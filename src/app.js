import { DEFAULTS } from './constants.js';
import { translations } from './i18n.js';
import { explainChanges, getIndicators, getValidatedParams, initialState, runSimulation, simulateWeek } from './model.js';
import { createCharts, markChartWeek, updateCharts } from './results-charts.js';
import { drawSoilProfile } from './soil-profile.js';

const byId = (id) => document.getElementById(id);
const parameterForm = byId('parameters');
const weekRange = byId('weekRange');
const soilCanvas = byId('soilCanvas');
const chartButtons = [...document.querySelectorAll('[data-chart]')];
const chartPanels = { concentration: byId('concPanel'), fractions: byId('fractionPanel') };
const controlIds = [
  'texture', 'organicMatter', 'pH', 'cec', 'advancedCEC', 'rainfall', 'permeability', 'groundwaterDepth',
  'initialConcentration', 'contaminatedDepth', 'intervention', 'limeDose', 'biocharDose',
];
const controls = Object.fromEntries(controlIds.map((id) => [id, byId(id)]));
const rangeIds = controlIds.filter((id) => controls[id].type === 'range');

let language = 'en';
let labels = translations[language];
let decimal = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
let measurement = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let params = getValidatedParams(DEFAULTS);
let history = [{ state: initialState(params), params }];
let selectedWeek = 0;

const charts = createCharts(DEFAULTS.durationWeeks);
if (!charts) {
  document.querySelectorAll('.chart-frame').forEach((frame) => { frame.hidden = true; });
  byId('chartUnavailable').hidden = false;
}

function readControls() {
  return getValidatedParams({
    texture: controls.texture.value,
    organicMatter: controls.organicMatter.valueAsNumber,
    pH: controls.pH.valueAsNumber,
    advancedCEC: controls.advancedCEC.checked,
    cecManual: controls.advancedCEC.checked && Number.isFinite(controls.cec.valueAsNumber)
      ? controls.cec.valueAsNumber
      : DEFAULTS.cecManual,
    rainfall: controls.rainfall.valueAsNumber,
    permeability: controls.permeability.value,
    groundwaterDepth: controls.groundwaterDepth.valueAsNumber,
    initialConcentration: controls.initialConcentration.valueAsNumber,
    contaminatedDepth: controls.contaminatedDepth.value,
    intervention: controls.intervention.value,
    limeDose: controls.limeDose.valueAsNumber,
    biocharDose: controls.biocharDose.valueAsNumber,
  });
}

function syncControlLabels(editingCEC = false) {
  for (const id of rangeIds) {
    byId(id + 'Val').value = decimal.format(controls[id].valueAsNumber);
  }
  controls.cec.disabled = !params.advancedCEC;
  if (!editingCEC) controls.cec.value = params.advancedCEC ? String(params.cec) : params.cec.toFixed(1);
  byId('limeDoseWrap').hidden = params.intervention !== 'Lime';
  byId('biocharDoseWrap').hidden = params.intervention !== 'BiocharCompost';

  const applied = history.at(-1).params;
  byId('scenarioPending').hidden = Object.keys(params).every((key) => params[key] === applied[key]);
}

function localize() {
  labels = translations[language];
  document.documentElement.lang = language;
  document.title = labels.documentTitle;
  decimal = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  measurement = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  document.querySelectorAll('[data-text]').forEach((node) => {
    node.textContent = labels[node.dataset.text];
  });
  document.querySelectorAll('[data-help]').forEach((node) => {
    node.title = labels.help[node.dataset.help];
  });
}

function renderProfile() {
  const frame = history[selectedWeek];
  // Parameter edits preview the geometry only while viewing the latest week.
  const profileParams = selectedWeek === history.length - 1 ? params : frame.params;
  byId('profileRain').textContent = decimal.format(profileParams.rainfall) + ' ' + labels.rainUnit;
  byId('profileDepth').textContent = '· ' + profileParams.contaminatedDepth.replace('-', '–') + ' cm';
  byId('profileWater').textContent = decimal.format(profileParams.groundwaterDepth) + ' m';
  byId('profileSurface').value = measurement.format(frame.state.surfaceConc);
  byId('profileDeep').value = measurement.format(frame.state.deepConc);
  drawSoilProfile(soilCanvas, frame.state, profileParams);
}

