// Démos des exercices : un vrai corps dessiné (proportions humaines, os de longueur fixe), le matériel
// (disques, haltères, poulies, bancs, machines), les muscles qui travaillent en couleur et des repères
// (trajectoire, alignement, angle, flèche du mouvement). On interpole des ANGLES entre des positions clés :
// le corps ne se déforme jamais. Vue de profil (le sportif regarde vers la droite) ou de face.
// Le calcul (solve, sample, fitBox) est pur et testé dans Node ; le dessin crée les éléments une fois
// puis ne met à jour que des attributs à chaque image.

/* ---------- Squelette ---------- */
export const L = { thigh: 19.5, shin: 19.5, torso: 24, uarm: 14.5, farm: 12.5, ankle: 3.2, head: 8.4 };
export const FLOOR = 100;
const RAD = Math.PI / 180;
export const dir = a => [Math.sin(a * RAD), -Math.cos(a * RAD)];
const add = (p, a, l) => { const d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const r1 = v => Math.round(v * 10) / 10;

// Position debout, bras le long du corps. Angles en degrés : direction de l'os, de l'articulation proche vers
// l'éloignée (0 = vers le haut, 90 = vers l'avant, 180 = vers le bas, 270 = vers l'arrière).
// at : point fixé (ankle, toe, knee, hip, shoulder, wrist) placé en (x, y).
export const STAND = { at: "ankle", x: 50, y: FLOOR - L.ankle, thigh: 180, shin: 180, torso: 0, head: 0, uarm: 180, farm: 180, foot: 90 };
const KEYS = ["x", "y", "thigh", "shin", "torso", "head", "uarm", "farm", "foot", "thigh2", "shin2", "uarm2", "farm2", "foot2", "hand", "hand2",
  "luarm", "lfarm", "lthigh", "lshin", "luarm2", "ropeT", "spine", "shrug", "chin"];
const PTS = ["Wt", "W2t", "At", "A2t", "Wr", "W2r"], SIDES = ["eb", "eb2", "kb", "kb2"];

// Joints d'une pose : A cheville, K genou, H hanche, S épaule, E coude, W poignet (2 = côté éloigné),
// N base du cou, C centre de la tête, et les pieds (talon / pointe).
// Cibles facultatives (cinématique inverse) : Wt / W2t position du poignet, At / A2t position de la cheville, Wv barre tenue
// bras tendus sur la verticale x = Wv ; balance : équilibre (voir balanced) ;
// eb / kb : côté du coude / du genou (+1 ou -1). luarm, lfarm… : raccourci de perspective (membre qui sort du plan).
export function solve(q) {
  if (q.balance) return balanced(q);
  const P = { ...STAND, ...q };
  const len = k => L[k] * (P["l" + k] ?? 1);
  let H;
  const o = [P.x, P.y];
  switch (P.at) {
    case "hip": H = o; break;
    case "knee": H = add(o, P.thigh, -len("thigh")); break;
    case "shoulder": H = add(o, P.torso, -L.torso); break;
    case "wrist": H = add(add(add(o, P.farm, -len("farm")), P.uarm, -len("uarm")), P.torso, -L.torso); break;
    case "toe": { const A = footAnkle(o, P.foot); H = add(add(A, P.shin, -len("shin")), P.thigh, -len("thigh")); break; }
    default: H = add(add(o, P.shin, -len("shin")), P.thigh, -len("thigh")); // ankle
  }
  const anchoredLeg = P.at === "ankle" || P.at === "toe" || P.at === "knee";
  if (P.At && !anchoredLeg) [P.thigh, P.shin] = ik(H, P.At, len("thigh"), len("shin"), P.kb ?? 1);
  if (P.A2t) [P.thigh2, P.shin2] = ik(H, P.A2t, len("thigh"), len("shin"), P.kb2 ?? P.kb ?? 1);
  const thigh2 = P.thigh2 ?? P.thigh, shin2 = P.shin2 ?? P.shin, foot2 = P.foot2 ?? P.foot;
  const K = add(H, P.thigh, len("thigh")), A = add(K, P.shin, len("shin"));
  const K2 = add(H, thigh2, len("thigh")), A2 = add(K2, shin2, len("shin"));
  const S = add(H, P.torso, L.torso + (P.shrug || 0));
  // Wr : main placée dans le repère du buste [le long, en travers (+ devant)], ex. barre sur les épaules
  const rel = r => { const u = dir(P.torso), n = dir(P.torso + 90); return [S[0] + u[0] * r[0] + n[0] * r[1], S[1] + u[1] * r[0] + n[1] * r[1]]; };
  if (P.Wr && !P.Wt) P.Wt = rel(P.Wr);
  if (P.Wv != null && !P.Wt) { // Wv : barre tenue bras tendus, sur la verticale x = Wv (trajectoire de barre droite)
    const reach = len("uarm") + len("farm") - 0.01, dx = P.Wv - S[0];
    P.Wt = [P.Wv, S[1] + Math.sqrt(Math.max(0, reach * reach - dx * dx))];
  }
  if (P.W2r && !P.W2t) P.W2t = rel(P.W2r);
  if (P.Wt && P.at !== "wrist") [P.uarm, P.farm] = ik(S, P.Wt, len("uarm"), len("farm"), P.eb ?? 1);
  // bras éloigné : il copie le bras proche (même raccourci) sauf s'il a sa propre cible ou ses propres angles
  const la2 = L.uarm * (P.luarm2 ?? (ownArm2(P) ? 1 : P.luarm ?? 1));
  if (P.W2t) [P.uarm2, P.farm2] = ik(S, P.W2t, la2, len("farm"), P.eb2 ?? P.eb ?? 1);
  const uarm2 = P.uarm2 ?? P.uarm, farm2 = P.farm2 ?? P.farm;
  const E = add(S, P.uarm, len("uarm")), W = add(E, P.farm, len("farm"));
  const E2 = add(S, uarm2, la2), W2 = add(E2, farm2, len("farm"));
  const ha = P.torso + topBend(P.spine) + (P.head || 0), S0 = P.shrug ? add(H, P.torso, L.torso) : S; // haussement : la tête ne bouge pas
  const N = add(S0, ha - (P.head || 0), 2.2), C = add(add(S0, ha, L.head), ha + 90, 0.9 - (P.chin || 0)); // chin : tête rentrée vers l'arrière
  return { H, K, A, K2, A2, S, E, W, E2, W2, N, C, ha, q: { ...P, thigh2, shin2, uarm2, farm2, foot2 }, ...feet(A, P.foot), ...feet(A2, foot2, "2") };
}
// Équilibre, comme le fait un vrai pratiquant : le centre de gravité (corps + charge tenue au point « of », en fraction du
// poids du corps) reste à l'aplomb du milieu du pied. by : on cherche l'inclinaison du buste (« torso », par défaut) ou celle
// des jambes autour des chevilles (« ankle » : les hanches partent en arrière). x : c'est le point « of » qui doit rester
// à l'aplomb de x (barre guidée). balance : { of?, load?, x?, by?, min?, max? }
function balanced(q) {
  const { balance: b, ...r } = q, ankle = b.by === "ankle";
  const pose = t => (ankle ? { ...r, thigh: (r.thigh ?? 180) + t, shin: (r.shin ?? 180) + t,
    ...(r.thigh2 != null && { thigh2: r.thigh2 + t }), ...(r.shin2 != null && { shin2: r.shin2 + t }) } : { ...r, torso: t });
  // cible : debout bras le long du corps, notre corps est d'aplomb 2,5 en arrière du milieu du pied ; une charge lourde
  // (barre) se place, elle, au-dessus du milieu du pied
  const f = t => {
    const j = solve(pose(t)), x = b.x != null && b.of ? at(j, b.of)[0] : com(j, b.load, b.of);
    return [x - (b.x ?? (j.heel[0] + j.toe[0]) / 2 - 2.5 / (1 + (b.load || 0))), j];
  };
  let lo = b.min ?? (ankle ? -30 : -25), hi = b.max ?? (ankle ? 30 : 95), [flo, jlo] = f(lo), [fhi, jhi] = f(hi);
  if (flo > 0 === fhi > 0) return Math.abs(flo) < Math.abs(fhi) ? jlo : jhi; // pas d'équilibre possible : la butée la plus proche
  let j = jlo;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2, [fm, jm] = f(mid);
    j = jm;
    if (fm > 0 === flo > 0) { lo = mid; flo = fm; } else hi = mid;
  }
  return j;
}
// Centre de gravité horizontal : masses des segments du corps (tables de Winter) + charge facultative au point « of »
const SEG = [["H", "S", 0.497, 0.5], ["S", "C", 0.081, 1], ["S", "E", 0.028, 0.436], ["E", "W", 0.022, 0.6], ["S", "E2", 0.028, 0.436], ["E2", "W2", 0.022, 0.6],
  ["H", "K", 0.1, 0.433], ["K", "A", 0.0465, 0.433], ["H", "K2", 0.1, 0.433], ["K2", "A2", 0.0465, 0.433], ["heel", "toe", 0.0145, 0.5], ["heel2", "toe2", 0.0145, 0.5]];
export function com(j, load = 0, of) {
  let x = 0, m = 0;
  for (const [a, c, w, s] of SEG) { x += w * (j[a][0] + (j[c][0] - j[a][0]) * s); m += w; }
  if (load && of) { x += load * at(j, of)[0]; m += load; }
  return x / m;
}
// Courbure du dos : le haut du buste s'enroule vers l'avant (spine > 0) ou se creuse (spine < 0)
const bendK = spine => ((spine || 0) / 90) * L.torso * 0.2;
const topBend = spine => Math.atan2(4 * bendK(spine), L.torso) / RAD;
// Deux os de longueurs l1, l2 depuis P vers la cible T : angles des deux os (bend : de quel côté plie l'articulation)
export function ik(P, T, l1, l2, bend = 1) {
  const dx = T[0] - P[0], dy = T[1] - P[1];
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(dx, dy)));
  const base = Math.atan2(dx, -dy) / RAD;
  const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) / RAD;
  const a1 = base + bend * alpha, E = add(P, a1, l1);
  return [a1, Math.atan2(T[0] - E[0], -(T[1] - E[1])) / RAD];
}
// cheville à partir de la pointe du pied (pied posé)
function footAnkle(toe, foot) { return add(add(toe, foot, -8.8), foot + 90, -L.ankle); }
function feet(A, foot, k = "") {
  const down = foot + 90;
  return { ["heel" + k]: add(add(A, foot, -3.2), down, L.ankle), ["toe" + k]: add(add(A, foot, 8.8), down, L.ankle) };
}

