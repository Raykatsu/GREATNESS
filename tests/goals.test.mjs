// Objectifs chiffrés : progression semaine par semaine, prescriptions dans les séances, test final, recalage, synchro.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { phaseOf, prescription, planOf, newGoal, suggestTarget, ambition, currentLevel, goalFix, goalAfterSession, goalSession, testProgram,
  progressOf, accessoriesFor, POPULAR, goalTitle, goalsContext, weekOf, expected, kindOf: KIND } = await import("../js/goals.js");
const { Session } = await import("../js/engine.js");
const { setUser, state } = await import("../js/store.js");
const { mergeData } = await import("../js/merge.js");
const { EXERCISES } = await import("../js/data.js");

const D = 864e5, W = 7 * D;
const ready = { sleep: 4, energy: 4, soreness: 1 };
const START = new Date(2026, 8, 7).getTime(); // lundi 7 septembre 2026

test("phases : volume, force, intensité, semaines allégées, affûtage, test", () => {
  const seq = n => Array.from({ length: n }, (_, i) => phaseOf(i + 1, n)).join(" ");
  assert.equal(seq(8), "base base base allege force pic affute test");
  assert.equal(seq(10), "base base base allege force force pic allege affute test");
  assert.equal(seq(12), "base base base allege force force force allege pic pic affute test");
});

test("prescriptions de charge : du départ à l'objectif, arrondies au pas de la barre", () => {
  const g = { ...newGoal({ exId: "bench", base: 80, target: 90, weeks: 10, now: START }) };
  const plan = planOf(g);
  assert.deepEqual(plan[0], { week: 1, phase: "base", sets: 4, reps: 6, weight: 62.5 });           // 78 % de 80
  assert.deepEqual(plan[8], { week: 9, phase: "affute", sets: 3, reps: 2, weight: 77.5 });         // 85 % de 90
  assert.deepEqual(plan[9], { week: 10, phase: "test", sets: 1, reps: 1, weight: 90 });
  for (const p of plan) assert.equal(p.weight % 2.5, 0, `semaine ${p.week}`);
  // dans une même phase, la charge ne baisse jamais ; la semaine allégée est plus légère que celle d'avant
  for (let i = 1; i < plan.length; i++) if (plan[i].phase === plan[i - 1].phase) assert.ok(plan[i].weight >= plan[i - 1].weight);
  assert.ok(plan[3].weight < plan[2].weight);
  // recalage : séances ratées → charges plus basses
  assert.ok(prescription({ ...g, adjust: 0.9 }, 5).weight < prescription(g, 5).weight);
  assert.equal(expected(g, 1), 80); assert.equal(expected(g, 9), 90);
});

test("prescriptions de répétitions et de temps", () => {
  const pull = newGoal({ exId: "pullup", base: 6, target: 12, weeks: 8, now: START });
  assert.equal(pull.kind, "reps");
  assert.deepEqual(planOf(pull).map(p => `${p.sets}x${p.reps}`), ["5x3", "5x4", "5x4", "3x4", "6x6", "4x8", "2x6", "1x12"]);
  const plank = newGoal({ exId: "plank", base: 60, target: 120, weeks: 8, now: START });
  assert.equal(plank.kind, "time");
  assert.ok(planOf(plank).every(p => p.reps % 5 === 0), "secondes par 5");
  assert.equal(planOf(plank).at(-1).reps, 120);
});

