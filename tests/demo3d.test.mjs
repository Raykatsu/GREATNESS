// Démos en 3D (js/demo3d.js) : le squelette du modèle anatomique prend la pose dessinée de chaque exercice. Pour tous les
// mouvements de la bibliothèque, à chaque instant : aucune valeur folle, des os de longueur fixe, et les positions clés
// au bon endroit (cuisses à l'horizontale en bas du squat, buste couché au développé couché, bras à l'horizontale en
// élévations latérales, pieds au sol debout). Le fichier du corps porte bien deux os et un poids par sommet.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MOVES } from "../js/moves.js";
import { lift, retarget, prepRig, boneRows, gearOf, bounds, arc, frame, axisAngle, SCALE } from "../js/demo3d.js";

const meta = JSON.parse(fs.readFileSync(new URL("../assets/anatomy/body.json", import.meta.url), "utf8"));
const R0 = prepRig(meta.rig), I = R0.I;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dir = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return d.map(x => x / l); };
const pose = (id, p) => { const J = lift(MOVES[id], p); return { J, ...retarget(R0, J) }; };
const apply = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

test("rotations : arc et repère amènent bien une direction sur l'autre", () => {
  for (const [a, b] of [[[0, 1, 0], [0, 0, 1]], [[1, 0, 0], [-1, 0, 0]], [[0.3, -0.9, 0.1], [0.5, 0.5, 0.7]]]) {
    const R = arc(a, b), out = apply(R, dir([0, 0, 0], a)), want = dir([0, 0, 0], b);
    assert.ok(dist(out, want) < 1e-9, `arc ${a} → ${b}`);
  }
  const F = frame([0, -1, 0], [1, 0, 0], [0, 0, 1], [1, 0, 0]);
  assert.ok(dist(apply(F, [0, -1, 0]), [0, 0, 1]) < 1e-9);
  assert.ok(dist(apply(F, [1, 0, 0]), [1, 0, 0]) < 1e-9); // l'axe du pli reste en place : pas de vrille
  assert.ok(dist(apply(axisAngle([0, 0, 1], Math.PI / 2), [1, 0, 0]), [0, 1, 0]) < 1e-9);
});

test("le squelette du modèle : 19 os, parents avant enfants, articulations à hauteur humaine", () => {
  assert.equal(meta.rig.length, 19);
  meta.rig.forEach((b, i) => assert.ok(b.p < i, `${b.n} : parent après lui`));
  const h = n => meta.rig[I[n]].h[1];
  assert.ok(h("thigh_r") > 0.8 && h("thigh_r") < 0.95, "hanche");
  assert.ok(h("shin_r") > 0.4 && h("shin_r") < 0.5, "genou");
  assert.ok(h("uarm_r") > 1.3 && h("uarm_r") < 1.45, "épaule");
  assert.ok(meta.rig[I.uarm_r].h[0] < 0 && meta.rig[I.uarm_l].h[0] > 0, "droite en -x, gauche en +x");
});

test("tous les mouvements, du début à la fin : valeurs finies, os de longueur fixe, matériel en place", () => {
  for (const [id, mv] of Object.entries(MOVES)) {
    for (let i = 0; i <= 8; i++) {
      const J = lift(mv, i / 8), ps = retarget(R0, J), rows = boneRows(R0, ps);
      assert.ok([...rows].every(Number.isFinite), `${id} à ${i / 8} : os`);
      for (const g of gearOf(mv, R0, ps, J)) assert.ok([...g.c, ...g.m].every(Number.isFinite), `${id} : matériel ${g.k}`);
      meta.rig.forEach((b, k) => {
        if (b.p < 0) return;
        assert.ok(Math.abs(dist(ps.P[k], ps.P[b.p]) - dist(b.h, meta.rig[b.p].h)) < 1e-9, `${id} : ${b.n} étiré`);
      });
    }
    const B = bounds(mv, R0, 4);
    assert.ok(B.r > 0.3 && B.r < 3, `${id} : cadrage ${B.r}`);
  }
});

test("positions clés : squat, développé couché, élévations latérales, vue de dessus", () => {
  // debout : chevilles au sol (centre de la cheville à 6-7 cm), corps droit
  const st = pose("air_squat", 0);
  assert.ok(Math.abs(st.P[I.foot_r][1] - (100 - 96.8) * SCALE) < 0.02);
  assert.ok(dir(st.P[I.pelvis], st.P[I.neck])[1] > 0.95);
  // bas du squat : cuisses presque à l'horizontale, bassin descendu
  const sq = pose("squat", 1), th = dir(sq.P[I.thigh_r], sq.P[I.shin_r]);
  assert.ok(Math.abs(th[1]) < 0.25, `cuisse ${th}`);
  assert.ok(sq.P[I.pelvis][1] < 0.55);
  // développé couché : buste à l'horizontale, bassin sur le banc, mains au-dessus des épaules
  const bp = pose("bench", 0), trunk = dir(bp.P[I.pelvis], bp.P[I.neck]);
  assert.ok(Math.abs(trunk[1]) < 0.3, `buste ${trunk}`);
  assert.ok(bp.P[I.hand_r][1] > bp.P[I.uarm_r][1] + 0.4, "bras tendus vers le haut");
  // pompes : mains et pointes de pied au sol
  const pu = pose("pushup", 1);
  assert.ok(pu.P[I.hand_r][1] < 0.12 && pu.tipOf(I.foot_r)[1] < 0.06);
  // élévations latérales (vue de face) : bras à l'horizontale, sur les côtés
  const lat = pose("lateral", 1), ua = dir(lat.P[I.uarm_r], lat.P[I.farm_r]);
  assert.ok(Math.abs(ua[1]) < 0.25 && ua[0] < -0.8, `bras droit ${ua}`);
  // vue de dessus (écarté couché) : buste à l'horizontale
  const fly = pose("db_fly", 0), tf = dir(fly.P[I.pelvis], fly.P[I.neck]);
  assert.ok(Math.abs(tf[1]) < 0.3, `buste couché ${tf}`);
});

test("body.bin : deux os et un poids par sommet, les os du squelette d'un seul bloc", () => {
  const buf = fs.readFileSync(new URL("../assets/anatomy/body.bin", import.meta.url));
  const { v, off } = meta;
  assert.equal(buf.length, off.skin + v * 4);
  const skin = new Uint8Array(buf.buffer, buf.byteOffset + off.skin, v * 4), nor = new Int8Array(buf.buffer, buf.byteOffset + off.nor, v * 4);
  let rigid = 0, bones = 0;
  for (let i = 0; i < v; i++) {
    assert.ok(skin[i * 4] < 19 && skin[i * 4 + 1] < 19, `sommet ${i}`);
    if (nor[i * 4 + 3] === 0) { bones++; if (skin[i * 4 + 2] === 255) rigid++; }
  }
  assert.equal(rigid, bones, "un os du squelette suit un seul segment");
});
