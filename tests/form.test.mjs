// Correction de posture : mouvements simulés à partir des poses des démos (vues de profil),
// en version propre puis avec un défaut, passés au compteur de reps et au correcteur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PATTERNS, JOINTS, angle, RepCounter } from "../js/motion.js";
import { FormCoach, formConfig, formHold, hipOffset, summaryText } from "../js/form.js";

// Pose de démo (repère 100 × 100) → 33 points MediaPipe ; côté gauche visible, côté droit caché
function landmarks(pose, face = 1) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.05 }));
  const set = (i, [x, y], v = 0.95) => { lm[i] = { x: x / 100, y: y / 100, visibility: v }; };
  const map = { 7: "h", 11: "s", 13: "e", 15: "w", 23: "p", 25: "k", 27: "f" };
  for (const [i, k] of Object.entries(map)) { set(+i, pose[k]); set(+i + 1, pose[k], 0.2); }
  set(0, [pose.h[0] + 3 * face, pose.h[1] + 1]);
  return lm;
}
const mix = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, [a[k][0] + ((b[k] || a[k])[0] - a[k][0]) * t, a[k][1] + ((b[k] || a[k])[1] - a[k][1]) * t]]));

// n reps de `ms` chacune entre la pose a et la pose b, 30 images par seconde
function run(id, a, b, { reps = 3, ms = 2400, face = 1, depth = 1 } = {}) {
  const pat = PATTERNS[formConfig(id).pat], coach = new FormCoach(id), counter = new RepCounter(pat);
  const seen = new Set(), joints = JOINTS[pat.joint][0];
  let t = 0;
  const step = pose => {
    const lm = landmarks(pose, face);
    const r = counter.update(angle(lm[joints[0]], lm[joints[1]], lm[joints[2]]));
    const f = coach.frame(lm, t, 1, counter.start != null);
    if (f?.issue) seen.add(f.issue);
    if (r) { const e = coach.event(r, t); if (e) seen.add(e); }
    t += 1000 / 30;
  };
  for (let i = 0; i < 10; i++) step(a); // position de départ
  for (let r = 0; r < reps; r++) {
    const n = Math.round((ms / 1000) * 30);
    for (let i = 0; i <= n; i++) { const c = i / n, x = c < 0.5 ? c * 2 : 2 - c * 2; step(mix(a, b, x * depth)); }
  }
  for (let i = 0; i < 10; i++) step(a);
  return { counter, coach, seen, s: coach.summary() };
}

test("squat propre : reps comptées, aucune correction", () => {
  const { counter, seen, s } = run("squat", PATTERNS.squat.a, PATTERNS.squat.b);
  assert.equal(counter.count, 3);
  assert.deepEqual([...seen], []);
  assert.equal(s.score, 100);
  assert.equal(s.clean, 3);
});

test("squat buste trop penché et squat trop haut", () => {
  const leaning = { ...PATTERNS.squat.b, h: [74, 56], n: [69, 59], s: [66, 61] };
  const r = run("squat", PATTERNS.squat.a, leaning);
  assert.ok(r.seen.has("lean"), [...r.seen].join());
  assert.equal(r.s.issues[0].id, "lean");
  assert.match(r.s.tip, /poitrine haute/);
  const shallow = run("squat", PATTERNS.squat.a, PATTERNS.squat.b, { depth: 0.45 });
  assert.equal(shallow.counter.count, 0);
  assert.ok(shallow.seen.has("partial"));
  assert.match(shallow.s.tip, /cuisses parallèles/);
});

test("soulevé de terre : dos plat accepté, dos rond signalé", () => {
  const ok = run("deadlift", PATTERNS.hinge.a, PATTERNS.hinge.b);
  assert.equal(ok.counter.count, 3);
  assert.ok(!ok.seen.has("back"), [...ok.seen].join());
  const rounded = { ...PATTERNS.hinge.b, h: [69, 56], n: [66, 52], s: [62, 50] };
  const bad = run("deadlift", PATTERNS.hinge.a, rounded);
  assert.ok(bad.seen.has("back"), [...bad.seen].join());
  assert.equal(bad.s.issues[0].id, "back");
  // même mouvement, l'athlète regarde vers la gauche de l'image : même verdict
  const mirror = p => Object.fromEntries(Object.entries(p).map(([k, [x, y]]) => [k, [100 - x, y]]));
  const badLeft = run("deadlift", mirror(PATTERNS.hinge.a), mirror(rounded), { face: -1 });
  assert.ok(badLeft.seen.has("back"));
});

test("roumain : genoux trop pliés", () => {
  const squatty = { ...PATTERNS.hinge.b, k: [58, 66], f: [48, 92] };
  const r = run("rdl", PATTERNS.hinge.a, squatty);
  assert.ok(r.seen.has("knees"), [...r.seen].join());
});

