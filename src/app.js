import { DEFAULTS, PERMEABILITY_FACTOR } from './constants.js';
import { getIndicators, getValidatedParams } from './model.js';
import {
  buildScenarioSeries,
  createStateA,
  createStateB,
  freezeBFromAWeek1,
  formatLockSummary,
  generateComparisonExplanation,
  generateExplanation,
  getDominantProcess,
  getWeekState,
  resetBState,
} from './sim-utils.js';

const CONTROL_IDS = [
  'texture',
  'organicMatter',
  'pH',
  'cec',
  'advancedCEC',
  'rainfall',
  'permeability',
  'groundwaterDepth',
  'initialConcentration',
  'contaminatedDepth',
  'intervention',
  'limeDose',
  'biocharDose',
];

const VALUE_IDS = ['organicMatter', 'pH', 'rainfall', 'groundwaterDepth', 'initialConcentration', 'limeDose', 'biocharDose'];

const controls = Object.fromEntries(CONTROL_IDS.map((id) => [id, document.getElementById(id)]));
const values = Object.fromEntries(VALUE_IDS.map((id) => [id, document.getElementById(`${id}Val`)]));

const languageToggle = document.getElementById('languageToggle');
const compareToggle = document.getElementById('compareToggle');
const freezeBBtn = document.getElementById('freezeBBtn');
const resetBBtn = document.getElementById('resetBBtn');
const bLockStatus = document.getElementById('bLockStatus');
const weekSlider = document.getElementById('weekSlider');
const weekLabel = document.getElementById('weekLabel');
const explanationList = document.getElementById('explanationList');

const profileATitle = document.getElementById('profileATitle');
const profileBTitle = document.getElementById('profileBTitle');

const profileACanvas = document.getElementById('soilCanvasA');
const profileBCanvas = document.getElementById('soilCanvasB');
const profileAContext = profileACanvas.getContext('2d');
const profileBContext = profileBCanvas.getContext('2d');

const INDICATOR_MAP = {
  mobility: ['kpiMobA', 'kpiMobB'],
  bioavailability: ['kpiBioA', 'kpiBioB'],
  groundwater: ['kpiGwA', 'kpiGwB'],
};

