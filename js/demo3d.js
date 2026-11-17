// Démos d'exercice en 3D : le corps anatomique (BodyParts3D / Z-Anatomy, js/body3d.js) fait le mouvement de la démo.
// À chaque image, la position dessinée (js/body.js : angles des os, de profil ou de face) est « relevée » en 3D : la
// profondeur vient des raccourcis de perspective du dessin (un bras raccourci de profil s'écarte du corps). Le squelette
// du modèle (19 os, placés sur les vrais os par tools/anatomy/export_web.py) prend ces directions : bassin et buste d'un
// bloc (le haut du dos s'enroule avec « spine »), bras et jambes pliés dans leur plan, mains et pieds dans le
// prolongement. La carte graphique déforme le corps : chaque sommet suit deux os, avec un poids. Le matériel (barre,
// haltères, banc, poulies…) est fait de cylindres et de boîtes. Les muscles ont la couleur de leur rôle (comme la
// planche) et l'agoniste s'allume pendant l'effort.
// Le calcul de la pose (lift, retarget, gearOf) est pur et testé dans Node ; mountDemo3D dessine en WebGL.
import { solve, sample, solveFront, sampleFront, at as at2d, L, FLOOR } from "./body.js";
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
function liftSide(move, p) {
  const j = solve(sample(move, p)), q = j.q;
  const W = (pt, lat) => [lat * SCALE, (FLOOR - pt[1]) * SCALE, (pt[0] - 50) * SCALE];
  const J = { kind: "side", at: q.at || "ankle", spine: q.spine || 0, shrug: q.shrug || 0 };
  for (const [s, k, sg] of [["r", "", -1], ["l", "2", 1]]) {
    const E = j["E" + k], Wr = j["W" + k], K = j["K" + k], A = j["A" + k];
    const sl = sg * SH, el = sl + sg * hyp(L.uarm, d2(j.S, E)), wl = el + sg * hyp(L.farm, d2(E, Wr));
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
function liftFront(move, p) {
  const top = isTop(move), q0 = sampleFront(move, p), q = top ? { ...q0, rot: 0 } : q0;
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
export const lift = (move, p) => (move.view === "front" ? liftFront(move, p) : liftSide(move, p));

/* ---------- Le squelette du modèle prend la pose ---------- */
// rig : os du modèle (body.json : n nom, p parent, h pivot, t bout, aim direction de visée au repos pour les pieds)
export function prepRig(rig) {
  const I = Object.fromEntries(rig.map((b, i) => [b.n, i]));
  const dir = rig.map(b => unit(b.aim || sub(b.t, b.h)));
  const shoulderC = mid(rig[I.uarm_r].h, rig[I.uarm_l].h), pelvis = rig[I.pelvis].h;
  return { rig, I, dir, trunk: unit(sub(shoulderC, pelvis)), lat: unit(sub(rig[I.thigh_l].h, rig[I.thigh_r].h)),
    hand: unit(sub(rig[I.hand_r].t, rig[I.hand_r].h)), clav: rig.map(b => (b.n.startsWith("clav") ? len(sub(b.t, b.h)) : 0)) };
}
// Plan de pli d'un membre (normale) : celui des trois articulations ; membre presque tendu → la normale par défaut
function bendNormal(d1, d2, fallback) {
  const n = cross(d1, d2), s = len(n), nf = unit(sub(fallback, scl(d1, dot(fallback, d1))), fallback);
  if (s < 1e-6) return nf;
  const w = smooth(0.06, 0.3, s), blend = add(scl(nf, 1 - w), scl(n, w / s));
  return len(blend) > 0.2 ? unit(blend) : scl(n, 1 / s);
}
export function retarget(R0, J) {
  const { rig, I, dir } = R0, nb = rig.length, R = new Array(nb).fill(ID), P = new Array(nb);
  // buste : bassin, ventre et poitrine d'un bloc, couchés ou penchés comme le dessin
  const Rt = frame(R0.trunk, R0.lat, sub(mid(J.shoulder_r, J.shoulder_l), J.pelvis), sub(J.hip_l, J.hip_r));
  R[I.pelvis] = R[I.abdomen] = Rt;
  R[I.chest] = mm(Rt, axisAngle([1, 0, 0], topBend(J.spine) * 1.5 * RAD)); // dos rond : le haut s'enroule vers l'avant
  const toward = (b, target) => { const Rp = R[rig[b].p]; R[b] = mm(Rp, arc(dir[b], mv(tr(Rp), target))); };
  const headDir = sub(J.head, J.neck);
  toward(I.neck, headDir); toward(I.head, headDir);
  for (const s of ["r", "l"]) {
    const sg = s === "r" ? -1 : 1;
    // bras : le plan épaule-coude-poignet ; tendu, il plie vers l'avant du buste
    const u = unit(sub(J["elbow_" + s], J["shoulder_" + s])), f = unit(sub(J["wrist_" + s], J["elbow_" + s]));
    // clavicule : haussement d'épaules, et l'épaule qui monte quand le bras passe au-dessus de l'horizontale
    const elev = Math.acos(Math.max(-1, Math.min(1, dot(u, scl(unit(mv(Rt, [0, -1, 0])), 1))))) / RAD;
    const raise = (J.shrug * SCALE) / (R0.clav[I["clav_" + s]] || 0.13) + Math.max(0, elev - 80) * 0.3 * RAD;
    R[I["clav_" + s]] = mm(R[I.chest], axisAngle([0, 0, 1], sg * raise));
    const na = bendNormal(u, f, mv(R[I["clav_" + s]], [-1, 0, 0]));
    R[I["uarm_" + s]] = frame(dir[I["uarm_" + s]], [-1, 0, 0], u, na);
    R[I["farm_" + s]] = frame(dir[I["farm_" + s]], [-1, 0, 0], f, na);
    toward(I["hand_" + s], sub(J["tip_" + s], J["wrist_" + s]));
    // jambe : le genou plie vers l'arrière
    const t = unit(sub(J["knee_" + s], J["hip_" + s])), sh = unit(sub(J["ankle_" + s], J["knee_" + s]));
    const nl = bendNormal(t, sh, mv(Rt, [1, 0, 0]));
    R[I["thigh_" + s]] = frame(dir[I["thigh_" + s]], [1, 0, 0], t, nl);
    R[I["shin_" + s]] = frame(dir[I["shin_" + s]], [1, 0, 0], sh, nl);
    toward(I["foot_" + s], sub(J["toe_" + s], J["heel_" + s]));
  }
  // positions : chaque pivot suit son parent (longueurs du modèle)
  for (let b = 0; b < nb; b++) {
    const pa = rig[b].p;
    P[b] = pa < 0 ? rig[b].h : add(P[pa], mv(R[pa], sub(rig[b].h, rig[pa].h)));
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
  return { R, P, tipOf };
}
// Matrices des os pour la carte graphique : 3 lignes de 4 par os (rotation | translation)
export function boneRows(R0, pose, out = new Float32Array(R0.rig.length * 12)) {
  R0.rig.forEach((b, i) => {
    const R = pose.R[i], t = sub(pose.P[i], mv(R, b.h));
    for (let r = 0; r < 3; r++) { out[i * 12 + r * 4] = R[r * 3]; out[i * 12 + r * 4 + 1] = R[r * 3 + 1]; out[i * 12 + r * 4 + 2] = R[r * 3 + 2]; out[i * 12 + r * 4 + 3] = t[r]; }
  });
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
  const grip = s => add(P[I["hand_" + s]], mv(R[I["hand_" + s]], scl(R0.hand, 0.075)));
  const Rc = R[I.chest], sC = mid(P[I.uarm_r], P[I.uarm_l]);
  const a = {
    W: grip("r"), W2: grip("l"), hands: mid(grip("r"), grip("l")), grip: grip("r"),
    back: add(P[I.neck], mv(Rc, [0, -0.02, -0.075])), rack: add(sC, mv(Rc, [0, 0.03, 0.085])),
    hips: add(P[I.pelvis], mv(R[I.pelvis], [0, 0.03, 0.13])), chest: add(sC, mv(Rc, [0, -0.12, 0.13])),
    H: P[I.pelvis], S: sC, K: P[I.shin_r], A: P[I.foot_r], E: P[I.farm_r], K2: P[I.shin_l], A2: P[I.foot_l], E2: P[I.farm_l],
  };
  return a;
}
const refName = r => (typeof r === "string" ? r : r && typeof r === "object" && !Array.isArray(r) ? r.j : null);
// Toutes les pièces de matériel d'un mouvement, pour une pose
export function gearOf(move, R0, pose, J) {
  const out = [], A = anchors(R0, pose, J), side = J.kind === "side";
  const at = ref => {
    if (Array.isArray(ref)) return J.map ? J.map(ref) : null;
    const n = refName(ref), base = A[n] ?? (n && J.map && J.j?.[n] ? J.map(J.j[n]) : null);
    if (!base) return null;
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
    } else if (g.k === "db") { // haltère dans une main (ou les deux, de face)
      const hands = g.at ? [refName(g.at) === "W2" ? "l" : "r"] : g.side === 0 ? ["r"] : g.side === 1 ? ["l"] : ["r", "l"];
      for (const s of hands) out.push(...dumbbell(A[s === "r" ? "W" : "W2"], dbAxis));
    } else if (g.k === "kb") {
      const c = add(A[refName(g.at) === "W2" ? "W2" : "W"], [0, -0.1, 0]);
      out.push({ k: "cyl", c, m: [0.16, 0, 0, 0, 0.09, 0, 0, 0, 0.09], col: "plate" }, cylAlong(add(c, [0, 0.085, 0]), lateral, 0.12, 0.012));
    } else if (side && (g.k === "pad" || g.k === "seat")) { // banc, dossier, coussin
      const p0 = g.at ? at2d(J.j, g.at) : [g.x, g.y], d = dirA(g.ang ?? 90), th = (g.th || 4) * SCALE, l = (g.len || 20) * SCALE;
      const a0 = J.map(p0), e = J.map([p0[0] + d[0] * (g.len || 20), p0[1] + d[1] * (g.len || 20)]), axis = unit(sub(e, a0));
      const n = unit(cross(lateral, axis)), c = add(mid(a0, e), scl(n, th / 2 * (dot(n, [0, 1, 0]) > 0 ? -1 : 1)));
      out.push(box(c, frame([0, 0, 1], [1, 0, 0], axis, lateral), 0.32, th, l));
      for (const [f] of g.legs || []) { const p = add(a0, scl(axis, l * f)); out.push(cylBetween([0, p[1] - th, p[2]], [0, 0, p[2]], 0.022)); }
    } else if (side && (g.k === "post" || g.k === "rail")) {
      const a0 = J.map([g.x, g.y]), b0 = J.map([g.x2 ?? g.x, g.y2 ?? FLOOR]);
      for (const x of g.k === "rail" ? [-0.55, 0.55] : [farX || 0.3]) out.push(cylBetween([x, a0[1], a0[2]], [x, b0[1], b0[2]], 0.025));
    } else if (side && g.k === "bar") { // barre de traction ou de dips
      const c = J.map([g.x, g.y]);
      out.push(cylAlong(c, lateral, 1.2, 0.016));
      if (g.post !== false) for (const x of [-0.6, 0.6]) out.push(cylBetween([x, c[1], c[2]], [x, 0, c[2]], 0.03));
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
    } else if (side && g.k === "line" && g.cls?.includes("frame")) {
      const a0 = fixed(g.from), b0 = fixed(g.to);
      if (a0 && b0) out.push(cylBetween([farX || 0.3, a0[1], a0[2]], [farX || 0.3, b0[1], b0[2]], 0.02));
    } else if (!side && g.k === "bar") { // de face : barre tenue à deux mains
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
    grow(pose.tipOf(R0.I.head), 0.06); grow(pose.tipOf(R0.I.hand_r), 0.04); grow(pose.tipOf(R0.I.hand_l), 0.04);
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
const VS = `attribute vec3 aPos; attribute vec4 aNor; attribute vec4 aSkin;
uniform mat4 uMVP; uniform vec3 uLo; uniform vec3 uSpan; uniform vec4 uBone[60]; uniform vec4 uCol[24];
uniform float uRigid; uniform mat4 uModel; uniform vec4 uGearCol;
varying vec3 vN; varying vec4 vC; varying vec3 vW;
vec3 tp(int b, vec4 p) { return vec3(dot(uBone[b * 3], p), dot(uBone[b * 3 + 1], p), dot(uBone[b * 3 + 2], p)); }
vec3 tn(int b, vec3 n) { return vec3(dot(uBone[b * 3].xyz, n), dot(uBone[b * 3 + 1].xyz, n), dot(uBone[b * 3 + 2].xyz, n)); }
void main() {
  if (uRigid > 0.5) {
    vec4 w = uModel * vec4(aPos, 1.0);
    vN = (uModel * vec4(aNor.xyz, 0.0)).xyz; vC = uGearCol; vW = w.xyz;
    gl_Position = uMVP * w; return;
  }
  vec3 p = uLo + (aPos + 32768.0) / 65535.0 * uSpan;
  vec4 r = vec4(p.x, p.z, -p.y, 1.0);
  vec3 n = vec3(aNor.x, aNor.z, -aNor.y) / 127.0;
  int b0 = int(aSkin.x + 0.5), b1 = int(aSkin.y + 0.5);
  float w0 = aSkin.z / 255.0;
  vec3 w = tp(b0, r) * w0 + tp(b1, r) * (1.0 - w0);
  vN = tn(b0, n) * w0 + tn(b1, n) * (1.0 - w0);
  vC = uCol[int(aNor.w + 0.5)]; vW = w;
  gl_Position = uMVP * vec4(w, 1.0);
}`;
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

// Démarre la démo 3D dans un canevas. colors : une couleur par groupe (colorTable de body3d.js) ; glow : groupes qui
// s'allument à l'effort ; floor : couleur du sol (linéaire). Renvoie { draw(p, act), reset(), destroy() }.
export function mountDemo3D(canvas, body, move, colors, { glow = [], floor = [0.045, 0.05, 0.065], onReady } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: true }) || canvas.getContext("webgl", { antialias: true });
  if (!gl) throw new Error("WebGL indisponible");
  if (!(gl instanceof (window.WebGL2RenderingContext || Object)) && !gl.getExtension("OES_element_index_uint")) throw new Error("WebGL : index 32 bits indisponibles");
  if (!body.skin || !body.rig) throw new Error("Corps 3D sans squelette");
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);
  const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  const aPos = gl.getAttribLocation(prog, "aPos"), aNor = gl.getAttribLocation(prog, "aNor"), aSkin = gl.getAttribLocation(prog, "aSkin");
  const bodyB = { pos: buf(gl.ARRAY_BUFFER, body.pos), nor: buf(gl.ARRAY_BUFFER, body.nor), skin: buf(gl.ARRAY_BUFFER, body.skin), idx: buf(gl.ELEMENT_ARRAY_BUFFER, body.idx) };
  const meshes = Object.fromEntries(Object.entries({ cyl: cylinderMesh(), box: boxMesh() }).map(([k, m]) => [k, { pos: buf(gl.ARRAY_BUFFER, m.pos), nor: buf(gl.ARRAY_BUFFER, m.nor), idx: buf(gl.ELEMENT_ARRAY_BUFFER, m.idx), n: m.idx.length }]));
  const lo = body.lo, span = body.hi.map((h, i) => h - lo[i]);
  gl.uniform3fv(U("uLo"), lo); gl.uniform3fv(U("uSpan"), span);
  const R0 = prepRig(body.rig), rows = new Float32Array(60 * 4);
  // couleurs : une par groupe ; les groupes qui s'allument (agonistes) changent à chaque image
  const col = new Float32Array(24 * 4);
  colors.slice(0, 24).forEach((c, i) => col.set([c[0], c[1], c[2], 0], i * 4));
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
  const cam = { yaw: yaw0, pitch: pitch0, zoom: 1 };
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  const size = () => {
    const r = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * r), h = Math.round(canvas.clientHeight * r);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
  };
  const bindBody = () => {
    gl.uniform1f(U("uRigid"), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.pos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.SHORT, false, 6, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.nor); gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 4, gl.BYTE, false, 4, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bodyB.skin); gl.enableVertexAttribArray(aSkin); gl.vertexAttribPointer(aSkin, 4, gl.UNSIGNED_BYTE, false, 4, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bodyB.idx);
  };
  const model = new Float32Array(16);
  const drawPiece = g => {
    const m = meshes[g.k], M = g.m;
    model.set([M[0], M[3], M[6], 0, M[1], M[4], M[7], 0, M[2], M[5], M[8], 0, g.c[0], g.c[1], g.c[2], 1]);
    gl.uniformMatrix4fv(U("uModel"), false, model);
    gl.uniform4fv(U("uGearCol"), GEAR_COL[g.col] || GEAR_COL.metal);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.vertexAttribPointer(aNor, 4, gl.FLOAT, false, 16, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  };
  const floorR = Math.max(1.2, B.r * 1.5);
  const floorDisc = { k: "cyl", c: [B.c[0], -0.003, B.c[2]], m: mm(arc([1, 0, 0], [0, 1, 0]), [0.002, 0, 0, 0, floorR, 0, 0, 0, floorR]) };
  gl.uniform4fv(U("uFloor"), [B.c[0], B.c[2], floorR * 0.35, floorR]); gl.uniform3fv(U("uFloorCol"), floor);
  let dead = false, last = { p: 0, act: 0 };
  function draw(p = last.p, act = last.act) {
    if (dead) return;
    last = { p, act };
    size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const J = lift(move, p), pose = retarget(R0, J);
    boneRows(R0, pose, rows);
    gl.uniform4fv(U("uBone[0]"), rows);
    glowIdx.forEach((i, k) => { const c = base[k], g = 0.75 + 0.35 * act; col.set([c[0] * g, c[1] * g, c[2] * g, 0.45 * act], i * 4); });
    gl.uniform4fv(U("uCol[0]"), col);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const eye = orbitEye(B.c, cam.yaw, cam.pitch, fit(aspect) * cam.zoom);
    const proj = perspective(FOV, aspect, 0.05, 30);
    gl.uniformMatrix4fv(U("uMVP"), false, mul(proj, lookAt(eye, B.c, [0, 1, 0])));
    const fwd = unit(sub(B.c, eye)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    const dirL = (a, b, c) => unit([right[0] * a + up[0] * b - fwd[0] * c, right[1] * a + up[1] * b - fwd[1] * c, right[2] * a + up[2] * b - fwd[2] * c]);
    gl.uniform3fv(U("uEye"), eye); gl.uniform3fv(U("uKey"), dirL(-0.55, 0.65, 0.55)); gl.uniform3fv(U("uFill"), dirL(0.8, 0.1, 0.4)); gl.uniform3fv(U("uBack"), dirL(0.2, 0.4, -0.9));
    bindBody();
    gl.drawElements(gl.TRIANGLES, body.t * 3, gl.UNSIGNED_INT, 0);
    // matériel : maillages rigides
    gl.uniform1f(U("uRigid"), 1);
    gl.disableVertexAttribArray(aSkin); gl.vertexAttrib4f(aSkin, 0, 0, 255, 0);
    for (const g of gearOf(move, R0, pose, J)) drawPiece(g);
    // sol en dernier, transparent sur ses bords
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(U("uFloorOn"), 1); drawPiece(floorDisc); gl.uniform1f(U("uFloorOn"), 0);
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
