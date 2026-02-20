export const DEFAULTS = {
  texture: 'Loam',
  organicMatter: 3,
  pH: 5.5,
  advancedCEC: false,
  cecManual: 14,
  rainfall: 40,
  permeability: 'Medium',
  groundwaterDepth: 3,
  initialConcentration: 60,
  contaminatedDepth: '0-20',
  intervention: 'None',
  limeDose: 0,
  biocharDose: 0,
  durationWeeks: 12,
};

export const TEXTURE_BASE_CEC = {
  Sandy: 6,
  Loam: 14,
  Clay: 24,
};

export const PERMEABILITY_FACTOR = {
  Low: 0.6,
  Medium: 1,
  High: 1.5,
};
