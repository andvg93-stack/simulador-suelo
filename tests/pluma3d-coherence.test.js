import test from 'node:test';
import assert from 'node:assert/strict';
import { plumeState } from '../src/plume-model.js';
import { createPlumeField, terrain, tracePlume } from '../src/plume-volume.js';

test('the plume fits the soil volume and agrees with the reported reach and maximum depth', () => {
  for (const scenario of [
    plumeState({ week: 0 }),
    plumeState({ week: 24, concentration: 220, infiltration: 120, mobility: 1, groundwaterDepth: 1 }),
    plumeState({ week: 24, infiltration: 120, mobility: 1, biochar: true, vegetation: true, lime: true }),
  ]) {
    const { min, max } = createPlumeField(scenario);
    assert.ok(min.x >= 0 && min.y >= 0 && min.z >= 0);
    assert.ok(max.x <= terrain.width && max.y <= terrain.depth && max.z <= terrain.breadth);
    assert.ok(Math.abs(max.x - min.x - scenario.length) < 1e-6);
    assert.equal(max.y, scenario.depth);
  }
});

test('the plume has optical density through its interior and stays transparent outside it', () => {
  const field = createPlumeField(plumeState({ week: 15 }));
  const section = Math.floor(field.samples.length / 8) * 4;
  const x = (field.min.x + field.max.x) / 2;
  const y = field.samples[section];
  const z = field.samples[section + 2];
  const rgba = (origin, direction) => {
    const result = new Uint8ClampedArray(4);
    tracePlume(field, origin, direction, result, 0);
    return result;
  };

  assert.ok(rgba({ x, y, z: -1 }, { x: 0, y: 0, z: 1 })[3] > 0);
  assert.ok(rgba({ x: -1, y, z }, { x: 1, y: 0, z: 0 })[3] > 0);
  assert.ok(rgba({ x, y: -1, z }, { x: 0, y: 1, z: 0 })[3] > 0);
  assert.equal(rgba({ x, y: field.max.y + .02, z: -1 }, { x: 0, y: 0, z: 1 })[3], 0);
  assert.equal(rgba({ x, y: -1, z: terrain.breadth - .01 }, { x: 0, y: 1, z: 0 })[3], 0);
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