// Pose au temps p (0 → 1) d'un mouvement à positions clés { p, ...pose } ; loop : le mouvement tourne en boucle.
// Entre les positions clés, chaque angle suit une courbe douce (cubique monotone) : le corps ne s'arrête qu'aux vrais
// changements de sens, sans à-coup ni dépassement ; une main ou un pied posé aux deux positions reste sur sa cible.
export function sample(move, p) {
  const ks = move.keys;
  if (ks.length === 1) return { ...move.base, ...ks[0] };
  p = move.loop ? ((p % 1) + 1) % 1 : Math.max(0, Math.min(1, p));
  const P = prep(move);
  let i = 0;
  while (i < ks.length - 2 && p > P.ps[i + 1]) i++;
  const h = P.ps[i + 1] - P.ps[i], u = h > 0 ? Math.min(1, Math.max(0, (p - P.ps[i]) / h)) : 1;
  const A = P.ks[i], B = P.ks[i + 1], out = { ...A };
  for (const c of KEYS) out[c] = herm(P.ps, P.chan[c], P.slope[c], i, u);
  for (const [c, par] of REL) out[c] += out[par];
  for (const k of PTS) {
    delete out[k];
    if (A[k] && B[k]) out[k] = [herm(P.ps, P.pt[k][0], P.pts[k][0], i, u), herm(P.ps, P.pt[k][1], P.pts[k][1], i, u)];
  }
  for (const k of SIDES) out[k] = A[k] ?? B[k]; // côté du coude / du genou : jamais interpolé
  for (const c of TWO) if (!P.own[c][i] && !P.own[c][i + 1]) delete out[c]; // membre éloigné non décrit : il copie l'autre
  return out;
}
// Préparation (une fois par mouvement) : chaque position clé complète, angles résolus (cinématique inverse comprise)
// et déroulés pour rester continus, pentes de chaque courbe
const PREP = new WeakMap();
const dflt = c => (c[0] === "l" && c !== "lerp" ? 1 : STAND[c] ?? 0);
function prep(move) {
  let P = PREP.get(move);
  if (P) return P;
  const ks = move.keys.map(k => ({ ...move.base, ...k })), ps = ks.map(k => k.p), qs = ks.map(k => solve(k).q);
  const chan = {}, slope = {}, pt = {}, pts = {};
  for (const c of KEYS) chan[c] = qs.map((q, i) => q[c] ?? ks[i][c] ?? (c === "luarm2" ? (ownArm2(ks[i]) ? 1 : q.luarm ?? 1)
    : c.endsWith("2") && c[0] !== "l" ? q[c.slice(0, -1)] ?? dflt(c.slice(0, -1)) : dflt(c)));
  // avant-bras et tibia suivis par rapport au bras et à la cuisse : le coude et le genou plient toujours dans le bon sens
  for (const [c, par] of REL) chan[c] = chan[c].map((v, i) => n180(v - chan[par][i]));
  for (const c of KEYS) {
    const v = chan[c];
    if (ANGLES.has(c)) for (let i = 1; i < v.length; i++) v[i] = v[i - 1] + n180(v[i] - v[i - 1]);
    slope[c] = slopes(ps, v, move.loop);
  }
  for (const k of PTS) {
    pt[k] = [0, 1].map(a => ks.map(q => (q[k] ? q[k][a] : NaN)));
    pts[k] = pt[k].map(v => slopes(ps, v, move.loop));
  }
  const own = {};
  for (const c of TWO) own[c] = ks.map(k => k[c] != null || (TWO_BY[c] || []).some(t => k[t] != null));
  P = { ks, ps, chan, slope, pt, pts, own };
  PREP.set(move, P);
  return P;
}
// Pentes d'une cubique monotone (Fritsch–Butland) : nulles aux extrémités d'un aller-retour et à chaque sommet
function slopes(ps, v, loop) {
  const n = v.length, m = new Array(n).fill(0), ok = i => i >= 0 && i < n && !Number.isNaN(v[i]);
  for (let i = 0; i < n; i++) {
    if (!ok(i)) continue;
    let l = i - 1, r = i + 1, hl, hr;
    if (loop && i === 0) l = n - 2;
    if (loop && i === n - 1) r = 1;
    if (!ok(l) || !ok(r) || (!loop && (i === 0 || i === n - 1))) continue;
    hl = i === 0 ? ps[n - 1] - ps[n - 2] : ps[i] - ps[l];
    hr = i === n - 1 ? ps[1] - ps[0] : ps[r] - ps[i];
    const dl = (v[i] - v[l]) / (hl || 1e-9), dr = (v[r] - v[i]) / (hr || 1e-9);
    if (!(dl * dr > 0)) continue; // sommet ou palier : arrêt naturel
    m[i] = (3 * (hl + hr)) / ((2 * hr + hl) / dl + (hr + 2 * hl) / dr);
  }
  return m;
}
function herm(ps, v, m, i, u) {
  const h = ps[i + 1] - ps[i], u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * m[i + 1];
}
const ANGLES = new Set(["thigh", "shin", "torso", "uarm", "farm", "foot", "thigh2", "shin2", "uarm2", "farm2", "foot2"]);
const REL = [["shin", "thigh"], ["shin2", "thigh2"], ["farm", "uarm"], ["farm2", "uarm2"]];
const n180 = a => ((((a + 180) % 360) + 360) % 360) - 180;
// Canaux du membre éloigné et les cibles qui les décident
const TWO = ["thigh2", "shin2", "uarm2", "farm2", "foot2", "hand2", "luarm2"];
const ownArm2 = q => q.W2t != null || q.W2r != null || q.uarm2 != null;
const TWO_BY = { thigh2: ["A2t"], shin2: ["A2t"], uarm2: ["W2t", "W2r"], farm2: ["W2t", "W2r"] };

/* ---------- Matériel ---------- */
// Point désigné par un nom de joint (« W », « S »…), avec décalage facultatif le long d'un angle
export function at(j, ref) {
  if (Array.isArray(ref)) return ref;
  if (typeof ref === "string") return j[ref] || j.H;
  const base = ref.j === "back" ? add(add(j.S, j.q.torso, -1.2), j.q.torso - 90, 4.2)          // barre sur les trapèzes
    : ref.j === "rack" ? add(add(j.S, j.q.torso, 0.6), j.q.torso + 90, 4.6)                     // barre sur l'avant des épaules
    : ref.j === "hips" ? add(add(j.H, j.q.torso, 1.2), j.q.torso + 90, 5.2)                     // barre sur les hanches (hip thrust)
    : ref.j === "chest" ? add(add(j.S, j.q.torso, -5), j.q.torso + 90, 7.5)                     // haltère contre la poitrine
    : ref.j === "hands" ? [(j.W[0] + j.W2[0]) / 2, (j.W[1] + j.W2[1]) / 2]
    : ref.j === "grip" ? add(j.W, j.q.farm + (j.q.hand || 0), 2.6)                                // dans la paume
    : j[ref.j] || j.H;
  let out = base;
  if (ref.u || ref.n) { // décalage le long / en travers (+ devant) du buste, ou d'un os (b : [joint, joint])
    const [P1, P2] = ref.b ? [j[ref.b[0]], j[ref.b[1]]] : [j.H, j.S];
    const l = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) || 1, ux = (P2[0] - P1[0]) / l, uy = (P2[1] - P1[1]) / l;
    const [nx, ny] = ref.b ? [uy, -ux] : [-uy, ux];
    out = [out[0] + ux * (ref.u || 0) + nx * (ref.n || 0), out[1] + uy * (ref.u || 0) + ny * (ref.n || 0)];
  }
  return ref.dx || ref.dy ? [out[0] + (ref.dx || 0), out[1] + (ref.dy || 0)] : out;
}