const LANG = {
  es: {
    axisWeek: 'Semana',
    axisConcentration: 'mg/kg',
    yPercent: '%',
    profileA: 'Escenario A',
    profileB: 'Escenario B (bloqueo semana 1)',
    week: 'Semana',
    surface: 'Superficie',
    deep: 'Profunda',
    dominant: 'Dominante',
    scenarioBUnlocked: 'Escenario B desbloqueado',
    freezeHint: 'Congela B en semana 1 para comparar',
    benchmarkHint: 'Referencia estable de comparacion',
    gw: 'AS',
    levels: { Low: 'Bajo', Medium: 'Medio', High: 'Alto', '-': '-' },
    concLabels: ['Superficie A', 'Profunda A', 'Superficie B', 'Profunda B'],
    fracLabels: ['Disuelto', 'Adsorbido', 'Inmovilizado'],
    fracXSingle: ['Escenario A'],
    fracXCompare: ['Escenario A', 'Escenario B'],
    tooltips: {
      texture: 'La textura controla sorcion y rutas de flujo.',
      organicMatter: 'Mayor materia organica suele fijar mas Cd.',
      pH: 'pH bajo aumenta la solubilidad y movilidad de Cd.',
      cec: 'CEC representa capacidad de intercambio y adsorcion.',
      advancedCEC: 'Permite definir CEC manualmente.',
      rainfall: 'Lluvia y riego impulsan la percolacion vertical.',
      permeability: 'Mayor permeabilidad acelera transporte hacia profundidad.',
      groundwaterDepth: 'Agua subterranea somera es mas vulnerable.',
      initialConcentration: 'La concentracion inicial define la masa contaminante base.',
      contaminatedDepth: 'Zona contaminada mas profunda aumenta transferencia al fondo.',
      intervention: 'Intervenciones modifican particion y movilidad del Cd.',
      limeDose: 'La cal eleva pH gradualmente.',
      biocharDose: 'Biochar/compost aumenta adsorcion.',
      compareToggle: 'Activa comparacion lado a lado A vs B.',
    },
  },
  en: {
    axisWeek: 'Week',
    axisConcentration: 'mg/kg',
    yPercent: '%',
    profileA: 'Scenario A',
    profileB: 'Scenario B (Week 1 lock)',
    week: 'Week',
    surface: 'Surface',
    deep: 'Deep',
    dominant: 'Dominant',
    scenarioBUnlocked: 'Scenario B unlocked',
    freezeHint: 'Freeze B at Week 1 to compare',
    benchmarkHint: 'Stable comparison benchmark',
    gw: 'GW',
    levels: { Low: 'Low', Medium: 'Medium', High: 'High', '-': '-' },
    concLabels: ['Surface A', 'Deep A', 'Surface B', 'Deep B'],
    fracLabels: ['Dissolved', 'Adsorbed', 'Immobilized'],
    fracXSingle: ['Scenario A'],
    fracXCompare: ['Scenario A', 'Scenario B'],
    tooltips: {
      texture: 'Texture controls sorption and flow pathways.',
      organicMatter: 'Higher organic matter usually binds more Cd.',
      pH: 'Lower pH increases Cd solubility and mobility.',
      cec: 'CEC indicates ion exchange and adsorption potential.',
      advancedCEC: 'Enable manual CEC override.',
      rainfall: 'Rainfall and irrigation drive vertical percolation.',
      permeability: 'Higher permeability accelerates downward transport.',
      groundwaterDepth: 'Shallow groundwater is more vulnerable.',
      initialConcentration: 'Initial concentration sets baseline contaminant mass.',
      contaminatedDepth: 'A deeper contaminated zone increases deep transfer.',
      intervention: 'Interventions modify Cd partitioning and mobility.',
      limeDose: 'Lime raises pH gradually.',
      biocharDose: 'Biochar-compost increases adsorption capacity.',
      compareToggle: 'Enable side-by-side A vs B comparison.',
    },
  },
};

let stateA = createStateA(DEFAULTS);
let stateB = createStateB();

const uiState = {
  compareEnabled: false,
  playIntervalMs: 700,
  lang: 'es',
};

let playHandle = null;
const soilOverlayImage = new Image();
soilOverlayImage.src = 'soil-cut-overlay.webp';
soilOverlayImage.addEventListener('load', () => {
  renderProfiles();
});

const concChart = new Chart(document.getElementById('concChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Surface A',
        data: [],
        borderColor: '#2468cc',
        backgroundColor: 'rgba(36, 104, 204, 0.12)',
        borderWidth: 2,
        tension: 0.24,
        pointRadius: (ctx) => (ctx.dataIndex === stateA.currentWeek ? 4 : 0),
      },
      {
        label: 'Deep A',
        data: [],
        borderColor: '#2468cc',
        borderDash: [7, 5],
        borderWidth: 2,
        tension: 0.24,
        pointRadius: (ctx) => (ctx.dataIndex === stateA.currentWeek ? 4 : 0),
      },
      {
        label: 'Surface B',
        data: [],
        borderColor: '#d8742a',
        backgroundColor: 'rgba(216, 116, 42, 0.12)',
        borderWidth: 2,
        tension: 0.24,
        pointRadius: (ctx) => (ctx.dataIndex === stateA.currentWeek ? 4 : 0),
      },
      {
        label: 'Deep B',
        data: [],
        borderColor: '#d8742a',
        borderDash: [7, 5],
        borderWidth: 2,
        tension: 0.24,
        pointRadius: (ctx) => (ctx.dataIndex === stateA.currentWeek ? 4 : 0),
      },
    ],
  },
  options: {
    maintainAspectRatio: false,
    animation: { duration: 240 },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 16 } },
    },
    scales: {
      y: { title: { display: true, text: 'mg/kg' } },
      x: { title: { display: true, text: 'Week' } },
    },
  },
});

