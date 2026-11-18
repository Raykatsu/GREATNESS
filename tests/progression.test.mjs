// Surcharge progressive expliquée (js/engine.js : progressionOf) : la charge et l'objectif de la prochaine séance
// suivent la double progression, ajustée au ressenti de la dernière fois, avec la raison en clair ; au poids du corps,
// on ajoute des reps puis on passe à une variante plus dure.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { state, recordLift } from "../js/store.js";
import { progressionOf, HARDER, plannedTarget } from "../js/engine.js";
import { EXERCISES } from "../js/data.js";

const bench = { id: "bench", reps: [6, 10], weight: 60, sets: 3 };
const lift = (id, o) => { state.lifts[id] = { weight: 60, reps: 8, date: Date.now(), best: 0, bestReps: 0, ...o }; };

test("charge : première fois, haut de fourchette, facile, sous la fourchette, à fond, dans la fourchette", () => {
  delete state.lifts.bench;
  let p = progressionOf(bench);
  assert.equal(p.move, "first"); assert.equal(p.weight, 60); assert.match(p.why, /Première fois/);
  lift("bench", { reps: 10, rpe: 8.5 });
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight, p.goal], ["up", 62.5, 6]); assert.match(p.why, /\+2,5 kg/);
  lift("bench", { reps: 10, rpe: 6.5 }); // facile : on monte de deux crans
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight], ["up", 65]); assert.match(p.why, /Facile/);
  lift("bench", { reps: 5, rpe: 9 });
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight, p.goal], ["down", 57.5, 10]);
  lift("bench", { reps: 8, rpe: 10 }); // à fond : on consolide
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight, p.goal], ["same", 60, 8]);
  lift("bench", { reps: 8, rpe: 8 }); // une rep de plus
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight, p.goal], ["same", 60, 9]);
  lift("bench", { reps: 8 }); // ancien enregistrement sans ressenti : double progression simple
  assert.equal(progressionOf(bench).goal, 9);
  lift("bench", { reps: 8, next: 70 }); // charge fixée par le coach
  p = progressionOf(bench);
  assert.deepEqual([p.move, p.weight], ["coach", 70]);
  assert.deepEqual(plannedTarget(bench), { weight: 70, goal: 6 });
});

test("poids du corps : des reps en plus, puis une variante plus dure", () => {
  const pu = { id: "pushup", reps: [8, 15], sets: 3 };
  delete state.lifts.pushup;
  assert.equal(progressionOf(pu).move, "first");
  state.lifts.pushup = { weight: 0, reps: 12, date: Date.now() };
  let p = progressionOf(pu);
  assert.equal(p.goal, 12 + EXERCISES.pushup.step); assert.equal(p.move, "up");
  const cap = 15 + 5 * EXERCISES.pushup.step;
  state.lifts.pushup = { weight: 0, reps: cap, date: Date.now() };
  p = progressionOf(pu);
  assert.equal(p.harder, "decline_pushup"); assert.match(p.why, /passe à/);
});

test("la variante plus dure existe toujours, et le ressenti est gardé avec la charge", () => {
  for (const [a, b] of Object.entries(HARDER)) assert.ok(EXERCISES[a] && EXERCISES[b], `${a} → ${b}`);
  recordLift("squat", 100, 5, 8.5);
  assert.equal(state.lifts.squat.rpe, 8.5);
  recordLift("squat", 102.5, 5);
  assert.equal(state.lifts.squat.rpe, undefined);
});
