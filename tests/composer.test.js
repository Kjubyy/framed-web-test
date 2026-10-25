import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASPECTS,
  TARGET_FILL,
  computeGuidance,
  computeTargetFrame,
  frameFromRelation,
  lumaHint,
  pickSubject,
  relationFrom,
} from '../js/composer.js';
import { center, coverTransform, fitRect, rectToScreen } from '../js/geometry.js';

const W = 1080;
const H = 1920;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const inside = (r) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= W + 1e-6 && r.y + r.h <= H + 1e-6;

test('ohne Motiv: zentrierter Frame mit exaktem Seitenverhältnis', () => {
  const { frame, tooBig } = computeTargetFrame({ subject: null, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  assert.equal(tooBig, false);
  assert.ok(near(frame.w / frame.h, 4 / 5));
  assert.ok(near(center(frame).x, W / 2) && near(center(frame).y, H / 2));
});

test('kleines Motiv links: liegt auf linkem Drittel, füllt ~TARGET_FILL', () => {
  const subject = { x: 250, y: 900, w: 120, h: 160, category: 'cup' };
  const { frame, tooBig } = computeTargetFrame({ subject, imageW: W, imageH: H, aspect: ASPECTS['1:1'] });
  assert.equal(tooBig, false);
  assert.ok(near(frame.w, frame.h, 1e-6));
  assert.ok(inside(frame));
  const sc = center(subject);
  assert.ok(near((sc.x - frame.x) / frame.w, 1 / 3, 1e-6));
  const fill = (subject.w * subject.h) / (frame.w * frame.h);
  assert.ok(near(fill, TARGET_FILL, 1e-9), `fill=${fill}`);
});

test('Motiv rechts unten: rechtes und unteres Drittel', () => {
  const subject = { x: 700, y: 1300, w: 100, h: 100 };
  const { frame } = computeTargetFrame({ subject, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  const sc = center(subject);
  assert.ok(near((sc.x - frame.x) / frame.w, 2 / 3));
  assert.ok(near((sc.y - frame.y) / frame.h, 2 / 3));
});

test('Motiv ragt nie aus dem Frame', () => {
  const subject = { x: 300, y: 600, w: 300, h: 700 };
  const { frame } = computeTargetFrame({ subject, imageW: W, imageH: H, aspect: ASPECTS['3:4'] });
  assert.ok(subject.x >= frame.x && subject.x + subject.w <= frame.x + frame.w);
  assert.ok(subject.y >= frame.y && subject.y + subject.h <= frame.y + frame.h);
});

test('riesiges Motiv → tooBig, Frame bleibt im Bild', () => {
  const subject = { x: 50, y: 200, w: 980, h: 1500 };
  const { frame, tooBig } = computeTargetFrame({ subject, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  assert.equal(tooBig, true);
  assert.ok(inside(frame));
  assert.ok(near(frame.w / frame.h, 4 / 5, 1e-6));
});

test('Guidance: zentrierter großer Frame ist ausgerichtet', () => {
  const frame = fitRect(W, H, ASPECTS['4:5'], 0.9);
  const g = computeGuidance({ frame, tooBig: false, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  assert.equal(g.aligned, true);
  assert.deepEqual(g.hints, []);
});

test('Guidance: Frame rechts oben und klein → schwenken + näher', () => {
  const frame = { x: 700, y: 100, w: 300, h: 375 };
  const g = computeGuidance({ frame, tooBig: false, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  assert.equal(g.aligned, false);
  assert.ok(g.hints.includes('→ nach rechts schwenken'));
  assert.ok(g.hints.includes('↑ etwas nach oben'));
  assert.ok(g.hints.includes('Näher ran oder zoomen'));
});

test('Guidance: tooBig → weiter weg', () => {
  const frame = fitRect(W, H, ASPECTS['4:5']);
  const g = computeGuidance({ frame, tooBig: true, imageW: W, imageH: H, aspect: ASPECTS['4:5'] });
  assert.ok(g.hints.includes('Weiter weg gehen'));
  assert.equal(g.aligned, false);
});

test('Relation: Roundtrip und Mitbewegen mit dem Motiv', () => {
  const subject = { x: 400, y: 800, w: 200, h: 200 };
  const frame = { x: 300, y: 650, w: 480, h: 600 };
  const rel = relationFrom(subject, frame);
  const back = frameFromRelation(subject, rel, ASPECTS['4:5'], W, H);
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(near(back[k], frame[k], 1e-6), k);
  const moved = frameFromRelation({ ...subject, x: 450 }, rel, ASPECTS['4:5'], W, H);
  assert.ok(near(moved.x, frame.x + 50, 1e-6));
});

test('pickSubject bevorzugt Personen und mittige Motive', () => {
  const dets = [
    { x: 10, y: 10, w: 150, h: 150, score: 0.9, category: 'chair' },
    { x: 440, y: 800, w: 200, h: 400, score: 0.8, category: 'person' },
  ];
  assert.equal(pickSubject(dets, W, H).category, 'person');
  assert.equal(pickSubject([], W, H), null);
  assert.equal(pickSubject([{ x: 0, y: 0, w: W, h: H, score: 1 }], W, H), null);
});

test('coverTransform: Video füllt Bildschirm', () => {
  const t = coverTransform(1080, 1920, 390, 844);
  const r = rectToScreen({ x: 0, y: 0, w: 1080, h: 1920 }, t);
  assert.ok(r.w >= 390 - 1e-6 && r.h >= 844 - 1e-6);
  assert.ok(near(r.x + r.w / 2, 195) && near(r.y + r.h / 2, 422));
});

test('lumaHint', () => {
  assert.match(lumaHint(20), /dunkel/);
  assert.match(lumaHint(240), /hell/);
  assert.equal(lumaHint(128), null);
});
