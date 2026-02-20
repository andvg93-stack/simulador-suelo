import { DEFAULTS } from './constants.js';
import { explainChanges, getIndicators, getValidatedParams, initialState, runSimulation, simulateWeek } from './model.js';

const ids = [
  'texture', 'organicMatter', 'pH', 'cec', 'advancedCEC', 'rainfall', 'permeability', 'groundwaterDepth',
  'initialConcentration', 'contaminatedDepth', 'intervention', 'limeDose', 'biocharDose',
];

const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const labelIds = ['organicMatter', 'pH', 'rainfall', 'groundwaterDepth', 'initialConcentration', 'limeDose', 'biocharDose'];
const labels = Object.fromEntries(labelIds.map((id) => [id, document.getElementById(`${id}Val`)]));
const explanationList = document.getElementById('explanationList');

let currentParams = getValidatedParams(DEFAULTS);
let states = [initialState(currentParams)];

const concCtx = document.getElementById('concChart');
const fractionCtx = document.getElementById('fractionChart');
const soilCanvas = document.getElementById('soilCanvas');
const soil = soilCanvas.getContext('2d');

const concChart = new Chart(concCtx, {
  type: 'line',
  data: { labels: [0], datasets: [
    { label: 'Surface concentration (mg/kg)', data: [currentParams.initialConcentration], borderColor: '#1f77b4' },
    { label: 'Deep concentration (mg/kg)', data: [currentParams.initialConcentration * 0.05], borderColor: '#d62728' },
  ] },
});

const fractionChart = new Chart(fractionCtx, {
  type: 'bar',
  data: { labels: [0], datasets: [
    { label: 'Dissolved %', data: [states[0].fractions.dissolved * 100], backgroundColor: '#6baed6', stack: 'frac' },
    { label: 'Adsorbed %', data: [states[0].fractions.adsorbed * 100], backgroundColor: '#74c476', stack: 'frac' },
    { label: 'Immobilized %', data: [states[0].fractions.immobilized * 100], backgroundColor: '#fd8d3c', stack: 'frac' },
  ] },
  options: { scales: { x: { stacked: true }, y: { stacked: true, max: 100 } } },
});

function readControls() {
  return getValidatedParams({
    texture: el.texture.value,
    organicMatter: Number(el.organicMatter.value),
    pH: Number(el.pH.value),
    advancedCEC: el.advancedCEC.checked,
    cecManual: Number(el.cec.value),
    rainfall: Number(el.rainfall.value),
    permeability: el.permeability.value,
    groundwaterDepth: Number(el.groundwaterDepth.value),
    initialConcentration: Number(el.initialConcentration.value),
    contaminatedDepth: el.contaminatedDepth.value,
    intervention: el.intervention.value,
    limeDose: Number(el.limeDose.value),
    biocharDose: Number(el.biocharDose.value),
    durationWeeks: DEFAULTS.durationWeeks,
  });
}

function syncControlLabels(params) {
  labelIds.forEach((id) => {
    labels[id].textContent = el[id].value;
  });
  el.cec.value = params.cec.toFixed(1);
  el.cec.disabled = !el.advancedCEC.checked;
  document.getElementById('limeDoseWrap').style.display = params.intervention === 'Lime' ? 'flex' : 'none';
  document.getElementById('biocharDoseWrap').style.display = params.intervention === 'BiocharCompost' ? 'flex' : 'none';
}

function setIndicator(nodeId, label) {
  const node = document.getElementById(nodeId);
  node.classList.remove('low', 'medium', 'high');
  node.classList.add(label.toLowerCase());
  node.querySelector('strong').textContent = label;
}

function renderIndicators(state) {
  const indicators = getIndicators(state);
  setIndicator('mobilityIndicator', indicators.mobility);
  setIndicator('bioIndicator', indicators.bioavailability);
  setIndicator('gwIndicator', indicators.groundwater);
}

function renderCharts() {
  const weeks = states.map((s) => s.week);
  concChart.data.labels = weeks;
  concChart.data.datasets[0].data = states.map((s) => s.surfaceConc.toFixed(2));
  concChart.data.datasets[1].data = states.map((s) => s.deepConc.toFixed(2));
  concChart.update();

  fractionChart.data.labels = weeks;
  fractionChart.data.datasets[0].data = states.map((s) => (s.fractions.dissolved * 100).toFixed(1));
  fractionChart.data.datasets[1].data = states.map((s) => (s.fractions.adsorbed * 100).toFixed(1));
  fractionChart.data.datasets[2].data = states.map((s) => (s.fractions.immobilized * 100).toFixed(1));
  fractionChart.update();
}