// Boîte englobante d'un mouvement (corps + matériel), pour le cadrage
export function fitBox(move, { pad = 7, square = false, ratio = 0 } = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = (p, r = 0) => { x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); };
  for (let i = 0; i <= 12; i++) {
    if (move.view === "front") { for (const [p, r] of frontPoints(move, i / 12)) grow(p, r); continue; }
    const j = solve(sample(move, i / 12));
    for (const k of ["H", "K", "A", "K2", "A2", "S", "E", "W", "E2", "W2", "heel", "toe", "heel2", "toe2"]) grow(j[k], 4.5);
    grow(j.C, 7);
    for (const g of move.gear || []) for (const [p, r] of gearPoints(g, j)) grow(p, r);
  }
  for (const a of move.aids || []) if (a.k === "line" && a.label && a.labelAt === "start") {
    const j = solve(sample(move, a.at ?? 1)), p1 = at(j, a.from), p2 = at(j, a.to), ext = a.ext ?? 0.12, sx = Math.sign(p2[0] - p1[0] || 1);
    grow([p1[0] - (p2[0] - p1[0]) * ext - sx * (2 + a.label.length * 2.15), p1[1]]);
  }
  if (move.view !== "front") y1 = Math.max(y1, FLOOR + 1.5);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad * 0.6;
  let w = x1 - x0, h = y1 - y0;
  const want = square ? 1 : ratio;
  if (want) {
    if (w / h < want) { const nw = h * want; x0 -= (nw - w) / 2; w = nw; }
    else { const nh = w / want; y0 -= (nh - h) * 0.75; h = nh; }
  }
  return [r1(x0), r1(y0), r1(w), r1(h)];
}
// Points de la vue de face (après rotation du corps) et de son matériel
function frontPoints(move, p) {
  const j = solveFront(sampleFront(move, p)), a = (j.q.rot || 0) * RAD, [cx, cy] = j.P;
  const rot = ([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
  const out = [["SL", 4], ["SR", 4], ["HL", 5], ["HR", 5], ["EL", 3.5], ["ER", 3.5], ["WL", 3.5], ["WR", 3.5], ["KL", 4.5], ["KR", 4.5], ["AL", 4], ["AR", 4], ["C", 7]].map(([k, r]) => [rot(j[k]), r]);
  for (const g of move.gear || []) {
    if (g.k === "cable") g.from.forEach(q => out.push([rot(q), 3]));
    if (g.k === "rect" || g.k === "seat") { out.push([[g.x, g.y], 0.5], [[g.x + g.w, g.y + (g.h || 4)], 0.5]); }
    if (g.k === "post") out.push([[g.x, g.y], 1], [[g.x2 ?? g.x, g.y2 ?? FLOOR], 1]);
    if (g.k === "bar") { const m = [(j.WL[0] + j.WR[0]) / 2, (j.WL[1] + j.WR[1]) / 2], e = g.half ?? 22; out.push([rot([m[0] - e, m[1]]), 8], [rot([m[0] + e, m[1]]), 8]); }
  }
  return out;
}
function gearPoints(g, j) {
  const p = g.at ? at(j, g.at) : [g.x ?? 0, g.y ?? 0];
  switch (g.k) {
    case "plate": return [[p, g.r || 8]];
    case "db": return [[p, 4]];
    case "kb": return [[add(p, 180, 4.5), 5]];
    case "pad": case "seat": { const e = add(p, g.ang ?? 90, g.len || 20); return [[p, (g.th || 4) + 1], [e, (g.th || 4) + 1]]; }
    case "post": return [[p, 2], [[g.x2 ?? p[0], g.y2 ?? p[1]], 2]];
    case "cable": return [[g.from, 3]];
    case "box": return [[[g.x, g.y], 1], [[g.x + g.w, FLOOR], 1]];
    case "rail": return [[[g.x, g.y], 2], [[g.x, FLOOR], 2]];
    case "line": return [[at(j, g.from), 2], [at(j, g.to), 2]];
    case "circle": return [[[g.x, g.y], (g.r || 3) + 1]];
    case "wall": return [[[g.x, g.y ?? 8], 1], [[g.x + 3, FLOOR], 1]];
    case "roll": return [[p, (g.r || 3) + 0.5]];
    case "mat": return [[[g.x, FLOOR], 0], [[g.x + g.w, FLOOR], 0]];
    case "bar": return g.post === false ? [[[g.x, g.y], 2]] : [[[g.x, g.y], 2], [[g.x + (g.px ?? 0), g.py ?? (g.up ? g.y - 30 : FLOOR)], 1]];
    case "sled": return [[p, 6]];
    case "rope": return [[[j.C[0], j.C[1] - 10], 1], [[j.C[0] + 22, j.H[1]], 1], [[j.C[0] - 22, j.H[1]], 1]];
    default: return [[p, 3]];
  }
}

/* ---------- Muscles ---------- */
export const MUSCLES = {
  pecs: "Pectoraux", delts: "Épaules", traps: "Trapèzes", lats: "Dorsaux", biceps: "Biceps", triceps: "Triceps", forearms: "Avant-bras",
  abs: "Abdos", obliques: "Obliques", lowerback: "Lombaires", glutes: "Fessiers", quads: "Quadriceps", hams: "Ischios",
  adductors: "Adducteurs", abductors: "Moyen fessier", calves: "Mollets", hipflex: "Fléchisseurs de hanche",
};
export const muscleNames = ids => ids.filter(m => MUSCLES[m]).map(m => MUSCLES[m]);

/* ---------- Dessin ---------- */
const NS = "http://www.w3.org/2000/svg";
const f = p => `${r1(p[0])} ${r1(p[1])}`;
// Courbe fermée lisse passant par tous les points (Catmull-Rom)
export function closed(pts) {
  const n = pts.length;
  let d = `M${f(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`;
  }
  return d + "Z";
}
// Repère local d'un os : u le long de l'os, n vers l'avant (antérieur)
const frame = (P1, P2, torso = false) => {
  const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  return torso ? { l, ux, uy, nx: -uy, ny: ux } : { l, ux, uy, nx: uy, ny: -ux };
};
const pt = (P1, F, s, c) => [P1[0] + F.ux * F.l * s + F.nx * c, P1[1] + F.uy * F.l * s + F.ny * c];
const prof = (arr, s) => { const x = Math.max(0, Math.min(1, s)) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)); return lerp(arr[i], arr[i + 1], x - i); };

// Profils (rayon côté avant / côté arrière, de l'articulation proche à l'éloignée)
const PROF = {
  thigh: [[5.6, 6, 5.5, 4.5, 3.7], [5.5, 5.8, 5.2, 4.3, 3.7]],
  shin: [[3.5, 3.2, 2.75, 2.3, 2.05], [3.7, 4.7, 3.9, 2.6, 2.05]],
  uarm: [[3.9, 3.85, 3.6, 3.05, 2.55], [4, 4.05, 3.7, 3, 2.55]],
  farm: [[2.7, 2.9, 2.5, 2.1, 1.8], [2.7, 2.8, 2.4, 2, 1.8]],
};
function limbPts(P1, P2, [fr, bk]) {
  const F = frame(P1, P2), out = [];
  for (const s of [0, 0.2, 0.4, 0.6, 0.8, 1]) out.push(pt(P1, F, s, prof(fr, s)));
  const re = (prof(fr, 1) + prof(bk, 1)) / 2;
  out.push(pt(P1, F, 1 + re / F.l * 0.92, (prof(fr, 1) - prof(bk, 1)) / 2));
  for (const s of [1, 0.8, 0.6, 0.4, 0.2, 0]) out.push(pt(P1, F, s, -prof(bk, s)));
  const rs = (prof(fr, 0) + prof(bk, 0)) / 2;
  out.push(pt(P1, F, -rs / F.l * 0.9, (prof(fr, 0) - prof(bk, 0)) / 2));
  return out;
}
// Muscle en fuseau sur un os : de s0 à s1, entre les fractions c0 et c1 du rayon (positif = devant, négatif = derrière)
function lensPts(P1, P2, [fr, bk], s0, s1, c0, c1) {
  const F = frame(P1, P2), out = [], back = [];
  const off = (s, c) => c >= 0 ? c * prof(fr, s) : c * prof(bk, s);
  for (let i = 0; i <= 6; i++) {
    const s = lerp(s0, s1, i / 6), w = Math.pow(Math.sin(Math.PI * i / 6), 0.6);
    const mid = (c0 + c1) / 2, half = (c1 - c0) / 2 * w;
    out.push(pt(P1, F, s, off(s, mid + half)));
    back.unshift(pt(P1, F, s, off(s, mid - half)));
  }
  return [...out, ...back.slice(1, -1)];
}

// Torse de profil : points (le long de l'axe hanche → épaule, en part de sa longueur ; en travers, + devant)
const TORSO = [[-0.1, -5.2], [0.03, -6.7], [0.22, -5.2], [0.48, -5.7], [0.76, -6.3], [0.96, -4.9], [1.05, -2.1], [1.06, 1.7], [0.97, 4.6],
  [0.84, 6.6], [0.7, 5.9], [0.5, 4.8], [0.28, 4.9], [0.08, 5.3], [-0.08, 3.3], [-0.13, -0.9]];
function axisPt(H, S, spine, a, c) {
  const F = frame(H, S, true), k = bendK(spine);
  const b = -k * 4 * a * (1 - a), db = -k * (4 - 8 * a); // décalage de l'axe (vers l'arrière si dos rond) et sa pente
  const tx = F.ux * F.l + F.nx * db, ty = F.uy * F.l + F.ny * db, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
  const x = H[0] + F.ux * F.l * a + F.nx * b, y = H[1] + F.uy * F.l * a + F.ny * b;
  return [x + nx * c, y + ny * c];
}
const torsoPts = (H, S, spine = 0) => TORSO.map(([a, c]) => axisPt(H, S, spine, a, c));
// Zones musculaires du torse (même repère) : [a0, a1, c0, c1]
const TZONE = { pecs: [0.68, 0.99, 1.7, 6.3], abs: [0.12, 0.64, 1.2, 4.7], obliques: [0.16, 0.56, -1.6, 2.1], lats: [0.42, 0.86, -5.7, -1.9],
  traps: [0.86, 1.08, -4.7, -0.7], lowerback: [0.06, 0.46, -5.1, -2.1], glutes: [-0.13, 0.2, -6.6, -1.6], hipflex: [-0.04, 0.16, 2.1, 5.1] };
function zonePts(H, S, [a0, a1, c0, c1], spine = 0) {
  const out = [], back = [];
  for (let i = 0; i <= 6; i++) {
    const a = lerp(a0, a1, i / 6), w = Math.pow(Math.sin(Math.PI * i / 6), 0.55), mid = (c0 + c1) / 2, half = (c1 - c0) / 2 * w;
    out.push(axisPt(H, S, spine, a, mid + half)); back.unshift(axisPt(H, S, spine, a, mid - half));
  }
  return [...out, ...back.slice(1, -1)];
}
// Muscles sur les membres : [os, s0, s1, c0, c1]
const LZONE = {
  quads: ["thigh", 0.1, 0.9, 0.05, 0.95], hams: ["thigh", 0.12, 0.86, -0.95, -0.08], adductors: ["thigh", 0.08, 0.6, -0.4, 0.4],
  abductors: ["thigh", -0.05, 0.25, -0.6, 0.6], calves: ["shin", 0.05, 0.62, -1, -0.12],
  delts: ["uarm", -0.12, 0.36, -0.95, 0.95], biceps: ["uarm", 0.24, 0.86, 0.05, 0.95], triceps: ["uarm", 0.14, 0.86, -0.95, -0.05],
  forearms: ["farm", 0.04, 0.66, -0.9, 0.9],
};

