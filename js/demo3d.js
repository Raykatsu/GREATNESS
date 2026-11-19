// Démos d'exercice en 3D : le corps anatomique (BodyParts3D / Z-Anatomy, js/body3d.js) fait le mouvement de la démo.
// À chaque image, la position dessinée (js/body.js : angles des os, de profil ou de face) est « relevée » en 3D : la
// profondeur vient des raccourcis de perspective du dessin (un bras raccourci de profil s'écarte du corps). Le squelette
// du modèle (placé sur les vrais os par tools/anatomy/export_web.py) prend ces directions : bassin et buste d'un bloc (le
// haut du dos s'enroule avec « spine »), bras et jambes pliés dans leur plan, pieds dans le prolongement. Les mains ont
// leurs doigts : fermées sur la barre, l'haltère ou la poignée (les doigts s'enroulent jusqu'à toucher la barre, le pouce
// se referme dessus), à plat sur le sol ou un appui, détendues sinon ; l'avant-bras tourne (pronation, supination) pour
// que les jointures suivent la barre, en prise pronation, supination ou neutre selon l'exercice. La carte graphique
// déforme le corps : chaque sommet suit deux os, avec un poids, et l'avant-bras se vrille progressivement du coude au
// poignet. Le matériel (barre, haltères, banc, poulies…) est fait de cylindres et de boîtes. Les muscles ont la couleur
// de leur rôle (comme la planche) et l'agoniste s'allume pendant l'effort.
// Le calcul de la pose (lift, retarget, gearOf) est pur et testé dans Node ; mountDemo3D dessine en WebGL.
import { solve, sample, solveFront, sampleFront, at as at2d, L, FLOOR, FSTAND } from "./body.js";
import { mul, perspective, lookAt, orbitEye } from "./body3d.js";

export const SCALE = 0.0203; // mètres par unité du dessin (cuisse et jambe du modèle / du dessin)
const RAD = Math.PI / 180;

/* ---------- Petits vecteurs et matrices 3 × 3 (ligne par ligne) ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = (a, fb = [0, 1, 0]) => { const l = len(a); return l > 1e-9 ? scl(a, 1 / l) : fb; };
const mid = (a, b) => scl(add(a, b), 0.5);
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mm = (A, B) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; };
const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const tr = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
// rotation d'angle t autour de l'axe unitaire k (Rodrigues)
export function axisAngle(k, t) {
  const c = Math.cos(t), s = Math.sin(t), v = 1 - c, [x, y, z] = k;
  return [c + x * x * v, x * y * v - z * s, x * z * v + y * s, y * x * v + z * s, c + y * y * v, y * z * v - x * s, z * x * v - y * s, z * y * v + x * s, c + z * z * v];
}
// plus petite rotation qui amène la direction a sur la direction b
export function arc(a, b) {
  a = unit(a); b = unit(b);
  const c = dot(a, b);
  if (c > 1 - 1e-9) return ID;
  if (c < -1 + 1e-9) return axisAngle(unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), Math.PI);
  const k = cross(a, b);
  return axisAngle(unit(k), Math.atan2(len(k), c));
}
// rotation qui amène le repère (direction da, normale na) sur (db, nb) : un membre plié dans son plan, sans vrille
export function frame(da, na, db, nb) {
  const base = (d, n) => { d = unit(d); const n2 = unit(sub(n, scl(d, dot(n, d))), unit(cross(d, [0, 0, 1]))); return [d, n2, cross(d, n2)]; };
  const [a1, a2, a3] = base(da, na), [b1, b2, b3] = base(db, nb);
  // R = B · Aᵀ
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = b1[r] * a1[c] + b2[r] * a2[c] + b3[r] * a3[c];
  return o;
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// quaternion [x, y, z, w] d'une rotation 3 × 3
export function quatOf(R) {
  const [a, b, c, d, e, f, g, h, i] = R, tr = a + e + i;
  let q;
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; q = [(h - f) / k, (c - g) / k, (d - b) / k, k / 4]; }
  else if (a > e && a > i) { const k = Math.sqrt(1 + a - e - i) * 2; q = [k / 4, (b + d) / k, (c + g) / k, (h - f) / k]; }
  else if (e > i) { const k = Math.sqrt(1 + e - a - i) * 2; q = [(b + d) / k, k / 4, (f + h) / k, (c - g) / k]; }
  else { const k = Math.sqrt(1 + i - a - e) * 2; q = [(c + g) / k, (f + h) / k, k / 4, (d - b) / k]; }
  const l = Math.hypot(...q);
  return q.map(x => x / l);
}
// angle de la rotation R autour de l'axe a (décomposition « vrille × reste »), dans ]-π, π]
const twistOf = (R, a) => { const q = quatOf(R); return 2 * Math.atan2(q[0] * a[0] + q[1] * a[1] + q[2] * a[2], q[3]); };
// interpolation de deux rotations (quaternions), t ∈ [0, 1]
function slerpR(A, B, t) {
  if (t <= 0) return A; if (t >= 1) return B;
  const qa = quatOf(A); let qb = quatOf(B), c = qa.reduce((s, x, k) => s + x * qb[k], 0);
  if (c < 0) { qb = qb.map(x => -x); c = -c; }
  const th = Math.acos(Math.min(1, c)), sn = Math.sin(th);
  const w = sn < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * th) / sn, Math.sin(t * th) / sn];
  const [x, y, z, ww] = qa.map((v, k) => w[0] * v + w[1] * qb[k]), l = Math.hypot(x, y, z, ww);
  return axisAngleQ([x / l, y / l, z / l, ww / l]);
}
const axisAngleQ = ([x, y, z, w]) => [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];

/* ---------- Du dessin à la 3D ---------- */
// Repère 3D (celui du modèle dans l'app) : x vers la gauche du sportif, y vers le haut, z vers l'avant ; sol en y = 0.
const hyp = (l, d) => Math.sqrt(Math.max(0, l * l - d * d));
const d2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const dirA = a => [Math.sin(a * RAD), -Math.cos(a * RAD)];
const SH = 7.4, HP = 3.8; // demi-largeur d'épaules et de hanches du dessin (vue de face)
const topBend = spine => Math.atan2(4 * (((spine || 0) / 90) * L.torso * 0.2), L.torso) / RAD; // comme body.js
export const isTop = move => move.label === "Vue de dessus";

