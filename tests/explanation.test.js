import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/constants.js';
import {
  buildScenarioSeries,
  generateComparisonExplanation,
  generateExplanation,
} from '../src/sim-utils.js';

test('generateExplanation reacts to pH and hydrology conditions', () => {
  const scenario = buildScenarioSeries({
    ...DEFAULTS,
    pH: 4.8,
    rainfall: 110,
    permeability: 'High',
    groundwaterDepth: 1.5,
  });

  const bullets = generateExplanation(scenario.params, scenario.states[3], scenario.states[2], 'en');

  assert.ok(bullets.some((line) => line.includes('Low pH')));
  assert.ok(bullets.some((line) => line.includes('High water input')));
  assert.ok(bullets.some((line) => line.includes('Shallow groundwater')));
});

test('generateExplanation reflects higher pH narrative', () => {
  const scenario = buildScenarioSeries({ ...DEFAULTS, pH: 7.4, rainfall: 20, permeability: 'Low' });
  const bullets = generateExplanation(scenario.params, scenario.states[2], scenario.states[1], 'en');

  assert.ok(bullets.some((line) => line.includes('Higher pH')));
});

test('generateComparisonExplanation emits comparative narrative for A vs B', () => {
  const scenarioA = buildScenarioSeries({ ...DEFAULTS, pH: 4.9, rainfall: 95, permeability: 'High' });
  const scenarioB = buildScenarioSeries({ ...DEFAULTS, pH: 6.8, rainfall: 30, permeability: 'Low' });

  const lines = generateComparisonExplanation(
    scenarioA.states[6],
    scenarioB.states[6],
    scenarioA.params,
    scenarioB.params,
    'en',
  );

  assert.ok(lines.length >= 2 && lines.length <= 4);
  assert.ok(lines.some((line) => line.includes('Scenario A vs B')));
});