// Tête de profil (ovale, nez, oreille), tournée selon l'angle de la tête
function headPts(C, ang) {
  const F = { l: 1, ux: Math.sin(ang * RAD), uy: -Math.cos(ang * RAD) }; F.nx = -F.uy; F.ny = F.ux;
  const P = (a, c) => [C[0] + F.ux * a + F.nx * c, C[1] + F.uy * a + F.ny * c];
  return [P(6.2, 0), P(5.2, 3.4), P(2.6, 5.3), P(0.4, 5.6), P(-0.6, 6.3), P(-1.6, 5.6), P(-3.6, 4.6), P(-5.4, 2.2), P(-6, -0.6), P(-4.8, -3.8), P(-1.4, -5.6), P(2.6, -5.2), P(5.2, -3.4)];
}
function footPts(heel, toe, A) {
  const dx = toe[0] - heel[0], dy = toe[1] - heel[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = uy, ny = -ux; // n vers le haut du pied
  const P = (s, c) => [heel[0] + ux * l * s + nx * c, heel[1] + uy * l * s + ny * c];
  return [P(0.02, 0.2), P(-0.04, 1.6), P(0.12, 3.4), [A[0] - ux * 0.6 + nx * 0.4, A[1] - uy * 0.6 + ny * 0.4], P(0.42, 3.6), P(0.72, 2.4), P(0.94, 1.5), P(1.02, 0.5), P(0.94, -0.05), P(0.5, -0.05)];
}
// Main : petite forme arrondie dans le prolongement de l'avant-bras
function handPts(W, a) {
  const F = { l: 1, ux: Math.sin(a * RAD), uy: -Math.cos(a * RAD) }; F.nx = F.uy; F.ny = -F.ux;
  const P = (s, c) => [W[0] + F.ux * s + F.nx * c, W[1] + F.uy * s + F.ny * c];
  return [P(-0.6, 1.5), P(1.6, 2.2), P(3.8, 1.8), P(4.6, 0), P(3.8, -1.7), P(1.6, -2), P(-0.6, -1.4)];
}

const el = (tag, cls, parent) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute("class", cls); if (parent) parent.appendChild(n); return n; };

// Construit la figure d'un mouvement dans le <svg> et renvoie draw(p).
// big : démo en grand (fantôme de la position finale, repères, flèches) ; sinon vignette.
export function figure(svg, move, { big = false } = {}) {
  svg.textContent = "";
  const box = fitBox(move, big ? { ratio: 1.12 } : { square: true, pad: 5 });
  svg.setAttribute("viewBox", box.join(" "));
  svg.classList.add("fig", big ? "fig-big" : "fig-small");
  if (move.view === "front") return frontFigure(svg, move, box, { big });
  const primary = new Set(move.mus?.p || []), second = new Set(move.mus?.s || []);
  const cls = m => (primary.has(m) ? "mus p" : second.has(m) ? "mus s" : "");
  // sol et ombre
  if (!move.noFloor) { const fl = el("line", "fig-floor", svg); fl.setAttribute("x1", box[0]); fl.setAttribute("x2", box[0] + box[2]); fl.setAttribute("y1", FLOOR); fl.setAttribute("y2", FLOOR); }
  const shadow = el("ellipse", "fig-shadow", svg);
  const ghost = big && move.ghost ? el("g", "fig-ghost", svg) : null;
  const aidsBack = el("g", "fig-aids", svg);
  const gearBack = el("g", "fig-gear", svg);
  const parts = {};
  const part = (name, group, bone, far = false) => {
    const g = el("g", far ? "fig-part far" : "fig-part", group);
    const body = el("path", "bd", g);
    const mus = [];
    for (const [m, z] of Object.entries(LZONE)) if (z[0] === bone && cls(m)) mus.push([el("path", cls(m), g), z]);
    parts[name] = { body, mus, bone };
  };
  const farG = el("g", "", svg);
  part("uarm2", farG, "uarm", true); part("farm2", farG, "farm", true); const hand2 = el("path", "bd hand", el("g", "fig-part far", farG));
  part("thigh2", farG, "thigh", true); part("shin2", farG, "shin", true); const foot2 = el("path", "bd shoe", el("g", "fig-part far", farG));
  const torsoG = el("g", "fig-part", svg), torso = el("path", "bd", torsoG);
  const tmus = Object.entries(TZONE).filter(([m]) => cls(m)).map(([m, z]) => [el("path", cls(m), torsoG), z]);
  const neckG = el("g", "fig-part", svg), neck = el("path", "bd", neckG), head = el("path", "bd head", neckG), ear = el("ellipse", "eye", neckG);
  const gearMid = el("g", "fig-gear", svg); // devant le buste, derrière le bras et la jambe proches
  const nearG = el("g", "", svg);
  part("thigh", nearG, "thigh"); part("shin", nearG, "shin"); const foot = el("path", "bd shoe", el("g", "fig-part", nearG));
  part("uarm", nearG, "uarm"); part("farm", nearG, "farm"); const hand = el("path", "bd hand", el("g", "fig-part", nearG));
  const gearFront = el("g", "fig-gear", svg);
  const aids = el("g", "fig-aids", svg);
  const gear = (move.gear || []).map(g => makeGear(g, g.back ? gearBack : g.mid ? gearMid : gearFront, big));
  // repères fixes : trajectoire
  for (const a of big ? move.aids || [] : []) {
    if (a.k === "path") {
      const pts = Array.from({ length: 13 }, (_, i) => at(solve(sample(move, i / 12)), a.of));
      const pl = el("polyline", "aid-path", aidsBack); pl.setAttribute("points", pts.map(f).join(" "));
    }
  }
  const live = (big ? move.aids || [] : []).filter(a => a.k !== "path").map(a => ({ a, g: el("g", `aid aid-${a.k}`, aids) }));
  if (ghost) drawGhost(ghost, solve(sample(move, move.ghostAt ?? 1)));

  const limb = (name, P1, P2) => {
    const pr = parts[name], prf = PROF[pr.bone];
    pr.body.setAttribute("d", closed(limbPts(P1, P2, prf)));
    for (const [e, z] of pr.mus) e.setAttribute("d", closed(lensPts(P1, P2, prf, z[1], z[2], z[3], z[4])));
  };
  let lastP = 0;
  return p => {
    const j = solve(sample(move, p));
    limb("uarm2", j.S, j.E2); limb("farm2", j.E2, j.W2); hand2.setAttribute("d", closed(handPts(j.W2, j.q.farm2 + (j.q.hand2 ?? j.q.hand ?? 0))));
    limb("thigh2", j.H, j.K2); limb("shin2", j.K2, j.A2); foot2.setAttribute("d", closed(footPts(j.heel2, j.toe2, j.A2)));
    torso.setAttribute("d", closed(torsoPts(j.H, j.S, j.q.spine)));
    for (const [e, z] of tmus) e.setAttribute("d", closed(zonePts(j.H, j.S, z, j.q.spine)));
    const ha = j.ha;
    neck.setAttribute("d", closed(limbPts(j.N, add(j.C, ha + 180, 3.6), [[2.6, 2.5, 2.5], [3, 2.8, 2.6]])));
    head.setAttribute("d", closed(headPts(j.C, ha)));
    const eyeP = add(add(j.C, ha, 1.1), ha + 90, 3.4);
    ear.setAttribute("cx", r1(eyeP[0])); ear.setAttribute("cy", r1(eyeP[1])); ear.setAttribute("rx", 0.75); ear.setAttribute("ry", 1.1);
    ear.setAttribute("transform", `rotate(${r1(ha)} ${r1(eyeP[0])} ${r1(eyeP[1])})`);
    limb("thigh", j.H, j.K); limb("shin", j.K, j.A); foot.setAttribute("d", closed(footPts(j.heel, j.toe, j.A)));
    limb("uarm", j.S, j.E); limb("farm", j.E, j.W); hand.setAttribute("d", closed(handPts(j.W, j.q.farm + (j.q.hand || 0))));
    // ombre au sol sous le corps
    const xs = [j.heel[0], j.toe[0], j.H[0], j.S[0]], cx = (Math.min(...xs) + Math.max(...xs)) / 2, low = Math.max(j.A[1], j.A2[1], j.H[1]);
    shadow.setAttribute("cx", r1(cx)); shadow.setAttribute("cy", FLOOR + 0.6); shadow.setAttribute("rx", r1(Math.max(10, (Math.max(...xs) - Math.min(...xs)) / 2 + 6)));
    shadow.setAttribute("ry", 1.6); shadow.style.opacity = move.noFloor ? 0 : Math.max(0.15, 1 - (FLOOR - low) / 40);
    for (const g of gear) g(j);
    for (const { a, g } of live) drawAid(g, a, j, move, p, lastP);
    lastP = p;
  };
}

// Silhouette légère de la position finale (repère « jusqu'où aller »)
function drawGhost(g, j) {
  const pathOf = pts => { const e = el("path", "", g); e.setAttribute("d", closed(pts)); };
  pathOf(limbPts(j.H, j.K2, PROF.thigh)); pathOf(limbPts(j.K2, j.A2, PROF.shin));
  pathOf(torsoPts(j.H, j.S, j.q.spine)); pathOf(headPts(j.C, j.ha));
  pathOf(limbPts(j.H, j.K, PROF.thigh)); pathOf(limbPts(j.K, j.A, PROF.shin)); pathOf(footPts(j.heel, j.toe, j.A));
  pathOf(limbPts(j.S, j.E, PROF.uarm)); pathOf(limbPts(j.E, j.W, PROF.farm));
}

