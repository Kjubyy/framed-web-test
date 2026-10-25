// KI-Check: Prompt bauen, Antwort lesen, optional Gemini direkt fragen.

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

export function toPct(frame, imageW, imageH) {
  const r = (v) => Math.round(v * 10) / 10;
  return { x: r((frame.x / imageW) * 100), y: r((frame.y / imageH) * 100), w: r((frame.w / imageW) * 100), h: r((frame.h / imageH) * 100) };
}

export function buildPrompt({ aspectLabel, framePct: f }) {
  return [
    'Du bist Fotograf und Bildgestalter.',
    `Auf dem Foto siehst du einen gestrichelten Rahmen: mein geplanter Bildausschnitt im Format ${aspectLabel} ` +
      `(x ${f.x} %, y ${f.y} %, Breite ${f.w} %, Höhe ${f.h} % – gemessen am ganzen Foto, x/y = linke obere Ecke).`,
    'Prüfe die Komposition: Drittel-Regel, Hauptmotiv, Horizont, Blickraum, störende Dinge am Rand.',
    'Antworte GENAU in diesem Format, ohne weitere Erklärungen:',
    `FRAME x y b h  (bester Ausschnitt im Format ${aspectLabel}, Prozent des ganzen Fotos; unverändert lassen, wenn er schon gut ist)`,
    'Danach eine Zeile: ein kurzer Tipp auf Deutsch (max. 1 Satz).',
  ].join('\n');
}

const NUM = /-?\d+(?:[.,]\d+)?/g;

// Liest „FRAME x y b h“ + Tipp. Gibt {frame: {x,y,w,h} als Anteile 0..1, tip} oder null zurück.
// Wurde der Prompt mitkopiert, wird dessen „FRAME x y b h“-Zeile übersprungen.
export function parseFrameReply(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const r = /FRAME/i.test(lines[i]) && parseFrameLine(lines, i);
    if (r) return r;
  }
  return null;
}

function parseFrameLine(lines, idx) {
  const after = lines[idx].slice(lines[idx].search(/FRAME/i) + 5);
  const nums = (after.match(NUM) || []).map((s) => parseFloat(s.replace(',', '.')));
  if (nums.length < 4) return null;
  let [x, y, w, h] = nums;
  if (Math.max(x, y, w, h) > 1) {
    x /= 100;
    y /= 100;
    w /= 100;
    h /= 100;
  }
  w = Math.min(Math.max(w, 0), 1);
  h = Math.min(Math.max(h, 0), 1);
  if (w < 0.05 || h < 0.05) return null;
  x = Math.min(Math.max(x, 0), 1 - w);
  y = Math.min(Math.max(y, 0), 1 - h);

  const clean = (s) =>
    s
      .replace(/[*_`#>]/g, '')
      .replace(/^\s*(zeile\s*2|tipp|tip)\s*[:\-–]\s*/i, '')
      .trim();
  const tip = lines
    .slice(idx + 1)
    .map(clean)
    .filter(Boolean)
    .join(' ')
    .slice(0, 220);
  return { frame: { x, y, w, h }, tip };
}

// Wählt die neueste „gemini-X-flash“-Variante, sonst irgendein Flash-Modell, sonst das erste.
export function pickDefaultModel(names) {
  const plain = names.map((n) => n.replace(/^models\//, ''));
  let best = null;
  let bestVer = -1;
  for (const n of plain) {
    const m = n.match(/^gemini-(\d+(?:\.\d+)?)-flash$/);
    if (m && parseFloat(m[1]) > bestVer) {
      bestVer = parseFloat(m[1]);
      best = n;
    }
  }
  return best ?? plain.find((n) => n.includes('flash')) ?? plain[0] ?? null;
}

export async function listGeminiModels(key) {
  const res = await fetch(`${GEMINI}/models?pageSize=200&key=${encodeURIComponent(key)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return (json.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
    .map((m) => m.name.replace(/^models\//, ''));
}

export async function askGemini({ key, model, prompt, jpegBase64 }) {
  const res = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } }] }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
  const parts = json.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('\n');
}

// Verkleinertes Standbild mit eingezeichnetem (gestricheltem) Frame.
export function makeSnapshot(source, imageW, imageH, frame, maxSide = 1280) {
  const s = Math.min(1, maxSide / Math.max(imageW, imageH));
  const c = document.createElement('canvas');
  c.width = Math.round(imageW * s);
  c.height = Math.round(imageH * s);
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0, c.width, c.height);
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = Math.max(3, c.width / 250);
  ctx.strokeStyle = '#ffd400';
  ctx.strokeRect(frame.x * s, frame.y * s, frame.w * s, frame.h * s);
  return c;
}
