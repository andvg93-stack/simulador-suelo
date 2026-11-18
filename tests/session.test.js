import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULTS } from '../src/constants.js';
import { getValidatedParams, initialState, simulateWeek } from '../src/model.js';
import { restoreSession, saveSession } from '../src/session.js';

test('restores a stepped simulation, pending parameters and the selected view', (t) => {
  let stored;
  const previous = globalThis.window;
  globalThis.window = {
    sessionStorage: {
      setItem: (_key, value) => { stored = value; },
      getItem: () => stored,
    },
  };
  t.after(() => { globalThis.window = previous; });

  const baseline = getValidatedParams(DEFAULTS);
  const lime = getValidatedParams({ ...DEFAULTS, rainfall: 70, intervention: 'Lime', limeDose: 3 });
  const next = getValidatedParams({ ...DEFAULTS, rainfall: 25 });
  const initial = initialState(baseline);
  const first = simulateWeek(initial, lime);
  const second = simulateWeek(first, next);
  const session = {
    params: getValidatedParams({ ...next, rainfall: 90 }),
    history: [
      { state: initial, params: baseline },
      { state: first, params: lime },
      { state: second, params: next },
    ],
    selectedWeek: 1,
    language: 'es',
    chart: 'fractions',
    groups: [true, true, false, false],
  };

  saveSession(session);
  assert.deepEqual(restoreSession(), session);
  stored = '{"timeline":[null]}';
  assert.equal(restoreSession(), null);
});