/* ---------- Matériel (création une fois, mise à jour à chaque image) ---------- */
function makeGear(g, layer, big) {
  const grp = el("g", `gear gear-${g.k}`, layer);
  const set = (e, o) => { for (const [k, v] of Object.entries(o)) e.setAttribute(k, typeof v === "number" ? r1(v) : v); };
  switch (g.k) {
    case "plate": { // disque vu de face (barre vue par le bout)
      const r = g.r || 8, far = el("circle", "plate far", grp), outer = el("circle", "plate", grp), ring = el("circle", "plate-ring", grp), hub = el("circle", "plate-hub", grp);
      return j => { const p = at(j, g.at); set(far, { cx: p[0] - 1.4, cy: p[1] - 1.1, r }); set(outer, { cx: p[0], cy: p[1], r }); set(ring, { cx: p[0], cy: p[1], r: r * 0.62 }); set(hub, { cx: p[0], cy: p[1], r: Math.max(1.4, r * 0.16) }); };
    }
    case "db": { // haltère vu par le bout
      const far = el("path", "db far", grp), near = el("path", "db", grp), hub = el("circle", "plate-hub", grp);
      const hex = (c, r) => Array.from({ length: 6 }, (_, i) => [c[0] + r * Math.cos(Math.PI / 6 + i * Math.PI / 3), c[1] + r * Math.sin(Math.PI / 6 + i * Math.PI / 3)]);
      const poly = pts => `M${pts.map(f).join("L")}Z`;
      return j => { const p = at(j, g.at || "W"), r = g.r || 3.8; far.setAttribute("d", poly(hex([p[0] - 1.2, p[1] - 0.9], r))); near.setAttribute("d", poly(hex(p, r))); set(hub, { cx: p[0], cy: p[1], r: 1 }); };
    }
    case "kb": { // kettlebell
      const handle = el("path", "kb-handle", grp), bell = el("circle", "kb", grp);
      return j => { const p = at(j, g.at || "W"), a = g.ang ?? (j.q.farm ?? 180) + (g.rel || 0), c = add(p, a, 5.6); handle.setAttribute("d", `M${f(add(c, a + 90, 2.6))}Q${f(add(p, a, -1.2))} ${f(add(c, a - 90, 2.6))}`); set(bell, { cx: c[0], cy: c[1], r: 4.4 }); };
    }
    case "cable": { // poulie + câble jusqu'à la main (ou une poignée)
      const post = g.post ? el("line", "post", grp) : null, line = el("line", "cable", grp), wheel = el("circle", "pulley", grp), grip = el("circle", "grip", grp);
      if (post) set(post, { x1: g.post[0], y1: g.post[1], x2: g.post[2], y2: g.post[3] });
      set(wheel, { cx: g.from[0], cy: g.from[1], r: 2.4 });
      return j => { const p = at(j, g.to || "W"); set(line, { x1: g.from[0], y1: g.from[1], x2: p[0], y2: p[1] }); set(grip, { cx: p[0], cy: p[1], r: 1.6 }); };
    }
    case "band": { // élastique : de l'ancrage à la main
      const line = el("path", "band", grp);
      return j => { const p = at(j, g.to || "W"), a = at(j, g.from); line.setAttribute("d", `M${f(a)}Q${f([(a[0] + p[0]) / 2, (a[1] + p[1]) / 2 + 2])} ${f(p)}`); };
    }
    case "pad": case "seat": { // coussin de banc / siège / dossier (fixe ou attaché à un joint)
      const pad = el("path", g.k === "seat" ? "pad seat" : "pad", grp), legs = g.legs ? el("path", "frame", grp) : null;
      const draw = p => {
        const a = g.ang ?? 90, len = g.len || 20, th = g.th || 3.6, e = add(p, a, len), n = a - 90;
        const q = [add(p, n, th / 2), add(e, n, th / 2), add(e, n, -th / 2), add(p, n, -th / 2)];
        pad.setAttribute("d", `M${f(q[0])}L${f(q[1])}Q${f(add(e, a, th / 2))} ${f(q[2])}L${f(q[3])}Q${f(add(p, a, -th / 2))} ${f(q[0])}Z`);
        if (legs) legs.setAttribute("d", g.legs.map(([s, x2, y2]) => { const b = add(p, a, len * s); return `M${f(b)}L${f([x2 ?? b[0], y2 ?? FLOOR])}`; }).join(""));
      };
      if (!g.at) { draw([g.x, g.y]); return () => {}; }
      return j => draw(at(j, g.at));
    }
    case "post": { const ln = el("line", "frame", grp); set(ln, { x1: g.x, y1: g.y, x2: g.x2 ?? g.x, y2: g.y2 ?? FLOOR }); return () => {}; }
    case "rail": { const ln = el("line", "rail", grp); set(ln, { x1: g.x, y1: g.y, x2: g.x, y2: FLOOR }); return () => {}; }
    case "bar": { // barre fixe vue par le bout (traction, dips) avec son montant
      if (g.post !== false) set(el("line", "frame", grp), { x1: g.x + (g.px ?? 0), y1: g.y, x2: g.x + (g.px ?? 0), y2: g.py ?? (g.up ? g.y - 30 : FLOOR) });
      set(el("circle", "fixbar", grp), { cx: g.x, cy: g.y, r: g.r || 1.6 });
      return () => {};
    }
    case "roll": { // coussin rond d'une machine (contre le tibia, la cuisse…), relié à l'axe par un bras
      const arm = g.pivot ? el("line", "frame thick", grp) : null, c = el("circle", "pad roll", grp);
      return j => { const p = at(j, g.at); if (arm) { const q = at(j, g.pivot); set(arm, { x1: q[0], y1: q[1], x2: p[0], y2: p[1] }); } set(c, { cx: p[0], cy: p[1], r: g.r || 3 }); };
    }
    case "box": { const r = el("rect", "box", grp); set(r, { x: g.x, y: g.y, width: g.w, height: FLOOR - g.y, rx: 1.2 }); return () => {}; }
    case "mat": { const r = el("rect", "mat", grp); set(r, { x: g.x, y: FLOOR - 1.4, width: g.w, height: 1.4, rx: 0.7 }); return () => {}; }
    case "sled": { // plateau mobile (presse à cuisses, hack squat) attaché aux pieds
      const plate = el("path", "frame thick", grp), rail = g.rail ? el("line", "rail", grp) : null;
      if (rail) set(rail, { x1: g.rail[0], y1: g.rail[1], x2: g.rail[2], y2: g.rail[3] });
      return j => { const p = at(j, g.at || "toe"), a = g.ang ?? 0; plate.setAttribute("d", `M${f(add(p, a, -8))}L${f(add(p, a, 8))}`); };
    }
    case "rope": { // corde à sauter vue de profil : des mains jusqu'à son point le plus loin, qui tourne autour du corps
      const arc = el("path", "band", grp);
      return j => {
        const t = (j.q.ropeT ?? 0) * Math.PI * 2, top = j.C[1] - 9, c = [(j.C[0] + j.A[0]) / 2, (top + FLOOR) / 2], ry = (FLOOR - top) / 2 + 1;
        const P = [c[0] + Math.sin(t) * 21, Math.min(FLOOR - 0.6, c[1] - Math.cos(t) * ry)];
        const m = [(j.W[0] + P[0]) / 2, (j.W[1] + P[1]) / 2], k = 0.3, bow = [m[0] + (P[1] - j.W[1]) * k * Math.sign(Math.cos(t) || 1), m[1] - (P[0] - j.W[0]) * k * Math.sign(Math.cos(t) || 1)];
        arc.setAttribute("d", `M${f(j.W)}Q${f(bow)} ${f(P)}`);
      };
    }
    case "wave": { // battle rope : corde ondulée jusqu'à l'ancrage
      const w = el("path", "band thick", grp);
      return j => { const a = [g.x, g.y], p = j.W, n = 10; let d = `M${f(p)}`;
        for (let i = 1; i <= n; i++) { const s = i / n, x = lerp(p[0], a[0], s), y = lerp(p[1], a[1], s) + Math.sin(s * 9 + (j.q.ropeT ?? 0) * 6.28) * 3 * (1 - s); d += `L${f([x, y])}`; }
        w.setAttribute("d", d); };
    }
    case "line": { // barre ou tige entre deux points (landmine…), plateau d'un pied
      const ln = el("line", g.cls || "frame thick", grp);
      return j => { const a = at(j, g.from), b = at(j, g.to); set(ln, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); };
    }
    case "circle": { const c = el("circle", g.cls || "pulley", grp); set(c, { cx: g.x, cy: g.y, r: g.r || 3 }); if (g.spin) { const sp = el("line", "frame", grp); return j => { const t = (j.q.ropeT ?? 0) * Math.PI * 2; set(sp, { x1: g.x - Math.cos(t) * g.r, y1: g.y - Math.sin(t) * g.r, x2: g.x + Math.cos(t) * g.r, y2: g.y + Math.sin(t) * g.r }); }; } return () => {}; }
    case "roller": { // rouleau de massage qui suit un point du corps au sol
      const c = el("circle", "pad", grp);
      return j => { const p = at(j, g.at); set(c, { cx: p[0], cy: FLOOR - 3.4, r: 3.4 }); };
    }
    case "wall": { const r = el("rect", "box", grp); set(r, { x: g.x, y: g.y ?? 8, width: 3, height: FLOOR - (g.y ?? 8), rx: 0.6 }); return () => {}; }
    default: return () => {};
  }
}

