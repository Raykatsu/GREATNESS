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

test("échauffement adapté et séances douces", async () => {
  const { warmupFor, isWorkout } = await import("../js/planner.js");
  const { PROGRAMS } = await import("../js/data.js");
  const P = id => PROGRAMS.find(p => p.id === id);
  assert.equal(warmupFor(P("push")), "warmup_upper");
  assert.equal(warmupFor(P("legs_b")), "warmup_lower");
  assert.equal(warmupFor(P("full_a")), "warmup_full");
  assert.ok(isWorkout(P("push")));
  for (const id of ["mobility", "care_back", "cooldown", "warmup_full", "mob_hips"]) assert.ok(!isWorkout(P(id)), id);
  for (const p of PROGRAMS.filter(p => ["mobility", "stretch", "care"].includes(p.cat))) assert.ok(p.simple && p.exercises.length >= 3, p.id);
});