// Profil : le sportif regarde vers la droite du dessin (+z) ; on voit son côté droit (-x), le côté « 2 » est le gauche.
// Un os raccourci de profil sort du plan : il s'écarte du corps (coudes ouverts au développé couché…).
// Un seul objet tenu à deux mains (kettlebell, haltère tenu par le disque) : les mains se rejoignent au milieu
const holdsTwoHanded = move => (move.gear || []).some(g => (g.k === "kb" && g.rel == null) || (g.k === "db" && g.r));
const HOLD_W = 2.2; // demi-écart des mains qui tiennent le même objet (unités du dessin, ≈ 4,5 cm)
function liftSide(move, p) {
  const j = solve(sample(move, p)), q = j.q, two = holdsTwoHanded(move);
  const W = (pt, lat) => [lat * SCALE, (FLOOR - pt[1]) * SCALE, (pt[0] - 50) * SCALE];
  const J = { kind: "side", at: q.at || "ankle", spine: q.spine || 0, shrug: q.shrug || 0 };
  for (const [s, k, sg] of [["r", "", -1], ["l", "2", 1]]) {
    const E = j["E" + k], Wr = j["W" + k], K = j["K" + k], A = j["A" + k];
    const sl = sg * SH, u = d2(j.S, E), f = d2(E, Wr);
    let el = sl + sg * hyp(L.uarm, u), wl = el + sg * hyp(L.farm, f);
    if (two) { wl = sg * HOLD_W; el = sl + (wl - sl) * (u / Math.max(1e-6, u + f)); } // les mains se rejoignent
    const hl = sg * HP, kl = hl + sg * hyp(L.thigh, d2(j.H, K)), al = kl + sg * hyp(L.shin, d2(K, A));
    const hd = dirA((k ? q.farm2 : q.farm) + ((k ? q.hand2 ?? q.hand : q.hand) || 0));
    Object.assign(J, {
      ["shoulder_" + s]: W(j.S, sl), ["elbow_" + s]: W(E, el), ["wrist_" + s]: W(Wr, wl), ["tip_" + s]: W([Wr[0] + hd[0] * 7, Wr[1] + hd[1] * 7], wl),
      ["hip_" + s]: W(j.H, hl), ["knee_" + s]: W(K, kl), ["ankle_" + s]: W(A, al), ["heel_" + s]: W(j["heel" + k], al), ["toe_" + s]: W(j["toe" + k], al),
    });
  }
  J.pelvis = W(j.H, 0); J.neck = W(j.S, 0); J.head = W(j.C, 0);
  J.map = pt => W(pt, 0); // un point du dessin (matériel fixe), au milieu du corps
  J.j = j;
  return J;
}
// Face (ou dos) : le plan du dessin est le plan frontal ; les coudes et les genoux pliés avancent vers nous.
// « Vue de dessus » : la même pose, couchée sur le dos (le devant du corps vers le haut).
// move.pose(p) : une pose de face calculée à chaque instant (la danse, dance.js) au lieu des positions clés
function liftFront(move, p) {
  const top = isTop(move), q0 = move.pose ? { ...FSTAND, ...move.pose(p) } : sampleFront(move, p), q = top ? { ...q0, rot: 0 } : q0;
  const j = solveFront(q), a = (q.rot || 0) * RAD, [cx, cy] = j.P;
  const rot = ([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
  const mx = move.back ? -1 : 1; // de face, la gauche de l'image est la droite du sportif ; de dos, sa gauche
  const W = (pt, z = 0) => { const r = rot(pt); return [mx * (r[0] - 50) * SCALE, (FLOOR - r[1]) * SCALE, z * SCALE]; };
  const J = { kind: top ? "top" : "front", at: "pelvis", spine: 0, shrug: q.shrug || 0 };
  const down = unit(sub(W([cx, cy + 10]), W([cx, cy]))), fwd = [0, 0, 1];
  for (const [s, k] of move.back ? [["l", "L"], ["r", "R"]] : [["r", "L"], ["l", "R"]]) {
    const S = j["S" + k], E = j["E" + k], Wr = j["W" + k], H = j["H" + k], K = j["K" + k], A = j["A" + k];
    const ez = hyp(L.uarm, d2(S, E)), wz = ez + hyp(L.farm, d2(E, Wr));
    const kz = hyp(L.thigh, d2(H, K)), az = kz - hyp(L.shin, d2(K, A));
    const e3 = W(E, ez), w3 = W(Wr, wz), a3 = W(A, az);
    Object.assign(J, {
      ["shoulder_" + s]: W(S), ["elbow_" + s]: e3, ["wrist_" + s]: w3, ["tip_" + s]: add(w3, scl(unit(sub(w3, e3)), 7 * SCALE)),
      ["hip_" + s]: W(H), ["knee_" + s]: W(K, kz), ["ankle_" + s]: a3,
      ["heel_" + s]: add(a3, add(scl(down, L.ankle * SCALE), scl(fwd, -3.2 * SCALE))), ["toe_" + s]: add(a3, add(scl(down, L.ankle * SCALE), scl(fwd, 8.8 * SCALE))),
    });
  }
  J.pelvis = W(j.P); J.neck = W(j.S0); J.head = W(j.C);
  J.map = pt => W(pt);
  // matériel fixe (tapis, siège, dossier, poulies) : il ne tourne pas avec le corps (planche latérale…)
  J.fixed = pt => [mx * (pt[0] - 50) * SCALE, (FLOOR - pt[1]) * SCALE, 0];
  J.j = j;
  if (top) { // couché sur le dos : (x, y, z) → (x, z, -y) autour du bassin ; la tête part vers -z
    const P0 = J.pelvis;
    for (const k of Object.keys(J)) if (Array.isArray(J[k]) && J[k].length === 3) { const r = sub(J[k], P0); J[k] = [P0[0] + r[0], r[2], -r[1]]; }
    J.map = J.fixed = null;
  }
  return J;
}
export function lift(move, p) {
  const J = move.view === "front" ? liftFront(move, p) : liftSide(move, p);
  J.hands = handPlan(move, J);
  J.grip = move.grip || "over";
  return J;
}

/* ---------- Ce que fait chaque main ---------- */
// « grip » : fermée sur une barre, un haltère, une poignée (axe imposé par le matériel ou choisi selon la prise ; rb :
// rayon de ce qu'on tient) ; « cup » : en coupe sous un haltère tenu par le disque, ou sous la barre en rack ; « free » :
// ni l'un ni l'autre, à plat (planted = 1) quand elle s'appuie sur le sol ou un appui, détendue sinon.
const RB = { plate: 0.014, bar: 0.016, db: 0.016, kb: 0.018, cable: 0.015, band: 0.015, line: 0.016, rope: 0.014, wave: 0.02, roller: 0.015, dip: 0.02 };
const HELD = new Set(["plate", "db", "kb", "cable", "band", "bar", "line", "rope", "wave", "roller"]);
// De profil, le bras éloigné fait-il le même geste que le proche (mains au même endroit du dessin) ? De face : oui.
const handsTogether = J => J.kind !== "side" || (J.j?.W && J.j?.W2 && Math.hypot(J.j.W[0] - J.j.W2[0], J.j.W[1] - J.j.W2[1]) < 3);
// Mains qui tiennent un haltère : celle du dessin ; de profil, les deux si le bras éloigné fait le même geste (curl…)
function dbHands(move, g, together) {
  const n = refName(g.at);
  if (!g.at) return g.side === 0 ? ["r"] : g.side === 1 ? ["l"] : ["r", "l"];
  if (n === "W2") return ["l"];
  const other = (move.gear || []).some(o => o !== g && o.k === "db" && refName(o.at) === "W2");
  return n === "W" && together && !other ? ["r", "l"] : ["r"];
}
export function handPlan(move, J) {
  const side = J.kind === "side", j = J.j || {}, H = {}, lateral = [1, 0, 0];
  const set = (s, h) => { if (!H[s]) H[s] = h; };
  const both = h => { set("r", h); set("l", h); };
  const together = handsTogether(J);
  const across = side ? lateral : unit(sub(J.wrist_l, J.wrist_r)); // barre tenue à deux mains
  const front = s => (s === "WL" ? (move.back ? "l" : "r") : (move.back ? "r" : "l")); // main gauche / droite de l'image
  for (const g of (move.gear || []).filter(g => HELD.has(g.k))) {
    const n = refName(g.at);
    if (g.k === "plate") both(n === "rack" ? { mode: "cup" } : { mode: "grip", rb: RB.plate, axis: across, reach: side && (n === "back" || n === "hips") ? n : null });
    else if (g.k === "db") {
      if (g.r) { both({ mode: "cup" }); continue; } // haltère tenu par le disque, à deux mains
      for (const s of dbHands(move, g, together)) set(s, { mode: "grip", rb: RB.db });
    } else if (g.k === "kb") {
      const s = n === "W2" ? "l" : "r";
      set(s, { mode: "grip", rb: RB.kb, axis: side ? lateral : null });
      if (g.rel == null) set(s === "r" ? "l" : "r", { mode: "grip", rb: RB.kb, axis: side ? lateral : null }); // à deux mains
    } else if (g.k === "cable" || g.k === "band") {
      if (side ? g.to === "W" : !["A", "K"].includes(g.to) && !g.ankles) {
        if (side || !g.from) both({ mode: "grip", rb: RB[g.k] });
        else (g.to || ["WL", "WR"]).forEach(t => set(front(t), { mode: "grip", rb: RB[g.k] }));
      }
    } else if (g.k === "line") { if (refName(g.to) === "W") both({ mode: "grip", rb: RB.line, axis: side ? lateral : null }); }
    else if (g.k === "bar") both({ mode: "grip", rb: RB.bar, axis: across });
    else both({ mode: "grip", rb: RB[g.k], axis: g.k === "roller" ? lateral : null });
  }
  // barres parallèles (dips) : les mains les serrent, axe d'avant en arrière
  if (side && j.W) for (const g of move.gear || []) {
    if (g.k === "post" && g.x2 != null && g.y2 === g.y && Math.abs(j.W[1] - g.y) < 4 && j.W[0] > Math.min(g.x, g.x2) - 2 && j.W[0] < Math.max(g.x, g.x2) + 2)
      both({ mode: "grip", rb: RB.dip, axis: [0, 0, 1], dip: g });
  }
  // mains libres : à plat sur le sol (poignet bas) ou un appui (box), ou si le mouvement repose sur les poignets
  for (const s of ["r", "l"]) {
    if (H[s]) continue;
    const W2d = s === "r" ? j.W : j.W2;
    const onBox = side && W2d && (move.gear || []).some(g => g.k === "box" && W2d[0] > g.x - 2 && W2d[0] < g.x + g.w + 2 && Math.abs(W2d[1] - g.y) < 5);
    // avant-bras couché près du sol (gainage sur les coudes, bras allongés devant) : la main aussi est à plat
    const fa = unit(sub(J["wrist_" + s], J["elbow_" + s])), low = Math.min(J["wrist_" + s][1], J["elbow_" + s][1]);
    const lying = Math.abs(fa[1]) < 0.4 ? smooth(0.17, 0.12, low) : 0;
    const planted = move.base?.at === "wrist" || onBox ? 1 : Math.max(lying, smooth(0.12, 0.065, J["wrist_" + s][1]));
    H[s] = { mode: "free", planted, ...(move.fists ? { fist: true } : {}) }; // poings serrés (le mannequin qui danse)
  }
  return H;
}

/* ---------- Le squelette du modèle prend la pose ---------- */
// rig : os du modèle (body.json : n nom, p parent, h pivot, t bout, aim direction de visée au repos pour les pieds ;
// ax axe de flexion des doigts et du pouce, ab / op écartement et opposition du pouce, pn normale de la paume).
// src : le corps décodé (ou body.json) ; un tableau seul (ancien format) donne un squelette sans doigts.
export function prepRig(src) {
  const rig = Array.isArray(src) ? src : src.rig;
  const I = Object.fromEntries(rig.map((b, i) => [b.n, i]));
  const dir = rig.map(b => unit(b.aim || sub(b.t, b.h)));
  const shoulderC = mid(rig[I.uarm_r].h, rig[I.uarm_l].h), pelvis = rig[I.pelvis].h;
  const R0 = { rig, I, dir, nb: rig.length, trunk: unit(sub(shoulderC, pelvis)), lat: unit(sub(rig[I.thigh_l].h, rig[I.thigh_r].h)),
    clav: rig.map(b => (b.n.startsWith("clav") ? len(sub(b.t, b.h)) : 0)) };
  const fingers = !Array.isArray(src) && src.fingers;
  R0.frow = fingers ? src.frow ?? I.fing1_r : -1;
  R0.hands = fingers && I.fing1_r != null ? { r: handRest(R0, "r", fingers.r), l: handRest(R0, "l", fingers.l) } : null;
  return R0;
}
// La main au repos (paume vers l'avant) : direction de la paume D (poignet → jointures), axe des jointures K (plier les
// doigts = tourner de + autour de K), normale de la paume n ; la chaîne moyenne des doigts dans le plan (D, n) ; le pouce.
function handRest(R0, s, F) {
  const { rig, I } = R0, hb = rig[I["hand_" + s]], fb = rig[I["farm_" + s]], t1 = rig[I["thumb1_" + s]];
  const ax = [1, 2, 3].map(k => unit(rig[I[`fing${k}_${s}`]].ax));
  const D = unit(sub(hb.t, hb.h)), K = unit(sub(ax[0], scl(D, dot(ax[0], D)))), n = unit(cross(K, D));
  const rows = [0, 1, 2, 3].map(k => scl(F.reduce((a, f) => add(a, f[k]), [0, 0, 0]), 1 / F.length));
  const p2 = rows.map(p => [dot(sub(p, rows[0]), D), dot(sub(p, rows[0]), n)]);
  const phi = [0, 1, 2].map(k => Math.atan2(p2[k + 1][1] - p2[k][1], p2[k + 1][0] - p2[k][0]));
  const thumb = [1, 2, 3].map(k => I[`thumb${k}_${s}`]);
  return {
    s, sg: s === "r" ? -1 : 1, // pronation p (paume qui se tourne vers l'intérieur) : rotation de sg × p autour de l'avant-bras
    hand: I["hand_" + s], farm: I["farm_" + s], D, K, n, fa: unit(sub(fb.t, fb.h)), elbow: fb.h,
    rows: [1, 2, 3].map(k => I[`fing${k}_${s}`]), ax, F, mcp: rows[0],
    len2: [0, 1, 2].map(k => Math.hypot(p2[k + 1][0] - p2[k][0], p2[k + 1][1] - p2[k][1])), rest: [phi[0], phi[1] - phi[0], phi[2] - phi[1]],
    thumb, ab: unit(t1.ab), op: unit(t1.op), tax: [unit(rig[thumb[1]].ax), unit(rig[thumb[2]].ax)], d1: unit(sub(t1.t, t1.h)),
    tj: [rig[thumb[0]].h, rig[thumb[1]].h, rig[thumb[2]].h, rig[thumb[2]].t], cache: {},
  };
}

/* ---------- Les doigts ---------- */
// Main fermée sur une barre de rayon rb, couchée en travers de la paume au pied des doigts : chaque rangée de phalanges
// plie (degré par degré) jusqu'à toucher la barre ; le pouce passe ensuite par-dessus la barre et se pose sur l'index.
const PALM = 0.009, SOFT = 0.0065, GRIP_X = -0.011; // épaisseur paume / doigts sous l'os, barre un peu avant les jointures
const FMAX = [80, 105, 75].map(a => a * RAD), TMAX = [70, 45, 50, 70, 90].map(a => a * RAD); // pouce : écart, opposition, flexions, rotation
// mains sans rien : flexions des 3 rangées (degrés) et réglage du pouce (voir thumbR)
const FREE = { relax: { f: [26, 34, 20], t: [0.3, 0.3, 0.25, 0.25, -0.3] }, flat: { f: [0, 3, 3], t: [0.05, 0, 0, 0, 0] },
  cup: { f: [40, 42, 26], t: [0.4, 0.35, 0.25, 0.25, -0.4] }, fist: { f: [82, 100, 66], t: [0.45, 0.62, 0.55, 0.7, -0.5] } };
// rotations du pouce (repère de repos) : a = [écart, opposition, flexion MCP, flexion IP, rotation du pouce sur lui-même],
// en part de TMAX (la rotation, négative, accompagne l'opposition : elle tourne la pulpe vers les doigts et fait plier le
// pouce autour de la barre plutôt que le long)
function thumbR(H, a) {
  const R1 = mm(axisAngle(H.op, a[1] * TMAX[1]), mm(axisAngle(H.ab, a[0] * TMAX[0]), axisAngle(H.d1, a[4] * TMAX[4])));
  const R2 = mm(R1, axisAngle(H.tax[0], a[2] * TMAX[2]));
  return [R1, R2, mm(R2, axisAngle(H.tax[1], a[3] * TMAX[3]))];
}
export function gripCurl(H, rb) {
  const key = rb.toFixed(4);
  if (H.cache[key]) return H.cache[key];
  const C = [GRIP_X, PALM + rb], need = rb + SOFT;
  const near = (X, a, l) => { // distance du centre de la barre à la phalange
    const u = [Math.cos(a), Math.sin(a)], v = [C[0] - X[0], C[1] - X[1]], t = Math.max(0, Math.min(l, v[0] * u[0] + v[1] * u[1]));
    return Math.hypot(v[0] - t * u[0], v[1] - t * u[1]);
  };
  let X = [0, 0], a = 0;
  const flex = H.len2.map((l, k) => {
    let f = 0;
    for (let d = RAD; d <= FMAX[k] + 1e-9; d += RAD) { if (near(X, a + d, l) < need - (k === 2 ? 0.003 : 0)) break; f = d; }
    if (k === 2) f = Math.max(f, 28 * RAD); // la pulpe du doigt appuie sur la barre
    a += f; X = [X[0] + l * Math.cos(a), X[1] + l * Math.sin(a)];
    return f;
  });
  const C3 = add(H.mcp, add(scl(H.D, C[0]), scl(H.n, C[1])));
  // pouce : il passe par-dessus la barre et vient se poser sur la phalange moyenne de l'index (cherché sur une grille)
  const th = flex.map((f, k) => f - H.rest[k]);
  const out = p => { const v = sub(p, C3); return len(sub(v, scl(H.K, dot(v, H.K)))); }; // distance à l'axe de la barre
  let Rk = ID; const fr = [0, 1].map(k => { Rk = mm(Rk, axisAngle(H.ax[k], th[k])); return Rk; });
  const F0 = H.F[0], pip = add(F0[0], mv(fr[0], sub(F0[1], F0[0]))), dip = add(pip, mv(fr[1], sub(F0[2], F0[1])));
  const md = mid(pip, dip), target = add(md, scl(unit(sub(sub(md, C3), scl(H.K, dot(sub(md, C3), H.K)))), 0.016));
  const cost = a => {
    const R = thumbR(H, a), j = [H.tj[0]];
    for (let k = 0; k < 3; k++) j.push(add(j[k], mv(R[k], sub(H.tj[k + 1], H.tj[k]))));
    let c = len(sub(j[3], target)) + 0.3 * Math.abs(out(j[2]) - rb - 0.009); // le bout sur l'index, la phalange contre la barre
    for (let k = 0; k < 3; k++) for (let u = 0.25; u <= 1.0001; u += 0.25) c += Math.max(0, rb + 0.0075 - out(add(j[k], scl(sub(j[k + 1], j[k]), u)))) * 6;
    return c;
  };
  // recherche sur une grille, resserrée deux fois autour du meilleur réglage
  let tc = [0, 0, 0, 0, 0], best = Infinity;
  const span = [[0, 1], [0, 1], [0, 1], [0, 1], [-1, 1]];
  for (let pass = 0, n = 5; pass < 3; pass++, n = 3) {
    const grid = span.map(([lo, hi]) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n));
    const at = [0, 0, 0, 0, 0];
    const walk = d => {
      if (d === 5) { const c = cost(at); if (c < best) { best = c; tc = at.slice(); } return; }
      for (const v of grid[d]) { at[d] = v; walk(d + 1); }
    };
    walk(0);
    span.forEach((st, k) => { const w = (st[1] - st[0]) / n; st[0] = Math.max(k === 4 ? -1 : -0.15, tc[k] - w); st[1] = Math.min(1.1, tc[k] + w); });
  }
  return (H.cache[key] = { th, C3, tc });
}
// angles des rangées (par rapport au repos), fermeture du pouce et point tenu (repère de repos) pour une main
function curlOf(H, plan) {
  if (plan.mode === "grip") return gripCurl(H, plan.rb);
  const lerp = (a, b, t) => a + (b - a) * t;
  const A = plan.mode === "cup" ? FREE.cup : plan.fist ? FREE.fist : FREE.relax, B = plan.mode === "cup" ? FREE.cup : FREE.flat, w = plan.planted || 0;
  return { th: A.f.map((f, k) => lerp(f, B.f[k], w) * RAD - H.rest[k]), tc: A.t.map((t, k) => lerp(t, B.t[k], w)),
    C3: add(H.mcp, add(scl(H.D, -0.02), scl(H.n, plan.mode === "cup" ? 0.035 : 0.02))) };
}

/* ---------- Orientation de la main et rotation de l'avant-bras ---------- */
// pronation possible (0 : paume en avant bras le long du corps, 90° : paumes face à face, 180° : paume en arrière ; l'épaule
// tourne aussi un peu dans les prises les plus pronées) ; prise visée : supination, neutre, pronation
const PRON = [-20 * RAD, 200 * RAD], RELAX_PRON = 75 * RAD, AIM = { under: 0, neutral: Math.PI / 2, over: Math.PI };
// Pronation que demande le repère voulu Rw de la main, l'avant-bras étant posé en Rf (sans rotation)
function pronOf(H, Rf, Rw) {
  let p = H.sg * twistOf(mm(tr(Rf), Rw), H.fa);
  if (p < -Math.PI / 2) p += 2 * Math.PI;
  return p;
}
// Main posée : le repère voulu, ramené à ce que l'avant-bras peut faire ; renvoie la main et la vrille de l'avant-bras
function settle(H, Rf, Rw) {
  const Q = mm(tr(Rf), Rw), tw = twistOf(Q, H.fa);
  let p = H.sg * tw; if (p < -Math.PI / 2) p += 2 * Math.PI;
  const pc = Math.max(PRON[0], Math.min(PRON[1], p)), tc = H.sg * pc;
  const swing = mm(tr(axisAngle(H.fa, tw)), Q); // le reste : flexion / inclinaison du poignet
  return { Rh: mm(Rf, mm(axisAngle(H.fa, tc), swing)), tw: tc };
}
// Repère de la main (paume D, normale n) qui envoie (D, n) de repos sur (d, n2)
const handFrame = (H, d, n2) => frame(H.D, H.n, d, n2);
function handPose(H, J, plan, Rf, Rt) {
  const f = mv(Rf, H.fa), hd = unit(sub(J["tip_" + H.s], J["wrist_" + H.s]), f);
  const flatPart = v => { const h = [v[0], 0, v[2]]; return len(h) > 0.3 ? unit(h) : null; };
  if (plan.mode === "grip") {
    // poing dans le prolongement de l'avant-bras : le poignet ne plie que de 35° au plus vers la direction du dessin
    const cosA = dot(hd, f), ang = Math.acos(Math.max(-1, Math.min(1, cosA))), lim = 35 * RAD;
    const hg = ang <= lim ? hd : mv(axisAngle(unit(cross(f, hd), [1, 0, 0]), lim), f);
    let A = plan.axis;
    if (!A) A = J.kind === "side" ? (J.grip === "neutral" ? unit(cross([1, 0, 0], f), [0, 0, 1]) : [1, 0, 0]) : mv(Rt, J.kind === "top" ? [0, 1, 0] : [0, 0, 1]);
    // les deux sens de l'axe des jointures (prise pronation ou supination) : celui que l'avant-bras atteint, selon la prise
    const opts = [A, scl(A, -1)].map(K => {
      let d = sub(hg, scl(K, dot(hg, K)));
      if (len(d) < 0.25) d = sub(f, scl(K, dot(f, K)));
      d = unit(d); const Rw = handFrame(H, d, cross(K, d));
      return { Rw, p: pronOf(H, Rf, Rw) };
    });
    // le sens le plus proche de la prise voulue (sans saut d'une image à l'autre), ramené à ce que l'avant-bras peut faire
    const aim = AIM[J.grip] ?? AIM.over;
    return settle(H, Rf, (Math.abs(opts[0].p - aim) <= Math.abs(opts[1].p - aim) ? opts[0] : opts[1]).Rw);
  }
  // détendue : avant-bras à mi-pronation, main dans la direction du dessin ; à plat : paume vers le sol, doigts vers l'avant
  const Rr = mm(Rf, axisAngle(H.fa, H.sg * RELAX_PRON)), relax = mm(Rr, arc(H.D, mv(tr(Rr), hd)));
  const w = plan.mode === "free" ? plan.planted : 0;
  if (w <= 0) return settle(H, Rf, relax);
  const d = flatPart(hd) || flatPart(f) || flatPart(mv(Rt, [0, 0, 1])) || [0, 0, 1];
  return settle(H, Rf, slerpR(relax, handFrame(H, d, [0, -1, 0]), w));
}

// Bras à deux os (longueurs a, b) depuis l'épaule S jusqu'au poignet T, coude du côté où il est (E) : directions du bras
// et de l'avant-bras (cible hors d'atteinte : bras tendu vers elle)
function ik2(S, T, a, b, E) {
  const v = sub(T, S), w = unit(v), d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, len(v)));
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const e0 = sub(E, S), m = unit(sub(e0, scl(w, dot(e0, w))), unit(cross(w, [1, 0, 0]), [0, 0, 1]));
  const El = add(S, add(scl(w, a * ca), scl(m, a * sa)));
  return [unit(sub(El, S)), unit(sub(add(S, scl(w, d)), El))];
}
// Points du corps où repose la barre ou l'haltère : trapèzes (squat), avant des épaules (front squat), hanches, poitrine
function bodyAnchor(R0, R, P, n) {
  const { I } = R0, Rc = R[I.chest], sC = mid(P[I.uarm_r], P[I.uarm_l]);
  return n === "back" ? add(P[I.neck], mv(Rc, [0, -0.02, -0.075])) : n === "rack" ? add(sC, mv(Rc, [0, 0.03, 0.085]))
    : n === "hips" ? add(P[I.pelvis], mv(R[I.pelvis], [0, 0.03, 0.13])) : add(sC, mv(Rc, [0, -0.12, 0.13]));
}
// Plan de pli d'un membre (normale) : celui des trois articulations ; membre presque tendu → la normale par défaut
function bendNormal(d1, d2, fallback) {
  const n = cross(d1, d2), s = len(n), nf = unit(sub(fallback, scl(d1, dot(fallback, d1))), fallback);
  if (s < 1e-6) return nf;
  const w = smooth(0.06, 0.3, s), blend = add(scl(nf, 1 - w), scl(n, w / s));
  return len(blend) > 0.2 ? unit(blend) : scl(n, 1 / s);
}
export function retarget(R0, J) {
  const { rig, I, dir } = R0, nb = rig.length, R = new Array(nb).fill(ID), P = new Array(nb), tw = { r: 0, l: 0 }, curl = {};
  // buste : bassin, ventre et poitrine d'un bloc, couchés ou penchés comme le dessin
  const Rt = frame(R0.trunk, R0.lat, sub(mid(J.shoulder_r, J.shoulder_l), J.pelvis), sub(J.hip_l, J.hip_r));
  R[I.pelvis] = R[I.abdomen] = Rt;
  R[I.chest] = mm(Rt, axisAngle([1, 0, 0], topBend(J.spine) * 1.5 * RAD)); // dos rond : le haut s'enroule vers l'avant
  const toward = (b, target) => { const Rp = R[rig[b].p]; R[b] = mm(Rp, arc(dir[b], mv(tr(Rp), target))); };
  const headDir = sub(J.head, J.neck);
  toward(I.neck, headDir); toward(I.head, headDir);
  // bras (directions u du bras, f de l'avant-bras) : le plan épaule-coude-poignet, tendu il plie vers l'avant du buste ;
  // puis la main (orientation et vrille de l'avant-bras), les doigts et le pouce
  const arm = (s, u, f) => {
    const na = bendNormal(u, f, mv(R[I["clav_" + s]], [-1, 0, 0]));
    R[I["uarm_" + s]] = frame(dir[I["uarm_" + s]], [-1, 0, 0], u, na);
    R[I["farm_" + s]] = frame(dir[I["farm_" + s]], [-1, 0, 0], f, na);
    const H = R0.hands?.[s];
    if (!H) return toward(I["hand_" + s], sub(J["tip_" + s], J["wrist_" + s]));
    const plan = J.hands?.[s] || { mode: "free", planted: 0 }, hp = handPose(H, J, plan, R[I["farm_" + s]], Rt), cu = curlOf(H, plan);
    R[H.hand] = hp.Rh; tw[s] = hp.tw; curl[s] = cu;
    let Rk = hp.Rh;
    H.rows.forEach((b, k) => { Rk = mm(Rk, axisAngle(H.ax[k], cu.th[k])); R[b] = Rk; });
    thumbR(H, cu.tc).forEach((Rl, k) => { R[H.thumb[k]] = mm(hp.Rh, Rl); });
  };
  for (const s of ["r", "l"]) {
    const sg = s === "r" ? -1 : 1;
    const u = unit(sub(J["elbow_" + s], J["shoulder_" + s])), f = unit(sub(J["wrist_" + s], J["elbow_" + s]));
    // clavicule : haussement d'épaules, et l'épaule qui monte quand le bras passe au-dessus de l'horizontale
    const elev = Math.acos(Math.max(-1, Math.min(1, dot(u, scl(unit(mv(Rt, [0, -1, 0])), 1))))) / RAD;
    const raise = (J.shrug * SCALE) / (R0.clav[I["clav_" + s]] || 0.13) + Math.max(0, elev - 80) * 0.3 * RAD;
    R[I["clav_" + s]] = mm(R[I.chest], axisAngle([0, 0, 1], sg * raise));
    arm(s, u, f);
    // jambe : le genou plie vers l'arrière
    const t = unit(sub(J["knee_" + s], J["hip_" + s])), sh = unit(sub(J["ankle_" + s], J["knee_" + s]));
    const nl = bendNormal(t, sh, mv(Rt, [1, 0, 0]));
    R[I["thigh_" + s]] = frame(dir[I["thigh_" + s]], [1, 0, 0], t, nl);
    R[I["shin_" + s]] = frame(dir[I["shin_" + s]], [1, 0, 0], sh, nl);
    toward(I["foot_" + s], sub(J["toe_" + s], J["heel_" + s]));
  }
  // positions : chaque pivot suit son parent (longueurs du modèle)
  const place = () => { for (let b = 0; b < nb; b++) { const pa = rig[b].p; P[b] = pa < 0 ? rig[b].h : add(P[pa], mv(R[pa], sub(rig[b].h, rig[pa].h))); } };
  place();
  // barre posée sur le corps (sur les trapèzes au squat, sur les hanches au hip thrust) : le bras se replace (épaule fixe,
  // coude du même côté) pour que le poing tombe sur la barre
  for (const s of ["r", "l"]) {
    const H = R0.hands?.[s], reach = J.hands?.[s]?.reach;
    if (!H || !reach) continue;
    const iu = I["uarm_" + s], ifa = I["farm_" + s], a = len(sub(rig[ifa].h, rig[iu].h)), b = len(sub(rig[H.hand].h, rig[ifa].h));
    for (let it = 0; it < 4; it++) {
      const G = add(P[H.hand], mv(R[H.hand], sub(curl[s].C3, rig[H.hand].h))), bar = bodyAnchor(R0, R, P, reach), e = [0, bar[1] - G[1], bar[2] - G[2]];
      if (len(e) < 0.002) break;
      arm(s, ...ik2(P[iu], add(P[H.hand], e), a, b, P[ifa]));
      place();
    }
  }
  // le corps est posé là où le dessin le pose : chevilles, pointe de pied, genou, hanches, épaules ou poignet
  const tipOf = b => add(P[b], mv(R[b], sub(rig[b].t, rig[b].h)));
  const pairs = {
    ankle: [J.ankle_r, P[I.foot_r]], toe: [J.toe_r, tipOf(I.foot_r)], knee: [J.knee_r, P[I.shin_r]], hip: [J.pelvis, P[I.pelvis]],
    shoulder: [mid(J.shoulder_r, J.shoulder_l), mid(P[I.uarm_r], P[I.uarm_l])], wrist: [J.wrist_r, P[I.hand_r]], pelvis: [J.pelvis, P[I.pelvis]],
  };
  const [want, got] = pairs[J.at] || pairs.ankle;
  let shift = sub(want, got);
  // de face debout : les pieds restent au sol (proportions du modèle un peu différentes de celles du dessin)
  if (J.kind === "front") shift = add(shift, [0, (J.ankle_r[1] + J.ankle_l[1]) / 2 - ((P[I.foot_r][1] + P[I.foot_l][1]) / 2 + shift[1]), 0]);
  for (let b = 0; b < nb; b++) P[b] = add(P[b], shift);
  // articulation k (0 : jointure … 3 : bout) du doigt f, posée : depuis la paume, puis le long des phalanges précédentes
  const joint = (H, F, k) => {
    let p = add(P[H.hand], mv(R[H.hand], sub(F[0], rig[H.hand].h)));
    for (let j = 0; j < k; j++) p = add(p, mv(R[H.rows[j]], sub(F[j + 1], F[j])));
    return p;
  };
  // main libre près du sol : le bout des doigts se pose sur le sol au lieu de le traverser (le poignet se relève un peu)
  for (const s of ["r", "l"]) {
    const H = R0.hands?.[s];
    if (!H || J.hands?.[s]?.mode === "grip") continue;
    for (let it = 0; it < 3; it++) {
      const t = H.F.map(F => joint(H, F, 3)).reduce((a, b) => (b[1] < a[1] ? b : a));
      if (t[1] >= 0.004) break;
      const v = sub(t, P[H.hand]), k = unit(cross(v, [0, 1, 0]), null);
      if (!k) break;
      const Rw = axisAngle(k, Math.min(0.6, (0.006 - t[1]) / Math.max(0.04, Math.hypot(v[0], v[2]))));
      for (const b of [H.hand, ...H.rows, ...H.thumb]) R[b] = mm(Rw, R[b]);
      for (const b of [...H.thumb, ...H.rows]) { const pa = rig[b].p; P[b] = add(P[pa], mv(R[pa], sub(rig[b].h, rig[pa].h))); }
    }
  }
  // doigts : chaque doigt plie autour de ses propres articulations (rotation commune à sa rangée) ; le point tenu
  const fv = [], tips = { r: [], l: [] }, grip = {}, gax = {};
  for (const s of ["r", "l"]) {
    const H = R0.hands?.[s];
    if (!H) { grip[s] = add(P[I["hand_" + s]], mv(R[I["hand_" + s]], scl(dir[I["hand_" + s]], 0.075))); gax[s] = mv(R[I["hand_" + s]], [1, 0, 0]); continue; }
    const hb = rig[H.hand], Rh = R[H.hand];
    for (let k = 0; k < 3; k++) H.F.forEach(F => fv.push(sub(joint(H, F, k), mv(R[H.rows[k]], F[k]))));
    H.F.forEach(F => tips[s].push(joint(H, F, 3)));
    grip[s] = add(P[H.hand], mv(Rh, sub(curl[s].C3, hb.h)));
    gax[s] = mv(Rh, H.K);
  }
  return { R, P, tipOf, tw, fv, tips, grip, gax };
}
// Données des os pour la carte graphique : un quaternion par os (q), une translation par os puis par os « virtuel » de
// doigt (t : la rangée k du doigt f, côté droit puis gauche, qui tourne avec sa rangée), et la vrille des avant-bras (tw :
// axe et angle, puis pivot et numéro de l'os de l'avant-bras, droite puis gauche).
export function boneData(R0, pose, out) {
  const nv = R0.hands ? 24 : 0;
  out ||= { q: new Float32Array(R0.nb * 4), t: new Float32Array((R0.nb + nv) * 4), tw: new Float32Array(16) };
  R0.rig.forEach((b, i) => {
    out.q.set(quatOf(pose.R[i]), i * 4);
    const t = sub(pose.P[i], mv(pose.R[i], b.h));
    out.t.set([t[0], t[1], t[2], 0], i * 4);
  });
  pose.fv.forEach((t, k) => out.t.set([t[0], t[1], t[2], 0], (R0.nb + k) * 4));
  if (R0.hands) ["r", "l"].forEach((s, i) => { const H = R0.hands[s]; out.tw.set([...H.fa, pose.tw[s], ...H.elbow, H.farm], i * 8); });
  return out;
}