/* ---------- Repères ---------- */
function drawAid(g, a, j, move, p, lastP) {
  if (a.k === "line") { // alignement (corps gainé, dos plat, cuisses parallèles…)
    if (a.at != null) { const show = Math.abs(p - a.at) < 0.16; g.style.opacity = show ? 1 : 0; if (!show) return; }
    const p1 = at(j, a.from), p2 = at(j, a.to), ext = a.ext ?? 0.12, d = [p2[0] - p1[0], p2[1] - p1[1]];
    const e1 = [p1[0] - d[0] * ext, p1[1] - d[1] * ext], e2 = [p2[0] + d[0] * ext, p2[1] + d[1] * ext];
    // étiquette : au bout de la ligne, au-dessus ; ou à son départ, en dehors (labelAt: "start")
    const [lx, ly, anchor] = a.labelAt === "start" ? [e1[0] - Math.sign(d[0] || 1) * 1.2, e1[1] + 1.5, d[0] >= 0 ? "end" : "start"] : [e2[0], e2[1] - 2, d[0] >= 0 ? "end" : "start"];
    g.innerHTML = `<line x1="${r1(e1[0])}" y1="${r1(e1[1])}" x2="${r1(e2[0])}" y2="${r1(e2[1])}"/>${a.label ? `<text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${anchor}">${a.label}</text>` : ""}`;
    return;
  }
  if (a.k === "angle") { // angle d'une articulation, affiché près de la position finale
    const show = Math.abs(p - (a.at ?? 1)) < 0.18;
    g.style.opacity = show ? 1 : 0;
    if (!show) return;
    const V = at(j, a.j), A = at(j, a.a), B = at(j, a.b), r = a.r || 6;
    const a1 = Math.atan2(A[1] - V[1], A[0] - V[0]), a2 = Math.atan2(B[1] - V[1], B[0] - V[0]);
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const P1 = [V[0] + r * Math.cos(a1), V[1] + r * Math.sin(a1)], P2 = [V[0] + r * Math.cos(a2), V[1] + r * Math.sin(a2)];
    const mid = a1 + da / 2, T = [V[0] + (r + 4.6) * Math.cos(mid), V[1] + (r + 4.6) * Math.sin(mid)];
    const deg = a.label || `${Math.round(Math.abs(da) * 180 / Math.PI / 5) * 5}°`;
    g.innerHTML = `<path d="M${f(P1)}A${r} ${r} 0 0 ${da > 0 ? 1 : 0} ${f(P2)}"/><text x="${r1(T[0])}" y="${r1(T[1] + 1.4)}" text-anchor="middle">${deg}</text>`;
    return;
  }
  if (a.k === "arrow") { // sens du mouvement en cours
    const t1 = Math.min(1, p + 0.08), t0 = Math.max(0, p - 0.08), dirSign = p >= lastP ? 1 : -1;
    const A = at(solve(sample(move, dirSign > 0 ? t0 : t1)), a.of), B = at(solve(sample(move, dirSign > 0 ? t1 : t0)), a.of);
    const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
    if (l < 0.6) { g.style.opacity = 0; return; }
    g.style.opacity = 1;
    const ux = dx / l, uy = dy / l, P = at(j, a.of), o = a.off || [0, 0], s = [P[0] + o[0] + ux * 3, P[1] + o[1] + uy * 3], e = [s[0] + ux * 7, s[1] + uy * 7];
    g.innerHTML = `<line x1="${r1(s[0])}" y1="${r1(s[1])}" x2="${r1(e[0])}" y2="${r1(e[1])}"/><path d="M${f([e[0] + ux * 2.6, e[1] + uy * 2.6])}L${f([e[0] - uy * 2, e[1] + ux * 2])}L${f([e[0] + uy * 2, e[1] - ux * 2])}Z"/>`;
    return;
  }
  if (a.k === "pin") { // point qui reste fixe (coude, hanche…)
    const P = at(j, a.of);
    g.innerHTML = `<circle cx="${r1(P[0])}" cy="${r1(P[1])}" r="2.6"/><circle class="dot" cx="${r1(P[0])}" cy="${r1(P[1])}" r=".9"/>`;
  }
}

/* ---------- Vue de face ---------- */
// Pose de face : bassin (x, y), inclinaison du buste (lean), bras (abduction 0 = le long du corps, 90 = à l'horizontale,
// 180 = en haut ; coude : flexion), jambes (écart), shinL/R : écart propre du tibia ; lthL, lshL, luaL, lfaL… : raccourci
// de perspective (membre qui pointe vers nous) ; rot : rotation de tout le corps (allongé sur le côté) ;
// turn : tête tournée (-1 → 1). Côté gauche de l'image = côté droit du sportif.
export const FSTAND = { x: 50, y: FLOOR - L.ankle - L.shin - L.thigh, lean: 0, armL: 8, armR: 8, elbowL: 0, elbowR: 0, legL: 4, legR: 4, kneeL: 0, kneeR: 0,
  shinL: 0, shinR: 0, lthL: 1, lthR: 1, lshL: 1, lshR: 1, luaL: 1, luaR: 1, lfaL: 1, lfaR: 1, head: 0, turn: 0, rot: 0, shrug: 0 };
const FKEYS = Object.keys(FSTAND);
export function sampleFront(move, p) {
  const ks = move.keys;
  p = move.loop ? ((p % 1) + 1) % 1 : Math.max(0, Math.min(1, p));
  let P = FPREP.get(move);
  if (!P) { // mêmes courbes douces que de profil
    const rows = ks.map(k => ({ ...FSTAND, ...move.base, ...k })), ps = rows.map(r => r.p ?? 0), v = {}, m = {};
    for (const k of FKEYS) { v[k] = rows.map(r => r[k]); m[k] = slopes(ps, v[k], move.loop); }
    FPREP.set(move, P = { ps, v, m });
  }
  const out = {};
  if (ks.length < 2) { for (const k of FKEYS) out[k] = P.v[k][0]; return out; }
  let i = 0;
  while (i < ks.length - 2 && p > P.ps[i + 1]) i++;
  const h = P.ps[i + 1] - P.ps[i], u = h > 0 ? Math.min(1, Math.max(0, (p - P.ps[i]) / h)) : 1;
  for (const k of FKEYS) out[k] = herm(P.ps, P.v[k], P.m[k], i, u);
  return out;
}
const FPREP = new WeakMap();
export function solveFront(q) {
  const P = [q.x, q.y], up = -q.lean, S0 = add(P, up, L.torso + q.shrug), side = up + 90;
  const sh = (s, w) => add(S0, side, s * w), hip = (s, w) => add(P, side, s * w);
  const SL = sh(-1, 7.4), SR = sh(1, 7.4), HL = hip(-1, 3.8), HR = hip(1, 3.8);
  // bras : angle absolu (0 = vers le bas), abduction vers l'extérieur
  const armDir = (s, abd, lean) => 180 - s * abd - lean;
  const EL = add(SL, armDir(-1, q.armL, q.lean), L.uarm * q.luaL), ER = add(SR, armDir(1, q.armR, q.lean), L.uarm * q.luaR);
  const WL = add(EL, armDir(-1, q.armL + q.elbowL, q.lean), L.farm * q.lfaL), WR = add(ER, armDir(1, q.armR + q.elbowR, q.lean), L.farm * q.lfaR);
  const legDir = (s, abd) => 180 - s * abd;
  const KL = add(HL, legDir(-1, q.legL), L.thigh * q.lthL * Math.cos(q.kneeL * RAD * 0.5)), KR = add(HR, legDir(1, q.legR), L.thigh * q.lthR * Math.cos(q.kneeR * RAD * 0.5));
  const AL = add(KL, legDir(-1, q.legL * 0.6 + q.shinL), L.shin * q.lshL * Math.cos(q.kneeL * RAD * 0.5)), AR = add(KR, legDir(1, q.legR * 0.6 + q.shinR), L.shin * q.lshR * Math.cos(q.kneeR * RAD * 0.5));
  const C = add(S0, up + q.head, 9.6 - q.shrug);
  return { P, S0, SL, SR, HL, HR, EL, ER, WL, WR, KL, KR, AL, AR, C, q };
}
// Bras de face qui va chercher le point T (cinématique inverse dans le plan de face) → { armL, elbowL } ou { armR, elbowR }
export function frontReach(q, side, T, bend = 1) {
  const j = solveFront({ ...FSTAND, ...q }), s = side === "L" ? -1 : 1, S = side === "L" ? j.SL : j.SR;
  const [a1, a2] = ik(S, T, L.uarm, L.farm, bend * s), lean = q.lean || 0, norm = a => ((a % 360) + 540) % 360 - 180;
  const abd = norm(s * (180 - lean - a1)), elbow = norm(s * (180 - lean - a2) - abd);
  return side === "L" ? { armL: abd, elbowL: elbow } : { armR: abd, elbowR: elbow };
}
const FPROF = { thigh: [[5, 5.1, 4.5, 3.7, 3.1], [5, 5.1, 4.5, 3.7, 3.1]], shin: [[3.2, 3.6, 3, 2.1, 1.8], [3.2, 3.6, 3, 2.1, 1.8]],
  uarm: [[3.4, 3.2, 3, 2.6, 2.2], [3.4, 3.2, 3, 2.6, 2.2]], farm: [[2.4, 2.5, 2.1, 1.8, 1.5], [2.4, 2.5, 2.1, 1.8, 1.5]] };
