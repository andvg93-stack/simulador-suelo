import test from 'node:test';
import assert from 'node:assert/strict';
import { plumeState } from '../src/plume-model.js';
import { groundwaterRiskColor } from '../src/plume-renderer.js';
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

test('sustained maximum transport reaches the deepest water table in the reported scenario', () => {
  const inputs = { concentration: 20, infiltration: 120, mobility: 1, groundwaterDepth: 4.5 };
  const depths = [0, 8, 16, 24].map(week => plumeState({ ...inputs, week }).depth);
  assert.ok(depths.slice(1).every((value, index) => value > depths[index]));
  const final = plumeState({ ...inputs, week: 24 });
  assert.ok(final.depth >= 4.5 && final.depth < terrain.depth);
  assert.ok(final.groundwaterGap <= 0);
  assert.equal(final.riskScore, 1);
  assert.ok(plumeState({ ...inputs, week: 24, infiltration: 40 }).depth < final.depth);
  assert.ok(plumeState({ ...inputs, week: 24, mobility: .4 }).depth < final.depth);

  const rgba = new Uint8ClampedArray(4);
  const field = createPlumeField(final);
  tracePlume(field, { x: field.min.x + .85 * final.length, y: 3.7, z: -1 }, { x: 0, y: 0, z: 1 }, rgba, 0);
  assert.ok(rgba[3] > 40, 'The rendered plume must be visible well below its previous depth');
});

test('groundwater color interpolates by score from blue to red', () => {
  assert.deepEqual(groundwaterRiskColor(0), [39, 139, 232]);
  assert.deepEqual(groundwaterRiskColor(1), [229, 55, 59]);
  const [red, green, blue] = groundwaterRiskColor(.60);
  assert.ok(blue > red && red > green, 'Intermediate water is violet');
  for (const boundary of [.38, .6, .8]) {
    const before = groundwaterRiskColor(boundary - .001);
    const after = groundwaterRiskColor(boundary + .001);
    assert.ok(before.every((channel, index) => Math.abs(channel - after[index]) <= 1));
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