function renderExplanation() {
  const curr = states[states.length - 1];
  const prev = states[states.length - 2] ?? curr;
  const bullets = explainChanges(prev, curr, currentParams);
  explanationList.innerHTML = bullets.map((text) => `<li>${text}</li>`).join('');
}

function drawSoil() {
  const state = states[states.length - 1];
  soil.clearRect(0, 0, soilCanvas.width, soilCanvas.height);

  const topY = 70;
  const soilBottom = 480;
  const contaminatedDepthPx = currentParams.contaminatedDepth === '0-40' ? 180 : 110;
  const gwY = topY + ((currentParams.groundwaterDepth - 0.5) / 9.5) * (soilBottom - topY);

  soil.fillStyle = '#d2b48c';
  soil.fillRect(80, topY, 300, soilBottom - topY);

  soil.fillStyle = '#c79e6d';
  soil.fillRect(80, topY, 300, contaminatedDepthPx);

  const grad = soil.createLinearGradient(80, topY, 80, topY + contaminatedDepthPx + 140);
  const intensity = Math.min(1, state.surfaceConc / 120);
  grad.addColorStop(0, `rgba(180, 30, 30, ${0.75 * intensity + 0.1})`);
  grad.addColorStop(1, `rgba(180, 30, 30, ${Math.min(0.5, state.deepConc / 100)})`);
  soil.fillStyle = grad;
  soil.fillRect(80, topY, 300, Math.min(soilBottom - topY, contaminatedDepthPx + 140));

  soil.strokeStyle = '#0055aa';
  soil.setLineDash([6, 4]);
  soil.beginPath();
  soil.moveTo(70, gwY);
  soil.lineTo(390, gwY);
  soil.stroke();
  soil.setLineDash([]);
  soil.fillStyle = '#0055aa';
  soil.fillText(`Groundwater (${currentParams.groundwaterDepth.toFixed(1)} m)`, 90, gwY - 8);

  const arrowCount = Math.round((currentParams.rainfall / 120) * 7 + ({ Low: 1, Medium: 2, High: 3 }[currentParams.permeability] ?? 2));
  soil.strokeStyle = '#203040';
  for (let i = 0; i < arrowCount; i += 1) {
    const x = 100 + i * (260 / Math.max(1, arrowCount - 1));
    soil.beginPath();
    soil.moveTo(x, topY + 5);
    soil.lineTo(x, topY + 45);
    soil.lineTo(x - 4, topY + 37);
    soil.moveTo(x, topY + 45);
    soil.lineTo(x + 4, topY + 37);
    soil.stroke();
  }

  soil.fillStyle = '#222';
  soil.fillText(`Week ${state.week}`, 20, 25);
  soil.fillText(`Surface Cd: ${state.surfaceConc.toFixed(1)} mg/kg`, 20, 42);
  soil.fillText(`Deep Cd: ${state.deepConc.toFixed(1)} mg/kg`, 20, 58);
}

function refreshAll() {
  currentParams = readControls();
  syncControlLabels(currentParams);
  renderIndicators(states[states.length - 1]);
  renderCharts();
  renderExplanation();
  drawSoil();
}

ids.forEach((id) => {
  el[id].addEventListener('input', () => {
    currentParams = readControls();
    syncControlLabels(currentParams);
    drawSoil();
  });
});

document.getElementById('runBtn').addEventListener('click', () => {
  currentParams = readControls();
  states = runSimulation(currentParams).states;
  refreshAll();
});

document.getElementById('stepBtn').addEventListener('click', () => {
  currentParams = readControls();
  if (states[states.length - 1].week >= currentParams.durationWeeks) return;
  states.push(simulateWeek(states[states.length - 1], currentParams));
  refreshAll();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    if (!el[key]) return;
    if (el[key].type === 'checkbox') {
      el[key].checked = Boolean(value);
    } else {
      el[key].value = value;
    }
  });
  currentParams = getValidatedParams(DEFAULTS);
  states = [initialState(currentParams)];
  refreshAll();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = {
    parameters: currentParams,
    results: states,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cd-simulation-results.json';
  a.click();
  URL.revokeObjectURL(url);
});

refreshAll();
