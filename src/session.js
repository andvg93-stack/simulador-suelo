import { DEFAULTS } from './constants.js';
import { getValidatedParams, initialState, simulateWeek } from './model.js';

const storageKey = 'cadmium-soil-simulator:v1';
const parameterTypes = Object.entries(DEFAULTS);

function restoreParameters(raw) {
  if (!raw || parameterTypes.some(([key, defaultValue]) =>
    typeof raw[key] !== typeof defaultValue ||
    (typeof defaultValue === 'number' && !Number.isFinite(raw[key]))
  )) throw new TypeError('Invalid simulation parameters');

  return getValidatedParams({ ...raw, durationWeeks: DEFAULTS.durationWeeks });
}

export function restoreSession() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey));
    const timeline = saved?.timeline;
    if (!Array.isArray(timeline) || timeline.length === 0 || timeline.length > DEFAULTS.durationWeeks + 1) return null;

    const history = [];
    for (const record of timeline) {
      const params = restoreParameters(record);
      const previous = history.at(-1)?.state;
      const state = previous ? simulateWeek(previous, params) : initialState(params);
      history.push({ state, params });
    }

    const latest = history.length - 1;
    return {
      params: restoreParameters(saved.params),
      history,
      selectedWeek: Number.isInteger(saved.selectedWeek) ? Math.max(0, Math.min(latest, saved.selectedWeek)) : latest,
      language: saved.language === 'es' || saved.language === 'en' ? saved.language : undefined,
      chart: saved.chart === 'fractions' ? 'fractions' : 'concentration',
      groups: Array.isArray(saved.groups) ? saved.groups.map((open) => open === true) : [],
    };
  } catch {
    return null;
  }
}

export function saveSession({ history, ...view }) {
  try {
    const timeline = history.map(({ params }) => params);
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...view, timeline }));
  } catch {
    // The simulator can still run when session storage is unavailable.
  }
}
