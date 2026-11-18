// Démos en 3D (js/demo3d.js) : le squelette du modèle anatomique prend la pose dessinée de chaque exercice. Pour tous les
// mouvements de la bibliothèque, à chaque instant : aucune valeur folle, des os de longueur fixe, et les positions clés
// au bon endroit (cuisses à l'horizontale en bas du squat, buste couché au développé couché, bras à l'horizontale en
// élévations latérales, pieds au sol debout). Les mains : fermées autour de la barre ou de la poignée (prise pronation,
// supination ou neutre selon l'exercice), à plat au sol aux pompes, réunies sur un objet tenu à deux mains ; l'avant-bras
// ne tourne jamais au-delà du possible. Le fichier du corps porte bien deux os, un poids et la part de vrille par sommet.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MOVES } from "../js/moves.js";
import { lift, retarget, prepRig, boneData, gearOf, bounds, arc, frame, axisAngle, quatOf, gripOf, SCALE } from "../js/demo3d.js";

const meta = JSON.parse(fs.readFileSync(new URL("../assets/anatomy/body.json", import.meta.url), "utf8"));
const R0 = prepRig(meta), I = R0.I;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dir = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return d.map(x => x / l); };
const withGrip = id => ({ ...MOVES[id], grip: gripOf(id) });
const pose = (id, p) => { const J = lift(withGrip(id), p); return { J, ...retarget(R0, J) }; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

test("rotations : quaternion d'une rotation", () => {
  for (const [k, t] of [[[0, 0, 1], 0.7], [[1, 0, 0], -2.4], [[0.48, 0.6, 0.64], 3.0]]) {
    const R = axisAngle(k, t), q = quatOf(R), v = [0.3, -0.5, 0.8];
    // q · v · q⁻¹ = R v
    const [x, y, z, w] = q, c = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
    const c2 = [c[0] + w * v[0], c[1] + w * v[1], c[2] + w * v[2]], c3 = [y * c2[2] - z * c2[1], z * c2[0] - x * c2[2], x * c2[1] - y * c2[0]];
    const out = [v[0] + 2 * c3[0], v[1] + 2 * c3[1], v[2] + 2 * c3[2]];
    assert.ok(dist(out, apply(R, v)) < 1e-9, `quaternion ${k} ${t}`);
  }
});

test("le squelette du modèle : 31 os et 24 phalanges, parents avant enfants, articulations à hauteur humaine", () => {
  assert.equal(meta.rig.length, 31);
  meta.rig.forEach((b, i) => assert.ok(b.p < i, `${b.n} : parent après lui`));
  const h = n => meta.rig[I[n]].h[1];
  assert.ok(h("thigh_r") > 0.8 && h("thigh_r") < 0.95, "hanche");
  assert.ok(h("shin_r") > 0.4 && h("shin_r") < 0.5, "genou");
  assert.ok(h("uarm_r") > 1.3 && h("uarm_r") < 1.45, "épaule");
  assert.ok(meta.rig[I.uarm_r].h[0] < 0 && meta.rig[I.uarm_l].h[0] > 0, "droite en -x, gauche en +x");
  // les rangées de phalanges se suivent (droite puis gauche) ; 4 doigts × 4 articulations, sous le poignet
  assert.deepEqual(["fing1_r", "fing2_r", "fing3_r", "fing1_l", "fing2_l", "fing3_l"].map(n => I[n]), [meta.frow, meta.frow + 1, meta.frow + 2, meta.frow + 3, meta.frow + 4, meta.frow + 5]);
  for (const s of ["r", "l"]) {
    assert.equal(meta.fingers[s].length, 4);
    for (const F of meta.fingers[s]) {
      assert.equal(F.length, 4);
      for (let k = 1; k < 4; k++) assert.ok(F[k][1] < F[k - 1][1] + 0.005 && dist(F[k], F[k - 1]) > 0.012 && dist(F[k], F[k - 1]) < 0.05, `phalange ${s}`);
      assert.ok(F[0][1] < meta.rig[I["hand_" + s]].h[1], "jointures sous le poignet");
    }
  }
  // repos : paume vers l'avant, plier les doigts les envoie vers la paume
  const H = R0.hands.r;
  assert.ok(H.n[2] > 0.85, `paume ${H.n}`);
  const bent = apply(axisAngle(H.K, Math.PI / 2), H.D);
  assert.ok(dot3(bent, H.n) > 0.95, "flexion vers la paume");
  // pronation : la paume droite tourne vers l'intérieur (+x), la gauche aussi (-x)
  assert.ok(apply(axisAngle(R0.hands.r.fa, R0.hands.r.sg * 0.5), H.n)[0] > H.n[0] + 0.2, "pronation droite");
  const Hl = R0.hands.l;
  assert.ok(apply(axisAngle(Hl.fa, Hl.sg * 0.5), Hl.n)[0] < Hl.n[0] - 0.2, "pronation gauche");
});

test("tous les mouvements, du début à la fin : valeurs finies, os de longueur fixe, matériel en place", () => {
  for (const id of Object.keys(MOVES)) {
    const mv = withGrip(id);
    for (let i = 0; i <= 8; i++) {
      const J = lift(mv, i / 8), ps = retarget(R0, J), bd = boneData(R0, ps);
      assert.ok([...bd.q, ...bd.t, ...bd.tw].every(Number.isFinite), `${id} à ${i / 8} : os`);
      assert.equal(bd.t.length, (31 + 24) * 4);
      // l'avant-bras ne tourne jamais au-delà de ce qu'il peut (de la supination complète à la pronation complète)
      for (const s of ["r", "l"]) { const pr = R0.hands[s].sg * ps.tw[s]; assert.ok(pr > -0.36 && pr < 3.5, `${id} : vrille ${s} ${pr}`); }
      // aucun doigt ne traverse le sol
      for (const s of ["r", "l"]) for (const t of ps.tips[s]) assert.ok(t[1] > -0.005, `${id} à ${i / 8} : doigt sous le sol (${t[1].toFixed(3)})`);
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

// Main fermée : le bout des doigts et du pouce tout près de la barre (autour, pas à côté), les jointures le long de la barre
function closedOn(ps, s, axisPt, axisDir, rb, label) {
  const H = R0.hands[s], off = p => { const v = [p[0] - axisPt[0], p[1] - axisPt[1], p[2] - axisPt[2]], t = dot3(v, axisDir); return Math.hypot(v[0] - t * axisDir[0], v[1] - t * axisDir[1], v[2] - t * axisDir[2]); };
  for (const t of ps.tips[s]) assert.ok(off(t) < rb + 0.03, `${label} : bout du doigt à ${off(t).toFixed(3)} de la barre`);
  const thumbTip = ps.tipOf(H.thumb[2]);
  assert.ok(off(thumbTip) < rb + 0.035, `${label} : pouce à ${off(thumbTip).toFixed(3)}`);
  assert.ok(Math.abs(dot3(ps.gax[s], axisDir)) > 0.9, `${label} : jointures en travers de la barre`);
}

test("mains : fermées sur la barre, l'haltère, la barre de traction ; prise pronation, supination ou neutre", () => {
  for (const [id, p] of [["deadlift", 0.5], ["bench", 0.5], ["row", 0.3], ["ohp", 0.5], ["pullup", 0.5], ["barbell_curl", 0.6]]) {
    // la barre : le long cylindre de métal en travers du corps (pas les montants)
    const ps = pose(id, p), gear = gearOf(withGrip(id), R0, ps, ps.J), bar = gear.find(g => g.k === "cyl" && g.col === "metal" && Math.abs(g.m[0]) > 1);
    assert.ok(bar, `${id} : barre`);
    const ax = [bar.m[0], bar.m[3], bar.m[6]].map(x => x / Math.hypot(bar.m[0], bar.m[3], bar.m[6]));
    assert.equal(ps.J.hands.r.mode, "grip"); assert.equal(ps.J.hands.l.mode, "grip");
    for (const s of ["r", "l"]) closedOn(ps, s, bar.c, ax, 0.014, `${id} ${s}`);
  }
  // haltères : la poignée passe dans le poing
  for (const [id, p] of [["db_bench", 0.5], ["curl", 0.5], ["farmer", 0.5], ["lateral", 1]]) {
    const ps = pose(id, p);
    for (const s of ["r", "l"]) closedOn(ps, s, ps.grip[s], ps.gax[s], 0.016, `${id} ${s}`);
  }
  // prise : pronation au soulevé de terre (dos des mains vers l'avant), supination au curl, neutre au farmer
  const pron = (id, p, s = "r") => { const ps = pose(id, p); return R0.hands[s].sg * ps.tw[s] * 180 / Math.PI; };
  assert.ok(pron("deadlift", 0.5) > 150, `soulevé de terre ${pron("deadlift", 0.5)}`);
  assert.ok(pron("barbell_curl", 0.5) < 40, `curl ${pron("barbell_curl", 0.5)}`);
  assert.ok(Math.abs(pron("farmer", 0.5) - 90) < 35, `farmer ${pron("farmer", 0.5)}`);
  assert.ok(Math.abs(pron("hammer", 0.5) - 90) < 35, `curl marteau ${pron("hammer", 0.5)}`);
  const dl = pose("deadlift", 0.5);
  assert.ok(apply(dl.R[I.hand_r], R0.hands.r.n)[2] < -0.5, "soulevé de terre : paumes vers les jambes");
  assert.equal(gripOf("chinup"), "under"); assert.equal(gripOf("pullup"), "over"); assert.equal(gripOf("hammer"), "neutral");
});

test("mains : à plat au sol (pompes, planche), réunies sur un objet tenu à deux mains, détendues sinon", () => {
  for (const [id, p] of [["pushup", 0.5], ["mountain", 0.3], ["down_dog", 0.5]]) {
    const ps = pose(id, p);
    for (const s of ["r", "l"]) {
      assert.ok(ps.J.hands[s].planted > 0.9, `${id} : main posée`);
      assert.ok(apply(ps.R[R0.hands[s].hand], R0.hands[s].n)[1] < -0.8, `${id} : paume vers le sol`);
      for (const t of ps.tips[s]) assert.ok(t[1] < 0.09, `${id} : doigts au sol (${t[1].toFixed(3)})`);
    }
  }
  for (const id of ["kb_swing", "goblet", "overhead_ext"]) {
    const ps = pose(id, 0.5);
    assert.ok(dist(ps.grip.r, ps.grip.l) < 0.16, `${id} : mains réunies (${dist(ps.grip.r, ps.grip.l).toFixed(3)})`);
  }
  const st = pose("air_squat", 0);
  assert.equal(st.J.hands.r.mode, "free"); assert.ok(st.J.hands.r.planted < 0.1, "debout : main détendue");
});

test("body.bin : deux os, un poids et la vrille par sommet ; les os du squelette d'un seul bloc, chaque phalange sur la sienne", () => {
  const buf = fs.readFileSync(new URL("../assets/anatomy/body.bin", import.meta.url));
  const { v, off } = meta;
  assert.equal(buf.length, off.skin + v * 4);
  const skin = new Uint8Array(buf.buffer, buf.byteOffset + off.skin, v * 4), nor = new Int8Array(buf.buffer, buf.byteOffset + off.nor, v * 4);
  let rigid = 0, bones = 0, twist = 0;
  const farm = [I.farm_r, I.farm_l], used = new Set();
  for (let i = 0; i < v; i++) {
    const b0 = skin[i * 4], b1 = skin[i * 4 + 1], tw = skin[i * 4 + 3];
    assert.ok(b0 < 31 + 24 && b1 < 31 + 24, `sommet ${i}`);
    assert.ok(!(b0 >= meta.frow && b0 < 31) && !(b1 >= meta.frow && b1 < 31), "les rangées de phalanges n'ont pas de sommets en propre");
    used.add(b0);
    if (nor[i * 4 + 3] === 0) { bones++; if (skin[i * 4 + 2] === 255) rigid++; }
    // la vrille ne concerne que l'avant-bras, du bon côté
    if (tw) { twist++; const side = tw > 127 ? 1 : 0; assert.ok(b0 === farm[side] || b1 === farm[side], `vrille hors de l'avant-bras ${i}`); }
    else assert.ok(b0 !== farm[0] && b1 !== farm[0] && b0 !== farm[1] && b1 !== farm[1], `avant-bras sans vrille ${i}`);
  }
  assert.equal(rigid, bones, "un os du squelette suit un seul segment");
  assert.ok(twist > 2000, `sommets de l'avant-bras ${twist}`);
  for (let k = 0; k < 24; k++) assert.ok(used.has(31 + k), `phalange ${k} sans sommet`);
});