const fractionChart = new Chart(document.getElementById('fractionChart'), {
  type: 'bar',
  data: {
    labels: [],
    datasets: [
      { label: 'Dissolved', data: [], backgroundColor: '#58a7d4', stack: 'fractions' },
      { label: 'Adsorbed', data: [], backgroundColor: '#5ea56d', stack: 'fractions' },
      { label: 'Immobilized', data: [], backgroundColor: '#de9854', stack: 'fractions' },
    ],
  },
  options: {
    maintainAspectRatio: false,
    animation: { duration: 240 },
    scales: {
      x: { stacked: true },
      y: { stacked: true, max: 100, title: { display: true, text: '%' } },
    },
  },
});

function dict() {
  return LANG[uiState.lang];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readControls() {
  return getValidatedParams({
    texture: controls.texture.value,
    organicMatter: Number(controls.organicMatter.value),
    pH: Number(controls.pH.value),
    advancedCEC: controls.advancedCEC.checked,
    cecManual: Number(controls.cec.value),
    rainfall: Number(controls.rainfall.value),
    permeability: controls.permeability.value,
    groundwaterDepth: Number(controls.groundwaterDepth.value),
    initialConcentration: Number(controls.initialConcentration.value),
    contaminatedDepth: controls.contaminatedDepth.value,
    intervention: controls.intervention.value,
    limeDose: Number(controls.limeDose.value),
    biocharDose: Number(controls.biocharDose.value),
    durationWeeks: DEFAULTS.durationWeeks,
  });
}

function applyDefaultsToControls() {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    if (!controls[key]) return;
    if (controls[key].type === 'checkbox') {
      controls[key].checked = Boolean(value);
    } else {
      controls[key].value = value;
    }
  });
}

function syncControlLabels(params) {
  values.organicMatter.textContent = Number(controls.organicMatter.value).toFixed(1);
  values.pH.textContent = Number(controls.pH.value).toFixed(1);
  values.rainfall.textContent = String(Number(controls.rainfall.value));
  values.groundwaterDepth.textContent = Number(controls.groundwaterDepth.value).toFixed(1);
  values.initialConcentration.textContent = String(Number(controls.initialConcentration.value));
  values.limeDose.textContent = Number(controls.limeDose.value).toFixed(1);
  values.biocharDose.textContent = Number(controls.biocharDose.value).toFixed(1);

  controls.cec.disabled = !controls.advancedCEC.checked;
  controls.cec.value = Number(params.cec).toFixed(1);

  document.getElementById('limeDoseWrap').style.display = params.intervention === 'Lime' ? 'flex' : 'none';
  document.getElementById('biocharDoseWrap').style.display = params.intervention === 'BiocharCompost' ? 'flex' : 'none';
}

function updateScenarioAFromControls() {
  const params = readControls();
  const built = buildScenarioSeries(params);
  stateA.params = built.params;
  stateA.results = built.states;
  stateA.currentWeek = clamp(stateA.currentWeek, 0, stateA.params.durationWeeks);
  stateB.currentWeek = stateA.currentWeek;

  weekSlider.max = String(stateA.params.durationWeeks);
  weekSlider.value = String(stateA.currentWeek);
  weekLabel.textContent = String(stateA.currentWeek);

  syncControlLabels(stateA.params);
}

function ensureBLocked() {
  if (!uiState.compareEnabled || stateB.locked) return;
  stateB = freezeBFromAWeek1(stateA.params, Math.max(1, stateA.currentWeek || 1), new Date());
  stateB.currentWeek = stateA.currentWeek;
}

function pausePlayback() {
  if (playHandle) {
    clearInterval(playHandle);
    playHandle = null;
  }
  stateA.isPlaying = false;
}

function startPlayback() {
  pausePlayback();
  stateA.isPlaying = true;
  playHandle = setInterval(() => {
    if (stateA.currentWeek >= stateA.params.durationWeeks) {
      pausePlayback();
      return;
    }
    stateA.currentWeek += 1;
    stateB.currentWeek = stateA.currentWeek;
    weekSlider.value = String(stateA.currentWeek);
    weekLabel.textContent = String(stateA.currentWeek);
    renderAll();
  }, uiState.playIntervalMs);
}