function frontFigure(svg, move, box, { big }) {
  const primary = new Set(move.mus?.p || []), second = new Set(move.mus?.s || []);
  const cls = m => (primary.has(m) ? "mus p" : second.has(m) ? "mus s" : "");
  if (!move.noFloor) { const fl = el("line", "fig-floor", svg); fl.setAttribute("x1", box[0]); fl.setAttribute("x2", box[0] + box[2]); fl.setAttribute("y1", FLOOR); fl.setAttribute("y2", FLOOR); }
  const fixedBack = el("g", "fig-gear", svg), gearBack = el("g", "fig-gear", svg); // matériel fixe (ne tourne pas avec le corps) / porté
  const g = el("g", "fig-part", svg);
  const mk = c => el("path", c, g);
  const legs = [mk("bd"), mk("bd"), mk("bd"), mk("bd")], feetE = [mk("bd shoe"), mk("bd shoe")];
  const legMus = ["quads", "adductors", "abductors", "calves"].filter(cls).map(m => [m, mk(cls(m)), mk(cls(m))]);
  const torso = mk("bd"), tmus = (move.back ? ["traps", "lats", "lowerback"] : ["pecs", "abs", "obliques", "traps"]).filter(cls).map(m => [m, mk(cls(m))]);
  const neck = mk("bd"), head = el("ellipse", "bd head", g), eyes = move.back ? [] : [el("ellipse", "eye", g), el("ellipse", "eye", g)]; // vue de dos : pas de visage
  const arms = [mk("bd"), mk("bd"), mk("bd"), mk("bd")], hands = [el("circle", "bd hand", g), el("circle", "bd hand", g)];
  const armMus = ["delts", "biceps", "triceps", "forearms"].filter(cls).map(m => [m, mk(cls(m)), mk(cls(m))]);
  const gearFront = el("g", "fig-gear", svg), fixedFront = el("g", "fig-gear", svg);
  const gears = (move.gear || []).map(gd => makeFrontGear(gd, FIXED.has(gd.k) ? (gd.back ? fixedBack : fixedFront) : gd.back ? gearBack : gearFront));
  const lp = (P1, P2, pr) => closed(limbPts(P1, P2, pr));
  const set = (e, o) => { for (const [k, v] of Object.entries(o)) e.setAttribute(k, typeof v === "number" ? r1(v) : v); };
  return p => {
    const j = solveFront(sampleFront(move, p)), q = j.q;
    const legsPts = [[j.HL, j.KL, j.AL], [j.HR, j.KR, j.AR]];
    legsPts.forEach(([H, K, A], i) => { legs[i * 2].setAttribute("d", lp(H, K, FPROF.thigh)); legs[i * 2 + 1].setAttribute("d", lp(K, A, FPROF.shin));
      const s = i ? 1 : -1, u = frame(K, A), dn = [u.ux, u.uy], sd = [-u.uy * s, u.ux * s]; // pied dans l'axe du tibia
      const F = (a, c) => [A[0] + dn[0] * a + sd[0] * c, A[1] + dn[1] * a + sd[1] * c];
      feetE[i].setAttribute("d", closed([F(-1, -1.6), F(-0.6, 2.4), F(2.6, 3), F(2.9, -2.2)])); });
    for (const [m, e1, e2] of legMus) {
      const z = m === "calves" ? ["shin", 0.06, 0.55, -0.9, 0.9] : m === "adductors" ? ["thigh", 0.05, 0.62, -0.95, -0.1] : m === "abductors" ? ["thigh", -0.1, 0.32, 0.2, 0.95] : ["thigh", 0.1, 0.9, -0.85, 0.85];
      [[j.HL, j.KL, j.AL, -1], [j.HR, j.KR, j.AR, 1]].forEach(([H, K, A, s], i) => {
        const [P1, P2] = z[0] === "shin" ? [K, A] : [H, K];
        const inner = m === "adductors" || m === "abductors", c0 = inner ? (s < 0 ? z[3] : -z[4]) : z[3], c1 = inner ? (s < 0 ? z[4] : -z[3]) : z[4];
        (i ? e2 : e1).setAttribute("d", closed(lensPts(P1, P2, FPROF[z[0]], z[1], z[2], Math.min(c0, c1), Math.max(c0, c1))));
      });
    }
    const up = -q.lean, side = up + 90, T = (a, c) => add(add(j.P, up, a * (L.torso + q.shrug) / L.torso), side, c);
    torso.setAttribute("d", closed([T(-2.2, -5.6), T(1, -6.4), T(8, -5.2), T(13.5, -4.8), T(19.5, -6.6), T(23.2, -8.6), T(25.4, -6), T(26.4, -2), T(26.4, 2), T(25.4, 6), T(23.2, 8.6), T(19.5, 6.6), T(13.5, 4.8), T(8, 5.2), T(1, 6.4), T(-2.2, 5.6), T(-3.4, 0)]));
    for (const [m, e] of tmus) {
      const zone = { pecs: [[16.6, -6.4], [22.4, -6.8], [23.4, -1], [17.4, -0.6], [16.6, 0.6], [17.4, 0.6], [23.4, 1], [22.4, 6.8], [16.6, 6.4], [15.4, 0]],
        abs: [[4.4, -3.4], [14.6, -3.6], [15, 0], [14.6, 3.6], [4.4, 3.4], [2.6, 0]], obliques: [[3, -5.6], [12, -4.8], [12.4, -3.8], [3.8, -4.4], [3, 4.4], [12, 3.8], [12.4, 4.8], [3, 5.6]],
        traps: move.back ? [[24.4, -7.6], [26.8, -2.6], [27.4, 0], [26.8, 2.6], [24.4, 7.6], [15, 0]] : [[23, -6.6], [26.8, -2.6], [27.4, 0], [26.8, 2.6], [23, 6.6], [24.6, 0]],
        lats: [[19.6, -6.8], [12, -5.4], [6, -4.6], [10, -2.2], [17, -3.4], [17, 3.4], [10, 2.2], [6, 4.6], [12, 5.4], [19.6, 6.8], [15, 0]],
        lowerback: [[2, -2.6], [9, -2.4], [9, 2.4], [2, 2.6]] }[m];
      e.setAttribute("d", closed(zone.map(([a, c]) => T(a, c))));
    }
    neck.setAttribute("d", closed(limbPts(add(j.S0, up, -1), add(j.C, up + q.head + 180, 4.6), [[2.6, 2.4, 2.3], [2.6, 2.4, 2.3]])));
    const ha = up + q.head;
    set(head, { cx: j.C[0], cy: j.C[1], rx: 5.2, ry: 6.3, transform: `rotate(${r1(ha)} ${r1(j.C[0])} ${r1(j.C[1])})` });
    eyes.forEach((e, i) => { const c = add(add(j.C, ha + 90, (i ? 2 : -2) + q.turn * 2.6), ha, 0.6); set(e, { cx: c[0], cy: c[1], rx: 0.7 * (1 - Math.abs(q.turn) * 0.35), ry: 1, transform: `rotate(${r1(ha)} ${r1(c[0])} ${r1(c[1])})` }); });
    [[j.SL, j.EL, j.WL], [j.SR, j.ER, j.WR]].forEach(([S, E, W], i) => {
      arms[i * 2].setAttribute("d", lp(S, E, FPROF.uarm)); arms[i * 2 + 1].setAttribute("d", lp(E, W, FPROF.farm));
      const h = add(W, Math.atan2(W[0] - E[0], -(W[1] - E[1])) / RAD, 1.6); set(hands[i], { cx: h[0], cy: h[1], r: 2.3 });
    });
    for (const [m, e1, e2] of armMus) {
      const z = m === "delts" ? [-0.12, 0.36, -0.95, 0.95] : m === "biceps" || m === "triceps" ? [0.24, 0.86, -0.7, 0.7] : [0.04, 0.66, -0.9, 0.9];
      [[j.SL, j.EL, j.WL], [j.SR, j.ER, j.WR]].forEach(([S, E, W], i) => {
        const [P1, P2, pr] = m === "forearms" ? [E, W, FPROF.farm] : [S, E, FPROF.uarm];
        (i ? e2 : e1).setAttribute("d", closed(lensPts(P1, P2, pr, z[0], z[1], z[2], z[3])));
      });
    }
    for (const gg of gears) gg(j);
    const tr = q.rot ? `rotate(${r1(q.rot)} ${r1(j.P[0])} ${r1(j.P[1])})` : "";
    g.setAttribute("transform", tr); gearFront.setAttribute("transform", tr); gearBack.setAttribute("transform", tr);
  };
}
const FIXED = new Set(["seat", "rect", "post"]);
function makeFrontGear(g, layer) {
  const grp = el("g", `gear gear-${g.k}`, layer);
  const set = (e, o) => { for (const [k, v] of Object.entries(o)) e.setAttribute(k, typeof v === "number" ? r1(v) : v); };
  if (g.k === "db") { // haltères vus de face : poignée + deux têtes, dans chaque main
    const parts = [0, 1].map(() => [el("line", "db-bar", grp), el("rect", "db", grp), el("rect", "db", grp)]);
    return j => [[j.WL, j.EL], [j.WR, j.ER]].forEach(([W, E], i) => {
      if (g.side != null && g.side !== i) { parts[i].forEach(e => e.setAttribute("opacity", 0)); return; }
      const a = Math.atan2(W[1] - E[1], W[0] - E[0]), c = [W[0] + Math.cos(a) * 1.6, W[1] + Math.sin(a) * 1.6], [bar, h1, h2] = parts[i];
      const ux = Math.cos(a + Math.PI / 2), uy = Math.sin(a + Math.PI / 2);
      set(bar, { x1: c[0] - ux * 4, y1: c[1] - uy * 4, x2: c[0] + ux * 4, y2: c[1] + uy * 4 });
      for (const [h, s] of [[h1, -1], [h2, 1]]) { const x = c[0] + ux * 4.6 * s, y = c[1] + uy * 4.6 * s; set(h, { x: x - 2, y: y - 2.6, width: 4, height: 5.2, rx: 1, transform: `rotate(${r1(a * 180 / Math.PI + 90)} ${r1(x)} ${r1(y)})` }); }
    });
  }
  if (g.k === "bar") { // barre tenue à deux mains, vue de face, disques aux bouts
    const bar = el("line", "db-bar", grp), pl = [el("rect", "plate", grp), el("rect", "plate", grp)];
    return j => { const a = j.WL, b = j.WR, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, ext = g.half ?? 22;
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (g.dy ?? 1.2)], e1 = [m[0] - ux * ext, m[1] - uy * ext], e2 = [m[0] + ux * ext, m[1] + uy * ext];
      set(bar, { x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1] });
      pl.forEach((r, i) => { const c = [m[0] + ux * (ext - 3) * (i ? 1 : -1), m[1] + uy * (ext - 3) * (i ? 1 : -1)], h = g.r ? g.r * 2 : 15;
        set(r, { x: c[0] - 1.6, y: c[1] - h / 2, width: 3.2, height: h, rx: 0.8, transform: `rotate(${r1(Math.atan2(uy, ux) / RAD)} ${r1(c[0])} ${r1(c[1])})` }); }); };
  }
  if (g.k === "cable") { // câbles depuis une ou deux poulies (ou élastiques accrochés : band)
    const lines = g.from.map(() => el("line", g.band ? "band" : "cable", grp));
    if (!g.band) g.from.forEach(p => set(el("circle", "pulley", grp), { cx: p[0], cy: p[1], r: 2.4 }));
    if (g.post) for (const [x1, y1, x2, y2] of g.post) set(el("line", "frame", grp), { x1, y1, x2, y2 });
    return j => g.from.forEach((fr, i) => { const W = (g.to || ["WL", "WR"])[i] === "WL" ? j.WL : j.WR; set(lines[i], { x1: fr[0], y1: fr[1], x2: W[0], y2: W[1] }); });
  }
  if (g.k === "band") { // élastique tenu entre les deux mains, ou autour des jambes
    const b = el("path", "band", grp);
    return j => { const [P1, P2] = g.legs ? [j.KL, j.KR] : g.ankles ? [j.AL, j.AR] : [j.WL, j.WR]; b.setAttribute("d", `M${f(P1)}Q${f([(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2 + (g.sag ?? 1.5)])} ${f(P2)}`); };
  }
  if (g.k === "kpad") { // coussins d'une machine contre les genoux (adducteurs : dedans, abducteurs : dehors)
    const pads = [el("rect", "pad", grp), el("rect", "pad", grp)];
    return j => [[j.KL, -1], [j.KR, 1]].forEach(([K, s], i) => { const x = K[0] + s * (g.out ? 5.6 : -5.6); set(pads[i], { x: x - 1.8, y: K[1] - 5, width: 3.6, height: 10, rx: 1.4 }); });
  }
  if (g.k === "seat") { set(el("rect", "pad seat", grp), { x: g.x, y: g.y, width: g.w, height: g.h || 4, rx: 1.6 }); return () => {}; }
  if (g.k === "rect") { set(el("rect", g.cls || "box", grp), { x: g.x, y: g.y, width: g.w, height: g.h, rx: g.rx ?? 1 }); return () => {}; }
  if (g.k === "post") { set(el("line", "frame", grp), { x1: g.x, y1: g.y, x2: g.x2 ?? g.x, y2: g.y2 ?? FLOOR }); return () => {}; }
  return () => {};
}

