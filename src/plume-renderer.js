import { clamp } from './plume-model.js';
import { createPlumeField, createPlumePainter, source, terrain } from './plume-volume.js';

const heightScale = 0.68;
const grassColors = ['#535b35', '#677940', '#818b46', '#9aa055', '#b2ae6b'];

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function plants() {
  const random = randomSequence(1493);
  return Array.from({ length: 620 }, (_, index) => {
    const x = .035 + random() * (terrain.width - .07);
    const z = .025 + random() * (terrain.breadth - .05);
    const sparsePatch = ((x - 1.7) / 1.22) ** 2 + ((z - .79) / .51) ** 2 < 1;
    return {
      x, z, sparsePatch, base: index < 170,
      blades: Array.from({ length: 4 }, () => ({
        color: Math.floor(random() * grassColors.length),
        height: .1 + random() * .30,
        dx: (random() - .5) * .39,
        dz: (random() - .5) * .37,
      })),
    };
  });
}

const { width: terrainWidth, breadth, depth } = terrain;
const point = (x, y, z) => ({ x, y, z });

const faces = [
  { origin: point(0, 0, 0), u: point(1, 0, 0), v: point(0, 1, 0), w: terrainWidth, h: depth, family: 'z', side: -1, shade: .03 },
  { origin: point(0, 0, breadth), u: point(1, 0, 0), v: point(0, 1, 0), w: terrainWidth, h: depth, family: 'z', side: 1, shade: .26 },
  { origin: point(0, 0, 0), u: point(0, 0, 1), v: point(0, 1, 0), w: breadth, h: depth, family: 'x', side: -1, shade: .25 },
  { origin: point(terrainWidth, 0, 0), u: point(0, 0, 1), v: point(0, 1, 0), w: breadth, h: depth, family: 'x', side: 1, shade: .18 },
];
const surface = { origin: point(0, 0, 0), u: point(1, 0, 0), v: point(0, 0, 1), w: terrainWidth, h: breadth };
const base = { ...surface, origin: point(0, depth, 0) };
const vertices = [0, depth].flatMap(y => [0, terrainWidth].flatMap(x => [0, breadth].map(z => point(x, y, z))));

function onFace(face, u, v) {
  const { origin, u: across, v: down } = face;
  return point(origin.x + across.x * u + down.x * v, origin.y + across.y * u + down.y * v, origin.z + across.z * u + down.z * v);
}

function viewpoint(camera, width, height) {
  const sine = Math.sin(camera.yaw);
  const cosine = Math.cos(camera.yaw);
  const pitchSin = Math.sin(camera.pitch);
  const pitchCos = Math.cos(camera.pitch);
  function rotate({ x, y, z }) {
    const away = x * sine + z * cosine;
    return { x: x * cosine - z * sine, y: y * heightScale * pitchCos - away * pitchSin };
  }

  const corners = vertices.map(rotate);
  const left = Math.min(...corners.map(p => p.x));
  const right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y));
  const bottom = Math.max(...corners.map(p => p.y));
  const margin = width < 540 ? 32 : 86;
  const scale = Math.min((width - margin) / (right - left), (height - 126) / (bottom - top)) * camera.zoom;
  const centerX = (left + right) * .5;
  const centerY = (top + bottom) * .5;
  const facing = (face) => face.side * (face.family === 'x' ? sine : cosine);
  const visible = faces.filter(face => facing(face) < -1e-5);
  const clearest = visible.reduce((best, face) => facing(face) * face.w < facing(best) * best.w ? face : best);

  return {
    scale,
    project(world) {
      const p = rotate(world);
      return { x: width / 2 + (p.x - centerX) * scale, y: height * .53 + (p.y - centerY) * scale };
    },
    ray(x, y) {
      const horizontal = (x - width / 2) / scale + centerX;
      const vertical = (y - height * .53) / scale + centerY;
      const away = -vertical * pitchSin;
      return point(horizontal * cosine + away * sine, vertical * pitchCos / heightScale,
        -horizontal * sine + away * cosine);
    },
    direction: point(sine * pitchCos, pitchSin / heightScale, cosine * pitchCos),
    visible,
    clearest,
    rear: faces.filter(face => facing(face) > 1e-5),
  };
}

