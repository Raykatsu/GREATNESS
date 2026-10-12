// Tests du moteur de coaching (node --test).
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { Session, plates } = await import("../js/engine.js");
const { setUser } = await import("../js/store.js");

const ready = { sleep: 4, energy: 4, soreness: 2 };
const prog = (exercises, extra = {}) => ({ id: "t", name: "Test", exercises, ...extra });
const ex = (id, sets = 3, reps = [8, 10], weight = 60, extra = {}) => ({ id, sets, reps, weight, rest: 90, rpe: 8, ...extra });

test("une série trop facile fait monter la charge", () => {
  setUser("t1", {});
  const s = new Session(prog([ex("bench")]), ready);
  const w = s.current.weight;
  s.logSet({ reps: 10, rpe: 6 });
  assert.ok(s.current.weight > w);
});

test("une série ratée fait baisser la charge", () => {
  setUser("t2", {});
  const s = new Session(prog([ex("bench")]), ready);
  const w = s.current.weight;
  s.logSet({ reps: 4, rpe: 10 });
  assert.ok(s.current.weight < w);
});

test("la douleur arrête l'exercice et propose une alternative", () => {
  setUser("t3", {});
  const s = new Session(prog([ex("bench"), ex("row")]), ready);
  const { events } = s.logSet({ reps: 8, rpe: 8, pain: true });
  assert.equal(s.plan[0].status, "skipped");
  assert.ok(events.some(e => e.swap));
});

test("superset : on enchaîne sans repos puis repos en fin de tour", () => {
  setUser("t4", {});
  const s = new Session(prog([ex("curl", 2, [8, 12], 10, { ss: "A" }), ex("pushdown", 2, [8, 12], 20, { ss: "A" }), ex("squat")]), ready);
  let r = s.logSet({ reps: 10, rpe: 8 });
  assert.equal(r.rest, 0); assert.equal(s.current.id, "pushdown");
  r = s.logSet({ reps: 10, rpe: 8 });
  assert.ok(r.rest > 0); assert.equal(s.current.id, "curl");
  s.logSet({ reps: 10, rpe: 8 });
  r = s.logSet({ reps: 10, rpe: 8 });
  assert.equal(s.current.id, "squat");
});

test("séance libre : ajout d'exercices et pas de fin automatique", () => {
  setUser("t5", {});
  const s = new Session(prog([], { free: true }), ready);
  assert.equal(s.finished, false);
  s.addExercise(ex("bench", 1));
  s.logSet({ reps: 8, rpe: 8 });
  assert.equal(s.current, undefined);
  assert.equal(s.finished, false);
});

test("sauvegarde et reprise d'une séance", () => {
  setUser("t6", {});
  const s = new Session(prog([ex("bench"), ex("row")]), ready);
  s.logSet({ reps: 9, rpe: 8 });
  const back = Session.restore(JSON.parse(JSON.stringify(s)));
  assert.equal(back.current.id, "bench");
  assert.equal(back.current.done.length, 1);
  back.logSet({ reps: 9, rpe: 8 });
  assert.equal(back.current.done.length, 2);
});

test("semaine allégée : moins de séries et charges réduites", () => {
  setUser("t7", {});
  const a = new Session(prog([ex("bench", 4)]), ready);
  const b = new Session(prog([ex("bench", 4)]), ready, { deload: true });
  assert.ok(b.current.sets < a.current.sets);
  assert.ok(b.current.weight < a.current.weight);
});

test("calculateur de disques", () => {
  assert.deepEqual(plates(100).side, [25, 15]);
  assert.deepEqual(plates(62.5).side, [20, 1.25]);
  assert.deepEqual(plates(20).side, []);
});