function setKpiPill(nodeId, level) {
  const node = document.getElementById(nodeId);
  node.classList.remove('low', 'medium', 'high');
  if (['Low', 'Medium', 'High'].includes(level)) {
    node.classList.add(level.toLowerCase());
  }
  node.textContent = dict().levels[level] ?? level;
}

function setIndicatorPair(kind, indicatorA, indicatorB) {
  const [idA, idB] = INDICATOR_MAP[kind];
  setKpiPill(idA, indicatorA);
  if (uiState.compareEnabled && indicatorB) {
    setKpiPill(idB, indicatorB);
  } else {
    setKpiPill(idB, '-');
  }
}

function renderIndicators(weekA, weekB) {
  const indicatorsA = weekA ? getIndicators(weekA) : { mobility: '-', bioavailability: '-', groundwater: '-' };
  const indicatorsB = weekB ? getIndicators(weekB) : null;

  setIndicatorPair('mobility', indicatorsA.mobility, indicatorsB?.mobility);
  setIndicatorPair('bioavailability', indicatorsA.bioavailability, indicatorsB?.bioavailability);
  setIndicatorPair('groundwater', indicatorsA.groundwater, indicatorsB?.groundwater);
}

function renderDominantProcess(weekA, weekB) {
  if (weekA) {
    const dominantA = getDominantProcess(weekA.fractions, uiState.lang);
    document.getElementById('dominantAName').textContent = dominantA.label;
    document.getElementById('dominantAPct').textContent = `${dominantA.percent}%`;
    document.getElementById('dominantAExplain').textContent = dominantA.note;
  }

  if (uiState.compareEnabled && weekB) {
    const dominantB = getDominantProcess(weekB.fractions, uiState.lang);
    document.getElementById('dominantBName').textContent = dominantB.label;
    document.getElementById('dominantBPct').textContent = `${dominantB.percent}%`;
    document.getElementById('dominantBExplain').textContent = dominantB.note;
  } else {
    document.getElementById('dominantBName').textContent = '-';
    document.getElementById('dominantBPct').textContent = '-';
    document.getElementById('dominantBExplain').textContent = dict().benchmarkHint;
  }
}

function updateChartLabels() {
  const d = dict();
  concChart.data.datasets[0].label = d.concLabels[0];
  concChart.data.datasets[1].label = d.concLabels[1];
  concChart.data.datasets[2].label = d.concLabels[2];
  concChart.data.datasets[3].label = d.concLabels[3];
  concChart.options.scales.x.title.text = d.axisWeek;
  concChart.options.scales.y.title.text = d.axisConcentration;

  fractionChart.data.datasets[0].label = d.fracLabels[0];
  fractionChart.data.datasets[1].label = d.fracLabels[1];
  fractionChart.data.datasets[2].label = d.fracLabels[2];
  fractionChart.options.scales.y.title.text = d.yPercent;

  profileATitle.textContent = d.profileA;
  profileBTitle.textContent = d.profileB;
}

function renderCharts(weekA, weekB) {
  const labels = stateA.results.map((entry) => entry.week);
  concChart.data.labels = labels;

  concChart.data.datasets[0].data = stateA.results.map((entry) => Number(entry.surfaceConc.toFixed(3)));
  concChart.data.datasets[1].data = stateA.results.map((entry) => Number(entry.deepConc.toFixed(3)));

  if (uiState.compareEnabled && stateB.locked && stateB.results.length > 0) {
    concChart.data.datasets[2].data = stateB.results.map((entry) => Number(entry.surfaceConc.toFixed(3)));
    concChart.data.datasets[3].data = stateB.results.map((entry) => Number(entry.deepConc.toFixed(3)));
    concChart.data.datasets[2].hidden = false;
    concChart.data.datasets[3].hidden = false;
  } else {
    concChart.data.datasets[2].data = labels.map(() => null);
    concChart.data.datasets[3].data = labels.map(() => null);
    concChart.data.datasets[2].hidden = true;
    concChart.data.datasets[3].hidden = true;
  }

  if (weekA) {
    if (uiState.compareEnabled && weekB) {
      fractionChart.data.labels = dict().fracXCompare;
      fractionChart.data.datasets[0].data = [
        Number((weekA.fractions.dissolved * 100).toFixed(2)),
        Number((weekB.fractions.dissolved * 100).toFixed(2)),
      ];
      fractionChart.data.datasets[1].data = [
        Number((weekA.fractions.adsorbed * 100).toFixed(2)),
        Number((weekB.fractions.adsorbed * 100).toFixed(2)),
      ];
      fractionChart.data.datasets[2].data = [
        Number((weekA.fractions.immobilized * 100).toFixed(2)),
        Number((weekB.fractions.immobilized * 100).toFixed(2)),
      ];
    } else {
      fractionChart.data.labels = dict().fracXSingle;
      fractionChart.data.datasets[0].data = [Number((weekA.fractions.dissolved * 100).toFixed(2))];
      fractionChart.data.datasets[1].data = [Number((weekA.fractions.adsorbed * 100).toFixed(2))];
      fractionChart.data.datasets[2].data = [Number((weekA.fractions.immobilized * 100).toFixed(2))];
    }
  }

  concChart.update();
  fractionChart.update();
}

