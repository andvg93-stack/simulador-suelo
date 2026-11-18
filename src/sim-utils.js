import { DEFAULTS, PERMEABILITY_FACTOR } from './constants.js';
import { getIndicators, getValidatedParams, runSimulation } from './model.js';

export function cloneParams(params) {
  return JSON.parse(JSON.stringify(params));
}

export function buildScenarioSeries(params) {
  const out = runSimulation(params);
  return {
    params: out.params,
    states: out.states,
  };
}

export function createStateA(params = DEFAULTS) {
  const built = buildScenarioSeries(params);
  return {
    params: built.params,
    results: built.states,
    currentWeek: 0,
    isPlaying: false,
  };
}

export function createStateB() {
  return {
    locked: false,
    snapshotParamsWeek1: null,
    lockedMeta: null,
    results: [],
    currentWeek: 0,
  };
}

export function freezeBFromAWeek1(paramsA, currentWeek = 1, capturedAt = new Date()) {
  const built = buildScenarioSeries(paramsA);
  const snapshot = cloneParams(built.params);
  const timestamp = capturedAt instanceof Date ? capturedAt.toISOString() : String(capturedAt);

  return {
    locked: true,
    snapshotParamsWeek1: snapshot,
    lockedMeta: {
      capturedAt: timestamp,
      summary: {
        pH: snapshot.pH,
        organicMatter: snapshot.organicMatter,
        rainfall: snapshot.rainfall,
        permeability: snapshot.permeability,
      },
    },
    results: built.states,
    currentWeek: Math.max(0, Math.min(snapshot.durationWeeks ?? 12, currentWeek)),
  };
}

export function resetBState() {
  return createStateB();
}

export function getWeekState(states, week) {
  if (!Array.isArray(states) || states.length === 0) return null;
  const idx = Math.max(0, Math.min(states.length - 1, Number(week) || 0));
  return states[idx];
}

