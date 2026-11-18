import { DEFAULTS } from './constants.js';
import { explainChanges, getIndicators, getValidatedParams, initialState, runSimulation, simulateWeek } from './model.js';

const i18n = {
  en: {
    appTitle: 'Soil Contamination Simulator (Cd)',
    appSubtitle: 'Explore how pH, texture, organic matter, and water control contaminant mobility.',
    controlsTitle: 'Controls',
    spanishToggleLabel: 'Spanish',
    soilGroupTitle: 'Soil',
    textureLabel: 'Texture',
    organicMatterLabel: 'Organic Matter (%)',
    pHLabel: 'pH',
    cecLabel: 'CEC (cmol(+)/kg)',
    advancedModeLabel: 'Advanced Mode (manual CEC)',
    hydrologyGroupTitle: 'Hydrology',
    rainfallLabel: 'Rainfall/Irrigation (mm/week)',
    permeabilityLabel: 'Permeability',
    groundwaterDepthLabel: 'Groundwater depth (m)',
    contaminationGroupTitle: 'Contamination',
    initialConcentrationLabel: 'Initial concentration (mg/kg)',
    contaminatedDepthLabel: 'Contaminated depth',
    interventionsGroupTitle: 'Interventions',
    interventionLabel: 'Intervention',
    limeDoseLabel: 'Lime dose',
    biocharDoseLabel: 'Biochar/Compost dose',
    runBtn: 'Run Simulation',
    stepBtn: 'Step Forward',
    resetBtn: 'Reset',
    exportBtn: 'Export Results',
    vizTitle: '2D Soil Visualization',
    resultsTitle: 'Results',
    mobilityText: 'Mobility',
    bioavailabilityText: 'Bioavailability',
    groundwaterRiskText: 'Groundwater Risk',
    explanationTitle: 'Auto-Explanation',
    levels: { low: 'Low', medium: 'Medium', high: 'High' },
    concSurface: 'Surface concentration (mg/kg)',
    concDeep: 'Deep concentration (mg/kg)',
    fracDis: 'Dissolved %',
    fracAds: 'Adsorbed %',
    fracImm: 'Immobilized %',
    groundwaterLabel: 'Groundwater',
    week: 'Week',
    surfaceCd: 'Surface Cd',
    deepCd: 'Deep Cd',
  },
  es: {
    appTitle: 'Simulador de Contaminación del Suelo (Cd)',
    appSubtitle: 'Explora cómo el pH, la textura, la materia orgánica y el agua controlan la movilidad del contaminante.',
    controlsTitle: 'Controles',
    spanishToggleLabel: 'Español',
    soilGroupTitle: 'Suelo',
    textureLabel: 'Textura',
    organicMatterLabel: 'Materia orgánica (%)',
    pHLabel: 'pH',
    cecLabel: 'CIC (cmol(+)/kg)',
    advancedModeLabel: 'Modo avanzado (CIC manual)',
    hydrologyGroupTitle: 'Hidrología',
    rainfallLabel: 'Lluvia/Riego (mm/semana)',
    permeabilityLabel: 'Permeabilidad',
    groundwaterDepthLabel: 'Profundidad del agua subterránea (m)',
    contaminationGroupTitle: 'Contaminación',
    initialConcentrationLabel: 'Concentración inicial (mg/kg)',
    contaminatedDepthLabel: 'Profundidad contaminada',
    interventionsGroupTitle: 'Intervenciones',
    interventionLabel: 'Intervención',
    limeDoseLabel: 'Dosis de cal',
    biocharDoseLabel: 'Dosis de biochar/compost',
    runBtn: 'Ejecutar simulación',
    stepBtn: 'Avanzar 1 semana',
    resetBtn: 'Reiniciar',
    exportBtn: 'Exportar resultados',
    vizTitle: 'Visualización 2D del suelo',
    resultsTitle: 'Resultados',
    mobilityText: 'Movilidad',
    bioavailabilityText: 'Bioaccesibilidad',
    groundwaterRiskText: 'Riesgo de agua subterránea',
    explanationTitle: 'Autoexplicación',
    levels: { low: 'Bajo', medium: 'Medio', high: 'Alto' },
    concSurface: 'Concentración superficial (mg/kg)',
    concDeep: 'Concentración profunda (mg/kg)',
    fracDis: 'Disuelto %',
    fracAds: 'Adsorbido %',
    fracImm: 'Inmovilizado %',
    groundwaterLabel: 'Agua subterránea',
    week: 'Semana',
    surfaceCd: 'Cd superficial',
    deepCd: 'Cd profundo',
  },
};

