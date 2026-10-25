import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, applyLookToPixels } from '../js/looks.js';

function image(w, h, rgb) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = rgb[0];
    d[i + 1] = rgb[1];
    d[i + 2] = rgb[2];
    d[i + 3] = 255;
  }
  return d;
}

test('Original lässt Pixel unverändert', () => {
  const d = image(4, 4, [200, 100, 50]);
  const before = Array.from(d);
  applyLookToPixels(d, 4, 4, LOOKS.find((l) => l.id === 'original'));
  assert.deepEqual(Array.from(d), before);
});

test('Schwarzweiß-Look: R = G = B', () => {
  const d = image(8, 8, [220, 80, 30]);
  applyLookToPixels(d, 8, 8, LOOKS.find((l) => l.id === 'trix'));
  for (let i = 0; i < d.length; i += 4) {
    assert.equal(d[i], d[i + 1]);
    assert.equal(d[i + 1], d[i + 2]);
  }
});

test('Vignette dunkelt die Ecken', () => {
  const w = 21;
  const d = image(w, w, [128, 128, 128]);
  applyLookToPixels(d, w, w, { vignette: 0.5 });
  const px = (x, y) => d[(y * w + x) * 4];
  assert.ok(px(0, 0) < px(10, 10) - 30);
});

test('Korn ist deterministisch', () => {
  const a = image(6, 6, [120, 120, 120]);
  const b = image(6, 6, [120, 120, 120]);
  applyLookToPixels(a, 6, 6, { grain: 0.1 }, 7);
  applyLookToPixels(b, 6, 6, { grain: 0.1 }, 7);
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('Alpha bleibt erhalten', () => {
  const d = image(3, 3, [10, 20, 30]);
  applyLookToPixels(d, 3, 3, LOOKS.find((l) => l.id === 'portra'));
  for (let i = 3; i < d.length; i += 4) assert.equal(d[i], 255);
});
