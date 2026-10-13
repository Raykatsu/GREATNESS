// Démos dessinées : chaque exercice a son mouvement, le corps ne se déforme jamais, les pieds restent au sol,
// la cinématique inverse atteint les cibles, les consignes propres à un exercice sont cohérentes.
import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../js/data.js";
import { L, FLOOR, solve, sample, ik, fitBox, solveFront, sampleFront, frontReach, FSTAND, MUSCLES } from "../js/body.js";
import { MOVES, moveOf, hasMove, sayOf, viewLabel } from "../js/moves.js";
import { phaseAt, cycleOf } from "../js/anim.js";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const profile = Object.entries(MOVES).filter(([, m]) => m.view !== "front");
const frontal = Object.entries(MOVES).filter(([, m]) => m.view === "front");
const steps = n => Array.from({ length: n + 1 }, (_, i) => i / n);

test("chaque exercice a son propre dessin", () => {
  for (const id of Object.keys(EXERCISES)) assert.ok(hasMove(id), id);
  assert.ok(moveOf("inconnu").keys.length >= 1); // exercice perso : un mouvement par défaut
  for (const [id, m] of Object.entries(MOVES)) {
    assert.ok(m.keys?.length >= 1, `${id} : positions clés`);
    for (const g of m.mus?.p || []) assert.ok(MUSCLES[g], `${id} : muscle ${g}`);
    for (const g of m.mus?.s || []) assert.ok(MUSCLES[g], `${id} : muscle ${g}`);
  }
});

test("le corps ne se déforme jamais : os de longueur fixe", () => {
  for (const [id, m] of profile) for (const p of steps(24)) {
    const j = solve(sample(m, p)), q = j.q;
    for (const k of ["H", "K", "A", "K2", "A2", "S", "E", "W", "E2", "W2", "C"]) assert.ok(j[k].every(Number.isFinite), `${id} p=${p} ${k}`);
    const near = (a, b, len, what) => assert.ok(Math.abs(dist(a, b) - len) < 0.05, `${id} p=${p} ${what} ${dist(a, b).toFixed(2)} ≠ ${len.toFixed(2)}`);
    near(j.H, j.K, L.thigh * (q.lthigh ?? 1), "cuisse"); near(j.K, j.A, L.shin * (q.lshin ?? 1), "tibia");
    near(j.H, j.K2, L.thigh * (q.lthigh ?? 1), "cuisse 2"); near(j.K2, j.A2, L.shin * (q.lshin ?? 1), "tibia 2");
    near(j.E, j.W, L.farm * (q.lfarm ?? 1), "avant-bras"); near(j.S, j.E, L.uarm * (q.luarm ?? 1), "bras");
  }
});

test("les pieds ne passent pas sous le sol", () => {
  for (const [id, m] of profile) for (const p of steps(24)) {
    const j = solve(sample(m, p));
    for (const k of ["heel", "toe", "heel2", "toe2"]) assert.ok(j[k][1] <= FLOOR + 1.6, `${id} p=${p} ${k} y=${j[k][1].toFixed(1)}`);
  }
});

test("cinématique inverse : la main et le pied atteignent leur cible", () => {
  const [a1, a2] = ik([0, 0], [10, 10], 14.5, 12.5, 1);
  const E = [Math.sin(a1 * Math.PI / 180) * 14.5, -Math.cos(a1 * Math.PI / 180) * 14.5];
  const W = [E[0] + Math.sin(a2 * Math.PI / 180) * 12.5, E[1] - Math.cos(a2 * Math.PI / 180) * 12.5];
  assert.ok(dist(W, [10, 10]) < 1e-6);
  for (const [id, m] of profile) for (const k of m.keys) {
    const q = { ...m.base, ...k }, j = solve(q);
    if (q.Wt && q.at !== "wrist" && dist(j.S, q.Wt) < L.uarm * (q.luarm ?? 1) + L.farm - 0.5) assert.ok(dist(j.W, q.Wt) < 0.3, `${id} p=${k.p} main`);
    const legFree = !["ankle", "toe", "knee"].includes(q.at ?? "ankle");
    if (q.At && legFree && dist(j.H, q.At) < 2 * L.thigh - 0.5) assert.ok(dist(j.A, q.At) < 0.3, `${id} p=${k.p} pied`);
  }
});

