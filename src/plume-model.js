export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function plumeState({
  week = 8,
  concentration: baseConcentration = 90,
  infiltration: baseInfiltration = 55,
  mobility: baseMobility = 0.58,
  groundwaterDepth = 2.5,
  biochar = false,
  vegetation = false,
  lime = false,
} = {}) {
  const growth = 1 - Math.exp(-week / 8.2);
  const concentration = baseConcentration * (biochar ? 0.72 : 1);
  const infiltration = baseInfiltration * (vegetation ? 0.62 : 1);
  const mobilityFactor = (biochar ? 0.76 : 1) * (vegetation ? 0.9 : 1) * (lime ? 0.58 : 1);
  const mobility = clamp(baseMobility * mobilityFactor, 0.08, 1);
  const transport = (infiltration / 120) * 0.52 + mobility * 0.48;
  const length = 1.25 + growth * (2.4 + transport * 3.6);
  const depth = 0.28 + growth * (0.55 + transport * 2.1);
  const spread = 0.42 + growth * (0.45 + mobility * 0.82);
  const intensity = clamp(concentration / 180, 0.12, 1.25);
  const groundwaterGap = groundwaterDepth - depth;
  const proximity = clamp(depth / groundwaterDepth, 0, 1.25);
  const remediationProtection = (biochar ? 0.08 : 0) + (vegetation ? 0.07 : 0) + (lime ? 0.1 : 0);
  const contactPenalty = depth >= groundwaterDepth ? 0.22 : clamp((proximity - 0.75) / 0.25, 0, 1) * 0.12;
  const riskScore = clamp(proximity * 0.52 + transport * 0.28 + intensity * 0.12 + contactPenalty - remediationProtection * 0.55, 0, 1);
  const riskLevel = riskScore > 0.68 ? 'Alto' : riskScore > 0.42 ? 'Medio' : 'Bajo';

  return { length, depth, spread, intensity, concentration, infiltration, mobility, groundwaterDepth,
    groundwaterGap, riskScore, riskLevel, remedies: { biochar, vegetation, lime } };
}
