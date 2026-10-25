// Kompositionsregeln: Motiv → Ziel-Frame → Hinweise. Alles in Video-Pixeln.
import { adjustAspect, center, clampRect, fitRect } from './geometry.js';

export const ASPECTS = { '4:5': 4 / 5, '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16 };

// Anteil der Frame-Fläche, den das Motiv füllen soll. Bei ~18 % ist das Motiv gut 40 % so breit
// wie der Frame – klein genug, um es auf einen Drittel-Punkt zu setzen.
export const TARGET_FILL = 0.18;
const MARGIN = 1.2; // Mindestabstand Motiv ↔ Frame-Rand (Faktor)
const ALIGN_TOL = 0.06; // erlaubte Abweichung Frame-Mitte ↔ Bildmitte (Anteil der Bildgröße)
const MIN_FILL = 0.7; // Frame muss mindestens so viel vom möglichen Ausschnitt füllen

// Wählt aus den Erkennungen das wahrscheinlichste Hauptmotiv.
// detections: [{x, y, w, h, score, category}]
export function pickSubject(detections, imageW, imageH) {
  const halfDiag = Math.hypot(imageW, imageH) / 2;
  let best = null;
  let bestScore = 0;
  for (const d of detections) {
    const area = (d.w * d.h) / (imageW * imageH);
    if (area > 0.9 || area < 0.002) continue;
    const c = center(d);
    const dist = Math.hypot(c.x - imageW / 2, c.y - imageH / 2) / halfDiag;
    const weight = d.category === 'person' ? 1.3 : 1;
    const s = Math.sqrt(area) * (1 - 0.6 * dist) * (d.score ?? 1) * weight;
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return best;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Ziel-Frame für ein Motiv. `tooBig`: Frame passt nicht ins Bild → weiter weg gehen.
export function computeTargetFrame({ subject, imageW, imageH, aspect }) {
  if (!subject) return { frame: fitRect(imageW, imageH, aspect, 0.85), tooBig: false };

  let w = Math.sqrt(((subject.w * subject.h) / TARGET_FILL) * aspect);
  let h = w / aspect;
  const grow = Math.max((subject.w * MARGIN) / w, (subject.h * MARGIN) / h, 1);
  w *= grow;
  h *= grow;

  const max = fitRect(imageW, imageH, aspect);
  const tooBig = w > max.w * 1.001 || h > max.h * 1.001;

  // Motivmitte auf den nächstgelegenen Drittel-Punkt; hohe Motive vertikal mittig.
  const c = center(subject);
  let px = c.x / imageW < 0.5 ? 1 / 3 : 2 / 3;
  let py = subject.h / h > 0.45 ? 0.5 : c.y / imageH < 0.5 ? 1 / 3 : 2 / 3;
  // Motiv darf nicht aus dem Frame ragen (rückt bei großen Motiven Richtung Mitte).
  const mx = subject.w / 2 / w + 0.02;
  const my = subject.h / 2 / h + 0.02;
  px = clamp(px, Math.min(mx, 0.5), Math.max(1 - mx, 0.5));
  py = clamp(py, Math.min(my, 0.5), Math.max(1 - my, 0.5));

  const frame = { x: c.x - px * w, y: c.y - py * h, w, h };
  return { frame: clampRect(frame, imageW, imageH), tooBig };
}

// Wie muss die Kamera bewegt werden, damit der Frame den Sucher füllt?
export function computeGuidance({ frame, tooBig, imageW, imageH, aspect }) {
  const max = fitRect(imageW, imageH, aspect);
  const c = center(frame);
  const dx = (c.x - imageW / 2) / imageW;
  const dy = (c.y - imageH / 2) / imageH;
  const fill = frame.w / max.w;
  const hints = [];
  if (dx > ALIGN_TOL) hints.push('→ nach rechts schwenken');
  else if (dx < -ALIGN_TOL) hints.push('← nach links schwenken');
  if (dy > ALIGN_TOL) hints.push('↓ etwas nach unten');
  else if (dy < -ALIGN_TOL) hints.push('↑ etwas nach oben');
  if (tooBig) hints.push('Weiter weg gehen');
  else if (fill < MIN_FILL) hints.push('Näher ran oder zoomen');
  const aligned = Math.abs(dx) <= ALIGN_TOL && Math.abs(dy) <= ALIGN_TOL && !tooBig && fill >= MIN_FILL;
  return { dx, dy, fill, aligned, hints };
}

// Merkt sich die Lage eines Frames relativ zum Motiv (für KI-Korrekturen, die dem Motiv folgen).
export function relationFrom(subject, frame) {
  const sc = center(subject);
  const fc = center(frame);
  return {
    cx: (fc.x - sc.x) / subject.w,
    cy: (fc.y - sc.y) / subject.h,
    w: frame.w / subject.w,
    h: frame.h / subject.h,
  };
}

export function frameFromRelation(subject, rel, aspect, imageW, imageH) {
  const sc = center(subject);
  const w = rel.w * subject.w;
  const h = rel.h * subject.h;
  const cx = sc.x + rel.cx * subject.w;
  const cy = sc.y + rel.cy * subject.h;
  const r = adjustAspect({ x: cx - w / 2, y: cy - h / 2, w, h }, aspect);
  return clampRect(r, imageW, imageH);
}

// Mittlere Helligkeit (0–255) → Belichtungshinweis.
export function lumaHint(mean) {
  if (mean < 55) return 'Zu dunkel – mehr Licht suchen';
  if (mean > 205) return 'Sehr hell – Gegenlicht vermeiden';
  return null;
}
