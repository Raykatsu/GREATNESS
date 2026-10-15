// Programmes célèbres (classics.js) : séances prescrites et vraies règles de progression ; séries imposées dans le moteur.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { startClassic, classicSession, classicAfter, nsunsInc, CLASSICS, GZ_T1 } = await import("../js/classics.js");
const { Session, fmtTarget } = await import("../js/engine.js");
const { setUser } = await import("../js/store.js");

const MAX = { squat: 100, bench: 80, deadlift: 140, ohp: 50 };
// Séance faite : les séries prescrites, avec des reps au choix pour certaines (index → reps)
const done = (prog, reps = {}) => {
  let k = 0;
  return { date: Date.now(), sets: prog.exercises.flatMap(e => (e.scheme || Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: e.reps[0] })))
    .map(x => ({ exId: e.id, weight: x.weight, reps: reps[k++] ?? x.reps, rpe: 8 }))) };
};

test("5/3/1 : max d'entraînement à 90 %, semaines 5 / 3 / 5-3-1 / allégée, série au max, BBB", () => {
  const c = startClassic("wendler", MAX);
  assert.deepEqual(c.tm, { squat: 90, bench: 72.5, deadlift: 125, ohp: 45 });
  const s1 = classicSession(c);
  assert.equal(s1.exercises[0].id, "ohp");
  assert.deepEqual(s1.exercises[0].scheme, [{ weight: 30, reps: 5 }, { weight: 35, reps: 5 }, { weight: 37.5, reps: 5, amrap: true }]);
  assert.deepEqual(s1.exercises[1].scheme.map(x => `${x.weight}×${x.reps}`), Array(5).fill("22.5×10")); // 5 × 10 à 50 %
  assert.equal(s1.exercises[2].id, "chinup");
  assert.match(s1.tag, /Cycle 1 · semaine 1 · 5 reps/);
  // semaine 3 (séance 9) : 75/85/95 % et 1+ ; semaine 4 : allégée, sans série au max ni BBB
  assert.deepEqual(classicSession({ ...c, n: 8 }).exercises[0].scheme.map(x => x.reps + (x.amrap ? "+" : "")), ["5", "3", "1+"]);
  const deload = classicSession({ ...c, n: 12 });
  assert.equal(deload.exercises[0].scheme.some(x => x.amrap), false);
  assert.equal(deload.exercises.length, 2);
});

test("5/3/1 : un cycle complet fait monter les max (+2,5 haut, +5 bas), −10 % sur un mouvement raté", () => {
  const c = startClassic("wendler", MAX);
  for (let i = 0; i < 16; i++) {
    const p = classicSession(c);
    const lift = p.exercises[0].id, missed = lift === "squat" && i === 11; // squat raté en semaine 3
    const notes = classicAfter(c, done(p, missed ? { 2: 0 } : {}), p);
    assert.ok(notes.at(-1).startsWith("Prochaine séance"));
    if (missed) assert.match(notes[0], /baissera de 10 %/);
  }
  assert.equal(c.n, 16);
  assert.deepEqual(c.tm, { squat: 80, bench: 75, deadlift: 130, ohp: 47.5 }); // 90 × 0,9 = 81 → 80 (pas de 2,5)
  assert.deepEqual(c.fails, {});
});

test("GZCLP : T1 5×3+ → 6×2+ → 10×1+ → reprise à 85 %, T2 3×10 → 3×8, T3 qui monte à 25 reps", () => {
  const c = startClassic("gzclp", MAX);
  assert.equal(c.w.t1_squat, 75); assert.equal(c.w.t2_bench, 40);
  let p = classicSession(c);
  assert.deepEqual(p.exercises.map(e => e.id), ["squat", "bench", "lat_pull"]);
  assert.deepEqual(p.exercises[0].scheme.map(x => x.reps + (x.amrap ? "+" : "")), ["3", "3", "3", "3", "3+"]);
  // tout réussi + 26 reps en T3 : squat +5, couché T2 +2,5, tirage +2,5
  classicAfter(c, done(p, { 10: 26 }), p);
  assert.deepEqual([c.w.t1_squat, c.w.t2_bench, c.w.t3_lat_pull], [80, 42.5, 22.5]);
  // le squat T1 rate trois fois de suite : paliers puis reprise à 85 %
  for (const stage of [1, 2, 0]) {
    while (classicSession(c).exercises[0].id !== "squat") { const q = classicSession(c); classicAfter(c, done(q), q); }
    p = classicSession(c);
    classicAfter(c, done(p, { 0: 0 }), p); // 0 rep sur la 1re série : raté à tous les paliers
    assert.equal(c.s.t1_squat, stage);
    if (stage) assert.deepEqual(classicSession({ ...c, n: c.n - 1 }).exercises[0].scheme.length, GZ_T1[stage][0]);
  }
  assert.equal(c.w.t1_squat, 67.5); // 85 % de 80 kg, arrondi à 2,5
});