/* ---------- Carte des muscles (face et dos) ---------- */
const MAP_FRONT = {
  delts: ["M18 27c-3.4 0-5.6 2.4-6 5.6l3.6 1.4c1-2.4 2.4-3.6 4.4-4z", "M42 27c3.4 0 5.6 2.4 6 5.6l-3.6 1.4c-1-2.4-2.4-3.6-4.4-4z"],
  pecs: ["M29.4 30.4c-3.4-.8-7.6-.6-9.4 1.4-.8 2.4-.4 5.6 1.6 6.8 2.4 1.2 6.2.6 7.8-1.2z", "M30.6 30.4c3.4-.8 7.6-.6 9.4 1.4.8 2.4.4 5.6-1.6 6.8-2.4 1.2-6.2.6-7.8-1.2z"],
  biceps: ["M12.2 35.2c-1.4 3.2-1.8 6.6-1.2 9.4l3 .2c.6-2.6 1.4-5.8 1.6-8.4z", "M47.8 35.2c1.4 3.2 1.8 6.6 1.2 9.4l-3 .2c-.6-2.6-1.4-5.8-1.6-8.4z"],
  forearms: ["M10.6 46.4c-1.4 3.6-2 7.4-1.8 10.4h2.6c.6-3.2 1.6-6.6 2.2-10.2z", "M49.4 46.4c1.4 3.6 2 7.4 1.8 10.4h-2.6c-.6-3.2-1.6-6.6-2.2-10.2z"],
  abs: ["M26.6 39.6h6.8l.4 4.2h-7.6zM26 45h8l.2 4.2h-8.4zM25.8 50.4h8.4l-.2 5.8c-1.4 1.6-2.8 2.2-4 2.2s-2.6-.6-4-2.2z"],
  obliques: ["M21.4 40.4c1.6.4 3 1.4 3.8 2.6l-.2 10.4c-1.4-.4-2.6-1.6-3.2-3.2-.8-3-.8-6.4-.4-9.8z", "M38.6 40.4c-1.6.4-3 1.4-3.8 2.6l.2 10.4c1.4-.4 2.6-1.6 3.2-3.2.8-3 .8-6.4.4-9.8z"],
  hipflex: ["M23.4 57.6c1.4.4 3 1.8 4 3.4l-1 3.4c-1.6-1.2-3-3.2-3.4-5.2z", "M36.6 57.6c-1.4.4-3 1.8-4 3.4l1 3.4c1.6-1.2 3-3.2 3.4-5.2z"],
  quads: ["M21.8 63.4c-1.4 4.6-1.6 10-.6 14.8.6 2.4 2 3.4 3.6 3.6 1.4-.6 2.2-2.2 2.4-4.2.4-4.4-.2-9-1.6-12.8z", "M38.2 63.4c1.4 4.6 1.6 10 .6 14.8-.6 2.4-2 3.4-3.6 3.6-1.4-.6-2.2-2.2-2.4-4.2-.4-4.4.2-9 1.6-12.8z"],
  adductors: ["M27.6 64.6c.8 2.6 1.4 6.2 1.2 9.6l-1.8.8c-.6-2.8-.6-6.4.6-10.4z", "M32.4 64.6c-.8 2.6-1.4 6.2-1.2 9.6l1.8.8c.6-2.8.6-6.4-.6-10.4z"],
  calves: ["M22.6 87.6c-1 3.4-.8 7.4.2 10.6h2.2c.6-3.2.8-7-.2-10.4z", "M37.4 87.6c1 3.4.8 7.4-.2 10.6h-2.2c-.6-3.2-.8-7 .2-10.4z"],
};
const MAP_BACK = {
  traps: ["M30 22.6c-2 2-5.6 3.6-9.4 4.6l2.2 3.2c2.4.6 4.8 3.4 7.2 9.2 2.4-5.8 4.8-8.6 7.2-9.2l2.2-3.2c-3.8-1-7.4-2.6-9.4-4.6z"],
  delts: ["M18 27c-3.4 0-5.6 2.4-6 5.6l3.6 1.4c1-2.4 2.4-3.6 4.4-4z", "M42 27c3.4 0 5.6 2.4 6 5.6l-3.6 1.4c-1-2.4-2.4-3.6-4.4-4z"],
  triceps: ["M12.2 35.2c-1.4 3.2-1.8 6.6-1.2 9.4l3 .2c.6-2.6 1.4-5.8 1.6-8.4z", "M47.8 35.2c1.4 3.2 1.8 6.6 1.2 9.4l-3 .2c-.6-2.6-1.4-5.8-1.6-8.4z"],
  forearms: ["M10.6 46.4c-1.4 3.6-2 7.4-1.8 10.4h2.6c.6-3.2 1.6-6.6 2.2-10.2z", "M49.4 46.4c1.4 3.6 2 7.4 1.8 10.4h-2.6c-.6-3.2-1.6-6.6-2.2-10.2z"],
  lats: ["M21.2 33.4c1.6 1.8 4.4 6 5.6 10.6l.4 5.4c-2.2-1-4.2-3-5.2-5.8-1-3-1.4-6.6-.8-10.2z", "M38.8 33.4c-1.6 1.8-4.4 6-5.6 10.6l-.4 5.4c2.2-1 4.2-3 5.2-5.8 1-3 1.4-6.6.8-10.2z"],
  lowerback: ["M28.6 44.6v10.4l-3-.8-.6-6.4zM31.4 44.6v10.4l3-.8.6-6.4z"],
  glutes: ["M29.6 56.4c-3.8-.2-6.8 1.4-7.6 4.6-.6 2.6.6 5 3.2 5.6 2 .4 3.8-.4 4.6-1.4z", "M30.4 56.4c3.8-.2 6.8 1.4 7.6 4.6.6 2.6-.6 5-3.2 5.6-2 .4-3.8-.4-4.6-1.4z"],
  abductors: ["M22.2 55.2c-1.2 1.2-1.8 3-1.6 4.8l2.4-.8c.4-1.6 1.2-2.8 2.4-3.6z", "M37.8 55.2c1.2 1.2 1.8 3 1.6 4.8l-2.4-.8c-.4-1.6-1.2-2.8-2.4-3.6z"],
  hams: ["M22 68c-.8 4.4-.6 9 .6 12.4l3.2.4c.6-3.8.8-8.2-.2-12.4z", "M38 68c.8 4.4.6 9-.6 12.4l-3.2.4c-.6-3.8-.8-8.2.2-12.4z"],
  calves: ["M22.4 86c-1.4 2.6-1.4 6.4-.2 9l2.6.6c.8-3 .8-6.4-.2-9.6z", "M37.6 86c1.4 2.6 1.4 6.4.2 9l-2.6.6c-.8-3-.8-6.4.2-9.6z"],
};
const SIL = "M30 4.6c-3.6 0-5.8 2.8-5.8 6.4s2 6.8 5.8 6.8 5.8-3.2 5.8-6.8-2.2-6.4-5.8-6.4zM26.8 18.6c-.2 1.6-.8 3-2.4 3.8-2.8 1.4-6.4 1.6-8.6 3.2-2.6 1.8-3.4 5-3.8 8.6-.6 4.4-1.6 8.2-2.8 12.4-1 3.8-1.6 7.8-1.8 11.6l-.4 3.4c-.2 1.6 2.4 2 3 .4l.6-3.2c.8-3.6 2.4-7.4 3.4-11.2.8-3 1.2-6.2 1.6-9.4.2-.8 1-.8 1.2 0 .6 3.4 1.2 7 1 10.4-.2 3.8-1.2 7-1.6 10.6-.6 6.6-.2 13.6.6 20.2.6 5.4.6 10.6.4 16-.2 3.2.2 6.2 1 9.2.4 1.4 4.4 1.4 4.4 0 .2-3.8.6-7.6.8-11.4.4-5.4 1-10.8 1.6-16.2.2-1.6 1.4-1.6 1.6 0 .6 5.4 1.2 10.8 1.6 16.2.2 3.8.6 7.6.8 11.4 0 1.4 4 1.4 4.4 0 .8-3 1.2-6 1-9.2-.2-5.4-.2-10.6.4-16 .8-6.6 1.2-13.6.6-20.2-.4-3.6-1.4-6.8-1.6-10.6-.2-3.4.4-7 1-10.4.2-.8 1-.8 1.2 0 .4 3.2.8 6.4 1.6 9.4 1 3.8 2.6 7.6 3.4 11.2l.6 3.2c.6 1.6 3.2 1.2 3-.4l-.4-3.4c-.2-3.8-.8-7.8-1.8-11.6-1.2-4.2-2.2-8-2.8-12.4-.4-3.6-1.2-6.8-3.8-8.6-2.2-1.6-5.8-1.8-8.6-3.2-1.6-.8-2.2-2.2-2.4-3.8z";
// Silhouette de face et de dos, muscles en couleur : principaux (p) et secondaires (s) d'un exercice,
// ou classe libre par muscle (cls : carte de récupération)
export function bodyMap(mus = {}, { cls, label = "Muscles travaillés" } = {}) {
  const p = new Set(mus.p || []), s = new Set(mus.s || []);
  const c = cls || (m => (p.has(m) ? "mus p" : s.has(m) ? "mus s" : "mz"));
  const draw = map => Object.entries(map).map(([m, ds]) => ds.map(d => `<path class="${c(m)}" d="${d}"/>`).join("")).join("");
  return `<svg class="body-map" viewBox="0 0 130 104" role="img" aria-label="${label}">
    <g><path class="sil" d="${SIL}"/>${draw(MAP_FRONT)}<text x="30" y="103">Face</text></g>
    <g transform="translate(70 0)"><path class="sil" d="${SIL}"/>${draw(MAP_BACK)}<text x="30" y="103">Dos</text></g></svg>`;
}
