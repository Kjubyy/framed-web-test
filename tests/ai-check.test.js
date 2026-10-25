import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseFrameReply, pickDefaultModel, toPct } from '../js/ai-check.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('Prompt enthält Format und Frame-Werte', () => {
  const p = buildPrompt({ aspectLabel: '4:5', framePct: { x: 10, y: 20, w: 50, h: 40 } });
  assert.match(p, /FRAME x y b h/);
  assert.match(p, /x 10 %, y 20 %, Breite 50 %, Höhe 40 %/);
});

test('toPct rundet auf eine Nachkommastelle', () => {
  assert.deepEqual(toPct({ x: 108, y: 192, w: 540, h: 675 }, 1080, 1920), { x: 10, y: 10, w: 50, h: 35.2 });
});

test('einfache Antwort', () => {
  const r = parseFrameReply('FRAME 10 20 50 40\nEtwas tiefer gehen.');
  assert.deepEqual(r.frame, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  assert.equal(r.tip, 'Etwas tiefer gehen.');
});

test('Markdown, Kommas, Prozentzeichen', () => {
  const r = parseFrameReply('Hier:\n**FRAME: 12,5 % 20 % 40 % 30 %**\n\nTipp: Horizont aufs untere Drittel.');
  assert.ok(near(r.frame.x, 0.125) && near(r.frame.w, 0.4));
  assert.equal(r.tip, 'Horizont aufs untere Drittel.');
});

test('Werte als Anteile (0..1) werden akzeptiert', () => {
  const r = parseFrameReply('FRAME 0.1 0.2 0.5 0.4');
  assert.deepEqual(r.frame, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  assert.equal(r.tip, '');
});

test('Clamping: Frame bleibt im Bild', () => {
  const r = parseFrameReply('FRAME 80 -5 40 30');
  assert.ok(near(r.frame.x, 0.6) && near(r.frame.y, 0));
});

test('mitkopierter Prompt wird übersprungen', () => {
  const prompt = buildPrompt({ aspectLabel: '4:5', framePct: { x: 10, y: 20, w: 50, h: 40 } });
  const r = parseFrameReply(`${prompt}\nFRAME 15 25 45 36\nNäher ans Motiv.`);
  assert.deepEqual(r.frame, { x: 0.15, y: 0.25, w: 0.45, h: 0.36 });
  assert.equal(r.tip, 'Näher ans Motiv.');
});

test('ungültig → null', () => {
  assert.equal(parseFrameReply('Sieht gut aus!'), null);
  assert.equal(parseFrameReply('FRAME 10 20'), null);
  assert.equal(parseFrameReply('FRAME 10 20 1 2'), null);
  assert.equal(parseFrameReply(''), null);
});

test('pickDefaultModel nimmt neueste Flash-Version', () => {
  assert.equal(pickDefaultModel(['models/gemini-2.0-flash', 'models/gemini-2.5-flash', 'models/gemini-2.5-pro']), 'gemini-2.5-flash');
  assert.equal(pickDefaultModel(['gemini-x-flash-preview', 'gemini-pro']), 'gemini-x-flash-preview');
  assert.equal(pickDefaultModel(['gemini-pro']), 'gemini-pro');
  assert.equal(pickDefaultModel([]), null);
});