let language = 'en';

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
    { label: i18n.en.concSurface, data: [currentParams.initialConcentration], borderColor: '#1f77b4' },
    { label: i18n.en.concDeep, data: [currentParams.initialConcentration * 0.05], borderColor: '#d62728' },
  ] },
});

const fractionChart = new Chart(fractionCtx, {
  type: 'bar',
  data: { labels: [0], datasets: [
    { label: i18n.en.fracDis, data: [states[0].fractions.dissolved * 100], backgroundColor: '#6baed6', stack: 'frac' },
    { label: i18n.en.fracAds, data: [states[0].fractions.adsorbed * 100], backgroundColor: '#74c476', stack: 'frac' },
    { label: i18n.en.fracImm, data: [states[0].fractions.immobilized * 100], backgroundColor: '#fd8d3c', stack: 'frac' },
  ] },
  options: { scales: { x: { stacked: true }, y: { stacked: true, max: 100 } } },
});

function localizeStaticText() {
  const t = i18n[language];
  Object.keys(t).forEach((key) => {
    if (typeof t[key] !== 'string') return;
    const node = document.getElementById(key);
    if (node) node.textContent = t[key];
  });

  el.texture.options[0].text = language === 'es' ? 'Arenoso' : 'Sandy';
  el.texture.options[1].text = language === 'es' ? 'Franco' : 'Loam';
  el.texture.options[2].text = language === 'es' ? 'Arcilloso' : 'Clay';

  el.permeability.options[0].text = language === 'es' ? 'Baja' : 'Low';
  el.permeability.options[1].text = language === 'es' ? 'Media' : 'Medium';
  el.permeability.options[2].text = language === 'es' ? 'Alta' : 'High';

  el.contaminatedDepth.options[0].text = language === 'es' ? '0–20 cm' : '0–20 cm';
  el.contaminatedDepth.options[1].text = language === 'es' ? '0–40 cm' : '0–40 cm';

  el.intervention.options[0].text = language === 'es' ? 'Ninguna' : 'None';
  el.intervention.options[1].text = language === 'es' ? 'Cal' : 'Lime';
  el.intervention.options[2].text = 'Biochar/Compost';
  el.intervention.options[3].text = language === 'es' ? 'Cobertura vegetal' : 'Vegetative cover';

  concChart.data.datasets[0].label = t.concSurface;
  concChart.data.datasets[1].label = t.concDeep;
  fractionChart.data.datasets[0].label = t.fracDis;
  fractionChart.data.datasets[1].label = t.fracAds;
  fractionChart.data.datasets[2].label = t.fracImm;
}

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

function setIndicator(nodeId, levelKey) {
  const node = document.getElementById(nodeId);
  node.classList.remove('low', 'medium', 'high');
  node.classList.add(levelKey);
  node.querySelector('strong').textContent = i18n[language].levels[levelKey];
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
  const bullets = explainChanges(prev, curr, currentParams, language);
  explanationList.innerHTML = bullets.map((text) => `<li>${text}</li>`).join('');
}

function drawSoil() {
  const state = states[states.length - 1];
  const t = i18n[language];
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
  soil.fillText(`${t.groundwaterLabel} (${currentParams.groundwaterDepth.toFixed(1)} m)`, 90, gwY - 8);

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
  soil.fillText(`${t.week} ${state.week}`, 20, 25);
  soil.fillText(`${t.surfaceCd}: ${state.surfaceConc.toFixed(1)} mg/kg`, 20, 42);
  soil.fillText(`${t.deepCd}: ${state.deepConc.toFixed(1)} mg/kg`, 20, 58);
}

function refreshAll() {
  currentParams = readControls();
  localizeStaticText();
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

document.getElementById('spanishToggle').addEventListener('change', (e) => {
  language = e.target.checked ? 'es' : 'en';
  refreshAll();
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
    language,
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
