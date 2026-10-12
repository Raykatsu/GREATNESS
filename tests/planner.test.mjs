import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { generateSession, generateWeekPlan, cycleInfo } = await import("../js/planner.js");
const { setUser, state } = await import("../js/store.js");
const { EXERCISES } = await import("../js/data.js");

test("séance générée sans matériel : uniquement poids du corps / élastique", () => {
  setUser("p1", {});
  const s = generateSession({ groups: ["jambes", "pecs"], minutes: 45, equipment: "home" });
  assert.ok(s.exercises.length >= 4);
  assert.ok(s.exercises.every(e => ["bw", "band"].includes(EXERCISES[e.id].equip)));
});

test("la régénération du programme garde les séances perso", () => {
  setUser("p2", { customPrograms: [{ id: "c42", name: "Ma séance", exercises: [] }], weekPlan: { 3: "c42" } });
  state.weekPlan = generateWeekPlan({ days: 4 });
  assert.equal(state.weekPlan[3], "c42");
});

test("semaine allégée toutes les 7 semaines", () => {
  setUser("p3", { cycleStart: Date.now() - 6 * 7 * 864e5 - 864e5 });
  assert.equal(cycleInfo().deload, true);
  setUser("p4", { cycleStart: Date.now() - 2 * 864e5 });
  assert.equal(cycleInfo().deload, false);
});