function silhouette(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const edge = (ordered) => {
    const hull = [];
    for (const p of ordered) {
      while (hull.length >= 2 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  return [...edge(sorted), ...edge(sorted.reverse())];
}

export function createTerrainRenderer(canvas, invalidate) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const texture = new Image();
  texture.addEventListener('load', invalidate);
  texture.src = new URL('../assets/plume-strata-v1.webp', import.meta.url).href;
  const foliage = plants();
  const paintPlume = createPlumePainter();
  let lastState;
  let field;

  function path(points) {
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
  }

  function facePath(face, project) {
    path([[0, 0], [face.w, 0], [face.w, face.h], [0, face.h]].map(([u, v]) => project(onFace(face, u, v))));
  }

  function mapFace(face, project, draw) {
    const p = project(face.origin);
    const u = project(onFace(face, 1, 0));
    const v = project(onFace(face, 0, 1));
    ctx.save();
    ctx.transform(u.x - p.x, u.y - p.y, v.x - p.x, v.y - p.y, p.x, p.y);
    ctx.beginPath();
    ctx.rect(0, 0, face.w, face.h);
    ctx.clip();
    draw();
    ctx.restore();
  }

  function backdrop(width, height, project) {
    const sky = ctx.createLinearGradient(0, 0, width * .24, height);
    sky.addColorStop(0, '#2f4a54');
    sky.addColorStop(.58, '#1a3540');
    sky.addColorStop(1, '#10252d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#90b4bd1b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -11; i < 20; i += 1) {
      const a = project(point(i, depth + .04, -9));
      const b = project(point(i, depth + .04, 12));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    for (let i = -11; i < 13; i += 1) {
      const a = project(point(-12, depth + .04, i));
      const b = project(point(21, depth + .04, i));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    const shadow = project(point(terrainWidth * .54, depth, breadth * .6));
    ctx.save();
    ctx.translate(shadow.x, shadow.y);
    ctx.scale(Math.min(width * .50, 530), Math.min(height * .23, 130));
    const falloff = ctx.createRadialGradient(0, 0, .08, 0, 0, 1);
    falloff.addColorStop(0, '#06171ed9');
    falloff.addColorStop(.69, '#06171e8e');
    falloff.addColorStop(1, '#06171e00');
    ctx.fillStyle = falloff;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function strata(face) {
    if (texture.naturalWidth) {
      const sampleWidth = texture.naturalWidth * face.w / terrainWidth;
      const sampleTop = texture.naturalHeight * .54;
      const strataBreak = depth * .39;
      ctx.drawImage(texture, 0, 0, sampleWidth, sampleTop, 0, 0, face.w, strataBreak);
      ctx.drawImage(texture, 0, sampleTop, sampleWidth, texture.naturalHeight - sampleTop,
        0, strataBreak, face.w, depth - strataBreak);
    } else {
      const layers = ctx.createLinearGradient(0, 0, 0, depth);
      layers.addColorStop(0, '#2d2019');
      layers.addColorStop(.18, '#493225');
      layers.addColorStop(.21, '#875537');
      layers.addColorStop(.50, '#a66f43');
      layers.addColorStop(.53, '#b39168');
      layers.addColorStop(1, '#a58b65');
      ctx.fillStyle = layers;
      ctx.fillRect(0, 0, face.w, depth);
    }
    ctx.fillStyle = 'rgba(13, 24, 22, ' + face.shade + ')';
    ctx.fillRect(0, 0, face.w, depth);
  }

  function groundwater(face, waterDepth, front) {
    const water = ctx.createLinearGradient(0, waterDepth, 0, depth);
    water.addColorStop(0, '#227b87ae');
    water.addColorStop(.35, '#205f70b8');
    water.addColorStop(1, '#244a57bd');
    ctx.fillStyle = water;
    ctx.fillRect(0, waterDepth, face.w, depth - waterDepth);
    if (!front) return;
    ctx.globalAlpha = .85;
    ctx.strokeStyle = '#9dd4d9cf';
    ctx.lineWidth = .022;
    ctx.beginPath();
    ctx.moveTo(0, waterDepth);
    ctx.lineTo(face.w, waterDepth);
    ctx.stroke();
  }

  function roots(face) {
    const random = randomSequence(face.family === 'x' ? 65 : 37);
    for (let n = 0; n < face.w * 4.2; n += 1) {
      const x = random() * face.w;
      const length = .11 + random() * .58;
      const lean = (random() - .5) * .27;
      ctx.lineWidth = .009 + random() * .006;
      ctx.strokeStyle = n % 3 === 0 ? '#d6af7da1' : '#a88059a5';
      ctx.beginPath();
      ctx.moveTo(x, .012);
      ctx.quadraticCurveTo(x + lean, length * .46, x + lean * .52, length);
      for (let branch = 1; branch <= 3; branch += 1) {
        const y = length * branch * .21;
        const stem = x + lean * branch / 3;
        ctx.moveTo(stem, y);
        ctx.quadraticCurveTo(stem + (branch % 2 ? -.11 : .09), y + .05, stem + (branch % 2 ? -.14 : .125), y + .12);
      }
      ctx.stroke();
    }
  }

  function infiltration(face, effectiveInfiltration) {
    if (face.family !== 'z') return;
    const count = Math.max(1, Math.round(effectiveInfiltration / 17));
    const end = .18 + effectiveInfiltration / 120 * 1.16;
    ctx.strokeStyle = '#c8e5e6ad';
    ctx.lineWidth = .013;
    for (let n = 0; n < count; n += 1) {
      const x = 1.16 + (n + .45) * (face.w - 1.65) / count;
      ctx.beginPath();
      ctx.setLineDash([.065, .077]);
      ctx.moveTo(x, .075);
      ctx.lineTo(x, end);
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(x - .043, end - .075);
      ctx.lineTo(x, end);
      ctx.lineTo(x + .043, end - .075);
      ctx.stroke();
    }
  }

  function chips(state) {
    for (const type of ['biochar', 'lime']) {
      if (!state.remedies[type]) continue;
      const charcoal = type === 'biochar';
      const random = randomSequence(charcoal ? 397 : 773);
      const center = charcoal ? 1.36 : 2.48;
      for (let i = 0; i < 138; i += 1) {
        const x = center + (random() + random() - 1) * 1.13;
        const z = .75 + (random() + random() - 1) * .64;
        const size = .015 + random() * .052;
        ctx.beginPath();
        ctx.moveTo(x - size, z);
        ctx.lineTo(x - size * .29, z - size * .85);
        ctx.lineTo(x + size * .65, z - size * .54);
        ctx.lineTo(x + size, z + size * .25);
        ctx.lineTo(x - size * .21, z + size * .72);
        ctx.closePath();
        ctx.fillStyle = charcoal ? (i % 3 === 0 ? '#373e37' : '#171f20') : (i % 3 === 0 ? '#bfb89a' : '#e1d9b9');
        ctx.fill();
        ctx.strokeStyle = charcoal ? '#778475ab' : '#f4ebcd9c';
        ctx.lineWidth = .008;
        ctx.stroke();
      }
    }
  }

  function topsoil(state) {
    ctx.globalAlpha = .51;
    if (texture.naturalWidth) {
      ctx.drawImage(texture, 0, 0, texture.naturalWidth, texture.naturalHeight * .13, 0, 0, surface.w, surface.h);
    } else {
      ctx.fillStyle = '#383426';
      ctx.fillRect(0, 0, surface.w, surface.h);
    }
    ctx.fillStyle = state.remedies.vegetation ? '#68773c62' : '#4f572c39';
    ctx.fillRect(0, 0, surface.w, surface.h);
    ctx.globalAlpha = 1;
    chips(state);
  }

  function walls(facets, project, state, front) {
    for (const face of facets) {
      mapFace(face, project, () => {
        ctx.globalAlpha = front ? .34 : .68;
        strata(face);
        groundwater(face, state.groundwaterDepth, front);
        if (!front) return;
        ctx.globalAlpha = 1;
        if (state.remedies.vegetation) roots(face);
        infiltration(face, state.infiltration);
      });

      if (front) {
        ctx.beginPath();
        facePath(face, project);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#a3b7a66c';
        ctx.stroke();
      }
    }
  }

  function vegetation(view, cover) {
    const { project, scale } = view;
    for (let shade = 0; shade < grassColors.length; shade += 1) {
      ctx.beginPath();
      for (const tuft of foliage) {
        if (tuft.sparsePatch || (!cover && !tuft.base)) continue;
        const start = project(point(tuft.x, 0, tuft.z));
        for (const blade of tuft.blades) {
          if (blade.color !== shade) continue;
          const size = cover ? 1 : .55;
          const mid = project(point(tuft.x + blade.dx * .24, -blade.height * size * .65, tuft.z + blade.dz * .25));
          const end = project(point(tuft.x + blade.dx * size, -blade.height * size, tuft.z + blade.dz * size));
          ctx.moveTo(start.x, start.y);
          ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
        }
      }
      ctx.lineWidth = clamp(scale * .009, .45, 1.3);
      ctx.strokeStyle = grassColors[shade];
      ctx.stroke();
    }
  }

  function callout(p, label, width, height, upward, color) {
    if (p.x < 10 || p.x > width - 10 || p.y < 54 || p.y > height - 27) return;
    const compact = width < 520;
    ctx.font = '600 ' + (compact ? 10 : 12) + 'px system-ui';
    const w = ctx.measureText(label).width + 16;
    const h = compact ? 20 : 23;
    const x = clamp(p.x + (upward ? 19 : 13), 8, width - w - 8);
    const y = clamp(p.y + (upward ? -35 : 10), 53, height - h - 31);

    ctx.strokeStyle = '#d8edf0db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x + 5, upward ? y + h - 3 : y + 4);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#112a34ed';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = '#f4f8f7';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, y + h / 2);
  }

  return function draw(state, camera, waterLabel) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 40 || height < 128) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const actualWidth = Math.round(width * pixelRatio);
    const actualHeight = Math.round(height * pixelRatio);
    if (canvas.width !== actualWidth) canvas.width = actualWidth;
    if (canvas.height !== actualHeight) canvas.height = actualHeight;
    ctx.setTransform(actualWidth / width, 0, 0, actualHeight / height, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    if (state !== lastState) {
      field = createPlumeField(state);
      lastState = state;
    }
    const view = viewpoint(camera, width, height);
    const { project, visible } = view;
    backdrop(width, height, project);
    mapFace(base, project, () => {
      ctx.fillStyle = '#234553c4';
      ctx.fillRect(0, 0, terrainWidth, breadth);
    });
    walls(view.rear, project, state, false);
    ctx.save();
    ctx.beginPath();
    path(silhouette(vertices.map(project)));
    ctx.clip();
    paintPlume(ctx, view, field, width, height);
    ctx.restore();
    walls(visible, project, state, true);
    mapFace(surface, project, () => topsoil(state));
    vegetation(view, state.remedies.vegetation);

    const waterFace = view.clearest;
    const waterPoint = project(onFace(waterFace, waterFace.w * .76, state.groundwaterDepth));
    callout(project(point(source.x, 0, source.z)), 'Origen · Cd', width, height, true, '#ecaa52');
    callout(waterPoint, 'Nivel freático · ' + waterLabel, width, height, false, '#60bdc8');
  };
}