function drawDepthAxis(ctx, x, top, bottom, depthMax, groundwaterDepth) {
  const d = dict();
  ctx.strokeStyle = '#5e7487';
  ctx.fillStyle = '#2f506a';
  ctx.lineWidth = 1;

  const yFromDepth = (depth) => top + (depth / depthMax) * (bottom - top);
  [0, 1, 2].forEach((depth) => {
    if (depth > depthMax) return;
    const y = yFromDepth(depth);
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.stroke();
    ctx.fillText(`${depth} m`, x - 42, y + 4);
  });

  const gwY = yFromDepth(Math.min(groundwaterDepth, depthMax));
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#2d74b3';
  ctx.beginPath();
  ctx.moveTo(x + 8, gwY);
  ctx.lineTo(x + 366, gwY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#2d74b3';
  ctx.fillText(`${d.gw} ${groundwaterDepth.toFixed(1)} m`, x + 12, gwY - 6);
}

function drawFlowMarkers(ctx, left, right, top, params) {
  const permeabilityBoost = PERMEABILITY_FACTOR[params.permeability] ?? 1;
  const count = Math.round(2 + (params.rainfall / 120) * 7 + permeabilityBoost * 2);

  ctx.strokeStyle = 'rgba(31, 80, 120, 0.75)';
  ctx.lineWidth = 1.2;

  for (let i = 0; i < count; i += 1) {
    const laneRatio = (i + 1) / (count + 1);
    const x = left + laneRatio * (right - left);
    const startY = top + 6;
    const endY = top + 42;

    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.lineTo(x - 4, endY - 8);
    ctx.moveTo(x, endY);
    ctx.lineTo(x + 4, endY - 8);
    ctx.stroke();
  }
}

function drawProfile(ctx, canvas, params, weekState, title) {
  const d = dict();
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!params || !weekState) {
    ctx.fillStyle = '#3b5a74';
    ctx.font = '15px Inter, Segoe UI, sans-serif';
    ctx.fillText(d.scenarioBUnlocked, 28, 54);
    return;
  }

  const top = 72;
  const bottom = height - 60;
  const left = 66;
  const right = width - 46;
  const depthMax = Math.max(2.4, params.groundwaterDepth + 0.45);
  const yFromDepth = (depth) => top + (depth / depthMax) * (bottom - top);

  const contaminatedDepthMeters = params.contaminatedDepth === '0-40' ? 0.4 : 0.2;
  const contaminatedBottom = yFromDepth(contaminatedDepthMeters);
  const plumeBottom = Math.min(bottom, contaminatedBottom + 155);
  const gwY = yFromDepth(Math.min(params.groundwaterDepth, depthMax));

  ctx.fillStyle = '#f2f7fc';
  ctx.fillRect(0, 0, width, top - 8);

  ctx.fillStyle = '#d5b083';
  ctx.fillRect(left, top, right - left, bottom - top);

  ctx.fillStyle = '#c79262';
  ctx.fillRect(left, top, right - left, contaminatedBottom - top);

  const intensitySurface = clamp(weekState.surfaceConc / 140, 0.05, 1);
  const intensityDeep = clamp(weekState.deepConc / 120, 0.04, 0.85);
  const plumeGradient = ctx.createLinearGradient(left, top, left, plumeBottom);
  plumeGradient.addColorStop(0, `rgba(176, 34, 34, ${0.16 + intensitySurface * 0.64})`);
  plumeGradient.addColorStop(1, `rgba(176, 34, 34, ${0.08 + intensityDeep * 0.54})`);
  ctx.fillStyle = plumeGradient;
  ctx.fillRect(left, top, right - left, plumeBottom - top);

  // Semi-transparent groundwater layer below the water table.
  if (gwY < bottom) {
    ctx.fillStyle = 'rgba(46, 119, 189, 0.22)';
    ctx.fillRect(left, gwY, right - left, bottom - gwY);
  }

  // Optional transparent soil-cut overlay (place soil-cut-overlay.webp at project root).
  if (soilOverlayImage.complete && soilOverlayImage.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(soilOverlayImage, left, top, right - left, bottom - top);
    ctx.restore();
  }

  drawFlowMarkers(ctx, left + 14, right - 14, top + 12, params);
  drawDepthAxis(ctx, left - 12, top, bottom, depthMax, params.groundwaterDepth);

  const dominant = getDominantProcess(weekState.fractions, uiState.lang);

  ctx.fillStyle = '#18374d';
  ctx.font = '600 14px Inter, Segoe UI, sans-serif';
  ctx.fillText(title, 20, 28);

  ctx.font = '12px Inter, Segoe UI, sans-serif';
  ctx.fillText(`${d.week} ${weekState.week}`, 20, 47);
  ctx.fillText(`${d.surface} ${weekState.surfaceConc.toFixed(1)} mg/kg`, 20, 63);
  ctx.fillText(`${d.deep} ${weekState.deepConc.toFixed(1)} mg/kg`, 220, 63);
  ctx.fillText(`${d.dominant}: ${dominant.label} (${dominant.percent}%)`, 20, height - 24);
}

