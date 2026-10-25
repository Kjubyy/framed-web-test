// Zeichnet Frame, Drittel-Linien, Fadenkreuz und Wasserwaage über das Kamerabild.
import { center, rectToScreen } from './geometry.js';

const GREEN = '#3ddc84';
const YELLOW = '#ffd400';
export const LEVEL_TOL = 1.5; // Grad

// cw/ch: Größe in CSS-Pixeln, t: coverTransform, frame/subject in Video-Pixeln, roll in Grad oder null.
export function drawOverlay(ctx, { cw, ch, t, frame, subject, aligned, showGrid, roll }) {
  ctx.clearRect(0, 0, cw, ch);
  if (!frame) return;
  const f = rectToScreen(frame, t);

  // Außerhalb des Frames abdunkeln.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.rect(0, 0, cw, ch);
  ctx.rect(f.x, f.y, f.w, f.h);
  ctx.fill('evenodd');

  if (subject) {
    const s = rectToScreen(subject, t);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.setLineDash([]);
  }

  if (showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const k of [1 / 3, 2 / 3]) {
      ctx.moveTo(f.x + f.w * k, f.y);
      ctx.lineTo(f.x + f.w * k, f.y + f.h);
      ctx.moveTo(f.x, f.y + f.h * k);
      ctx.lineTo(f.x + f.w, f.y + f.h * k);
    }
    ctx.stroke();
  }

  // Rahmen + Eckwinkel
  const color = aligned ? GREEN : '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  const L = Math.min(28, f.w / 5, f.h / 5);
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [f.x, f.y, 1, 1],
    [f.x + f.w, f.y, -1, 1],
    [f.x, f.y + f.h, 1, -1],
    [f.x + f.w, f.y + f.h, -1, -1],
  ]) {
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
  }
  ctx.stroke();

  // Fadenkreuz in der Bildschirmmitte, Zielpunkt in der Frame-Mitte.
  const cx = cw / 2;
  const cy = ch / 2;
  const fc = center(f);
  if (!aligned) {
    ctx.strokeStyle = 'rgba(255,212,0,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(fc.x, fc.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = aligned ? GREEN : YELLOW;
  ctx.beginPath();
  ctx.arc(fc.x, fc.y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy);
  ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();

  // Wasserwaage: feste Referenz + Linie, die dem echten Horizont folgt.
  if (roll != null) {
    const level = Math.abs(roll) < LEVEL_TOL;
    const R = 70;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - R - 30, cy);
    ctx.lineTo(cx - 24, cy);
    ctx.moveTo(cx + 24, cy);
    ctx.lineTo(cx + R + 30, cy);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((roll * Math.PI) / 180);
    ctx.strokeStyle = level ? GREEN : YELLOW;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.lineTo(-24, 0);
    ctx.moveTo(24, 0);
    ctx.lineTo(R, 0);
    ctx.stroke();
    ctx.restore();
  }
}