test("nSuns : 9 séries dont la « 1+ », la série 1+ décide de la progression", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 8].map(r => nsunsInc("squat", r)), [0, 0, 2.5, 2.5, 5, 5, 7.5, 7.5]);
  assert.deepEqual([2, 4, 6].map(r => nsunsInc("bench", r)), [2.5, 2.5, 5]);
  const c = startClassic("nsuns", MAX);
  const d1 = classicSession(c);
  assert.equal(d1.exercises[0].scheme.length, 9); assert.equal(d1.exercises[1].scheme.length, 8);
  classicAfter(c, done(d1), d1); // jour 1 (volume) : pas de série 1+, rien ne change
  assert.equal(c.tm.bench, 72.5);
  const d2 = classicSession(c);
  assert.equal(d2.exercises[0].id, "squat"); assert.equal(d2.exercises[1].id, "sumo_deadlift");
  assert.deepEqual(d2.exercises[0].scheme[2], { weight: 85, reps: 1, amrap: true }); // 95 % de 90
  const notes = classicAfter(c, done(d2, { 2: 5 }), d2);
  assert.equal(c.tm.squat, 95);
  assert.match(notes[0], /\+5 kg/);
});

test("Starting Strength : A/B en alternance, +2,5 kg (+5 au soulevé de terre), −10 % après 3 échecs", () => {
  const c = startClassic("ss", MAX);
  const a = classicSession(c);
  assert.deepEqual(a.exercises.map(e => `${e.id}:${e.scheme.length}x5@${e.scheme[0].weight}`), ["squat:3x5@70", "bench:3x5@55", "deadlift:1x5@100"]);
  classicAfter(c, done(a), a);
  assert.deepEqual([c.w.squat, c.w.bench, c.w.deadlift], [72.5, 57.5, 105]);
  const b = classicSession(c);
  assert.deepEqual(b.exercises.map(e => e.id), ["squat", "ohp", "row"]);
  for (let i = 0; i < 3; i++) { const p = classicSession(c); classicAfter(c, done(p, { 0: 3 }), p); } // squat raté 3 fois
  assert.equal(c.w.squat, 65); // 72,5 × 0,9 → 65
  assert.equal(Object.keys(CLASSICS).length, 4);
});

test("moteur de séance : charges imposées série par série, série au max annoncée et commentée", () => {
  setUser("classic1", {});
  const c = startClassic("wendler", MAX), p = classicSession(c);
  const s = new Session(p, { sleep: 4, energy: 4, soreness: 2 });
  const ex = s.current;
  assert.equal(ex.sets, 3); assert.equal(fmtTarget(ex), "30 kg × 5");
  s.logSet({ reps: 5, rpe: 7 });
  assert.equal(fmtTarget(s.current), "35 kg × 5");
  const r = s.logSet({ reps: 5, rpe: 8 });
  assert.equal(fmtTarget(s.current), "37.5 kg × 5+");
  assert.ok(r.events.some(e => e.title === "Série au maximum"));
  const r2 = s.logSet({ reps: 9, rpe: 9 });
  assert.ok(r2.events.some(e => e.title === "Énorme !"));
  assert.equal(s.current.scheme.length, 5); // BBB ensuite
  assert.equal(s.summary().sets.filter(x => x.exId === "ohp").length, 3);
});

test("widget « Séance du jour » : 7 jours, les séances du programme se suivent, jours de récup", async () => {
  const { state, setUser: su } = await import("../js/store.js");
  const { widgetData } = await import("../js/widgetdata.js");
  const { generateWeekPlan } = await import("../js/planner.js");
  su("widget1", {});
  state.classic = startClassic("wendler", MAX);
  state.weekPlan = generateWeekPlan();
  const monday = new Date(2026, 9, 12, 9); // lundi 12 octobre 2026
  const d = widgetData(+monday);
  assert.equal(d.days.length, 7);
  assert.deepEqual(d.days.map(x => x.date), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  // lundi, mardi, jeudi, vendredi : militaire, terre, couché, squat ; mercredi, samedi, dimanche : récup
  assert.deepEqual(d.days.map(x => (x.rest ? "récup" : x.title.replace("5/3/1 · ", ""))), ["Développé militaire", "Soulevé de terre", "récup", "Développé couché", "Squat", "récup", "récup"]);
  assert.match(d.days[0].sub, /min · 3 exercices/);
  assert.equal(d.weekGoal, 4);
});