function drawPlaceholderB() {
  const d = dict();
  const ctx = profileBContext;
  const canvas = profileBCanvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f6f9fd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3f5e75';
  ctx.font = '600 15px Inter, Segoe UI, sans-serif';
  ctx.fillText(d.scenarioBUnlocked, 52, 120);
  ctx.font = '13px Inter, Segoe UI, sans-serif';
  ctx.fillText(d.freezeHint, 52, 146);
}

function renderProfiles() {
  const weekA = getWeekState(stateA.results, stateA.currentWeek);
  drawProfile(profileAContext, profileACanvas, stateA.params, weekA, dict().profileA);

  if (uiState.compareEnabled) {
    const weekB = stateB.locked ? getWeekState(stateB.results, stateA.currentWeek) : null;
    if (stateB.locked && weekB) {
      drawProfile(profileBContext, profileBCanvas, stateB.snapshotParamsWeek1, weekB, dict().profileB);
    } else {
      drawPlaceholderB();
    }
  }
}

function renderExplanation(weekA, weekB) {
  const bullets = uiState.compareEnabled
    ? generateComparisonExplanation(weekA, weekB, stateA.params, stateB.snapshotParamsWeek1, uiState.lang)
    : generateExplanation(stateA.params, weekA, getWeekState(stateA.results, Math.max(0, stateA.currentWeek - 1)), uiState.lang);
  explanationList.innerHTML = bullets.map((item) => `<li>${item}</li>`).join('');
}

function renderLockStatus() {
  bLockStatus.textContent = formatLockSummary(stateB.lockedMeta, uiState.lang);
  bLockStatus.classList.toggle('locked', stateB.locked);
  bLockStatus.classList.toggle('unlocked', !stateB.locked);
}

function applyLanguageText() {
  document.documentElement.lang = uiState.lang;
  document.querySelectorAll('[data-i18n-es]').forEach((node) => {
    node.textContent = node.getAttribute(`data-i18n-${uiState.lang}`) ?? node.textContent;
  });
  const tips = dict().tooltips;
  Object.keys(tips).forEach((id) => {
    const node = id === 'compareToggle' ? compareToggle.closest('label') : controls[id]?.closest('label');
    if (node) node.title = tips[id];
  });
  updateChartLabels();
}