test("positions clés ordonnées, boucles bouclées", () => {
  for (const [id, m] of Object.entries(MOVES)) {
    const ps = m.keys.map(k => k.p);
    assert.deepEqual(ps, [...ps].sort((a, b) => a - b), `${id} : ordre`);
    assert.equal(ps[0], 0, `${id} : départ à 0`);
    if (m.keys.length > 1) assert.equal(ps.at(-1), 1, `${id} : fin à 1`);
    if (m.loop && m.view !== "front") { // la fin d'une boucle retombe sur son début : pas de saut
      const a = solve(sample(m, 0)), b = solve(sample(m, 0.9999));
      for (const k of ["H", "S", "W", "A", "A2"]) assert.ok(dist(a[k], b[k]) < 0.8, `${id} : boucle ${k}`);
    }
  }
});

test("un os ne tourne jamais de plus d'un demi-tour entre deux positions clés", () => {
  const ANG = ["thigh", "shin", "torso", "uarm", "farm", "foot", "thigh2", "shin2", "uarm2", "farm2", "foot2"];
  for (const [id, m] of profile) for (let i = 1; i < m.keys.length; i++) {
    const a = { ...m.base, ...m.keys[i - 1] }, b = { ...m.base, ...m.keys[i] };
    for (const k of ANG) if (a[k] != null && b[k] != null) assert.ok(Math.abs(b[k] - a[k]) <= 180, `${id} ${k} : ${a[k]} → ${b[k]}`);
  }
});

test("vue de face : poses calculables, bras qui atteignent leur cible", () => {
  for (const [id, m] of frontal) for (const p of steps(12)) {
    const j = solveFront(sampleFront(m, p));
    for (const k of ["SL", "SR", "EL", "ER", "WL", "WR", "KL", "KR", "AL", "AR", "C"]) assert.ok(j[k].every(Number.isFinite), `${id} p=${p} ${k}`);
  }
  const q = { y: 80, lean: 6 }, T = [60, 70], r = frontReach(q, "L", T, -1), j = solveFront({ ...FSTAND, ...q, ...r });
  assert.ok(dist(j.WL, T) < 1e-6);
});

test("cadrage : la boîte contient tout le mouvement", () => {
  for (const [id, m] of Object.entries(MOVES)) {
    const [x, y, w, h] = fitBox(m, { ratio: 1.12 });
    assert.ok([x, y, w, h].every(Number.isFinite) && w > 20 && h > 20, `${id} : ${[x, y, w, h]}`);
    assert.ok(Math.abs(w / h - 1.12) < 0.01, `${id} : proportions`);
    if (m.view === "front") continue;
    for (const p of steps(12)) { const j = solve(sample(m, p)); for (const k of ["H", "S", "W", "A", "C"]) assert.ok(j[k][0] >= x && j[k][0] <= x + w && j[k][1] >= y && j[k][1] <= y + h, `${id} p=${p} ${k} hors cadre`); }
  }
});

test("rythme des démos : aller, pause, retour ; boucles continues", () => {
  const rep = MOVES.squat, run = MOVES.treadmill;
  assert.equal(phaseAt(rep, 0), 0); assert.equal(phaseAt(rep, 0.45), 1); assert.equal(phaseAt(rep, 0.95), 0);
  assert.ok(phaseAt(rep, 0.2) > 0 && phaseAt(rep, 0.2) < 1);
  assert.equal(phaseAt(run, 0.3), 0.3);
  assert.equal(cycleOf(rep), 2400); assert.ok(cycleOf(run) < 2400);
  for (const [id, m] of Object.entries(MOVES)) for (const c of steps(20)) { const p = phaseAt(m, c); assert.ok(p >= 0 && p <= 1, `${id} ${c}`); }
});

test("consignes propres à un exercice", () => {
  for (const id of ["box_jump", "burpee", "wall_sit", "pec_deck", "rower"]) assert.ok(Object.keys(sayOf(id)).length, id);
  assert.deepEqual(sayOf("inconnu"), {});
  for (const id of Object.keys(EXERCISES)) {
    const s = sayOf(id);
    if (s.steps) {
      assert.ok(MOVES[id].loop, `${id} : étapes réservées aux mouvements en boucle`);
      const at = s.steps.map(x => x[0]);
      assert.equal(at[0], 0, id); assert.deepEqual(at, [...at].sort((a, b) => a - b), id);
    }
    for (const k of ["setup", "go", "back"]) if (k in s) assert.ok(typeof s[k] === "string" && s[k].length > 8, `${id}.${k}`);
  }
  assert.equal(viewLabel(MOVES.db_fly), "Vue de dessus");
  assert.equal(viewLabel(MOVES.rear_delt), "Vue de dos");
  assert.equal(viewLabel(MOVES.lateral), "Vue de face");
  assert.equal(viewLabel(MOVES.squat), "");
});
