import { clamp } from './plume-model.js';

export const terrain = { width: 8.4, breadth: 2.85, depth: 5.1 };
export const source = { x: .88, z: .67 };
const sections = 256;
const axes = ['x', 'y', 'z'];
const waves = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i * Math.PI / 512));

export function createPlumeField(state) {
  const breadth = state.spread * .69;
  const samples = new Float32Array((sections + 1) * 4);

  for (let section = 0; section <= sections; section += 1) {
    const t = section / sections;
    const envelope = Math.sin(Math.PI * t) ** .58;
    const bottom = .06 + (state.depth - .06) * t ** .73;
    const topLimit = .022 + (state.depth - .022) * .28 * t;
    const halfHeight = Math.min(bottom - topLimit, (state.depth * .83 + .12) * envelope) / 2;
    const offset = 4 * section;
    samples[offset] = bottom - halfHeight;
    samples[offset + 1] = 1 / Math.max(halfHeight, 1e-5);
    samples[offset + 2] = source.z + .48 * Math.sin(t * 2.1);
    samples[offset + 3] = 1 / Math.max(breadth * envelope, 1e-5);
  }

  return {
    samples,
    length: state.length,
    strength: 6.0 + state.intensity * 7.2,
    min: { x: source.x, y: .022, z: Math.max(0, source.z - breadth) },
    max: {
      x: Math.min(terrain.width, source.x + state.length),
      y: Math.min(terrain.depth, state.depth),
      z: Math.min(terrain.breadth, source.z + .48 + breadth),
    },
  };
}

function intersection(origin, direction, min, max) {
  let near = -Infinity;
  let far = Infinity;
  for (const axis of axes) {
    const start = origin[axis];
    const along = direction[axis];
    if (Math.abs(along) < 1e-8) {
      if (start < min[axis] || start > max[axis]) return null;
      continue;
    }
    const first = (min[axis] - start) / along;
    const last = (max[axis] - start) / along;
    near = Math.max(near, Math.min(first, last));
    far = Math.min(far, Math.max(first, last));
    if (far <= near) return null;
  }
  return [near, far];
}

export function tracePlume(field, origin, direction, pixels, offset) {
  const span = intersection(origin, direction, field.min, field.max);
  if (!span) return;
  const [near, far] = span;
  const count = Math.min(84, Math.max(3, Math.ceil((far - near) / .053)));
  const step = (far - near) / count;
  const start = near + step / 2;
  const { samples, length, strength } = field;

  let x = origin.x + direction.x * start;
  let y = origin.y + direction.y * start;
  let z = origin.z + direction.z * start;
  const dx = direction.x * step;
  const dy = direction.y * step;
  const dz = direction.z * step;
  let opacity = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let i = 0; i < count && opacity < .99; i += 1, x += dx, y += dy, z += dz) {
    const progress = (x - source.x) / length;
    if (progress <= 0 || progress >= 1) continue;
    const column = progress * sections;
    const index = Math.floor(column) * 4;
    const blend = column % 1;
    const centerY = samples[index] + blend * (samples[index + 4] - samples[index]);
    const centerZ = samples[index + 2] + blend * (samples[index + 6] - samples[index + 2]);
    const height = samples[index + 1] + blend * (samples[index + 5] - samples[index + 1]);
    const width = samples[index + 3] + blend * (samples[index + 7] - samples[index + 3]);
    const vertical = (y - centerY) * height;
    const lateral = (z - centerZ) * width;
    const core = 1 - vertical * vertical - lateral * lateral;
    if (core <= 0) continue;

    const broad = waves[Math.floor(x * 156 + y * 281 - z * 319) & 1023];
    const fine = waves[Math.floor(x * 438 - y * 535 + z * 807) & 1023];
    const density = core * core * (.83 + .17 * broad + .10 * fine) * (1 - progress * .46);
    const weight = (1 - opacity) * Math.min(.50, density * step * strength);
    const light = .52 - vertical * .34 - lateral * .12 + broad * .09;
    opacity += weight;
    red += weight * (206 + 48 * light);
    green += weight * (92 + 91 * light);
    blue += weight * (24 + 45 * light);
  }

  if (opacity < .003) return;
  pixels[offset] = red / opacity;
  pixels[offset + 1] = green / opacity;
  pixels[offset + 2] = blue / opacity;
  pixels[offset + 3] = opacity * 255;
}

export function createPlumePainter() {
  const buffer = document.createElement('canvas');
  const context = buffer.getContext('2d');
  let image;

  return function paint(context2d, view, field, width, height) {
    const corners = [field.min.y, field.max.y].flatMap(y => [field.min.x, field.max.x].flatMap(x =>
      [field.min.z, field.max.z].map(z => view.project({ x, y, z }))));
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))) - 2);
    const right = Math.min(width, Math.ceil(Math.max(...corners.map(p => p.x))) + 2);
    const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))) - 2);
    const bottom = Math.min(height, Math.ceil(Math.max(...corners.map(p => p.y))) + 2);
    if (right <= left || bottom <= top) return;

    const w = right - left;
    const h = bottom - top;
    const resolution = Math.min(1, 460 / w, 235 / h, Math.sqrt(52000 / (w * h)));
    const columns = Math.ceil(w * resolution);
    const rows = Math.ceil(h * resolution);
    if (!image || image.width !== columns || image.height !== rows) {
      buffer.width = columns;
      buffer.height = rows;
      image = context.createImageData(columns, rows);
    }
    image.data.fill(0);

    const dx = w / columns;
    const dy = h / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const ray = view.ray(left + (col + .5) * dx, top + (row + .5) * dy);
        tracePlume(field, ray, view.direction, image.data, (row * columns + col) * 4);
      }
    }

    context.putImageData(image, 0, 0);
    context2d.drawImage(buffer, left, top, w, h);
  };
}
