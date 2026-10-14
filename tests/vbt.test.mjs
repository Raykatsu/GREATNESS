// Vitesse de barre à la caméra (js/vbt.js) : vitesse de chaque poussée, perte de vitesse, ressenti estimé
import test from "node:test";
import assert from "node:assert/strict";
import { VelocityTracker, velocityLoss, estimateRpe, velocitySummary, lossLimit, fmtV, CONC, MVT } from "../js/vbt.js";
import { PATTERNS, RepCounter } from "../js/motion.js";

// Squat filmé de profil : athlète de 1,80 m qui occupe 0,8 de la hauteur de l'image (2,25 m par unité)
const H = 0.8, SH = 0.246 * H, TH = 0.245 * H, TO = 0.288 * H, UA = 0.186 * H, FA = 0.146 * H;
function body(knee) {
  const al = ((180 - knee) / 2) * Math.PI / 180, an = { x: 0.5, y: 0.9 };
  const kn = { x: an.x + SH * Math.sin(al), y: an.y - SH * Math.cos(al) };
  const hip = { x: kn.x - TH * Math.sin(al), y: kn.y - TH * Math.cos(al) };
  const sh = { x: hip.x, y: hip.y - TO }, el = { x: sh.x, y: sh.y + UA }, wr = { x: el.x + FA, y: el.y };
  return { an, kn, hip, sh, el, wr };
}
// Une série : chaque rep descend en 1,2 s, pause, remonte en `up` secondes ; 30 images par seconde
function squatSet(ups, tracker) {
  const counter = new RepCounter(PATTERNS.squat), done = [];
  let t = 0;
  const step = (knee, dt) => {
    t += dt;
    const r = counter.update(knee);
    if (r === "rep") { const x = tracker.rep(t); if (x) done.push(x); }
    const x = tracker.frame(t, knee, body(knee));
    if (x) done.push(x);
  };
  const hold = (s, knee = 170) => { for (let i = 0; i < s * 30; i++) step(knee, 1000 / 30); };
  const move = (from, to, s) => { const n = Math.round(s * 30); for (let i = 1; i <= n; i++) step(from + ((to - from) * i) / n, 1000 / 30); };
  hold(0.6);
  for (const up of ups) { move(170, 80, 1.2); hold(0.1, 80); move(80, 170, up); hold(0.8); }
  return { reps: counter.count, done };
}
const disp = Math.abs(body(170).sh.y - body(80).sh.y) * (1.8 / H); // déplacement réel des épaules (m)

test("vitesse de la poussée mesurée à ±8 % sur un squat simulé, échelle tirée de la taille de l'athlète", () => {
  const tr = new VelocityTracker("squat", { height: 1.8 });
  const ups = [0.6, 0.65, 0.72, 0.85, 1.05];
  const { reps, done } = squatSet(ups, tr);
  assert.equal(reps, 5);
  assert.equal(done.length, 5);
  done.forEach((r, i) => {
    const want = disp / ups[i];
    assert.ok(Math.abs(r.v - want) / want < 0.08, `rep ${i + 1} : ${r.v} m/s pour ${want.toFixed(2)} attendus`);
    assert.ok(Math.abs(r.disp - disp) / disp < 0.08, `amplitude ${r.disp} m pour ${disp.toFixed(2)}`);
    assert.ok(r.peak >= r.v);
  });
  assert.ok(Math.abs(tr.scale() - 1.8 / H) / (1.8 / H) < 0.03);
  const s = tr.summary();
  assert.equal(s.reps.length, 5);
  assert.ok(s.loss >= 35 && s.loss <= 50, `perte ${s.loss} %`);
  assert.ok(s.rpe >= 9.5, `RPE ${s.rpe}`); // dernière rep au seuil d'échec du squat (0,30 m/s)
});

test("rep lente ou trop courte ignorée, mouvement sans sens de poussée, échelle inconnue", () => {
  const plank = new VelocityTracker("plank");
  assert.equal(plank.ok, false);
  assert.equal(plank.frame(0, 90, body(170)), null);
  // sans segments visibles, pas d'échelle : aucune vitesse inventée
  const blind = new VelocityTracker("squat");
  let t = 0;
  for (let i = 0; i < 40; i++) blind.frame((t += 33), 170 - i * 2, { sh: { x: 0.5, y: 0.3 + i * 0.003 } });
  blind.rep(t);
  for (let i = 0; i < 30; i++) blind.frame((t += 33), 90 + i * 3, { sh: { x: 0.5, y: 0.42 - i * 0.004 } });
  assert.equal(blind.summary(), null);
});

test("perte de vitesse et ressenti (RPE) estimés", () => {
  assert.equal(velocityLoss([0.5]), 0);
  assert.equal(velocityLoss([0.5, 0.52, 0.4]), 23);
  assert.equal(velocityLoss([0.5, 0.45, 0.55]), 0);
  assert.equal(estimateRpe([0.6, 0.58], 0.3), null); // trop peu de reps
  assert.equal(estimateRpe([0.6, 0.58, 0.55], null), null); // pas de seuil connu
  assert.deepEqual(estimateRpe([0.6, 0.58, 0.55, 0.52], 0.3), { rir: 5, rpe: 5 });
  assert.deepEqual(estimateRpe([0.5, 0.48, 0.44, 0.39, 0.34], 0.3), { rir: 1, rpe: 9 });
  assert.deepEqual(estimateRpe([0.45, 0.4, 0.33, 0.31], 0.3), { rir: 0, rpe: 10 });
  assert.deepEqual(estimateRpe([0.62, 0.6, 0.6, 0.59, 0.6], 0.17), { rir: 5, rpe: 5 }); // aucune fatigue : facile
  const s = velocitySummary([0.5, 0.48, 0.44, 0.39, 0.34], 0.3);
  assert.deepEqual([s.first, s.last, s.best, s.mean, s.loss, s.rpe], [0.5, 0.34, 0.5, 0.43, 32, 9]);
  assert.equal(velocitySummary([]), null);
});

test("réglages : sens de la poussée, seuils d'échec, limites selon l'objectif, affichage", () => {
  for (const k of Object.keys(MVT)) assert.ok(CONC[k], k);
  assert.equal(CONC.curl, -1);
  assert.equal(CONC.press_h, 1);
  assert.equal(lossLimit("force"), 20);
  assert.equal(lossLimit("muscle"), 35);
  assert.equal(lossLimit("forme"), 30);
  assert.equal(fmtV(0.456), "0,46 m/s");
  assert.equal(fmtV(1), "1,00 m/s");
});