function renderCompareUIState() {
  document.body.classList.toggle('compare-mode', uiState.compareEnabled);
  freezeBBtn.disabled = !uiState.compareEnabled;
  resetBBtn.disabled = !uiState.compareEnabled;
}

function renderAll() {
  applyLanguageText();
  renderCompareUIState();

  const weekA = getWeekState(stateA.results, stateA.currentWeek);
  const weekB = uiState.compareEnabled && stateB.locked ? getWeekState(stateB.results, stateA.currentWeek) : null;

  renderIndicators(weekA, weekB);
  renderDominantProcess(weekA, weekB);
  renderCharts(weekA, weekB);
  renderExplanation(weekA, weekB);
  renderLockStatus();
  renderProfiles();

  weekSlider.value = String(stateA.currentWeek);
  weekLabel.textContent = String(stateA.currentWeek);
}

function markChanged(target) {
  const field = target.closest('.control-field');
  if (!field) return;
  field.classList.add('changed');
  setTimeout(() => field.classList.remove('changed'), 260);
}

CONTROL_IDS.forEach((id) => {
  controls[id].addEventListener('input', (event) => {
    pausePlayback();
    markChanged(event.target);
    updateScenarioAFromControls();
    renderAll();
  });
});

languageToggle.addEventListener('change', () => {
  uiState.lang = languageToggle.checked ? 'en' : 'es';
  renderAll();
});

compareToggle.addEventListener('change', () => {
  pausePlayback();
  uiState.compareEnabled = compareToggle.checked;
  renderAll();
});

freezeBBtn.addEventListener('click', () => {
  pausePlayback();
  updateScenarioAFromControls();
  stateB = freezeBFromAWeek1(stateA.params, Math.max(1, stateA.currentWeek || 1), new Date());
  stateB.currentWeek = stateA.currentWeek;
  renderAll();
});

resetBBtn.addEventListener('click', () => {
  pausePlayback();
  stateB = resetBState();
  renderAll();
});

document.getElementById('playBtn').addEventListener('click', () => {
  updateScenarioAFromControls();
  ensureBLocked();
  renderAll();
  startPlayback();
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  pausePlayback();
  renderAll();
});

document.getElementById('stepBtn').addEventListener('click', () => {
  pausePlayback();
  updateScenarioAFromControls();
  ensureBLocked();
  stateA.currentWeek = clamp(stateA.currentWeek + 1, 0, stateA.params.durationWeeks);
  stateB.currentWeek = stateA.currentWeek;
  renderAll();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  pausePlayback();
  applyDefaultsToControls();
  stateA = createStateA(DEFAULTS);
  stateB = resetBState();
  stateA.currentWeek = 0;
  stateB.currentWeek = 0;
  weekSlider.max = String(DEFAULTS.durationWeeks);
  weekSlider.value = '0';
  weekLabel.textContent = '0';
  syncControlLabels(stateA.params);
  renderAll();
});

weekSlider.addEventListener('input', () => {
  pausePlayback();
  stateA.currentWeek = clamp(Number(weekSlider.value), 0, stateA.params.durationWeeks);
  stateB.currentWeek = stateA.currentWeek;
  weekLabel.textContent = String(stateA.currentWeek);
  renderAll();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = {
    language: uiState.lang,
    compareEnabled: uiState.compareEnabled,
    selectedWeek: stateA.currentWeek,
    scenarioA: {
      params: stateA.params,
      results: stateA.results,
    },
    scenarioB: {
      locked: stateB.locked,
      snapshotParamsWeek1: stateB.snapshotParamsWeek1,
      snapshotMeta: stateB.lockedMeta,
      results: stateB.results,
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cd-simulation-results-compare.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

applyDefaultsToControls();
stateA = createStateA(DEFAULTS);
stateB = createStateB();
syncControlLabels(stateA.params);
updateScenarioAFromControls();
uiState.lang = 'es';
languageToggle.checked = false;
renderAll();