const I18N = {
  en: {
    perm: { Low: 'Low', Medium: 'Medium', High: 'High' },
    level: { Low: 'Low', Medium: 'Medium', High: 'High' },
    processName: {
      dissolved: 'Dissolved',
      adsorbed: 'Adsorbed',
      immobilized: 'Immobilized',
    },
    processNote: {
      dissolved: 'Higher immediate mobility and leaching potential.',
      adsorbed: 'Retained on soil surfaces with slower transport.',
      immobilized: 'Lower immediate bioavailability with residual stock.',
    },
    explanation: {
      baseline1: 'Week 0 baseline loaded. Adjust parameters to inspect process shifts.',
      baseline2: 'Use play or step to explore weekly transitions.',
      weekDominant: (week, label, pct) => `Week ${week}: ${label} dominates at ${pct}% and drives observed behavior.`,
      lowPh: 'Low pH keeps Cd more soluble, which tends to increase mobility and plant exposure.',
      highPh: 'Higher pH favors sorption-immobilization and reduces dissolved Cd.',
      highRetention: 'High retention capacity (OM-CEC) shifts Cd away from dissolved forms.',
      highFlow: 'High water input with permeability accelerates vertical transport.',
      lowFlow: 'Limited water flux keeps percolation and deep transfer lower.',
      shallowGw: 'Shallow groundwater raises vulnerability when deep concentration grows.',
      deepRise: (a, b) => `Deep concentration increased (${a.toFixed(1)} -> ${b.toFixed(1)} mg/kg).`,
      tradeoff: (note) => `Trade-off: ${note}`,
      compareNoLock1: 'Scenario B is not locked yet.',
      compareNoLock2: 'Freeze B at Week 1 to create a stable benchmark.',
      compareClose: 'Scenario A vs B: concentrations remain close for the selected week.',
      compareAHigh: (d, w) => `Scenario A vs B: A has +${d.toFixed(1)} mg/kg deeper Cd than B at week ${w}.`,
      compareBHigh: (d, w) => `Scenario A vs B: B has +${Math.abs(d).toFixed(1)} mg/kg deeper Cd than A at week ${w}.`,
      domShift: (a, b) => `Dominant process changed: A=${a}, B=${b}.`,
      domSame: (a) => `Both scenarios are ${a.toLowerCase()} dominated in this week.`,
      riskContrast: (a, b) => `Groundwater risk contrast: A=${a}, B=${b}.`,
      controlsDiff: 'Differences reflect modified controls in A while B remains locked to Week 1 conditions.',
      controlsSame: 'B acts as a frozen benchmark for sensitivity analysis.',
      fallback: 'System near baseline: parameter effects are modest at this week.',
    },
    lock: {
      unlocked: 'B unlocked',
      locked: (time, s) => `B locked to Week 1 conditions | ${time} | pH ${Number(s.pH).toFixed(1)}, OM ${Number(s.organicMatter).toFixed(1)}%, Rain ${Number(s.rainfall).toFixed(0)} mm/week, Perm ${s.permeability}`,
    },
  },
  es: {
    perm: { Low: 'Baja', Medium: 'Media', High: 'Alta' },
    level: { Low: 'Bajo', Medium: 'Medio', High: 'Alto' },
    processName: {
      dissolved: 'Disuelto',
      adsorbed: 'Adsorbido',
      immobilized: 'Inmovilizado',
    },
    processNote: {
      dissolved: 'Mayor movilidad inmediata y potencial de lixiviacion.',
      adsorbed: 'Retenido en superficies del suelo con transporte mas lento.',
      immobilized: 'Menor biodisponibilidad inmediata con stock residual.',
    },
    explanation: {
      baseline1: 'Linea base de semana 0 cargada. Ajusta parametros para ver cambios de proceso.',
      baseline2: 'Usa correr o paso para explorar transiciones semanales.',
      weekDominant: (week, label, pct) => `Semana ${week}: domina ${label} con ${pct}% y define el comportamiento observado.`,
      lowPh: 'pH bajo mantiene Cd mas soluble, aumentando movilidad y exposicion de plantas.',
      highPh: 'pH alto favorece sorcion-inmovilizacion y reduce Cd disuelto.',
      highRetention: 'Alta capacidad de retencion (MO-CEC) desplaza Cd fuera de la fase disuelta.',
      highFlow: 'Alta entrada de agua con permeabilidad acelera transporte vertical.',
      lowFlow: 'Flujo de agua limitado reduce percolacion y transferencia profunda.',
      shallowGw: 'Agua subterranea somera aumenta vulnerabilidad cuando sube la concentracion profunda.',
      deepRise: (a, b) => `La concentracion profunda aumento (${a.toFixed(1)} -> ${b.toFixed(1)} mg/kg).`,
      tradeoff: (note) => `Compromiso: ${note}`,
      compareNoLock1: 'El escenario B aun no esta bloqueado.',
      compareNoLock2: 'Congela B en semana 1 para crear referencia estable.',
      compareClose: 'Escenario A vs B: las concentraciones son similares en la semana seleccionada.',
      compareAHigh: (d, w) => `Escenario A vs B: A tiene +${d.toFixed(1)} mg/kg de Cd profundo frente a B en semana ${w}.`,
      compareBHigh: (d, w) => `Escenario A vs B: B tiene +${Math.abs(d).toFixed(1)} mg/kg de Cd profundo frente a A en semana ${w}.`,
      domShift: (a, b) => `Cambio de proceso dominante: A=${a}, B=${b}.`,
      domSame: (a) => `Ambos escenarios estan dominados por ${a.toLowerCase()} en esta semana.`,
      riskContrast: (a, b) => `Contraste de riesgo de acuifero: A=${a}, B=${b}.`,
      controlsDiff: 'Las diferencias reflejan cambios de controles en A mientras B permanece bloqueado en Semana 1.',
      controlsSame: 'B funciona como referencia congelada para analisis de sensibilidad.',
      fallback: 'Sistema cerca de linea base: los efectos de parametros son modestos en esta semana.',
    },
    lock: {
      unlocked: 'B desbloqueado',
      locked: (time, s) => `B bloqueado a condiciones de Semana 1 | ${time} | pH ${Number(s.pH).toFixed(1)}, MO ${Number(s.organicMatter).toFixed(1)}%, Lluvia ${Number(s.rainfall).toFixed(0)} mm/semana, Perm ${s.permeability}`,
    },
  },
};

function langDict(lang) {
  return I18N[lang] ?? I18N.es;
}

