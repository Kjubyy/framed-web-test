import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromGravity } from '../js/level.js';

const G = 9.81;
const rad = (d) => (d * Math.PI) / 180;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('aufrecht im Hochformat → 0°', () => {
  assert.ok(near(levelFromGravity(0, G, 0).roll, 0));
});

test('5° gekippt → Betrag 5°, Vorzeichen je Richtung', () => {
  const right = levelFromGravity(-G * Math.sin(rad(5)), G * Math.cos(rad(5)), 0).roll;
  const left = levelFromGravity(G * Math.sin(rad(5)), G * Math.cos(rad(5)), 0).roll;
  assert.ok(near(right, -5));
  assert.ok(near(left, 5));
});

test('invertierte Achsen (ältere iOS-Versionen) → gleicher Wert', () => {
  const a = levelFromGravity(G * Math.sin(rad(7)), G * Math.cos(rad(7)), 0).roll;
  const b = levelFromGravity(-G * Math.sin(rad(7)), -G * Math.cos(rad(7)), 0).roll;
  assert.ok(near(a, b));
});

test('Querformat → 0°', () => {
  assert.ok(near(levelFromGravity(G, 0, 0).roll, 0));
  assert.ok(near(levelFromGravity(-G, 0, 0).roll, 0));
});

test('pitch: flach liegend ±90°, aufrecht 0°', () => {
  assert.ok(near(Math.abs(levelFromGravity(0, 0, G).pitch), 90));
  assert.ok(near(levelFromGravity(0, G, 0).pitch, 0));
});
