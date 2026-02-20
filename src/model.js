import { DEFAULTS, TEXTURE_BASE_CEC, PERMEABILITY_FACTOR } from './constants.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function computeCEC(params) {
  const base = TEXTURE_BASE_CEC[params.texture] ?? TEXTURE_BASE_CEC.Loam;
  const omBonus = params.organicMatter * 0.9;
  return clamp(base + omBonus, 3, 45);
}

export function getValidatedParams(raw) {
  const texture = ['Sandy', 'Loam', 'Clay'].includes(raw.texture) ? raw.texture : DEFAULTS.texture;
  const permeability = ['Low', 'Medium', 'High'].includes(raw.permeability) ? raw.permeability : DEFAULTS.permeability;
  const intervention = ['None', 'Lime', 'BiocharCompost', 'VegetativeCover'].includes(raw.intervention)
    ? raw.intervention
    : DEFAULTS.intervention;

  const params = {
    ...DEFAULTS,
    ...raw,
    texture,
    permeability,
    intervention,
    organicMatter: clamp(Number(raw.organicMatter ?? DEFAULTS.organicMatter), 0, 10),
    pH: clamp(Number(raw.pH ?? DEFAULTS.pH), 4, 8.5),
    rainfall: clamp(Number(raw.rainfall ?? DEFAULTS.rainfall), 0, 120),
    groundwaterDepth: clamp(Number(raw.groundwaterDepth ?? DEFAULTS.groundwaterDepth), 0.5, 10),
    initialConcentration: clamp(Number(raw.initialConcentration ?? DEFAULTS.initialConcentration), 0, 200),
    limeDose: clamp(Number(raw.limeDose ?? DEFAULTS.limeDose), 0, 5),
    biocharDose: clamp(Number(raw.biocharDose ?? DEFAULTS.biocharDose), 0, 5),
    durationWeeks: clamp(Number(raw.durationWeeks ?? DEFAULTS.durationWeeks), 1, 52),
    cecManual: clamp(Number(raw.cecManual ?? DEFAULTS.cecManual), 1, 60),
  };

  params.cec = params.advancedCEC ? params.cecManual : computeCEC(params);
  return params;
}

export function partitionFractions(state, params) {
  const phEffect = clamp((6.5 - state.pH) * 0.09, -0.2, 0.28);
  const cecEffect = clamp((params.cec - 12) * 0.008, -0.08, 0.2);
  const omEffect = clamp((params.organicMatter - 3) * 0.015, -0.05, 0.1);
  const biocharEffect = params.intervention === 'BiocharCompost' ? params.biocharDose * 0.025 : 0;

  const dissolved = clamp(0.42 + phEffect - cecEffect - omEffect - biocharEffect, 0.05, 0.9);
  const adsorbedRaw = clamp(0.4 - phEffect + cecEffect + omEffect + biocharEffect, 0.05, 0.9);
  const immobilizedRaw = clamp(0.18 + (state.pH - 6) * 0.04 + cecEffect * 0.5, 0.03, 0.7);

  const sum = dissolved + adsorbedRaw + immobilizedRaw;
  return {
    dissolved: dissolved / sum,
    adsorbed: adsorbedRaw / sum,
    immobilized: immobilizedRaw / sum,
  };
}