export function getDominantProcess(fractions = {}, lang = 'es') {
  const entries = [
    ['dissolved', Number(fractions.dissolved ?? 0)],
    ['adsorbed', Number(fractions.adsorbed ?? 0)],
    ['immobilized', Number(fractions.immobilized ?? 0)],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const [key, value] = entries[0];

  const dict = langDict(lang);
  return {
    key,
    label: dict.processName[key],
    note: dict.processNote[key],
    percent: (value * 100).toFixed(1),
  };
}

function clampLines(lines, lang = 'es') {
  const clean = lines.filter(Boolean);
  const dict = langDict(lang);
  if (clean.length < 2) {
    clean.push(dict.explanation.fallback);
  }
  if (clean.length < 3) {
    clean.push(dict.explanation.tradeoff(lang === 'es' ? 'reducir Cd disuelto puede dejar stock residual a largo plazo.' : 'reducing dissolved Cd can leave long-term residual stock.'));
  }
  return clean.slice(0, 4);
}

export function generateExplanation(paramsRaw, outputWeek, prevWeek, lang = 'es') {
  const dict = langDict(lang);
  if (!outputWeek) {
    return [dict.explanation.baseline1, dict.explanation.baseline2];
  }

  const params = getValidatedParams(paramsRaw);
  const lines = [];
  const dominant = getDominantProcess(outputWeek.fractions, lang);
  const flowIndex = params.rainfall * (PERMEABILITY_FACTOR[params.permeability] ?? 1);

  lines.push(dict.explanation.weekDominant(outputWeek.week, dominant.label, dominant.percent));

  if (params.pH < 5.8) {
    lines.push(dict.explanation.lowPh);
  } else if (params.pH > 7) {
    lines.push(dict.explanation.highPh);
  }

  if (params.organicMatter >= 5 || params.cec >= 20) {
    lines.push(dict.explanation.highRetention);
  }

  if (flowIndex >= 70) {
    lines.push(dict.explanation.highFlow);
  } else if (flowIndex <= 25) {
    lines.push(dict.explanation.lowFlow);
  }

  if (params.groundwaterDepth < 2.5) {
    lines.push(dict.explanation.shallowGw);
  }

  if (prevWeek && outputWeek.deepConc > prevWeek.deepConc + 0.2) {
    lines.push(dict.explanation.deepRise(prevWeek.deepConc, outputWeek.deepConc));
  }

  lines.push(dict.explanation.tradeoff(dominant.note));
  return clampLines(lines, lang);
}

export function generateComparisonExplanation(weekA, weekB, paramsA, paramsB, lang = 'es') {
  const dict = langDict(lang);
  if (!weekA || !weekB) {
    return [dict.explanation.compareNoLock1, dict.explanation.compareNoLock2];
  }

  const lines = [];
  const dSurface = weekA.surfaceConc - weekB.surfaceConc;
  const dDeep = weekA.deepConc - weekB.deepConc;
  const domA = getDominantProcess(weekA.fractions, lang);
  const domB = getDominantProcess(weekB.fractions, lang);
  const indicatorA = getIndicators(weekA).groundwater;
  const indicatorB = getIndicators(weekB).groundwater;
  const riskA = dict.level[indicatorA] ?? indicatorA;
  const riskB = dict.level[indicatorB] ?? indicatorB;

  if (Math.abs(dDeep) < 0.2 && Math.abs(dSurface) < 0.2) {
    lines.push(dict.explanation.compareClose);
  } else if (dDeep > 0) {
    lines.push(dict.explanation.compareAHigh(dDeep, weekA.week));
  } else {
    lines.push(dict.explanation.compareBHigh(dDeep, weekA.week));
  }

  if (domA.key !== domB.key) {
    lines.push(dict.explanation.domShift(domA.label, domB.label));
  } else {
    lines.push(dict.explanation.domSame(domA.label));
  }

  if (riskA !== riskB) {
    lines.push(dict.explanation.riskContrast(riskA, riskB));
  }

  if (paramsA && paramsB && (paramsA.rainfall !== paramsB.rainfall || paramsA.permeability !== paramsB.permeability || paramsA.pH !== paramsB.pH)) {
    lines.push(dict.explanation.controlsDiff);
  } else {
    lines.push(dict.explanation.controlsSame);
  }

  return clampLines(lines, lang);
}

export function formatLockSummary(lockedMeta, lang = 'es') {
  const dict = langDict(lang);
  if (!lockedMeta || !lockedMeta.summary) {
    return dict.lock.unlocked;
  }

  const when = new Date(lockedMeta.capturedAt);
  const timeText = Number.isNaN(when.getTime()) ? String(lockedMeta.capturedAt) : when.toLocaleString();
  const translated = {
    ...lockedMeta.summary,
    permeability: dict.perm[lockedMeta.summary.permeability] ?? lockedMeta.summary.permeability,
  };
  return dict.lock.locked(timeText, translated);
}
