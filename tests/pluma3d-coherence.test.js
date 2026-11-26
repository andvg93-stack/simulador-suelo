import test from 'node:test';
import assert from 'node:assert/strict';
import { plumeState } from '../src/plume-model.js';
import { plumeShell, terrain } from '../src/plume-renderer.js';

test('the plume fits the soil volume and agrees with the reported reach and maximum depth', () => {
  for (const scenario of [
    plumeState({ week: 0 }),
    plumeState({ week: 24, concentration: 220, infiltration: 120, mobility: 1, groundwaterDepth: 1 }),
    plumeState({ week: 24, infiltration: 120, mobility: 1, biochar: true, vegetation: true, lime: true }),
  ]) {
    const outer = plumeShell(scenario, 0);
    const inner = plumeShell(scenario, .77);
    assert.ok([...outer, ...inner].every(({ x, y, z }) =>
      x >= 0 && x <= terrain.width && y >= 0 && y <= terrain.depth && z >= 0 && z <= terrain.breadth));
    const xs = outer.map(p => p.x);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - scenario.length) < 1e-6);
    assert.ok(Math.abs(Math.max(...outer.map(p => p.y)) - scenario.depth) < 1e-6);
  }
});

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
