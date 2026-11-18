const permeabilityArrows = { Low: 1, Medium: 2, High: 3 };

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function drawSoilProfile(canvas, state, params) {
  const { width, height } = canvas.getBoundingClientRect();
  const soil = canvas.getContext('2d');
  if (!soil || !width || !height) return;

  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  soil.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);

  const ground = 0.21;
  const boundary = params.contaminatedDepth === '0-40' ? 0.49 : 0.425;
  const waterline = 0.66 + 0.25 * Math.sqrt((params.groundwaterDepth - 0.5) / 9.5);
  canvas.parentElement.style.setProperty('--waterline', (100 * waterline) + '%');

  function ridge(x, depth, roughness) {
    return depth + roughness * (0.011 * Math.sin(x * 14 + depth * 13) + 0.006 * Math.cos(x * 35 + depth * 10));
  }

  function layer(depth, fill, roughness = 1) {
    soil.beginPath();
    soil.moveTo(0, ridge(0, depth, roughness));
    for (let i = 1; i <= 100; i += 1) soil.lineTo(i / 100, ridge(i / 100, depth, roughness));
    soil.lineTo(1, 1);
    soil.lineTo(0, 1);
    soil.closePath();
    soil.fillStyle = fill;
    soil.fill();
  }

  function gradient(top, bottom, startColor, endColor) {
    const fill = soil.createLinearGradient(0, top, 0, bottom);
    fill.addColorStop(0, startColor);
    fill.addColorStop(1, endColor);
    return fill;
  }

  soil.fillStyle = gradient(0, ground, '#e6eee4', '#c8d9cb');
  soil.fillRect(0, 0, 1, 1);
  layer(ground - 0.015, '#556443', 0.9);
  layer(ground, '#684634', 0.9);
  layer(ground + 0.02, gradient(ground, boundary, '#805238', '#a96e4e'), 0.8);
  layer(boundary, '#b88463');
  layer(boundary + 0.06, '#c5a07e', 1.1);
  layer(0.59, '#b79677', 1.4);
  layer(waterline - 0.055, '#a9896c', 0.7);
  layer(waterline, gradient(waterline, 1, '#74938a', '#3b6c70'), 0);

  const texture = seededRandom(7391);
  for (let i = 0; i < 950; i += 1) {
    const x = texture();
    const y = ground + texture() * (1 - ground);
    const size = 0.001 + texture() * 0.006;
    if (y < ridge(x, ground, 0.9)) continue;
    soil.fillStyle = y > waterline
      ? (i % 3 === 0 ? '#d1eee34a' : '#173e4b42')
      : (i % 3 === 0 ? '#f4d6ad65' : '#38271b3c');
    soil.beginPath();
    soil.ellipse(x, y, size, size * 0.43, texture() - 0.5, 0, 2 * Math.PI);
    soil.fill();
  }

  function cadmium(concentration, top, bottom, seed) {
    const random = seededRandom(seed);
    const count = Math.ceil(110 * concentration / (concentration + 30));
    for (let i = 0; i < count; i += 1) {
      const x = 0.37 + random() * 0.60;
      const y = top + random() * (bottom - top);
      const radius = 1.15 + random() * 1.85;
      soil.fillStyle = i % 3 === 0 ? '#ffd6a5df' : '#742e22b5';
      soil.beginPath();
      soil.ellipse(x, y, radius / width, radius / height, 0, 0, 2 * Math.PI);
      soil.fill();
    }
  }

  cadmium(state.surfaceConc, ground + 0.035, boundary - 0.014, 3157);
  cadmium(state.deepConc, boundary + 0.025, waterline - 0.024, 6724);

  function arrow(x, top, bottom, color, dashed) {
    soil.strokeStyle = color;
    soil.beginPath();
    soil.moveTo(x, top);
    soil.lineTo(x, bottom);
    if (dashed) soil.setLineDash([0.012, 0.016]);
    soil.stroke();

    soil.setLineDash([]);
    soil.beginPath();
    soil.moveTo(x - 5 / width, bottom - 6 / height);
    soil.lineTo(x, bottom);
    soil.lineTo(x + 5 / width, bottom - 6 / height);
    soil.stroke();
  }

  soil.save();
  soil.lineWidth = 1.45 / width;
  soil.lineCap = 'round';
  soil.lineJoin = 'round';
  const count = Math.round(params.rainfall / 120 * 7 + permeabilityArrows[params.permeability]);
  for (let i = 0; i < count; i += 1) {
    const x = count === 1 ? 0.75 : 0.57 + i * 0.36 / (count - 1);
    if (params.rainfall > 0) arrow(x, 0.10, 0.18, '#386d71', false);
    arrow(x, 0.29, Math.min(waterline - 0.032, 0.54 + (i % 3) * 0.041), '#b2dfdb', true);
  }

  soil.strokeStyle = '#e5f7ed';
  soil.lineWidth = 2 / width;
  soil.setLineDash([0.019, 0.013]);
  soil.beginPath();
  soil.moveTo(0, waterline);
  soil.lineTo(1, waterline);
  soil.stroke();
  soil.restore();
}
