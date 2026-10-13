// Récupération musculaire : fatigue laissée par les séries, qui s'efface avec le temps ; le coach allège un muscle pas remis.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { recovery, exerciseReady, programStrain, readyIn, recoveryContext, recoveryAnswer, musclesOf, recoverySummary } = await import("../js/recovery.js");
const { Session } = await import("../js/engine.js");
const { setUser, state } = await import("../js/store.js");

const H = 36e5, NOW = Date.UTC(2026, 9, 13, 18);
const sess = (hoursAgo, sets) => ({ id: "s" + hoursAgo, date: NOW - hoursAgo * H, durationSec: 3600, sets });
const sets = (exId, n, rpe = 9, weight = 80) => Array.from({ length: n }, () => ({ exId, weight, reps: 8, rpe }));

test("sans séance : tout est récupéré", () => {
  const r = recovery([], NOW);
  for (const m of Object.values(r)) { assert.equal(m.ready, 1); assert.equal(m.level, 3); assert.equal(m.week, 0); assert.equal(m.hours, 0); }
});

test("grosse séance de jambes : quadriceps à reposer, pectoraux frais, puis récupération en 3 jours", () => {
  const legs = [sess(1, [...sets("squat", 5), ...sets("leg_press", 4)])];
  const r = recovery(legs, NOW);
  assert.ok(r.quads.ready < 0.35, `quadriceps ${r.quads.ready}`);
  assert.equal(r.quads.level, 0);
  assert.ok(r.glutes.ready < 0.6);
  assert.equal(r.pecs.ready, 1);
  assert.equal(r.quads.week, 9);
  assert.ok(r.quads.hours > 30 && r.quads.hours < 80, `prêt dans ${r.quads.hours} h`);
  const later = recovery(legs.map(s => ({ ...s, date: s.date - 72 * H })), NOW);
  assert.ok(later.quads.ready >= 0.85, `3 jours après : ${later.quads.ready}`);
});

test("les petits muscles récupèrent plus vite que les gros", () => {
  const r = recovery([sess(30, [...sets("curl", 6), ...sets("squat", 6)])], NOW);
  assert.ok(r.biceps.ready > r.quads.ready, `${r.biceps.ready} > ${r.quads.ready}`);
});

test("une série facile fatigue moins qu'une série à l'échec ; les étirements ne fatiguent pas", () => {
  const easy = recovery([sess(1, sets("bench", 4, 6))], NOW), hard = recovery([sess(1, sets("bench", 4, 10))], NOW);
  assert.ok(easy.pecs.ready > hard.pecs.ready);
  const st = recovery([sess(1, sets("child_pose", 5, 0, 0))], NOW);
  assert.equal(st.lowerback.ready, 1);
  // muscles qui aident : moitié
  assert.ok(hard.triceps.week === 4 && hard.delts.week === 2, `${hard.triceps.week} ${hard.delts.week}`);
});

test("séance prévue sur des muscles pas remis : listés du plus fatigué au moins fatigué", () => {
  const r = recovery([sess(2, [...sets("bench", 5, 10), ...sets("dips", 4, 10)])], NOW);
  const push = { exercises: [{ id: "bench" }, { id: "ohp" }, { id: "pushdown" }] };
  const st = programStrain(push, r);
  assert.ok(st.length >= 2 && st.some(x => x.m === "pecs") && st.some(x => x.m === "triceps"), JSON.stringify(st));
  assert.ok(st[0].ready <= st[1].ready);
  assert.deepEqual(programStrain({ exercises: [{ id: "squat" }] }, r), []);
  assert.ok(exerciseReady("bench", r) < 0.5 && exerciseReady("squat", r) === 1);
  assert.deepEqual(musclesOf("bench").p, ["pecs", "triceps"]);
});

test("textes : délai, résumé, contexte pour l'IA, réponse du coach", () => {
  assert.equal(readyIn(0), "récupéré"); assert.equal(readyIn(12), "prêt dans ~12 h"); assert.equal(readyIn(30), "prêt demain"); assert.equal(readyIn(60), "prêt dans 3 jours");
  const ss = [sess(3, [...sets("squat", 6), ...sets("curl", 2, 7)])];
  const sum = recoverySummary(recovery(ss, NOW));
  assert.ok(sum.tired.includes("quads") && sum.worked > 0);
  const ctx = recoveryContext(ss, NOW);
  assert.match(ctx, /Quadriceps \d+ %/); assert.match(ctx, /sous 60 %/);
  assert.equal(recoveryContext([], NOW), "");
  assert.match(recoveryAnswer(ss, NOW), /À reposer : .*Quadriceps \(\d+ %/);
  assert.match(recoveryAnswer([], NOW), /frais/);
});

test("le coach allège un exercice dont les muscles ne sont pas remis", () => {
  const ready = { sleep: 4, energy: 4, soreness: 2 }, prog = { id: "p", name: "Push", exercises: [{ id: "bench", sets: 4, reps: [6, 8], weight: 80, rest: 120, rpe: 8 }, { id: "squat", sets: 4, reps: [6, 8], weight: 100, rest: 120, rpe: 8 }] };
  setUser("rec1", {});
  const fresh = new Session(prog, ready);
  setUser("rec2", { sessions: [{ id: "x", date: Date.now() - 3 * H, durationSec: 3600, sets: sets("bench", 6, 10) }] });
  const tired = new Session(prog, ready);
  assert.equal(tired.plan[0].sets, fresh.plan[0].sets - 1);
  assert.ok(tired.plan[0].weight < fresh.plan[0].weight);
  assert.equal(tired.plan[1].sets, fresh.plan[1].sets); // le squat n'est pas touché
  const note = tired.recoveryNote();
  assert.match(note.text, /Pectoraux/);
  assert.equal(fresh.recoveryNote(), null);
  assert.ok(state.sessions.length === 1);
});
