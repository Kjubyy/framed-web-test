// Rechteck-Helfer. Ein Rechteck ist immer {x, y, w, h} (x/y = oben links).

export function center(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// Abbildung von Video-Pixeln auf Bildschirm-Pixel bei object-fit: cover.
export function coverTransform(vw, vh, cw, ch) {
  const s = Math.max(cw / vw, ch / vh);
  return { s, ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2 };
}

export function rectToScreen(r, t) {
  return { x: r.x * t.s + t.ox, y: r.y * t.s + t.oy, w: r.w * t.s, h: r.h * t.s };
}

// Größtes Rechteck mit Seitenverhältnis `aspect` (Breite/Höhe), mittig im Bild, skaliert mit `scale`.
export function fitRect(imageW, imageH, aspect, scale = 1) {
  let w = imageW;
  let h = w / aspect;
  if (h > imageH) {
    h = imageH;
    w = h * aspect;
  }
  w *= scale;
  h *= scale;
  return { x: (imageW - w) / 2, y: (imageH - h) / 2, w, h };
}

// Gleiches Zentrum und gleiche Fläche, aber exaktes Seitenverhältnis.
export function adjustAspect(r, aspect) {
  const area = r.w * r.h;
  const w = Math.sqrt(area * aspect);
  const h = w / aspect;
  const c = center(r);
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

// Schiebt das Rechteck ins Bild; ist es größer als das Bild, wird es mittig verkleinert.
export function clampRect(r, imageW, imageH) {
  let { x, y, w, h } = r;
  const shrink = Math.min(1, imageW / w, imageH / h);
  if (shrink < 1) {
    const c = center(r);
    w *= shrink;
    h *= shrink;
    x = c.x - w / 2;
    y = c.y - h / 2;
  }
  x = Math.min(Math.max(x, 0), imageW - w);
  y = Math.min(Math.max(y, 0), imageH - h);
  return { x, y, w, h };
}

export function smoothRect(prev, next, alpha) {
  if (!prev) return next;
  const mix = (a, b) => a + (b - a) * alpha;
  return { x: mix(prev.x, next.x), y: mix(prev.y, next.y), w: mix(prev.w, next.w), h: mix(prev.h, next.h) };
}