test("objectif conseillé et ambition", () => {
  setUser("goal-a", {});
  assert.equal(suggestTarget("bench", 80, 10), 87.5);    // débutant sur l'exercice : +1,1 % par semaine, arrondi vers le bas
  assert.equal(suggestTarget("pullup", 6, 10), 10);
  assert.equal(suggestTarget("plank", 60, 8), 95);
  assert.equal(suggestTarget("pullup", 2, 8), 4);        // au moins +2 reps
  for (const [id, base, w] of [["bench", 95, 10], ["bench", 98, 10], ["squat", 120, 12], ["pullup", 6, 10], ["pullup", 2, 8], ["plank", 60, 8], ["deadlift", 140, 8]])
    assert.equal(ambition(KIND(id), base, suggestTarget(id, base, w), w).label, "Réaliste", id); // le conseil est toujours réaliste
  assert.equal(ambition("load", 80, 87.5, 10).label, "Réaliste");
  assert.equal(ambition("load", 80, 92.5, 10).label, "Ambitieux");
  assert.equal(ambition("load", 80, 110, 10).label, "Très ambitieux");
  assert.equal(ambition("load", 80, 80, 10).label, "Déjà atteint");
  assert.equal(goalTitle({ exId: "bench", kind: "load", target: 100 }), "Développé couché : 100 kg");
  assert.equal(goalTitle({ exId: "plank", kind: "time", target: 150 }), "Gainage : 2 min 30");
});

test("niveau actuel : 1RM estimé avec le ressenti, sinon le record", () => {
  const now = START + 30 * D;
  const st = { sessions: [{ date: now - 3 * D, sets: [{ exId: "bench", weight: 80, reps: 6, rpe: 8 }, { exId: "bench", weight: 70, reps: 10, rpe: 10 }] }], lifts: { squat: { best: 121.3 } } };
  assert.equal(currentLevel("bench", st, now), 101.5); // 80 × (1 + 8/30) = 101,3 → 101,5
  assert.equal(currentLevel("squat", st, now), 121.5);
  assert.equal(currentLevel("deadlift", st, now), 0);
});

test("séances : la prescription de la semaine remplace la charge habituelle (pas dans un échauffement)", () => {
  setUser("goal-b", {});
  const now = Date.now();
  const g = newGoal({ exId: "bench", base: 100, target: 110, weeks: 10, now: now - 15 * D }); // semaine 3 : volume
  state.goals = [g];
  const fix = goalFix("bench");
  assert.equal(weekOf(g), 3);
  assert.deepEqual([fix.sets, fix.goal, fix.weight], [4, 6, 80]); // 78 % de 102,5 kg attendus en semaine 3
  assert.match(fix.note, /semaine 3\/10 \(volume\) : 4 × 6 à 80 kg/);
  assert.equal(goalFix("squat"), null);
  const s = new Session({ id: "push", name: "Push", cat: "gym", exercises: [{ id: "bench", sets: 3, reps: [8, 10], weight: 60, rest: 90, rpe: 8 }, { id: "ohp", sets: 3, reps: [8, 10], weight: 40, rest: 90, rpe: 8 }] }, ready);
  assert.deepEqual([s.plan[0].sets, s.plan[0].goal, s.plan[0].weight, s.plan[0].reps], [4, 6, 80, [6, 6]]);
  assert.equal(s.plan[1].weight, 40); // les autres exercices ne bougent pas
  assert.match(s.intro().text, /Objectif « Développé couché : 110 kg », semaine 3\/10/);
  const warm = new Session({ id: "warmup_upper", name: "Échauffement", cat: "stretch", exercises: [{ id: "bench", sets: 2, reps: [10, 12], weight: 20, rest: 30, rpe: 5 }] }, ready);
  assert.equal(warm.plan[0].weight, 20);
  // la séance de la semaine : l'exercice prescrit, puis des exercices d'appoint
  const sess = goalSession(g, state);
  assert.equal(sess.exercises[0].fixed.weight, 80);
  assert.ok(sess.exercises.length >= 3);
  assert.ok(sess.exercises.slice(1).every(e => EXERCISES[e.id] && e.id !== "bench"));
  state.goals = [];
});

