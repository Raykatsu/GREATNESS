// Animations et comptage caméra : chaque exercice a un mouvement, le compteur suit les angles.
import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../js/data.js";
import { PATTERNS, patternOf, angle, RepCounter } from "../js/motion.js";

test("chaque exercice a un mouvement connu", () => {
  for (const id of Object.keys(EXERCISES)) assert.ok(PATTERNS[patternOf(id)], id);
  assert.equal(patternOf("bench"), "press_h");
  assert.equal(patternOf("squat"), "squat");
  assert.equal(patternOf("inconnu"), "stretch");
});

test("les poses ont tous les points", () => {
  for (const [k, p] of Object.entries(PATTERNS)) for (const pose of [p.a, p.b])
    for (const pt of ["h", "n", "s", "e", "w", "p", "k", "f"]) assert.equal(pose[pt]?.length, 2, `${k}.${pt}`);
});

test("angle", () => {
  assert.equal(Math.round(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 90);
  assert.equal(Math.round(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 })), 180);
});

const feed = (c, seq) => seq.flatMap(v => Array(4).fill(v)).map(v => c.update(v)).filter(Boolean);

test("compte les répétitions complètes", () => {
  const c = new RepCounter({ low: 100, high: 150 });
  const out = feed(c, [170, 170, 80, 80, 170, 170, 80, 80, 170, 170]);
  assert.deepEqual(out, ["rep", "rep"]);
  assert.equal(c.count, 2);
});

test("départ en position basse (curl)", () => {
  const c = new RepCounter({ low: 70, high: 140 });
  assert.deepEqual(feed(c, [50, 50, 160, 160, 50, 50]), ["rep"]);
});

test("amplitude trop courte = partielle", () => {
  const c = new RepCounter({ low: 100, high: 150 });
  const out = feed(c, [170, 170, 115, 115, 170, 170]);
  assert.deepEqual(out, ["partial"]);
  assert.equal(c.count, 0);
});

test("bruit en haut ne compte rien", () => {
  const c = new RepCounter({ low: 100, high: 150 });
  assert.deepEqual(feed(c, [165, 158, 170, 140, 162, 168]), []);
});