/* ---------- Le matériel ---------- */
// Chaque pièce : { k: "cyl" (axe x local) | "box", m: matrice 3 × 3 (orientation × taille), c: centre, col: "metal" | "pad" | "floor" }
const cylBetween = (a, b, r, col = "metal") => { const d = sub(b, a), l = len(d); return { k: "cyl", c: mid(a, b), m: mm(arc([1, 0, 0], d), [l, 0, 0, 0, r, 0, 0, 0, r]), col }; };
const cylAlong = (c, axis, l, r, col = "metal") => ({ k: "cyl", c, m: mm(arc([1, 0, 0], axis), [l, 0, 0, 0, r, 0, 0, 0, r]), col });
const box = (c, Rm, sx, sy, sz, col = "pad") => ({ k: "box", c, m: mm(Rm, [sx, 0, 0, 0, sy, 0, 0, 0, sz]), col });
function barbell(c, axis, half = 1.0, r = 0.2) {
  axis = unit(axis);
  const out = [cylAlong(c, axis, half * 2, 0.014)];
  for (const s of [-1, 1]) {
    out.push(cylAlong(add(c, scl(axis, s * half * 0.62)), axis, 0.05, r, "plate"), cylAlong(add(c, scl(axis, s * half * 0.68)), axis, 0.035, r * 0.82, "plate"));
    out.push(cylAlong(add(c, scl(axis, s * half * 0.55)), axis, 0.03, 0.03));
  }
  return out;
}
function dumbbell(c, axis) {
  axis = unit(axis);
  return [cylAlong(c, axis, 0.15, 0.016), ...[-1, 1].map(s => cylAlong(add(c, scl(axis, s * 0.105)), axis, 0.07, 0.055, "plate"))];
}
// Points du corps posé où se tient le matériel (mêmes noms que body.js : W, W2, back, rack, hips, chest…)
function anchors(R0, pose, J) {
  const { I, rig } = R0, { R, P } = pose;
  const sC = mid(P[I.uarm_r], P[I.uarm_l]), g = pose.grip, on = n => bodyAnchor(R0, R, P, n);
  const a = {
    W: g.r, W2: g.l, hands: mid(g.r, g.l), grip: g.r, back: on("back"), rack: on("rack"), hips: on("hips"), chest: on("chest"),
    H: P[I.pelvis], S: sC, K: P[I.shin_r], A: P[I.foot_r], E: P[I.farm_r], K2: P[I.shin_l], A2: P[I.foot_l], E2: P[I.farm_l],
  };
  return a;
}
const refName = r => (typeof r === "string" ? r : r && typeof r === "object" && !Array.isArray(r) ? r.j : null);
const HAND_REF = new Set(["W", "W2", "hands", "grip"]);
// Toutes les pièces de matériel d'un mouvement, pour une pose
export function gearOf(move, R0, pose, J) {
  const out = [], A = anchors(R0, pose, J), side = J.kind === "side";
  const at = ref => {
    if (Array.isArray(ref)) return J.map ? J.map(ref) : null;
    const n = refName(ref), base = A[n] ?? (n && J.map && J.j?.[n] ? J.map(J.j[n]) : null);
    if (!base) return null;
    if (HAND_REF.has(n)) return base; // dans le poing (le décalage du dessin plaçait la barre près du poignet)
    return ref && typeof ref === "object" ? add(base, [0, -(ref.dy || 0) * SCALE, (ref.dx || 0) * SCALE]) : base;
  };
  const lateral = [1, 0, 0];
  // poignée d'haltère : en travers de profil (curl, développé), d'avant en arrière de face (élévations, haussements),
  // dans l'axe du buste couché (écarté vu de dessus)
  const Rt = pose.R[R0.I.pelvis], dbAxis = side ? lateral : J.kind === "top" ? mv(Rt, [0, 1, 0]) : mv(Rt, [0, 0, 1]);
  const fixed = ref => (J.map ? J.map(Array.isArray(ref) ? ref : at2d(J.j, ref)) : null); // point du dessin, posé en 3D
  for (const g of move.gear || []) {
    const farX = g.back ? 0.28 : 0; // matériel dessiné derrière le corps : de l'autre côté
    if (g.k === "plate") { // barre chargée (le disque du dessin est le bout de la barre)
      const c = at(g.at || "W");
      if (c) out.push(...barbell([0, c[1], c[2]], lateral, 1.0, Math.max(0.12, (g.r || 8.5) * SCALE)));
    } else if (g.k === "db" && g.r) { // haltère tenu à deux mains par le disque du haut, dans le prolongement des avant-bras
      const fa = unit(add(sub(pose.P[R0.I.hand_r], pose.P[R0.I.farm_r]), sub(pose.P[R0.I.hand_l], pose.P[R0.I.farm_l])));
      out.push(...dumbbell(sub(A.hands, scl(fa, 0.105)), fa));
    } else if (g.k === "db") { // haltère dans une main (ou les deux) : la poignée dans le poing, le long des jointures
      for (const s of dbHands(move, g, handsTogether(J))) out.push(...dumbbell(A[s === "r" ? "W" : "W2"], R0.hands ? pose.gax[s] : dbAxis));
    } else if (g.k === "kb") { // poignée dans le poing (ou les deux), la boule pend sous la main (ou repose sur l'avant-bras)
      const s = refName(g.at) === "W2" ? "l" : "r", h = g.rel == null ? A.hands : A[s === "r" ? "W" : "W2"], ax = R0.hands ? pose.gax[s] : lateral;
      const fwd = unit(sub(pose.P[R0.I["hand_" + s]], pose.P[R0.I["farm_" + s]]));
      const down = g.rel === 180 ? scl(fwd, -1) : g.ang != null ? [0, -1, 0] : fwd;
      const c = add(h, scl(down, 0.1));
      out.push({ k: "cyl", c, m: mm(arc([1, 0, 0], ax), [0.16, 0, 0, 0, 0.09, 0, 0, 0, 0.09]), col: "plate" }, cylAlong(h, ax, 0.12, 0.012));
    } else if (side && (g.k === "pad" || g.k === "seat")) { // banc, dossier, coussin
      const p0 = g.at ? at2d(J.j, g.at) : [g.x, g.y], d = dirA(g.ang ?? 90), th = (g.th || 4) * SCALE, l = (g.len || 20) * SCALE;
      const a0 = J.map(p0), e = J.map([p0[0] + d[0] * (g.len || 20), p0[1] + d[1] * (g.len || 20)]), axis = unit(sub(e, a0));
      const n = unit(cross(lateral, axis)), c = add(mid(a0, e), scl(n, th / 2 * (dot(n, [0, 1, 0]) > 0 ? -1 : 1)));
      out.push(box(c, frame([0, 0, 1], [1, 0, 0], axis, lateral), 0.32, th, l));
      for (const [f] of g.legs || []) { const p = add(a0, scl(axis, l * f)); out.push(cylBetween([0, p[1] - th, p[2]], [0, 0, p[2]], 0.022)); }
    } else if (side && g.k === "post" && R0.hands && J.hands?.r?.dip === g) { // barres parallèles : une sous chaque main
      const a0 = J.map([g.x, g.y]), b0 = J.map([g.x2, g.y2]);
      for (const s of ["r", "l"]) { const h = A[s === "r" ? "W" : "W2"]; out.push(cylBetween([h[0], h[1], a0[2]], [h[0], h[1], b0[2]], 0.02)); }
    } else if (side && (g.k === "post" || g.k === "rail")) {
      const a0 = J.map([g.x, g.y]), b0 = J.map([g.x2 ?? g.x, g.y2 ?? FLOOR]);
      for (const x of g.k === "rail" ? [-0.55, 0.55] : [farX || 0.3]) out.push(cylBetween([x, a0[1], a0[2]], [x, b0[1], b0[2]], 0.025));
    } else if (side && g.k === "bar") { // barre de traction (ou basse, rowing inversé) : dans les poings
      const c = R0.hands ? [0, A.W[1], A.W[2]] : J.map([g.x, g.y]);
      out.push(cylAlong(c, lateral, 1.2, 0.016));
      if (g.post !== false) for (const x of [-0.6, 0.6]) out.push(cylBetween([x, c[1], c[2]], [x, 0, c[2]], 0.03));
    } else if (g.k === "roller") { // roue abdominale : poignées dans les poings, la roue au milieu
      const c = A.hands, ax = side ? lateral : unit(sub(A.W2, A.W));
      out.push(cylAlong(c, ax, 0.34, 0.012), cylAlong(c, ax, 0.06, 0.09, "plate"));
    } else if (side && g.k === "box") {
      const a0 = J.map([g.x, g.y]), b0 = J.map([g.x + g.w, FLOOR]);
      out.push(box(mid(a0, b0), ID, 0.5, Math.abs(a0[1] - b0[1]), Math.abs(b0[2] - a0[2]), "pad"));
    } else if (side && g.k === "mat") {
      const a0 = J.map([g.x, FLOOR]), b0 = J.map([g.x + g.w, FLOOR]);
      out.push(box([0, 0.004, (a0[2] + b0[2]) / 2], ID, 0.7, 0.008, Math.abs(b0[2] - a0[2]), "pad"));
    } else if (side && g.k === "roll") {
      const c = fixed(g.at);
      if (c) out.push(cylAlong([0, c[1], c[2]], lateral, 0.36, (g.r || 3) * SCALE));
    } else if (g.k === "cable") { // câble de poulie (ou élastique) jusqu'à la main
      const from = Array.isArray(g.from?.[0]) ? g.from : [g.from];
      from.forEach((f, i) => {
        const hand = side ? A.W : A[(g.to || ["WL", "WR"])[i] === "WL" ? (move.back ? "W2" : "W") : (move.back ? "W" : "W2")];
        const p0 = side ? J.map(f) : J.fixed ? J.fixed(f) : null;
        if (!p0 || !hand) return;
        const pulley = side ? [hand[0], p0[1], p0[2]] : [p0[0], p0[1], hand[2] * 0.2];
        out.push(cylBetween(pulley, hand, 0.004), cylAlong(pulley, lateral, 0.03, 0.035, "plate"));
      });
    } else if (side && g.k === "line" && g.cls?.includes("frame")) { // bras de machine, jusqu'aux poignées
      const a0 = fixed(g.from), b0 = refName(g.to) === "W" && R0.hands ? A.W : fixed(g.to);
      if (a0 && b0) out.push(cylBetween([farX || 0.3, a0[1], a0[2]], [farX || 0.3, b0[1], b0[2]], 0.02));
    } else if (!side && g.k === "bar") { // de face : barre tenue à deux mains, dans les poings
      const c = A.hands, axis = sub(A.W2, A.W);
      out.push(...barbell(c, len(axis) > 0.05 ? axis : lateral, 1.0, Math.max(0.12, (g.r || 7.5) * SCALE)));
    } else if (!side && (g.k === "seat" || g.k === "rect")) {
      if (J.kind === "top") { // vue de dessus : banc sous le buste, ou tapis au sol
        const P0 = pose.P[R0.I.pelvis], C0 = mid(pose.P[R0.I.uarm_r], pose.P[R0.I.uarm_l]);
        if (g.cls?.includes("mat")) out.push(box([P0[0], 0.004, (P0[2] + C0[2]) / 2], ID, 0.8, 0.008, 1.9, "pad"));
        else out.push(box([P0[0], P0[1] - 0.16, (P0[2] + C0[2]) / 2 - 0.1], ID, 0.32, 0.08, 1.2, "pad"));
      } else {
        const a0 = J.fixed([g.x, g.y]), b0 = J.fixed([g.x + g.w, g.y + (g.h || 4)]), cx = (a0[0] + b0[0]) / 2, w = Math.abs(b0[0] - a0[0]);
        const cls = g.cls || "", behind = (move.back ? 1 : -1) * 0.2; // derrière le corps, vu de la caméra
        if (cls.includes("mat")) out.push(box([cx, 0.004, 0], ID, w, 0.008, 0.8, "pad")); // tapis au sol
        else if (cls.includes("seat") || g.k === "seat") out.push(box([cx, (a0[1] + b0[1]) / 2, 0], ID, w, Math.abs(a0[1] - b0[1]), 0.42, "pad"));
        else out.push(box([cx, (a0[1] + b0[1]) / 2, behind], ID, w, Math.abs(a0[1] - b0[1]), 0.08, "pad")); // dossier, panneau
      }
    } else if (!side && g.k === "post") {
      const a0 = J.fixed([g.x, g.y]), b0 = J.fixed([g.x2 ?? g.x, g.y2 ?? FLOOR]), z = (move.back ? 1 : -1) * 0.3;
      out.push(cylBetween([a0[0], a0[1], z], [b0[0], b0[1], z], 0.025));
    }
  }
  return out;
}

