import { clamp, plumeState } from './plume-model.js';
import { createTerrainRenderer } from './plume-renderer.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('plumeCanvas');
const form = byId('scenarioForm');
const time = byId('timeSlider');
const play = byId('playButton');
const zoomIn = byId('zoomIn');
const zoomOut = byId('zoomOut');
const fields = [
  { input: byId('concentrationSlider'), value: byId('concentrationValue'), effect: byId('concentrationEffect'), key: 'concentration', unit: ' mg/kg', digits: 0 },
  { input: byId('infiltrationSlider'), value: byId('infiltrationValue'), effect: byId('infiltrationEffect'), key: 'infiltration', unit: ' mm/sem', digits: 0 },
  { input: byId('mobilitySlider'), value: byId('mobilityValue'), effect: byId('mobilityEffect'), key: 'mobility', unit: '', digits: 2 },
  { input: byId('groundwaterSlider'), value: byId('groundwaterValue'), key: 'groundwaterDepth', unit: ' m', digits: 1 },
];
const treatments = {
  vegetation: byId('vegetationCheck'),
  biochar: byId('biocharCheck'),
  lime: byId('limeCheck'),
};
const metrics = {
  length: byId('lengthMetric'),
  depth: byId('depthMetric'),
  distance: byId('distanceMetric'),
  risk: byId('riskMetric'),
};

const initialCamera = { yaw: .31, pitch: .35, zoom: 1 };
const camera = { ...initialCamera };
const pointers = new Map();
const numbers = [0, 1, 2].map(digits => new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}));
const format = (value, digits = 1) => numbers[digits].format(value);
let current;
let redraw = 0;
let playTimer = null;
const drawTerrain = createTerrainRenderer(canvas, scheduleScene);
if (!drawTerrain) byId('sceneError').hidden = false;

function scheduleScene() {
  if (redraw) return;
  redraw = requestAnimationFrame(() => {
    redraw = 0;
    drawTerrain?.(current, camera, format(current.groundwaterDepth) + ' m');
  });
}

function updateScenario() {
  const week = time.valueAsNumber;
  const parameters = { week };
  for (const field of fields) parameters[field.key] = field.input.valueAsNumber;
  for (const [key, checkbox] of Object.entries(treatments)) parameters[key] = checkbox.checked;
  current = plumeState(parameters);

  for (const { value, effect, key, digits, unit } of fields) {
    const base = parameters[key];
    value.value = format(base, digits) + unit;
    if (effect) {
      const effective = current[key];
      effect.hidden = Math.abs(base - effective) < .0001;
      effect.textContent = 'Valor efectivo: ' + format(effective, digits) + unit;
    }
  }

  const weekText = 'Semana ' + week + ' de ' + time.max;
  byId('timeValue').value = weekText;
  time.setAttribute('aria-valuetext', weekText);
  metrics.length.textContent = format(current.length) + ' m';
  metrics.depth.textContent = format(current.depth) + ' m';
  metrics.distance.textContent = current.groundwaterGap > 0 ? format(current.groundwaterGap) + ' m' : 'Contacto';
  metrics.risk.textContent = current.riskLevel;
  metrics.risk.dataset.risk = current.riskLevel;
  scheduleScene();
}

function stop() {
  clearInterval(playTimer);
  playTimer = null;
  byId('playText').textContent = 'Animar';
  byId('playIcon').textContent = '▶';
}

function setZoom(value) {
  camera.zoom = clamp(value, .72, 1.75);
  zoomIn.disabled = camera.zoom === 1.75;
  zoomOut.disabled = camera.zoom === .72;
  scheduleScene();
}

function orbit(dx, dy) {
  camera.yaw = (camera.yaw + dx) % (2 * Math.PI);
  camera.pitch = clamp(camera.pitch + dy, .12, .98);
  scheduleScene();
}

function resetCamera() {
  Object.assign(camera, initialCamera);
  setZoom(initialCamera.zoom);
}

form.addEventListener('input', () => {
  stop();
  updateScenario();
});
form.addEventListener('submit', event => event.preventDefault());
time.addEventListener('input', () => {
  stop();
  updateScenario();
});
play.addEventListener('click', () => {
  if (playTimer) {
    stop();
    return;
  }

  byId('playText').textContent = 'Pausar';
  byId('playIcon').textContent = 'Ⅱ';
  playTimer = setInterval(() => {
    time.value = time.valueAsNumber >= Number(time.max) ? time.min : String(time.valueAsNumber + 1);
    updateScenario();
  }, 520);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
});
byId('resetButton').addEventListener('click', () => {
  stop();
  form.reset();
  time.value = time.defaultValue;
  resetCamera();
  updateScenario();
});
byId('resetCamera').addEventListener('click', resetCamera);
zoomIn.addEventListener('click', () => setZoom(camera.zoom * 1.16));
zoomOut.addEventListener('click', () => setZoom(camera.zoom / 1.16));

function fingerDistance() {
  const [first, second] = pointers.values();
  return Math.hypot(second.x - first.x, second.y - first.y);
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointers.size >= 2) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  const oldDistance = pointers.size === 2 ? fingerDistance() : 0;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (oldDistance > 0) {
    setZoom(camera.zoom * fingerDistance() / oldDistance);
  } else {
    orbit((event.clientX - previous.x) * .008, (event.clientY - previous.y) * .006);
  }
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, ({ pointerId }) => pointers.delete(pointerId));
}

const keyMoves = {
  ArrowLeft: [-.09, 0], ArrowRight: [.09, 0],
  ArrowUp: [0, -.07], ArrowDown: [0, .07],
};
canvas.addEventListener('keydown', event => {
  const move = Object.hasOwn(keyMoves, event.key) && keyMoves[event.key];
  if (move) {
    event.preventDefault();
    orbit(...move);
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    setZoom(camera.zoom * 1.16);
  } else if (event.key === '-') {
    event.preventDefault();
    setZoom(camera.zoom / 1.16);
  } else if (event.key === 'Home') {
    event.preventDefault();
    resetCamera();
  }
});

new ResizeObserver(scheduleScene).observe(canvas);
updateScenario();
