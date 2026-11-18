import test from 'node:test';
import assert from 'node:assert/strict';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function plumeState({
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
  const depth = 0.28 + growth * (0.55 + transport * 2.1);
  const intensity = clamp(concentration / 180, 0.12, 1.25);
  const groundwaterGap = groundwaterDepth - depth;
  const proximity = clamp(depth / groundwaterDepth, 0, 1.25);
  const remediationProtection = (biochar ? 0.08 : 0) + (vegetation ? 0.07 : 0) + (lime ? 0.1 : 0);
  const contactPenalty = depth >= groundwaterDepth ? 0.22 : clamp((proximity - 0.75) / 0.25, 0, 1) * 0.12;
  const riskScore = clamp(proximity * 0.52 + transport * 0.28 + intensity * 0.12 + contactPenalty - remediationProtection * 0.55, 0, 1);
  const riskLevel = riskScore > 0.68 ? 'Alto' : riskScore > 0.42 ? 'Medio' : 'Bajo';

  return { depth, groundwaterGap, riskScore, riskLevel };
}

test('three remediation methods reduce risk but do not hide a plume close to groundwater', () => {
  const scenario = plumeState({
    week: 24,
    concentration: 220,
    infiltration: 120,
    mobility: 1,
    groundwaterDepth: 2.5,
    biochar: true,
    vegetation: true,
    lime: true,
  });

  assert.ok(scenario.depth > 1.7);
  assert.equal(scenario.riskLevel, 'Medio');
});

test('the same remediated plume can be low risk when groundwater is clearly deeper', () => {
  const shallowAquifer = plumeState({
    week: 24,
    concentration: 220,
    infiltration: 120,
    mobility: 1,
    groundwaterDepth: 2.5,
    biochar: true,
    vegetation: true,
    lime: true,
  });
  const deepAquifer = plumeState({
    week: 24,
    concentration: 220,
    infiltration: 120,
    mobility: 1,
    groundwaterDepth: 4,
    biochar: true,
    vegetation: true,
    lime: true,
  });

  assert.ok(deepAquifer.riskScore < shallowAquifer.riskScore);
  assert.equal(deepAquifer.riskLevel, 'Bajo');
});

test('direct or near contact with groundwater remains high risk in severe scenarios', () => {
  const scenario = plumeState({
    week: 24,
    concentration: 220,
    infiltration: 120,
    mobility: 1,
    groundwaterDepth: 1.8,
  });

  assert.ok(scenario.groundwaterGap <= 0);
  assert.equal(scenario.riskLevel, 'Alto');
});

test('combined remediation lowers risk relative to the same physical scenario without remediation', () => {
  const untreated = plumeState({ week: 16, concentration: 140, infiltration: 85, mobility: 0.75, groundwaterDepth: 2.4 });
  const treated = plumeState({
    week: 16,
    concentration: 140,
    infiltration: 85,
    mobility: 0.75,
    groundwaterDepth: 2.4,
    biochar: true,
    vegetation: true,
    lime: true,
  });

  assert.ok(treated.riskScore < untreated.riskScore);
  assert.ok(treated.depth < untreated.depth);
});