/* ---------- Cadrage : tout le mouvement dans le champ ---------- */
export function bounds(move, R0, steps = 8) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const grow = (p, r = 0) => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - r); hi[i] = Math.max(hi[i], p[i] + r); } };
  for (let i = 0; i <= steps; i++) {
    const J = lift(move, i / steps), pose = retarget(R0, J);
    pose.P.forEach(p => grow(p, 0.08));
    grow(pose.tipOf(R0.I.head), 0.06);
    for (const s of ["r", "l"]) { grow(pose.grip[s], 0.06); for (const t of pose.tips[s]) grow(t, 0.02); if (!pose.tips[s].length) grow(pose.tipOf(R0.I["hand_" + s]), 0.1); }
    grow(pose.tipOf(R0.I.foot_r), 0.03); grow(pose.tipOf(R0.I.foot_l), 0.03);
    // matériel : disques et coussins entiers, barres et câbles par leur milieu
    for (const g of gearOf(move, R0, pose, J)) {
      const M = g.m, half = 0.5 * Math.hypot(M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]);
      grow(g.c, g.col === "metal" ? 0.03 : Math.min(half, 0.6));
    }
  }
  return { lo, hi, c: mid(lo, hi), r: len(sub(hi, lo)) / 2 };
}

/* ---------- WebGL ---------- */
// Corps : chaque os est un quaternion (uQ) et une translation (uT) ; les os « virtuels » des doigts (numéros ≥ NB)
// prennent la rotation de leur rangée (FROW…) et leur propre translation. L'avant-bras se vrille progressivement du
// coude au poignet (uTw : axe et angle, pivot et numéro de l'os, droite puis gauche ; 4e octet du sommet : sa part).
const bodyVS = (nb, nt, frow, nc) => `attribute vec3 aPos; attribute vec4 aNor; attribute vec4 aSkin;
uniform mat4 uMVP; uniform vec3 uLo; uniform vec3 uSpan;
uniform vec4 uQ[${nb}]; uniform vec4 uT[${nt}]; uniform vec4 uTw[4]; uniform vec4 uCol[${nc}];
varying vec3 vN; varying vec4 vC; varying vec3 vW;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 spin(vec3 k, float a, vec3 v) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
vec4 rotOf(int b) {
  if (b < ${nb}) return uQ[b];
  int k = b - ${nb}, sd = k / 12;
  return uQ[${frow} + sd * 3 + (k - sd * 12) / 4];
}
void main() {
  vec3 p = uLo + (aPos + 32768.0) / 65535.0 * uSpan;
  vec3 r = vec3(p.x, p.z, -p.y);
  vec3 n = vec3(aNor.x, aNor.z, -aNor.y) / 127.0;
  vec3 rt = r, nt = n; float fb = -1.0;
  if (aSkin.w > 0.5) {
    bool left = aSkin.w > 127.5;
    float t = (aSkin.w - (left ? 128.0 : 1.0)) / 126.0;
    vec4 A = left ? uTw[2] : uTw[0], P = left ? uTw[3] : uTw[1];
    rt = P.xyz + spin(A.xyz, t * A.w, r - P.xyz); nt = spin(A.xyz, t * A.w, n); fb = P.w;
  }
  int b0 = int(aSkin.x + 0.5), b1 = int(aSkin.y + 0.5);
  vec4 q0 = rotOf(b0), q1 = rotOf(b1);
  bool v0 = abs(aSkin.x - fb) < 0.5, v1 = abs(aSkin.y - fb) < 0.5;
  float w0 = aSkin.z / 255.0;
  vec3 w = (qrot(q0, v0 ? rt : r) + uT[b0].xyz) * w0 + (qrot(q1, v1 ? rt : r) + uT[b1].xyz) * (1.0 - w0);
  vN = qrot(q0, v0 ? nt : n) * w0 + qrot(q1, v1 ? nt : n) * (1.0 - w0);
  vC = uCol[int(aNor.w + 0.5)]; vW = w;
  gl_Position = uMVP * vec4(w, 1.0);
}`;
// Matériel (pièces rigides) et sol
const gearVS = `attribute vec3 aPos; attribute vec4 aNor;
uniform mat4 uMVP; uniform mat4 uModel; uniform vec4 uGearCol;
varying vec3 vN; varying vec4 vC; varying vec3 vW;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vN = (uModel * vec4(aNor.xyz, 0.0)).xyz; vC = uGearCol; vW = w.xyz; gl_Position = uMVP * w; }`;
const FS = `precision mediump float;
varying vec3 vN; varying vec4 vC; varying vec3 vW;
uniform vec3 uEye; uniform vec3 uKey; uniform vec3 uFill; uniform vec3 uBack;
uniform float uFloorOn; uniform vec4 uFloor; uniform vec3 uFloorCol;
void main() {
  if (uFloorOn > 0.5) { // sol : un disque qui s'estompe vers le bord (couleur prémultipliée)
    float a = (1.0 - smoothstep(uFloor.z, uFloor.w, length(vW.xz - uFloor.xy))) * 0.9;
    gl_FragColor = vec4(pow(uFloorCol, vec3(0.4545)) * a, a); return;
  }
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uEye - vW);
  float k = dot(n, uKey), wrap = max((k + 0.4) / 1.4, 0.0), f = max(dot(n, uFill), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.35 + 0.65 * max(dot(n, uBack), 0.0));
  float s = pow(max(dot(n, normalize(uKey + v)), 0.0), 42.0);
  vec3 c = vC.rgb * (0.12 + 0.62 * mix(max(k, 0.0), wrap, 0.45) + 0.24 * f) + vec3(0.92, 0.95, 1.0) * (0.2 * s + 0.3 * rim);
  c += vC.rgb * vC.a; // muscle qui s'allume pendant l'effort
  gl_FragColor = vec4(pow(c, vec3(0.4545)), 1.0);
}`;
const GEAR_COL = { metal: [0.42, 0.44, 0.48, 0], plate: [0.05, 0.05, 0.06, 0], pad: [0.07, 0.075, 0.09, 0] };