export function simulateWeek(prev, params) {
  const next = { ...prev };

  if (params.intervention === 'Lime') {
    next.pH = clamp(next.pH + 0.03 + params.limeDose * 0.02, 4, 8.5);
  }

  const fractions = partitionFractions(next, params);
  const percolationFactor = PERMEABILITY_FACTOR[params.permeability] ?? 1;
  const leachingRate = clamp(0.005 + (params.rainfall / 120) * 0.06 * percolationFactor, 0.001, 0.12);

  const availableForLeach = next.surfaceConc * fractions.dissolved;
  const leached = clamp(availableForLeach * leachingRate, 0, next.surfaceConc);

  const attenuation = clamp(0.012 + fractions.immobilized * 0.03, 0, 0.08);
  const retainedInSurface = clamp(next.surfaceConc * attenuation, 0, next.surfaceConc - leached);

  next.surfaceConc = clamp(next.surfaceConc - leached - retainedInSurface, 0, 500);
  const deepGain = leached * (params.contaminatedDepth === '0-40' ? 0.7 : 0.9);
  const deepLoss = next.deepConc * clamp(0.01 * percolationFactor, 0.005, 0.04);
  next.deepConc = clamp(next.deepConc + deepGain - deepLoss, 0, 500);

  const mobilityScore = clamp(fractions.dissolved * 0.75 + leachingRate * 2.3, 0, 1);
  const bioavailabilityScore = clamp(fractions.dissolved * 0.65 + (6.8 - next.pH) * 0.08, 0, 1);
  const gwDepthFactor = clamp((4 - params.groundwaterDepth) / 4, 0, 1);
  const gwRiskScore = clamp(next.deepConc / 80 + mobilityScore * 0.4 + gwDepthFactor * 0.45, 0, 1.6);

  next.week += 1;
  next.fractions = fractions;
  next.mobilityScore = mobilityScore;
  next.bioavailabilityScore = bioavailabilityScore;
  next.gwRiskScore = gwRiskScore;
  next.leached = leached;

  return next;
}

function levelFromScore(score) {
  if (score < 0.33) return 'Low';
  if (score < 0.66) return 'Medium';
  return 'High';
}

export function getIndicators(state) {
  return {
    mobility: levelFromScore(state.mobilityScore ?? 0),
    bioavailability: levelFromScore(state.bioavailabilityScore ?? 0),
    groundwater: levelFromScore(clamp((state.gwRiskScore ?? 0) / 1.2, 0, 1)),
  };
}

export function initialState(params) {
  return {
    week: 0,
    pH: params.pH,
    surfaceConc: params.initialConcentration,
    deepConc: params.initialConcentration * 0.05,
    fractions: partitionFractions({ pH: params.pH }, params),
    mobilityScore: 0,
    bioavailabilityScore: 0,
    gwRiskScore: 0,
    leached: 0,
  };
}

export function runSimulation(rawParams) {
  const params = getValidatedParams(rawParams);
  const states = [initialState(params)];
  for (let i = 0; i < params.durationWeeks; i += 1) {
    states.push(simulateWeek(states[states.length - 1], params));
  }
  return { params, states };
}

export function explainChanges(prev, current, params) {
  const bullets = [];
  if (current.week === 0) {
    bullets.push('Week 0 baseline loaded. Adjust controls and run to explore outcomes.');
    return bullets;
  }
  if (current.surfaceConc < prev.surfaceConc) {
    bullets.push(`Surface concentration fell from ${prev.surfaceConc.toFixed(1)} to ${current.surfaceConc.toFixed(1)} mg/kg due to leaching and retention.`);
  }
  if (current.deepConc > prev.deepConc) {
    bullets.push(`Deep soil concentration increased to ${current.deepConc.toFixed(1)} mg/kg as dissolved Cd moved downward.`);
  }
  if (params.intervention === 'Lime') {
    bullets.push(`Lime dose raised pH to ${current.pH.toFixed(2)}, which reduced dissolved Cd and mobility.`);
  }
  if (params.intervention === 'BiocharCompost') {
    bullets.push('Biochar/compost increased adsorption capacity, shifting Cd from dissolved to adsorbed pools.');
  }
  if (params.intervention === 'VegetativeCover') {
    bullets.push('Vegetative cover reduces erosion risk, but leaching remains controlled mainly by water flow and permeability.');
  }
  bullets.push(`Trade-off: stronger immobilization lowers bioavailability but may leave a long-term residual contaminant stock in soil.`);

  return bullets.slice(0, 5);
}