function renderSelectedWeek() {
  const { state, params: applied } = history[selectedWeek];
  const previous = history[selectedWeek - 1]?.state ?? state;
  const duration = params.durationWeeks;
  byId('weekLabel').value = labels.week + ' ' + state.week + ' / ' + duration;
  weekRange.value = state.week;
  weekRange.setAttribute('aria-valuetext', labels.week + ' ' + state.week + ' ' + labels.weekOf + ' ' + duration);

  const indicators = getIndicators(state);
  const levels = labels.feminineLevels ?? labels.levels;
  for (const [id, level, words] of [
    ['mobilityIndicator', indicators.mobility, levels],
    ['bioIndicator', indicators.bioavailability, levels],
    ['gwIndicator', indicators.groundwater, labels.levels],
  ]) {
    const indicator = byId(id);
    indicator.dataset.level = level;
    indicator.querySelector('strong').textContent = words[level];
  }

  for (const [key, fraction] of Object.entries(state.fractions)) {
    byId(key + 'Value').textContent = measurement.format(fraction * 100) + ' %';
  }
  const bullets = explainChanges(previous, state, applied, language).map((text) => {
    const bullet = document.createElement('li');
    bullet.textContent = text;
    return bullet;
  });
  byId('explanationList').replaceChildren(...bullets);

  markChartWeek(charts, selectedWeek);
  renderProfile();
}

function refreshHistory() {
  const latest = history.length - 1;
  const max = latest || params.durationWeeks;
  weekRange.max = max;
  weekRange.disabled = latest === 0;
  byId('stepBtn').disabled = latest >= params.durationWeeks;

  const count = Math.min(4, max);
  const ticks = Array.from({ length: count + 1 }, (_, index) => {
    const tick = document.createElement('span');
    const week = Math.round(index * max / count);
    tick.textContent = week;
    tick.style.left = (week / max * 100) + '%';
    return tick;
  });
  byId('timelineTicks').replaceChildren(...ticks);

  syncControlLabels();
  updateCharts(charts, history, labels, language);
  renderSelectedWeek();
}

parameterForm.addEventListener('submit', (event) => event.preventDefault());

parameterForm.addEventListener('input', (event) => {
  params = readControls();
  const editingCEC = event.target === controls.cec;
  if (history.length === 1) {
    history[0] = { state: initialState(params), params };
    updateCharts(charts, history, labels, language);
    renderSelectedWeek();
  } else {
    renderProfile();
  }
  syncControlLabels(editingCEC);
});

controls.cec.addEventListener('change', () => syncControlLabels());

byId('spanishToggle').addEventListener('change', (event) => {
  language = event.target.checked ? 'es' : 'en';
  localize();
  refreshHistory();
});

weekRange.addEventListener('input', () => {
  selectedWeek = weekRange.valueAsNumber;
  renderSelectedWeek();
});

chartButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const next = button.dataset.chart;
    chartButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    for (const [key, panel] of Object.entries(chartPanels)) panel.hidden = key !== next;
    charts?.[next].resize();
    charts?.[next].draw();
  });
});

byId('runBtn').addEventListener('click', () => {
  const run = runSimulation(readControls());
  params = run.params;
  history = run.states.map((state) => ({ state, params }));
  selectedWeek = history.length - 1;
  refreshHistory();
});

byId('stepBtn').addEventListener('click', () => {
  const { state } = history.at(-1);
  params = readControls();
  if (state.week >= params.durationWeeks) return;

  history.push({ state: simulateWeek(state, params), params });
  selectedWeek = history.length - 1;
  refreshHistory();
});

byId('resetBtn').addEventListener('click', () => {
  parameterForm.reset();
  params = getValidatedParams(DEFAULTS);
  history = [{ state: initialState(params), params }];
  selectedWeek = 0;
  refreshHistory();
});

byId('exportBtn').addEventListener('click', () => {
  const payload = { language, parameters: params, results: history.map(({ state }) => state) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cd-simulation-results.json';
  link.click();
  URL.revokeObjectURL(url);
});

localize();
refreshHistory();
new ResizeObserver(renderProfile).observe(soilCanvas);