test("pompes : gainage correct, puis bassin qui s'affaisse", () => {
  const ok = run("pushup", PATTERNS.pushup.a, PATTERNS.pushup.b, { face: -1 });
  assert.equal(ok.counter.count, 3);
  assert.ok(!ok.seen.has("sag") && !ok.seen.has("pike"), [...ok.seen].join());
  const sag = (p, d) => ({ ...p, p: [p.p[0], p.p[1] + d] });
  const bad = run("pushup", sag(PATTERNS.pushup.a, 9), sag(PATTERNS.pushup.b, 6), { face: -1 });
  assert.ok(bad.seen.has("sag"), [...bad.seen].join());
  const pike = run("pushup", sag(PATTERNS.pushup.a, -14), sag(PATTERNS.pushup.b, -14), { face: -1 });
  assert.ok(pike.seen.has("pike"), [...pike.seen].join());
});

test("curl : coudes qui avancent, élan du buste", () => {
  const ok = run("curl", PATTERNS.curl.a, PATTERNS.curl.b);
  assert.equal(ok.counter.count, 3);
  assert.deepEqual([...ok.seen], []);
  const drift = run("curl", PATTERNS.curl.a, { ...PATTERNS.curl.b, e: [60, 33], w: [62, 18] });
  assert.ok(drift.seen.has("elbows"), [...drift.seen].join());
  const swing = run("curl", PATTERNS.curl.a, { ...PATTERNS.curl.b, h: [40, 14], n: [42, 22], s: [43, 25], e: [45, 39] });
  assert.ok(swing.seen.has("swing"), [...swing.seen].join());
});

test("développé militaire : cambrure", () => {
  const ok = run("ohp", PATTERNS.press_v.a, PATTERNS.press_v.b);
  assert.ok(!ok.seen.has("arch"), [...ok.seen].join());
  const arched = { ...PATTERNS.press_v.b, h: [35, 15], n: [37, 22], s: [38, 25], e: [40, 13], w: [42, 2] };
  const bad = run("ohp", PATTERNS.press_v.a, arched);
  assert.ok(bad.seen.has("arch"), [...bad.seen].join());
});

test("tempo : reps trop rapides signalées (pas pour le cardio)", () => {
  const fast = run("squat", PATTERNS.squat.a, PATTERNS.squat.b, { reps: 4, ms: 700 });
  assert.ok(fast.counter.count >= 3);
  assert.ok(fast.seen.has("fast"));
  assert.ok(fast.s.issues.some(i => i.id === "fast"));
  assert.equal(formConfig("burpee").fast, 0);
  assert.equal(formConfig("kb_swing").fast, 0);
});

test("gainage chronométré : secondes tenues, bassin qui descend", () => {
  assert.ok(formHold("plank") && formHold("wall_sit") && !formHold("squat"));
  const coach = new FormCoach("plank"), pose = PATTERNS.plank.a;
  let t = 0;
  for (let i = 0; i < 300; i++, t += 1000 / 30) assert.equal(coach.frame(landmarks(pose, -1), t)?.issue, null);
  const sagged = { ...pose, p: [60, 79] };
  let issue = null;
  for (let i = 0; i < 90; i++, t += 1000 / 30) issue = coach.frame(landmarks(sagged, -1), t).issue || issue;
  assert.equal(issue, "sag");
  const s = coach.summary();
  assert.equal(s.hold, true);
  assert.ok(s.seconds >= 12 && s.seconds <= 13, String(s.seconds));
  assert.ok(s.score >= 75 && s.score < 100, String(s.score));
  assert.equal(s.issues[0].id, "sag");
  assert.match(summaryText(s), /s tenues/);
  // debout (hors position) : le chrono ne tourne pas
  const before = coach.summary().seconds;
  for (let i = 0; i < 60; i++, t += 1000 / 30) coach.frame(landmarks(PATTERNS.squat.a, -1), t);
  assert.equal(coach.summary().seconds, before);
});

test("géométrie : écart du bassin à la ligne du corps", () => {
  const S = { x: 0, y: 0 }, A = { x: 1, y: 0 };
  assert.ok(hipOffset(S, { x: 0.5, y: 0.1 }, A) > 0.09); // plus bas que la ligne (y vers le bas)
  assert.ok(hipOffset(S, { x: 0.5, y: -0.1 }, A) < -0.09);
  assert.ok(Math.abs(hipOffset(A, { x: 0.5, y: 0 }, S)) < 1e-9);
  assert.match(summaryText({ reps: 5, clean: 4, score: 80, issues: [{ id: "back", label: "Dos rond", n: 1 }] }), /Technique 80 % \(4\/5 reps propres\) · à corriger : dos rond/);
});
