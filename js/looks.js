// Filmlooks und Rahmen. applyLookToPixels arbeitet direkt auf RGBA-Daten (ImageData.data).

export const LOOKS = [
  { id: 'original', name: 'Original' },
  { id: 'portra', name: 'Portra', warmth: 0.05, contrast: -0.05, saturation: 0.9, fade: 0.04, grain: 0.035, vignette: 0.25 },
  { id: 'gold', name: 'Gold', warmth: 0.09, contrast: 0.08, saturation: 1.15, grain: 0.04, vignette: 0.25 },
  { id: 'cinestill', name: 'Cinestill', warmth: -0.03, tint: 0.02, contrast: 0.12, saturation: 1.08, grain: 0.05, vignette: 0.3 },
  { id: 'fade', name: 'Verblasst', contrast: -0.15, saturation: 0.75, fade: 0.1, grain: 0.03, vignette: 0.15 },
  { id: 'trix', name: 'Tri-X', bw: true, contrast: 0.25, grain: 0.08, vignette: 0.35 },
];

export const FRAMES = [
  { id: 'none', name: 'Ohne' },
  { id: 'gallery', name: 'Galerie' },
  { id: 'polaroid', name: 'Sofortbild' },
  { id: 'black', name: 'Schwarz' },
];

// Deterministischer Zufall, damit Korn bei Vorschau und Export gleich aussieht.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function applyLookToPixels(data, w, h, look, seed = 1) {
  const { bw = false, saturation = 1, warmth = 0, tint = 0, contrast = 0, fade = 0, grain = 0, vignette = 0 } = look;
  if (!bw && saturation === 1 && !warmth && !tint && !contrast && !fade && !grain && !vignette) return;
  const rand = mulberry32(seed);
  const cx = w / 2;
  const cy = h / 2;
  const maxD2 = cx * cx + cy * cy;
  const k = 1 + contrast;
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  for (let y = 0; y < h; y++) {
    const dy2 = (y + 0.5 - cy) ** 2;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (bw) {
        r = g = b = l;
      } else {
        r = l + (r - l) * saturation + warmth;
        g = l + (g - l) * saturation - tint;
        b = l + (b - l) * saturation - warmth;
      }
      r = (r - 0.5) * k + 0.5;
      g = (g - 0.5) * k + 0.5;
      b = (b - 0.5) * k + 0.5;
      r = fade + r * (1 - fade);
      g = fade + g * (1 - fade);
      b = fade + b * (1 - fade);
      const v = vignette ? 1 - vignette * (((x + 0.5 - cx) ** 2 + dy2) / maxD2) : 1;
      const n = grain ? (rand() - 0.5) * 2 * grain : 0;
      data[i] = clamp(r * v + n) * 255;
      data[i + 1] = clamp(g * v + n) * 255;
      data[i + 2] = clamp(b * v + n) * 255;
    }
  }
}

function copyCanvas(src, w = src.width, h = src.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return c;
}

export function renderLook(src, lookId) {
  const c = copyCanvas(src);
  const look = LOOKS.find((l) => l.id === lookId) || LOOKS[0];
  if (look.id === 'original') return c;
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  applyLookToPixels(img.data, c.width, c.height, look);
  ctx.putImageData(img, 0, 0);
  return c;
}

export function renderFrame(src, frameId) {
  const { width: w, height: h } = src;
  const m = Math.min(w, h);
  let pad;
  let color;
  if (frameId === 'gallery') {
    const b = Math.round(m * 0.07);
    pad = { l: b, r: b, t: b, b };
    color = '#f4f1ea';
  } else if (frameId === 'polaroid') {
    const b = Math.round(w * 0.06);
    pad = { l: b, r: b, t: b, b: Math.round(w * 0.25) };
    color = '#fbfaf7';
  } else if (frameId === 'black') {
    const b = Math.round(m * 0.035);
    pad = { l: b, r: b, t: b, b };
    color = '#111111';
  } else {
    return src;
  }
  const c = document.createElement('canvas');
  c.width = w + pad.l + pad.r;
  c.height = h + pad.t + pad.b;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, pad.l, pad.t);
  if (frameId === 'gallery') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = Math.max(1, m / 900);
    ctx.strokeRect(pad.l, pad.t, w, h);
  }
  return c;
}