// Maillages du matériel : cylindre (axe x, rayon 1, longueur 1) et boîte (côté 1), centrés
function cylinderMesh(seg = 20) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2, y = Math.cos(a), z = Math.sin(a); pos.push(-0.5, y, z, 0.5, y, z); nor.push(0, y, z, 0, 0, y, z, 0); }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (const x of [-0.5, 0.5]) { // couvercles
    const c = pos.length / 3; pos.push(x, 0, 0); nor.push(Math.sign(x), 0, 0, 0);
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pos.push(x, Math.cos(a), Math.sin(a)); nor.push(Math.sign(x), 0, 0, 0); }
    for (let i = 0; i < seg; i++) idx.push(c, c + 1 + i, c + 2 + i);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}
function boxMesh() {
  const pos = [], nor = [], idx = [];
  const F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [-1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, -1, 0]]];
  for (const [n, u, v] of F) {
    const b = pos.length / 3;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(...[0, 1, 2].map(i => n[i] * 0.5 + u[i] * 0.5 * s + v[i] * 0.5 * t)); nor.push(...n, 0); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

// Prise de chaque exercice : pronation (« over », paumes vers le bas ou vers l'arrière, par défaut), supination
// (« under », paumes vers le haut ou vers soi), neutre (paumes face à face).
const UNDER = new Set(["curl", "barbell_curl", "ez_curl", "incline_curl", "concentration", "spider_curl", "preacher", "cable_curl", "band_curl", "chinup", "wrist_curl"]);
const NEUTRAL = new Set(["hammer", "farmer", "db_lunge", "walking_lunge", "db_rdl", "db_row", "kickback", "shrug", "rope_pushdown", "face_pull",
  "bulgarian", "step_up", "dips", "db_fly", "lateral", "front_raise", "close_pulldown", "cable_row", "machine_row", "chest_row", "tbar_row"]);
export const gripOf = id => (UNDER.has(id) ? "under" : NEUTRAL.has(id) ? "neutral" : "over");

// Démarre la démo 3D dans un canevas. colors : une couleur par groupe (colorTable de body3d.js) ; glow : groupes qui
// s'allument à l'effort ; floor : couleur du sol (linéaire) ; id : l'exercice (pour la prise). Renvoie { draw(p, act), reset(), destroy() }.
// camera (essais, captures) : { target: [x, y, z] ou "hand" (main droite), dist, yaw, pitch } remplace le cadrage.
export function mountDemo3D(canvas, body, move0, colors, { glow = [], floor = [0.045, 0.05, 0.065], onReady, id, camera } = {}) {
  const move = { ...move0, grip: move0.grip || gripOf(id) };
  const gl = canvas.getContext("webgl2", { antialias: true }) || canvas.getContext("webgl", { antialias: true });
  if (!gl) throw new Error("WebGL indisponible");
  if (!(gl instanceof (window.WebGL2RenderingContext || Object)) && !gl.getExtension("OES_element_index_uint")) throw new Error("WebGL : index 32 bits indisponibles");
  if (!body.skin || !body.rig) throw new Error("Corps 3D sans squelette");
  const R0 = prepRig(body), NC = body.parts.length, NT = R0.nb + (R0.hands ? 24 : 0);
  // place des données du corps dans la carte graphique (au moins 128 vecteurs partout ; on reste en dessous)
  const need = 4 + 2 + R0.nb + NT + 4 + NC;
  if (gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) < need) throw new Error("WebGL : pas assez de place pour le squelette");
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const fsh = sh(gl.FRAGMENT_SHADER, FS);
  const program = vs => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, fsh);
    gl.bindAttribLocation(p, 0, "aPos"); gl.bindAttribLocation(p, 1, "aNor"); gl.bindAttribLocation(p, 2, "aSkin");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; return { p, U: n => (u[n] ??= gl.getUniformLocation(p, n)) };
  };
  const bodyP = program(bodyVS(R0.nb, NT, Math.max(0, R0.frow), NC)), gearP = program(gearVS);
  const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  const bodyB = { pos: buf(gl.ARRAY_BUFFER, body.pos), nor: buf(gl.ARRAY_BUFFER, body.nor), skin: buf(gl.ARRAY_BUFFER, body.skin), idx: buf(gl.ELEMENT_ARRAY_BUFFER, body.idx) };
  const meshes = Object.fromEntries(Object.entries({ cyl: cylinderMesh(), box: boxMesh() }).map(([k, m]) => [k, { pos: buf(gl.ARRAY_BUFFER, m.pos), nor: buf(gl.ARRAY_BUFFER, m.nor), idx: buf(gl.ELEMENT_ARRAY_BUFFER, m.idx), n: m.idx.length }]));
  const lo = body.lo, span = body.hi.map((h, i) => h - lo[i]);
  gl.useProgram(bodyP.p);
  gl.uniform3fv(bodyP.U("uLo"), lo); gl.uniform3fv(bodyP.U("uSpan"), span);
  let bones = null;
  // couleurs : une par groupe ; les groupes qui s'allument (agonistes) changent à chaque image
  const col = new Float32Array(NC * 4);
  colors.slice(0, NC).forEach((c, i) => col.set([c[0], c[1], c[2], 0], i * 4));
  const glowIdx = glow.map(n => body.parts.indexOf(n)).filter(i => i >= 0);
  const base = glowIdx.map(i => col.slice(i * 4, i * 4 + 3));
  // cadrage : vue de profil (côté droit du sportif, un peu de trois quarts), de face, de dos ou de dessus
  const B = bounds(move, R0), FOV = 0.62;
  const J0 = lift(move, 0), lying = Math.abs(unit(sub(mid(J0.shoulder_r, J0.shoulder_l), J0.pelvis))[1]) < 0.55;
  const yaw0 = move.view === "front" ? (move.back ? Math.PI - 0.3 : 0.3) : -Math.PI / 2 + 0.3, pitch0 = isTop(move) ? 0.95 : lying ? 0.42 : 0.2;
  // distance qui fait tenir tout le mouvement : sa hauteur dans le champ vertical, sa largeur (vue de la caméra) dans le
  // champ horizontal, plus la moitié de sa profondeur
  const ext = sub(B.hi, B.lo), side = move.view !== "front", top = isTop(move);
  const across = side ? ext[2] : ext[0], tall = top ? Math.max(ext[1], ext[2]) : ext[1], deep = side ? ext[0] : top ? ext[1] : ext[2];
  const fit = aspect => { const tv = Math.tan(FOV / 2); return Math.max(1.1, Math.max(tall / 2 / tv, across / 2 / (tv * aspect)) * 1.1 + deep / 2); };
  const cam = { yaw: camera?.yaw ?? yaw0, pitch: camera?.pitch ?? pitch0, zoom: 1 };
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  const size = () => {
    const r = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * r), h = Math.round(canvas.clientHeight * r);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
  };
  const model = new Float32Array(16);
  const drawPiece = g => {
    const m = meshes[g.k], M = g.m;
    model.set([M[0], M[3], M[6], 0, M[1], M[4], M[7], 0, M[2], M[5], M[8], 0, g.c[0], g.c[1], g.c[2], 1]);
    gl.uniformMatrix4fv(gearP.U("uModel"), false, model);
    gl.uniform4fv(gearP.U("uGearCol"), GEAR_COL[g.col] || GEAR_COL.metal);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  };
  const floorR = Math.max(1.2, B.r * 1.5);
  const floorDisc = { k: "cyl", c: [B.c[0], -0.003, B.c[2]], m: mm(arc([1, 0, 0], [0, 1, 0]), [0.002, 0, 0, 0, floorR, 0, 0, 0, floorR]) };
  gl.useProgram(gearP.p);
  gl.uniform4fv(gearP.U("uFloor"), [B.c[0], B.c[2], floorR * 0.35, floorR]); gl.uniform3fv(gearP.U("uFloorCol"), floor);
  let dead = false, last = { p: 0, act: 0 };
  const lights = (P, eye, dirL) => {
    gl.uniform3fv(P.U("uEye"), eye); gl.uniform3fv(P.U("uKey"), dirL(-0.55, 0.65, 0.55)); gl.uniform3fv(P.U("uFill"), dirL(0.8, 0.1, 0.4)); gl.uniform3fv(P.U("uBack"), dirL(0.2, 0.4, -0.9));
  };
  function draw(p = last.p, act = last.act) {
    if (dead) return;
    last = { p, act };
    size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const J = lift(move, p), pose = retarget(R0, J);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const at = camera?.target === "hand" ? pose.grip.r : camera?.target || B.c;
    const eye = orbitEye(at, cam.yaw, cam.pitch, (camera?.dist ?? fit(aspect)) * cam.zoom);
    const mvp = mul(perspective(FOV, aspect, 0.02, 30), lookAt(eye, at, [0, 1, 0]));
    const fwd = unit(sub(at, eye)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    const dirL = (a, b, c) => unit([right[0] * a + up[0] * b - fwd[0] * c, right[1] * a + up[1] * b - fwd[1] * c, right[2] * a + up[2] * b - fwd[2] * c]);
    // le corps
    gl.useProgram(bodyP.p);
    bones = boneData(R0, pose, bones || undefined);
    gl.uniform4fv(bodyP.U("uQ[0]"), bones.q); gl.uniform4fv(bodyP.U("uT[0]"), bones.t); gl.uniform4fv(bodyP.U("uTw[0]"), bones.tw);
    glowIdx.forEach((i, k) => { const c = base[k], g = 0.75 + 0.35 * act; col.set([c[0] * g, c[1] * g, c[2] * g, 0.45 * act], i * 4); });
    gl.uniform4fv(bodyP.U("uCol[0]"), col);
    gl.uniformMatrix4fv(bodyP.U("uMVP"), false, mvp);
    lights(bodyP, eye, dirL);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, false, 6, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, false, 4, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.skin); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, 4, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bodyB.idx);
    gl.drawElements(gl.TRIANGLES, body.t * 3, gl.UNSIGNED_INT, 0);
    // matériel : maillages rigides
    gl.disableVertexAttribArray(2);
    gl.useProgram(gearP.p);
    gl.uniformMatrix4fv(gearP.U("uMVP"), false, mvp);
    lights(gearP, eye, dirL);
    gl.uniform1f(gearP.U("uFloorOn"), 0);
    for (const g of gearOf(move, R0, pose, J)) drawPiece(g);
    // sol en dernier, transparent sur ses bords
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(gearP.U("uFloorOn"), 1); drawPiece(floorDisc); gl.uniform1f(gearP.U("uFloorOn"), 0);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  // gestes : glisser = tourner, pincer (ou molette) = zoomer, double-toucher = recadrer
  const pts = new Map();
  let pinch0 = 0, zoom0 = 1, lastTap = 0, downAt = null;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = cam.zoom; downAt = null; }
  });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      cam.yaw -= (e.clientX - prev[0]) * 0.009;
      cam.pitch = Math.max(-0.35, Math.min(1.35, cam.pitch + (e.clientY - prev[1]) * 0.006));
    } else if (pts.size === 2 && pinch0 > 0) {
      const [a, b] = [...pts.values()];
      cam.zoom = Math.max(0.45, Math.min(1.8, zoom0 * pinch0 / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1]))));
    }
    draw();
  });
  const upH = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (downAt && pts.size === 0 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && performance.now() - downAt.t < 400) {
      const now = performance.now();
      if (now - lastTap < 320) reset();
      lastTap = now;
    }
    if (!pts.size) downAt = null;
  };
  canvas.addEventListener("pointerup", upH);
  canvas.addEventListener("pointercancel", upH);
  canvas.addEventListener("wheel", e => { e.preventDefault(); cam.zoom = Math.max(0.45, Math.min(1.8, cam.zoom * (1 + Math.sign(e.deltaY) * 0.1))); draw(); }, { passive: false });
  function reset() { Object.assign(cam, { yaw: yaw0, pitch: pitch0, zoom: 1 }); draw(); }
  draw(0, 0);
  onReady?.();
  return {
    draw, reset,
    destroy() { dead = true; gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}
