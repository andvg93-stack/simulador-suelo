import test from 'node:test';
import assert from 'node:assert/strict';
import { getValidatedParams, partitionFractions, runSimulation, simulateWeek, initialState } from '../src/model.js';
import { DEFAULTS } from '../src/constants.js';

test('fractions sum to ~1', () => {
  const params = getValidatedParams(DEFAULTS);
  const frac = partitionFractions({ pH: params.pH }, params);
  assert.ok(Math.abs(frac.dissolved + frac.adsorbed + frac.immobilized - 1) < 1e-9);
});

test('increasing pH decreases dissolved fraction', () => {
  const low = getValidatedParams({ ...DEFAULTS, pH: 5 });
  const high = getValidatedParams({ ...DEFAULTS, pH: 7.5 });
  const lowFrac = partitionFractions({ pH: low.pH }, low);
  const highFrac = partitionFractions({ pH: high.pH }, high);
  assert.ok(highFrac.dissolved < lowFrac.dissolved);
});

test('increasing rainfall increases leaching during first week', () => {
  const dry = getValidatedParams({ ...DEFAULTS, rainfall: 10 });
  const wet = getValidatedParams({ ...DEFAULTS, rainfall: 100 });
  const s0Dry = initialState(dry);
  const s0Wet = initialState(wet);
  const s1Dry = simulateWeek(s0Dry, dry);
  const s1Wet = simulateWeek(s0Wet, wet);
  assert.ok(s1Wet.leached > s1Dry.leached);
});

test('runSimulation returns 12 weeks plus initial state by default', () => {
  const out = runSimulation(DEFAULTS);
  assert.equal(out.states.length, 13);
  assert.equal(out.states.at(-1).week, 12);
});