test("test final : montée en charge, tentative, deuxième essai selon la réussite", () => {
  setUser("goal-c", {});
  const g = newGoal({ exId: "bench", base: 90, target: 100, weeks: 8, now: Date.now() - 50 * D });
  state.goals = [g];
  const p = testProgram(g);
  assert.equal(p.id, `goal_test_${g.id}`);
  const run = (attemptReps) => {
    const s = new Session(p, ready);
    const ws = [s.current.weight];
    for (const r of [5, 3, 2, 1]) { s.logSet({ reps: r, rpe: 7 }); ws.push(s.current.weight); }
    s.logSet({ reps: attemptReps, rpe: 10 }); ws.push(s.current.weight);
    return { s, ws };
  };
  const ok = run(1);
  assert.deepEqual(ok.ws, [50, 70, 80, 90, 100, 102.5]); // réussi : 2e essai plus lourd
  assert.match(ok.s.log[0].title, /Réussi/);
  assert.deepEqual(run(0).ws.at(-1), 95);                // raté : 2e essai plus léger
  // le résultat du test
  const sum = { date: Date.now(), programId: p.id, sets: [{ exId: "bench", weight: 100, reps: 1, rpe: 10 }, { exId: "bench", weight: 102.5, reps: 1, rpe: 10 }] };
  const [r] = goalAfterSession(sum, state);
  assert.deepEqual([r.test, r.success, r.value], [true, true, 102.5]);
  assert.equal(g.status, "finished");
  assert.equal(progressOf(g).status, "done");
  // répétitions : échauffement puis le maximum
  const pull = newGoal({ exId: "pullup", base: 8, target: 12, weeks: 8 });
  assert.deepEqual(testProgram(pull).exercises[0].ramp.map(x => x.reps), [4, 12]);
  state.goals = [];
});

test("recalage : séries ratées → charges en baisse ; réussies facilement → en hausse", () => {
  setUser("goal-d", {});
  const now = Date.now();
  const g = newGoal({ exId: "squat", base: 100, target: 110, weeks: 10, now: now - 2 * D });
  state.goals = [g];
  const p = prescription(g, 1);
  goalAfterSession({ date: now, programId: "legs", sets: [1, 2, 3, 4].map(() => ({ exId: "squat", weight: p.weight, reps: 3, rpe: 10 })) }, state, now);
  assert.equal(g.adjust, 0.96);
  goalAfterSession({ date: now, programId: "legs", sets: [1, 2, 3, 4].map(() => ({ exId: "squat", weight: p.weight, reps: 6, rpe: 7 })) }, state, now);
  assert.equal(g.adjust, 0.979);
  assert.equal(g.log.length, 2);
  assert.match(goalsContext(state, now), /Objectif chiffré en cours : « Squat : 110 kg » \(départ 100 kg\), semaine 1\/10/);
  state.goals = [];
});

test("exercices d'appoint : connus et adaptés au matériel", () => {
  for (const list of Object.values(POPULAR)) for (const id of list) {
    assert.ok(EXERCISES[id], id);
    for (const eq of ["gym", "db", "home"]) {
      const acc = accessoriesFor(id, eq);
      assert.ok(acc.every(a => EXERCISES[a] && a !== id), `${id} / ${eq}`);
      if (eq === "home") assert.ok(acc.every(a => ["bw", "band"].includes(EXERCISES[a].equip)), `${id} à la maison : ${acc}`);
    }
  }
});

test("synchro : objectifs réunis, la version modifiée en dernier gagne, les supprimés ne reviennent pas", () => {
  const g1 = { id: "g1", exId: "bench", start: 1, at: 10, adjust: 1 }, g2 = { id: "g2", exId: "squat", start: 2, at: 10 }, g3 = { id: "g3", exId: "row", start: 3, at: 5 };
  const a = { meta: { updatedAt: 100 }, goals: [{ ...g1, adjust: 0.96, at: 20 }, g2], deleted: { goals: ["g3"] } };
  const b = { meta: { updatedAt: 200 }, goals: [g1, g3] };
  const m = mergeData(a, b);
  assert.deepEqual(m.goals.map(g => g.id), ["g1", "g2"]);
  assert.equal(m.goals[0].adjust, 0.96); // modifié plus tard sur l'autre appareil
});
