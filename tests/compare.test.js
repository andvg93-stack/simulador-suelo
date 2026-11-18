import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/constants.js';
import { buildScenarioSeries, freezeBFromAWeek1, resetBState } from '../src/sim-utils.js';

test('freezeBFromAWeek1 stores snapshot and recomputes a full 0-12 series', () => {
  const frozen = freezeBFromAWeek1({ ...DEFAULTS, pH: 6.2, rainfall: 55 }, 1, '2026-03-02T12:00:00.000Z');

  assert.equal(frozen.locked, true);
  assert.equal(frozen.snapshotParamsWeek1.pH, 6.2);
  assert.equal(frozen.snapshotParamsWeek1.rainfall, 55);
  assert.equal(frozen.results.length, 13);
  assert.equal(frozen.results.at(-1).week, 12);
  assert.equal(frozen.lockedMeta.summary.permeability, frozen.snapshotParamsWeek1.permeability);
});

test('scenario B remains unchanged after scenario A parameters are modified post-freeze', () => {
  const frozen = freezeBFromAWeek1(DEFAULTS, 1, '2026-03-02T12:00:00.000Z');
  const deepBefore = frozen.results.map((week) => Number(week.deepConc.toFixed(5)));

  buildScenarioSeries({ ...DEFAULTS, pH: 4.6, rainfall: 110, permeability: 'High' });

  const deepAfter = frozen.results.map((week) => Number(week.deepConc.toFixed(5)));
  assert.deepEqual(deepAfter, deepBefore);
});

test('resetBState clears snapshot and lock flag', () => {
  const reset = resetBState();

  assert.equal(reset.locked, false);
  assert.equal(reset.snapshotParamsWeek1, null);
  assert.equal(reset.lockedMeta, null);
  assert.deepEqual(reset.results, []);
});
