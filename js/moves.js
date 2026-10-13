// Bibliothèque des mouvements dessinés (voir body.js) : positions clés, matériel, muscles et repères.
// Angles : direction de l'os (0 = haut, 90 = avant, 180 = bas, 270 = arrière) ; Wt / At : position visée de la main /
// de la cheville (le coude et le genou se placent tout seuls). Sol à y = 100, le sportif regarde vers la droite.
import { frontReach } from "./body.js";
import { patternOf } from "./motion.js";

const ANK = 96.8, FSTAND_Y = 100 - 3.2 - 19.5 - 19.5;
// raccourcis
const stand = (o = {}) => ({ at: "ankle", x: 50, y: ANK, ...o });
const plate = (at, r = 8.5, o = {}) => ({ k: "plate", at, r, ...o });
const db = (at = "W", o = {}) => ({ k: "db", at, ...o });
const bench = (x, y, len, o = {}) => ({ k: "pad", x, y, len, ang: 90, th: 4, legs: [[0.12], [0.88]], back: true, ...o });
const M = (p, s = []) => ({ p, s });

/* ---------- Jambes ---------- */
const SQ_ARMS = { Wr: [-0.6, -6.2], eb: -1 }; // mains sur la barre, derrière la nuque
const PARALLEL = { k: "line", from: "H", to: "K", ext: 0.3, at: 1, label: "cuisses parallèles", labelAt: "start" };
// balance : le buste se penche juste ce qu'il faut pour garder barre et corps au-dessus du milieu du pied (body.js)
// xrot : bras tournés hors du plan (mains sur la barre derrière la nuque) : le coude paraît plié « à l'envers » de profil
const squatBar = {
  mus: M(["quads", "glutes"], ["hams", "lowerback", "abs", "adductors"]), xrot: true,
  base: { balance: { of: { j: "back" }, load: 0.8 } },
  keys: [
    { p: 0, ...stand({ shin: 182, thigh: 182, ...SQ_ARMS, head: -4 }) },
    { p: 1, ...stand({ shin: 211, thigh: 90, ...SQ_ARMS, head: -22 }) },
  ],
  gear: [plate({ j: "back" })],
  aids: [{ k: "path", of: { j: "back" } }, PARALLEL, { k: "arrow", of: "H", off: [-8, 0] }],
};
const frontSquat = {
  ...squatBar, mus: M(["quads", "glutes"], ["abs", "lowerback", "adductors"]), xrot: false,
  base: { balance: { of: { j: "rack" }, load: 0.7, min: -3 } },
  keys: [
    { p: 0, ...stand({ uarm: 72, farm: 257, lfarm: 0.7, head: 0 }) },
    { p: 1, ...stand({ shin: 214, thigh: 88, uarm: 92, farm: 277, lfarm: 0.7, head: -12 }) },
  ],
  gear: [plate({ j: "rack" })], aids: [{ k: "path", of: { j: "rack" } }, PARALLEL],
};
const goblet = {
  mus: M(["quads", "glutes"], ["abs", "adductors", "lowerback"]),
  base: { balance: { of: "W", load: 0.3, min: -3 } },
  keys: [
    { p: 0, ...stand({ Wr: [-6.5, 8.6], eb: 1 }) },
    { p: 1, ...stand({ shin: 214, thigh: 84, Wr: [-6.5, 8.6], eb: 1 }) },
  ],
  gear: [db("W", { r: 4.2 })], aids: [PARALLEL, { k: "arrow", of: "H", off: [-8, 0] }],
};
const airSquat = {
  mus: M(["quads", "glutes"], ["hams", "abs"]),
  base: { balance: {} },
  keys: [
    { p: 0, ...stand({ uarm: 175, farm: 175 }) },
    { p: 1, ...stand({ shin: 212, thigh: 88, uarm: 92, farm: 92 }) },
  ],
  aids: [PARALLEL, { k: "arrow", of: "H", off: [-8, 0] }],
};
// Wv : barre tenue bras tendus sur la verticale du milieu du pied (trajectoire droite, comme un bon soulevé de terre)
const MIDFOOT = 52.8;
const deadlift = {
  mus: M(["glutes", "hams", "lowerback"], ["quads", "traps", "forearms", "lats"]),
  base: { Wv: MIDFOOT },
  keys: [
    { p: 0, ...stand({ shin: 194, thigh: 104, torso: 58, head: -24 }) },
    { p: 0.5, ...stand({ shin: 181, thigh: 140, torso: 44, head: -16 }) },
    { p: 1, ...stand({ torso: 0, head: 0 }) },
  ],
  gear: [plate({ j: "W", dy: 1.6 })],
  aids: [{ k: "path", of: { j: "W", dy: 1.6 } }, { k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "W", off: [-14, 0] }],
  ghostAt: 1,
};
// les hanches partent en arrière (rotation des jambes autour des chevilles) pour rester en équilibre
const rdl = {
  mus: M(["hams", "glutes"], ["lowerback", "forearms"]),
  base: { Wv: MIDFOOT, balance: { of: "W", load: 0.6, by: "ankle", min: -16, max: 16 } },
  keys: [
    { p: 0, ...stand({ torso: 2 }) },
    { p: 1, ...stand({ shin: 180, thigh: 152, torso: 66, head: -16 }) },
  ],
  gear: [plate({ j: "W", dy: 1.6 })],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.25 }, { k: "path", of: { j: "W", dy: 1.6 } }, { k: "arrow", of: "H", off: [-7, 0] }],
};
const lunge = {
  mus: M(["quads", "glutes"], ["hams", "adductors", "calves"]),
  keys: [
    { p: 0, ...stand({ x: 60, thigh: 155, shin: 178, torso: 2, A2t: [28, 91], kb2: -1, foot2: 160 }) },
    { p: 1, ...stand({ x: 60, shin: 192, thigh: 92, torso: 4, A2t: [28, 91], kb2: -1, foot2: 165 }) },
  ],
  aids: [{ k: "angle", j: "K", a: "H", b: "A", at: 1 }, { k: "arrow", of: "H", off: [0, -8] }],
};
const legPress = {
  mus: M(["quads", "glutes"], ["hams", "adductors"]),
  base: { at: "hip", x: 40, y: 86, torso: 300, head: -20, uarm: 150, farm: 110, kb: -1 },
  keys: [
    { p: 0, At: [74, 58], foot: 30 },
    { p: 1, At: [60, 64], foot: 30 },
  ],
  gear: [{ k: "pad", x: 22, y: 76, len: 22, ang: 300, th: 4, back: true }, { k: "pad", x: 36, y: 92, len: 14, ang: 90, th: 4, back: true }, { k: "sled", at: "toe", ang: 30, back: true },
    { k: "post", x: 30, y: 94, x2: 88, y2: 52, back: true }],
  aids: [{ k: "angle", j: "K", a: "H", b: "A", at: 1 }],
};
const hipThrust = {
  mus: M(["glutes"], ["hams", "quads", "abs"]),
  base: { at: "shoulder", x: 30, y: 74, uarm: 120, farm: 60, kb: -1, At: [73, ANK] },
  keys: [
    { p: 0, torso: 306, head: 36 },
    { p: 1, torso: 271, head: 46 },
  ],
  gear: [bench(10, 79.4, 22), plate({ j: "hips" }, 9)],
  aids: [{ k: "line", from: "S", to: "K", ext: 0.05 }, { k: "arrow", of: "H", off: [0, 4] }],
};

const smithSquat = {
  ...squatBar,
  base: { balance: { of: { j: "back" }, x: 52.4 } }, // la barre guidée reste sur son rail
  keys: [
    { p: 0, ...stand({ x: 56, ...SQ_ARMS, head: -4 }) },
    { p: 1, ...stand({ x: 56, shin: 202, thigh: 90, ...SQ_ARMS, head: -20 }) },
  ],
  gear: [{ k: "rail", x: 52.4, y: 6, back: true }, plate({ j: "back" })],
  aids: [PARALLEL, { k: "arrow", of: "H", off: [-8, 0] }],
};
const hackSquat = {
  mus: M(["quads", "glutes"], ["adductors", "hams"]), xrot: true,
  base: { at: "hip", torso: 342, head: -4, At: [64, 88.6], kb: -1, foot: 72, Wr: [-1, 5.5], eb: -1 },
  keys: [
    { p: 0, x: 47, y: 54 },
    { p: 1, x: 51.6, y: 68.3 },
  ],
  gear: [{ k: "post", x: 16, y: 6, x2: 50, y2: 100, back: true }, { k: "pad", at: { j: "H", u: -3, n: -7 }, ang: 342, len: 31, th: 3.6, back: true },
    { k: "roll", at: { j: "S", u: 2.6, n: -1.4 }, r: 2.6 }, { k: "pad", x: 58.7, y: 95.5, len: 20, ang: 72, th: 3, back: true }, { k: "post", x: 66, y: 93, x2: 70, y2: 100, back: true }],
  aids: [{ k: "angle", j: "K", a: "H", b: "A", at: 1 }, { k: "arrow", of: "H", off: [-6, 4] }],
};
const jumpSquat = {
  dur: 2000,
  mus: M(["quads", "glutes"], ["calves", "hams"]), loop: true,
  keys: [
    { p: 0, ...stand() },
    { p: 0.24, ...stand({ shin: 206, thigh: 106, torso: 40, uarm: 198, farm: 190, head: -14 }) },
    { p: 0.42, ...stand({ y: ANK - 5, foot: 140, uarm: 25, farm: 18 }) },
    { p: 0.54, ...stand({ y: ANK - 12, foot: 150, uarm: 12, farm: 6 }) },
    { p: 0.68, ...stand({ y: ANK, foot: 90, shin: 192, thigh: 150, torso: 18, uarm: 110, farm: 100 }) },
    { p: 0.84, ...stand({ shin: 204, thigh: 108, torso: 36, uarm: 100, farm: 92, head: -12 }) },
    { p: 1, ...stand() },
  ],
  aids: [{ k: "arrow", of: "C", off: [10, 0] }],
};
const wallSit = {
  mus: M(["quads"], ["glutes", "abs"]),
  base: { at: "hip", x: 31, torso: 0, head: 0, kb: -1, At: [50.5, ANK], uarm: 168, farm: 28 }, // bras croisés sur la poitrine
  keys: [{ p: 0, y: 64 }, { p: 1, y: 77.3 }],
  gear: [{ k: "wall", x: 21.4, y: 14, back: true }],
  aids: [{ k: "angle", j: "K", a: "H", b: "A", at: 1, label: "90°" }, { k: "arrow", of: "H", off: [5, -9] }],
};
const BOX = { k: "box", x: 64, y: 76, w: 26, back: true };
const ON_BOX = 72.8; // cheville d'un pied posé sur la box
const boxJump = {
  dur: 4400,
  mus: M(["quads", "glutes"], ["calves", "hams"]), loop: true,
  base: { at: "hip", kb: -1, kb2: -1 },
  keys: [
    { p: 0, x: 50, y: 57.8, torso: 0, At: [50, ANK], foot: 90, uarm: 180, farm: 180, head: 0 },
    { p: 0.14, x: 44, y: 70, torso: 40, At: [50, ANK], foot: 90, uarm: 192, farm: 184, head: -14 },
    { p: 0.26, x: 53, y: 53, torso: 12, At: [54, 88.4], foot: 150, uarm: 22, farm: 14, head: -4 },
    { p: 0.36, x: 60, y: 46, torso: 16, At: [62, 64], foot: 155, uarm: 80, farm: 70, head: -6 },
    { p: 0.48, x: 68, y: 51, torso: 38, At: [74, ON_BOX], foot: 90, uarm: 100, farm: 92, head: -12 },
    { p: 0.62, x: 74, y: ON_BOX - 39, torso: 0, At: [74, ON_BOX], foot: 90, uarm: 180, farm: 180, head: 0 },
    { p: 0.74, x: 60, y: 61, torso: 16, At: [74, ON_BOX], foot: 90, A2t: [50, ANK], foot2: 90, uarm: 160, farm: 150, head: -8 },
    { p: 0.82, x: 54, y: 59, torso: 10, At: [66, 69], foot: 120, A2t: [50, ANK], foot2: 90, uarm: 170, farm: 165, head: -4 },
    { p: 0.9, x: 51, y: 58.2, torso: 4, At: [52, ANK - 5], foot: 110, A2t: [50, ANK], foot2: 90, uarm: 178, farm: 176, head: 0 },
    { p: 1, x: 50, y: 57.8, torso: 0, At: [50, ANK], foot: 90, A2t: [50, ANK], foot2: 90, uarm: 180, farm: 180, head: 0 },
  ],
  gear: [BOX],
};
const deepSquat = {
  mus: M(["quads", "glutes", "adductors"], ["calves", "lowerback"]),
  base: { balance: {} },
  keys: [
    { p: 0, ...stand({ uarm: 175, farm: 40 }) },
    { p: 1, ...stand({ shin: 222, thigh: 72, uarm: 150, farm: 20, head: -10 }) },
  ],
  aids: [{ k: "arrow", of: "H", off: [-8, 0] }],
};
const kbGoblet = { ...goblet, gear: [{ k: "kb", at: "W", ang: 180 }] };
const dbLunge = {
  ...lunge,
  keys: lunge.keys.map(k => ({ ...k, uarm: 182, farm: 180, uarm2: 178, farm2: 180 })),
  gear: [db("W2", { back: true }), db("W")],
};
const bulgarian = {
  mus: M(["quads", "glutes"], ["adductors", "hams"]),
  keys: [
    { p: 0, ...stand({ x: 64, torso: 4, A2t: [38, 78], kb2: -1, foot2: 250, uarm: 180, farm: 180 }) },
    { p: 1, ...stand({ x: 64, shin: 200, thigh: 96, torso: 20, A2t: [38, 78], kb2: -1, foot2: 250, uarm: 182, farm: 180, head: -8 }) },
  ],
  gear: [bench(22, 82, 22), db("W")],
  aids: [{ k: "angle", j: "K", a: "H", b: "A", at: 1 }, { k: "arrow", of: "H", off: [0, -9] }],
};
const stepUp = {
  mus: M(["quads", "glutes"], ["hams", "calves"]),
  keys: [
    { p: 0, ...stand({ x: 66, y: 74.8, shin: 195, thigh: 115, torso: 14, A2t: [44, ANK], kb2: -1, foot2: 100, uarm: 200, farm: 190 }) },
    { p: 0.65, ...stand({ x: 66, y: 74.8, shin: 184, thigh: 172, torso: 4, A2t: [55, 72], kb2: -1, foot2: 120, uarm: 172, farm: 168 }) },
    { p: 1, ...stand({ x: 66, y: 74.8, A2t: [63.4, 74.8], kb2: -1, foot2: 90, uarm: 178, farm: 176 }) },
  ],
  gear: [{ k: "box", x: 56, y: 78, w: 26, back: true }],
  aids: [{ k: "arrow", of: "H", off: [-8, 0] }],
};
const SEAT = (x, y, len = 24) => ({ k: "seat", x, y, len, ang: 90, th: 3.6, legs: [[0.5]], back: true });
const legExt = {
  mus: M(["quads"], []),
  base: { at: "hip", x: 40, y: 76, torso: 354, head: -4, thigh: 92, Wt: [44, 79], eb: 1 },
  keys: [{ p: 0, shin: 186, foot: 100 }, { p: 1, shin: 98, foot: 10 }],
  gear: [SEAT(26, 83.3, 28), { k: "pad", x: 31, y: 82, len: 31, ang: 354, th: 4, back: true }, { k: "roll", at: { j: "A", b: ["K", "A"], u: -2.4, n: 4.6 }, r: 3, pivot: "K" }],
  aids: [{ k: "pin", of: "K" }, { k: "arrow", of: "A", off: [6, 0] }],
};
const adductor = {
  view: "front", mus: M(["adductors"], []),
  base: { y: 72, armL: 22, armR: 22, elbowL: 30, elbowR: 30, legL: 90, legR: 90, shinL: -54, shinR: -54 },
  keys: [{ p: 0, lthL: 0.62, lthR: 0.62 }, { p: 1, lthL: 0.12, lthR: 0.12 }],
  gear: [{ k: "rect", x: 26, y: 46, w: 48, h: 31, cls: "pad", rx: 3, back: true }, { k: "kpad" }],
};
const abductor = { ...adductor, mus: M(["abductors", "glutes"], []), keys: [...adductor.keys].reverse().map((k, i) => ({ ...k, p: i })), gear: [adductor.gear[0], { k: "kpad", out: true }] };
const tke = {
  mus: M(["quads"], []),
  keys: [
    { p: 0, ...stand({ shin: 194, thigh: 162, torso: 8, uarm: 195, farm: 120 }) },
    { p: 1, ...stand({ torso: 2, uarm: 195, farm: 120 }) },
  ],
  gear: [{ k: "post", x: 86, y: 64, back: true }, { k: "band", from: [86, 76], to: "K" }],
  aids: [{ k: "arrow", of: "K", off: [-6, 0] }],
};
const legCurl = {
  mus: M(["hams"], ["calves"]),
  base: { at: "hip", x: 50, y: 80.4, torso: 90, head: -14, thigh: 270, uarm: 160, farm: 120 },
  keys: [{ p: 0, shin: 270, foot: 180 }, { p: 1, shin: 378, foot: 290 }],
  gear: [{ k: "pad", x: 22, y: 87.6, len: 70, ang: 90, th: 4, legs: [[0.12], [0.88]], back: true }, { k: "roll", at: { j: "A", b: ["K", "A"], u: -2.2, n: -4.4 }, r: 3, pivot: "K" }],
  aids: [{ k: "pin", of: "K" }, { k: "arrow", of: "A", off: [0, -6] }],
};
const seatedLegCurl = {
  mus: M(["hams"], ["calves"]),
  base: { at: "hip", x: 40, y: 76, torso: 352, head: -4, thigh: 92, Wt: [44, 79], eb: 1 },
  keys: [{ p: 0, shin: 94, foot: 5 }, { p: 1, shin: 198, foot: 112 }],
  gear: [SEAT(26, 83.3, 28), { k: "pad", x: 31, y: 82, len: 31, ang: 352, th: 4, back: true }, { k: "roll", at: { j: "K", b: ["H", "K"], u: -5, n: 7.6 }, r: 2.6 },
    { k: "roll", at: { j: "A", b: ["K", "A"], u: -2.4, n: -4.4 }, r: 3, pivot: "K" }],
  aids: [{ k: "pin", of: "K" }, { k: "arrow", of: "A", off: [0, 6] }],
};
const nordic = {
  mus: M(["hams"], ["glutes", "lowerback"]),
  base: { at: "knee", x: 46, y: 95.6, shin: 285, foot: 175 },
  keys: [
    { p: 0, thigh: 180, torso: 0, uarm: 160, farm: 40 },
    { p: 0.82, thigh: 236, torso: 56, Wt: [86, 96], head: 10 },
    { p: 1, thigh: 244, torso: 64, Wt: [88, 98], head: 14 },
  ],
  gear: [{ k: "mat", x: 30, w: 30 }, { k: "roll", at: { j: "heel", dx: 0.6, dy: -4 }, r: 2.8 }],
  aids: [{ k: "line", from: "K", to: "S", ext: 0.06 }, { k: "arrow", of: "S", off: [0, -7] }],
};
const CALF_BLOCK = { k: "box", x: 52, y: 92, w: 18, back: true };
const calf = {
  mus: M(["calves"], []), xrot: true,
  base: { at: "toe", x: 63, y: 92, torso: 0, Wr: [2.4, 3], eb: -1 },
  keys: [{ p: 0, foot: 68 }, { p: 1, foot: 124 }],
  gear: [CALF_BLOCK, { k: "post", x: 38, y: 12, back: true }, { k: "roll", at: { j: "S", u: 2.4, n: -0.8 }, r: 2.8, pivot: { j: "S", u: 2.4, n: -11 } }],
  aids: [{ k: "arrow", of: "heel", off: [-6, 0] }],
};
const seatedCalf = {
  mus: M(["calves"], []),
  base: { at: "hip", x: 35.1, y: 72.8, torso: 0, head: 0, kb: -1, Wt: [50, 64], eb: 1 },
  keys: [{ p: 0, At: [54.6, 92.3], foot: 68 }, { p: 1, At: [58.2, 84.6], foot: 122 }],
  gear: [SEAT(22, 80, 22), { k: "box", x: 56, y: 92, w: 16, back: true }, { k: "roll", at: { j: "K", b: ["H", "K"], u: -3, n: 7.4 }, r: 2.8 }],
  aids: [{ k: "arrow", of: "heel", off: [-6, 0] }],
};
const pressCalf = {
  ...legPress, mus: M(["calves"], []),
  keys: [{ p: 0, At: [71.5, 63.9], foot: -30 }, { p: 1, At: [71.5, 63.9], foot: 12 }],
  gear: legPress.gear.map(g => (g.k === "sled" ? { ...g, ang: 325 } : g)),
  aids: [{ k: "arrow", of: "toe", off: [4, -4] }],
};
const calfBw = {
  mus: M(["calves"], []),
  base: { at: "toe", x: 58, y: 88, torso: 0, Wt: [79, 44], eb: -1 },
  keys: [{ p: 0, foot: 60 }, { p: 1, foot: 125 }],
  gear: [{ k: "box", x: 48, y: 88, w: 22, back: true }, { k: "wall", x: 81, y: 10, back: true }],
  aids: [{ k: "arrow", of: "heel", off: [-6, 0] }],
};

/* ---------- Charnière de hanche, fessiers ---------- */
const dbRdl = { ...rdl, gear: [db("W2", { back: true }), db("W")], aids: rdl.aids.filter(a => a.k !== "path") };
const goodMorning = {
  mus: M(["hams", "glutes", "lowerback"], ["abs"]), xrot: true,
  base: { balance: { of: { j: "back" }, load: 0.6, by: "ankle", min: -16, max: 16 } },
  keys: [
    { p: 0, ...stand({ torso: 4, ...SQ_ARMS, head: -2 }) },
    { p: 1, ...stand({ shin: 180, thigh: 158, torso: 72, ...SQ_ARMS, head: -14 }) },
  ],
  gear: [plate({ j: "back" })],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "H", off: [-8, 0] }],
};
const sumo = {
  mus: M(["glutes", "quads", "adductors"], ["hams", "lowerback", "traps", "forearms"]),
  base: { Wv: MIDFOOT },
  keys: [
    { p: 0, ...stand({ shin: 196, thigh: 103, lthigh: 0.8, torso: 55, head: -18 }) },
    { p: 1, ...stand({ lthigh: 1, torso: 0, head: 0 }) },
  ],
  gear: [plate({ j: "W", dy: 1.6 })],
  aids: [{ k: "path", of: { j: "W", dy: 1.6 } }, { k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "W", off: [-14, 0] }],
};
const kbSwing = {
  dur: 1800,
  mus: M(["glutes", "hams"], ["lowerback", "abs", "delts", "forearms"]), loop: true,
  keys: [
    { p: 0, ...stand({ uarm: 92, farm: 90 }) },
    { p: 0.22, ...stand({ uarm: 170, farm: 172, torso: 6 }) },
    { p: 0.45, ...stand({ shin: 190, thigh: 152, torso: 64, uarm: 205, farm: 208, head: -16 }) },
    { p: 0.68, ...stand({ shin: 184, thigh: 172, torso: 18, uarm: 150, farm: 150 }) },
    { p: 1, ...stand({ uarm: 92, farm: 90 }) },
  ],
  gear: [{ k: "kb", at: "W" }],
  aids: [{ k: "path", of: "W" }],
};
const backExt = {
  mus: M(["lowerback", "glutes"], ["hams"]),
  base: { at: "hip", x: 50, y: 58, thigh: 225, shin: 225, foot: 135, Wr: [-5, 4.5], eb: 1 },
  keys: [{ p: 0, torso: 150, head: 0 }, { p: 1, torso: 45, head: 0 }],
  gear: [{ k: "pad", x: 58.4, y: 60.6, len: 12, ang: 225, th: 4, back: true }, { k: "post", x: 52, y: 70, back: true }, { k: "post", x: 36, y: 86, x2: 52, y2: 70, back: true },
    { k: "line", from: { j: "heel", dx: -1.6, dy: 1.6 }, to: { j: "toe", dx: -1.6, dy: 1.6 }, cls: "frame thick", back: true }, { k: "roll", at: { j: "A", dx: 2.4, dy: -1.2 }, r: 2.2 }],
  aids: [{ k: "line", from: "A", to: "S", ext: 0.04, at: 1 }, { k: "arrow", of: "S", off: [4, 4] }],
};
const superman = {
  mus: M(["lowerback", "glutes"], ["hams", "delts", "traps"]),
  base: { at: "hip", x: 46, y: 93.6, thigh: 270, shin: 270, foot: 245 },
  keys: [
    { p: 0, torso: 90, uarm: 90, farm: 90, head: -4, thigh: 270, shin: 270 },
    { p: 1, torso: 80, uarm: 76, farm: 74, head: -8, thigh: 278, shin: 280 },
  ],
  gear: [{ k: "mat", x: 4, w: 108 }],
  aids: [{ k: "arrow", of: "W", off: [0, -6] }, { k: "arrow", of: "A", off: [0, -6] }],
};
const seatedFold = {
  mus: M(["hams"], ["lowerback", "calves"]),
  base: { at: "hip", x: 36, y: 93.4, thigh: 90, shin: 90, foot: 0 },
  keys: [
    { p: 0, torso: 0, uarm: 70, farm: 75, head: 0 },
    { p: 1, torso: 58, spine: 36, Wt: [78, 87], head: 14 },
  ],
  gear: [{ k: "mat", x: 18, w: 76 }],
  aids: [{ k: "arrow", of: "S", off: [2, -8] }],
};
const inchworm = {
  dur: 6400,
  mus: M(["hams", "abs"], ["delts", "pecs", "triceps"]), loop: true,
  base: { at: "toe", x: 40, y: 100, hand: -90 },
  keys: [
    { p: 0, foot: 90, uarm: 180, farm: 180 },
    { p: 0.2, foot: 90, thigh: 174, shin: 180, torso: 140, spine: 30, head: 10, Wt: [52, 98] },
    { p: 0.5, foot: 160, thigh: 254, shin: 254, torso: 74, Wt: [100, 98] },
    { p: 0.8, foot: 90, thigh: 174, shin: 180, torso: 140, spine: 30, head: 10, Wt: [52, 98] },
    { p: 1, foot: 90, uarm: 180, farm: 180 },
  ],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const downDog = {
  mus: M(["hams", "calves", "delts"], ["lats", "lowerback"]),
  base: { at: "wrist", x: 80, y: 96.6, hand: -90, At: [20, 91.4], kb: -1 },
  keys: [
    { p: 0, farm: 182, uarm: 180, torso: 74, foot: 160 },
    { p: 1, farm: 138, uarm: 138, torso: 138, foot: 104, head: -6 },
  ],
  gear: [{ k: "mat", x: 6, w: 92 }],
  aids: [{ k: "line", from: "H", to: "W", ext: 0.04, at: 1 }, { k: "arrow", of: "H", off: [0, -8] }],
};
const gluteBridge = {
  mus: M(["glutes"], ["hams", "abs"]),
  base: { at: "shoulder", x: 30, y: 94.4, head: 0, At: [72, ANK], kb: -1, uarm: 90, farm: 90, hand: 0 },
  keys: [{ p: 0, torso: 270, head: 0 }, { p: 1, torso: 248, head: 22 }],
  gear: [{ k: "mat", x: 8, w: 76 }],
  aids: [{ k: "line", from: "S", to: "K", ext: 0.05, at: 1 }, { k: "arrow", of: "H", off: [0, 6] }],
};
const pelvicTilt = {
  ...gluteBridge, mus: M(["abs", "glutes"], ["lowerback"]),
  keys: [{ p: 0, torso: 270, spine: -46 }, { p: 1, torso: 266, spine: 16, head: 4 }],
  aids: [{ k: "arrow", of: { j: "H", u: 7, n: -7 }, off: [0, -6] }],
};
const clamshell = {
  view: "front", mus: M(["abductors", "glutes"], []),
  base: { x: 50, y: 89.5, rot: 90, lthL: 0.71, lthR: 0.71, lshR: 0.71, legR: 4, shinR: -2.4, armL: 12, elbowL: -70, armR: 172, elbowR: 40, head: -6 },
  keys: [{ p: 0, legL: 4, shinL: -2.4, lshL: 0.71 }, { p: 1, legL: 40, shinL: -64.6, lshL: 0.7 }],
  gear: [{ k: "rect", x: 10, y: 98.6, w: 92, h: 1.4, cls: "mat" }],
};
const bandWalk = {
  dur: 2400,
  view: "front", mus: M(["abductors", "glutes"], ["quads"]), loop: true,
  base: { y: FSTAND_Y + 5, kneeL: 40, kneeR: 40, armL: 14, armR: 14, elbowL: -40, elbowR: -40 },
  keys: [
    { p: 0, legL: 7, legR: 7 },
    { p: 0.3, legL: 7, legR: 24, y: FSTAND_Y + 4 },
    { p: 0.5, legL: 14, legR: 14, x: 53 },
    { p: 0.8, legL: 5, legR: 14, x: 53, y: FSTAND_Y + 4 },
    { p: 1, legL: 7, legR: 7 },
  ],
  gear: [{ k: "band", ankles: true, sag: 0.6 }],
};
const gluteMachine = {
  mus: M(["glutes"], ["hams"]),
  base: { at: "hip", x: 50, y: 58, torso: 40, head: -10, A2t: [52, ANK], kb2: -1, Wt: [74, 52], eb: 1, foot: 130, foot2: 90 },
  keys: [{ p: 0, thigh: 150, shin: 205 }, { p: 1, thigh: 215, shin: 240 }],
  gear: [{ k: "pad", x: 63, y: 55, len: 14, ang: 40, th: 3.6, back: true }, { k: "post", x: 78, y: 30, back: true }, { k: "roll", at: { j: "A", b: ["K", "A"], u: 1, n: -4 }, r: 2.6, pivot: { j: "H", dx: 2, dy: 6 } }],
  aids: [{ k: "arrow", of: "A", off: [-6, 0] }],
};
const cableKickback = {
  mus: M(["glutes"], ["hams"]),
  base: { at: "hip", x: 50, y: 58, torso: 18, head: -6, A2t: [53, ANK], kb2: -1, Wt: [76, 50], eb: 1, foot2: 90 },
  keys: [{ p: 0, thigh: 184, shin: 186, foot: 95 }, { p: 1, thigh: 216, shin: 222, foot: 135 }],
  gear: [{ k: "cable", from: [84, 96], to: "A", post: [88, 30, 88, 100], back: true }],
  aids: [{ k: "arrow", of: "A", off: [-6, 0] }],
};

/* ---------- Poussée ---------- */
const BENCH = { at: "hip", x: 62, y: 74.4, torso: 270, head: 0, At: [76, ANK], kb: -1 };
const benchPress = {
  mus: M(["pecs", "triceps"], ["delts"]),
  base: BENCH,
  keys: [
    { p: 0, Wt: [37.6, 47.6], luarm: 1 },
    { p: 1, Wt: [40, 66.6], luarm: 0.55, eb: 1 },
  ],
  gear: [bench(22, 81.4, 46), plate({ j: "W", dy: -0.6 })],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [10, 0] }],
};
const ohp = {
  mus: M(["delts", "triceps"], ["traps", "abs", "pecs"]),
  keys: [
    { p: 0, ...stand({ torso: -2, Wt: [56, 32], luarm: 0.75, head: -4 }) },
    { p: 1, ...stand({ torso: 0, Wt: [MIDFOOT, 6], luarm: 1, head: 0 }) },
  ],
  gear: [plate({ j: "W", dy: -1 }, 9)],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [10, 0] }],
};
const pushup = {
  mus: M(["pecs", "triceps"], ["delts", "abs"]),
  base: { at: "toe", x: 20, y: 99.6, hand: -90 },
  keys: [
    { p: 0, thigh: 251, shin: 251, foot: 161, torso: 70, Wt: [84, 98] },
    { p: 1, thigh: 267, shin: 267, foot: 177, torso: 87, Wt: [84, 98], luarm: 0.75 },
  ],
  aids: [{ k: "line", from: "S", to: "A", ext: 0.08 }, { k: "arrow", of: "S", off: [0, -9] }],
};
const DIP_BARS = [{ k: "post", x: 30, y: 42, x2: 74, y2: 42, back: true }, { k: "post", x: 34, y: 42, back: true }, { k: "post", x: 70, y: 42, back: true }];
const dips = {
  mus: M(["triceps", "pecs"], ["delts"]),
  base: { at: "shoulder", Wt: [52, 40.4], eb: 1, hand: 0, thigh: 172, shin: 212, foot: 150 },
  keys: [
    { p: 0, x: 52, y: 13.8, torso: 4 },
    { p: 1, x: 55, y: 24.4, torso: 20, head: -6 },
  ],
  gear: DIP_BARS,
  aids: [{ k: "angle", j: "E", a: "S", b: "W", at: 1 }, { k: "arrow", of: "S", off: [-9, 0] }],
};

const INCLINE = { at: "hip", x: 58, y: 72, torso: 308, head: 6, At: [72, ANK], kb: -1 };
const inclinePads = [{ k: "pad", x: 54.4, y: 77.4, len: 33, ang: 308, th: 4, legs: [[0.1, 56, 100], [0.75]], back: true }, { k: "pad", x: 50, y: 79.4, len: 16, ang: 90, th: 3.6, back: true }];
const incline = {
  mus: M(["pecs", "delts"], ["triceps"]), base: INCLINE,
  keys: [{ p: 0, Wt: [41, 31], eb: 1 }, { p: 1, Wt: [46, 52.5], luarm: 0.55, eb: 1 }],
  gear: [...inclinePads, plate({ j: "W", dy: -0.6 })],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [10, 0] }],
};
const DECLINE = { at: "hip", x: 60, y: 70, torso: 252, head: 8, thigh: 66, shin: 172, foot: 84 };
const decline = {
  mus: M(["pecs", "triceps"], ["delts"]), base: DECLINE,
  keys: [{ p: 0, Wt: [41, 52], eb: 1 }, { p: 1, Wt: [42, 70.5], luarm: 0.55, eb: 1 }],
  gear: [{ k: "pad", x: 66, y: 74.4, len: 46, ang: 252, th: 4, legs: [[0.15], [0.85]], back: true }, { k: "roll", at: { j: "A", dx: 3, dy: -2 }, r: 2.4 }, plate({ j: "W", dy: -0.6 })],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [10, 0] }],
};
const dbBench = { ...benchPress, gear: [benchPress.gear[0], db("W2", { back: true }), db("W")] };
const inclineDb = { ...incline, gear: [...inclinePads, db("W2", { back: true }), db("W")] };
const smithBench = { ...benchPress, keys: [{ p: 0, Wt: [40, 47.6], luarm: 1 }, { p: 1, Wt: [40, 66.6], luarm: 0.55, eb: 1 }], gear: [{ k: "rail", x: 40, y: 10, back: true }, ...benchPress.gear] };
const smithIncline = { ...incline, keys: [{ p: 0, Wt: [44, 31], eb: 1 }, { p: 1, Wt: [44, 52.5], luarm: 0.55, eb: 1 }], gear: [{ k: "rail", x: 44, y: 6, back: true }, ...incline.gear] };
const SEATED = { at: "hip", x: 44, y: 77.3, thigh: 90, shin: 180, foot: 90 };
const seatBack = (x = 44, ang = 356) => [{ k: "pad", x: x - 13, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, { k: "pad", x: x - 7, y: 84, len: 30, ang, th: 4, back: true }];
const chestPress = {
  mus: M(["pecs", "triceps"], ["delts"]),
  base: { ...SEATED, torso: 354, head: 0 },
  keys: [{ p: 0, Wt: [55, 51], eb: 1, luarm: 0.7 }, { p: 1, Wt: [72, 51], eb: 1, luarm: 1 }],
  gear: [...seatBack(), { k: "line", from: [64, 14], to: "W", cls: "frame thick", back: true }, { k: "post", x: 64, y: 12, back: true }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const inclineMachine = { ...chestPress, keys: [{ p: 0, Wt: [55, 49], eb: 1, luarm: 0.7 }, { p: 1, Wt: [70, 33], eb: 1, luarm: 1 }], gear: [...seatBack(), { k: "line", from: [50, 8], to: "W", cls: "frame thick", back: true }, { k: "post", x: 50, y: 6, back: true }] };
const bandPress = {
  mus: M(["pecs", "triceps"], ["delts", "abs"]),
  keys: [
    { p: 0, ...stand({ torso: 6, Wt: [58, 45], eb: 1, luarm: 0.75, A2t: [40, ANK], foot2: 110 }) },
    { p: 1, ...stand({ torso: 6, Wt: [77, 44], eb: 1, A2t: [40, ANK], foot2: 110 }) },
  ],
  gear: [{ k: "post", x: 18, y: 36, back: true }, { k: "band", from: [18, 45], to: "W" }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const inclinePushup = {
  mus: M(["pecs", "triceps"], ["delts", "abs"]),
  base: { at: "toe", x: 2, y: 99.6, hand: -90 },
  keys: [
    { p: 0, thigh: 233, shin: 233, foot: 143, torso: 53, Wt: [62, 76.6] },
    { p: 1, thigh: 249, shin: 249, foot: 159, torso: 69, Wt: [62, 76.6], luarm: 0.8 },
  ],
  gear: [{ k: "box", x: 54, y: 78, w: 30, back: true }],
  aids: [{ k: "line", from: "S", to: "A", ext: 0.08 }, { k: "arrow", of: "S", off: [-6, -6] }],
};
const declinePushup = {
  mus: M(["pecs", "delts"], ["triceps", "abs"]),
  base: { at: "toe", x: 22, y: 64, hand: -90, Wt: [87, 98] },
  keys: [
    { p: 0, thigh: 285, shin: 285, foot: 189, torso: 105 },
    { p: 1, thigh: 302, shin: 302, foot: 206, torso: 122, luarm: 0.75 },
  ],
  gear: [{ k: "box", x: 2, y: 64, w: 26, back: true }],
  aids: [{ k: "line", from: "S", to: "A", ext: 0.08 }, { k: "arrow", of: "S", off: [0, -9] }],
};
const pike = {
  mus: M(["delts", "triceps"], ["pecs", "traps"]),
  base: { at: "toe", x: 40, y: 100, foot: 125, hand: -90, Wt: [76, 98] },
  keys: [
    { p: 0, thigh: 200, shin: 200, torso: 146, head: 0 },
    { p: 1, thigh: 214, shin: 214, torso: 172, head: -18 },
  ],
  aids: [{ k: "arrow", of: "C", off: [7, 0] }],
};
const DB_SEAT = [{ k: "pad", x: 31, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, { k: "pad", x: 37, y: 84, len: 34, ang: 0, th: 4, back: true }];
const dbPress = {
  mus: M(["delts", "triceps"], ["traps", "pecs"]),
  base: { ...SEATED, torso: 0, head: 0 },
  keys: [{ p: 0, Wt: [55, 37], luarm: 0.65 }, { p: 1, Wt: [50, 9] }],
  gear: [...DB_SEAT, db("W2", { back: true }), db("W")],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [9, 0] }],
};
const arnold = {
  view: "front", mus: M(["delts"], ["triceps", "traps"]),
  base: { y: 77.3 - 1, lthL: 0.3, lthR: 0.3, legL: 12, legR: 12, shinL: -7, shinR: -7 },
  keys: [
    { p: 0, armL: 20, armR: 20, elbowL: 150, elbowR: 150, luaL: 0.6, luaR: 0.6 },
    { p: 0.5, armL: 82, armR: 82, elbowL: 88, elbowR: 88 },
    { p: 1, armL: 166, armR: 166, elbowL: 8, elbowR: 8 },
  ],
  gear: [{ k: "rect", x: 30, y: 79, w: 40, h: 4, cls: "pad seat", back: true }, { k: "db" }],
};
const shoulderMachine = {
  mus: M(["delts", "triceps"], ["traps"]),
  base: { ...SEATED, torso: 0, head: 0 },
  keys: [{ p: 0, Wt: [56, 36], luarm: 0.7 }, { p: 1, Wt: [53, 12] }],
  gear: [...DB_SEAT, { k: "line", from: [24, 22], to: "W", cls: "frame thick", back: true }, { k: "post", x: 24, y: 20, back: true }],
  aids: [{ k: "arrow", of: "W", off: [9, 0] }],
};
const smithOhp = { ...dbPress, keys: [{ p: 0, Wt: [53, 35], luarm: 0.65 }, { p: 1, Wt: [53, 9] }], gear: [...DB_SEAT, { k: "rail", x: 53, y: 2, back: true }, plate({ j: "W", dy: -1 })] };
const kbPress = {
  mus: M(["delts", "triceps"], ["abs", "traps"]),
  keys: [
    { p: 0, ...stand({ Wt: [56, 33], luarm: 0.8, uarm2: 180, farm2: 180 }) },
    { p: 1, ...stand({ Wt: [MIDFOOT, 7], uarm2: 180, farm2: 180 }) },
  ],
  gear: [{ k: "kb", at: "W", rel: 180 }],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [9, 0] }],
};
const benchDips = {
  mus: M(["triceps"], ["pecs", "delts"]),
  base: { at: "wrist", x: 42, y: 77, hand: 180, At: [70, 95.4], kb: -1, foot: 70 },
  keys: [{ p: 0, farm: 180, uarm: 180, torso: 2 }, { p: 1, farm: 172, uarm: 250, torso: 10, head: -4 }],
  gear: [{ k: "pad", x: 14, y: 80.6, len: 30, ang: 90, th: 4, legs: [[0.15], [0.85]], back: true }],
  aids: [{ k: "angle", j: "E", a: "S", b: "W", at: 1 }, { k: "arrow", of: "H", off: [6, 0] }],
};
const dipMachine = {
  mus: M(["triceps"], ["pecs", "delts"]),
  base: { ...SEATED, torso: 4, head: 0 },
  keys: [{ p: 0, Wt: [52, 50], eb: 1, luarm: 0.85 }, { p: 1, Wt: [50, 77], eb: 1 }],
  gear: [...DB_SEAT, { k: "line", from: [22, 52], to: "W", cls: "frame thick", back: true }],
  aids: [{ k: "arrow", of: "W", off: [8, 0] }],
};

/* ---------- Tirage ---------- */
const row = {
  mus: M(["lats", "traps"], ["biceps", "delts", "lowerback", "hams"]),
  keys: [
    { p: 0, ...stand({ shin: 177, thigh: 152, torso: 55, Wt: [MIDFOOT, 72.6], head: -20 }) },
    { p: 1, ...stand({ shin: 177, thigh: 152, torso: 55, Wt: [MIDFOOT, 58.4], head: -20 }) },
  ],
  gear: [plate({ j: "W", dy: 1.4 })],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "W", off: [7, 0] }],
};
const pullup = {
  mus: M(["lats", "biceps"], ["traps", "forearms", "abs", "delts"]),
  base: { at: "shoulder", Wt: [52, 4.4], eb: 1, hand: 0, thigh: 188, shin: 222, foot: 150 },
  keys: [
    { p: 0, x: 51, y: 31.2, torso: -4 },
    { p: 1, x: 48.6, y: 9.4, torso: -16, head: -12, luarm: 0.8 },
  ],
  gear: [{ k: "post", x: 72, y: 2, back: true }, { k: "post", x: 52, y: 2, x2: 72, y2: 2, back: true }, { k: "bar", x: 52, y: 4, r: 1.8, post: false }],
  aids: [{ k: "arrow", of: "C", off: [11, 0] }],
};
const latPull = {
  mus: M(["lats", "biceps"], ["traps", "delts"]),
  base: { at: "hip", x: 46, y: 80, head: -8, At: [66, ANK], kb: -1 },
  keys: [
    { p: 0, torso: -4, Wt: [55, 32] },
    { p: 1, torso: -16, Wt: [58, 54], luarm: 0.78 },
  ],
  gear: [{ k: "seat", x: 36, y: 84.6, len: 18, ang: 90, th: 4, legs: [[0.5]], back: true }, { k: "pad", x: 56, y: 70.4, len: 8, ang: 90, th: 3.4, back: true },
    { k: "cable", from: [58, 16], to: "W", post: [76, 12, 76, 100], back: true }],
  aids: [{ k: "arrow", of: "W", off: [8, 0] }],
};
const cableRow = {
  mus: M(["lats", "traps"], ["biceps", "delts", "lowerback"]),
  base: { at: "hip", x: 38, y: 86, head: 0, At: [70, 88], kb: -1, foot: 20 },
  keys: [
    { p: 0, torso: 22, Wt: [78, 78], eb: 1 },
    { p: 1, torso: -6, Wt: [56, 77], eb: 1 },
  ],
  gear: [{ k: "seat", x: 20, y: 90.4, len: 66, ang: 90, th: 4, back: true }, { k: "pad", x: 72, y: 86, len: 9, ang: 0, th: 3, back: true },
    { k: "cable", from: [90, 82], to: "W", post: [94, 60, 94, 100], back: true }],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "W", off: [0, -7] }],
};

const assistedPullup = {
  ...pullup, mus: M(["lats", "biceps"], ["traps", "delts"]),
  base: { ...pullup.base, thigh: 180, shin: 270, foot: 180 },
  keys: [{ p: 0, x: 51, y: 31.2, torso: -2 }, { p: 1, x: 49.4, y: 9.4, torso: -10, head: -10, luarm: 0.8 }],
  gear: [{ k: "bar", x: 52, y: 4, r: 1.8, post: false }, { k: "post", x: 72, y: 0, back: true }, { k: "post", x: 52, y: 2, x2: 72, y2: 2, back: true },
    { k: "pad", at: { j: "K", dx: 2, dy: 4.4 }, ang: 270, len: 22, th: 3, back: true }, { k: "line", from: { j: "K", dx: 2, dy: 6 }, to: [72, 92], cls: "frame", back: true }],
};
const straightPulldown = {
  mus: M(["lats"], ["triceps", "abs", "delts"]),
  keys: [
    { p: 0, ...stand({ shin: 186, thigh: 168, torso: 26, uarm: 42, farm: 40, head: -6 }) },
    { p: 1, ...stand({ shin: 186, thigh: 168, torso: 26, uarm: 172, farm: 170, head: -6 }) },
  ],
  gear: [{ k: "cable", from: [82, 12], to: "W", post: [86, 8, 86, 100], back: true }],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const tbarRow = {
  mus: M(["lats", "traps"], ["biceps", "lowerback", "hams", "delts"]),
  keys: [
    { p: 0, ...stand({ shin: 178, thigh: 153, torso: 50, Wt: [MIDFOOT, 70.9], head: -18 }) },
    { p: 1, ...stand({ shin: 178, thigh: 153, torso: 50, Wt: [MIDFOOT, 57.8], head: -18 }) },
  ],
  gear: [{ k: "line", from: [4, 99], to: { j: "W", dx: 7, dy: 1.6 }, cls: "frame thick", back: true }, plate({ j: "W", dx: 6, dy: 1.6 }, 7, { back: true })],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.25 }, { k: "arrow", of: "W", off: [8, -4] }],
};
const machineRow = {
  mus: M(["lats", "traps"], ["biceps", "delts"]),
  base: { ...SEATED, x: 40, torso: 8, head: 0 },
  keys: [{ p: 0, Wt: [77, 56], eb: 1 }, { p: 1, Wt: [56, 60], eb: 1, luarm: 0.9 }],
  gear: [{ k: "pad", x: 27, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, { k: "pad", x: 60, y: 76, len: 22, ang: 4, th: 4, back: true },
    { k: "line", from: [84, 96], to: "W", cls: "frame thick", back: true }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const dbRow = {
  mus: M(["lats", "traps"], ["biceps", "delts", "lowerback"]),
  base: { at: "hip", x: 40, y: 57.4, torso: 88, head: -14, thigh2: 172, shin2: 268, foot2: 178, At: [44, ANK], kb: -1, W2t: [66, 79], eb2: 1 },
  keys: [{ p: 0, Wt: [65, 84], eb: 1 }, { p: 1, Wt: [52, 63], eb: 1 }],
  gear: [{ k: "pad", x: 28, y: 83, len: 46, ang: 90, th: 4, legs: [[0.12], [0.88]], back: true }, db("W")],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.2 }, { k: "arrow", of: "W", off: [8, 0] }],
};
const chestRow = {
  mus: M(["lats", "traps"], ["biceps", "delts"]),
  base: { at: "hip", x: 42, y: 66, torso: 52, head: -10, At: [30, 90], kb: -1, foot: 150 },
  keys: [{ p: 0, Wt: [64, 84], eb: 1 }, { p: 1, Wt: [54, 68], eb: 1, luarm: 0.9 }],
  gear: [{ k: "pad", x: 46, y: 75, len: 34, ang: 52, th: 4, legs: [[0.15, 50, 100], [0.7]], back: true }, db("W2", { back: true }), db("W")],
  aids: [{ k: "arrow", of: "W", off: [8, 0] }],
};
const invertedRow = {
  mus: M(["lats", "traps"], ["biceps", "delts", "abs"]),
  base: { at: "ankle", x: 84, y: 96.1, foot: 15, Wt: [37, 48] },
  keys: [{ p: 0, thigh: 112, shin: 112, torso: 292, head: 4 }, { p: 1, thigh: 125, shin: 125, torso: 305, head: 8 }],
  gear: [{ k: "post", x: 40, y: 36, back: true }, { k: "bar", x: 37, y: 48, r: 1.8, post: false }],
  aids: [{ k: "line", from: "A", to: "S", ext: 0.06 }, { k: "arrow", of: "S", off: [0, -8] }],
};
const bandRow = {
  mus: M(["lats", "traps"], ["biceps", "delts"]),
  base: { at: "hip", x: 36, y: 93.4, thigh: 90, shin: 90, foot: 0, head: 0 },
  keys: [{ p: 0, torso: 8, Wt: [70, 78], eb: 1 }, { p: 1, torso: -4, Wt: [43, 76], eb: 1, luarm: 0.9 }],
  gear: [{ k: "mat", x: 18, w: 76 }, { k: "band", from: { j: "toe", dx: 1 }, to: "W" }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};

/* ---------- Écartés, élévations, haussements ---------- */
const pecDeck = {
  view: "front", mus: M(["pecs"], ["delts"]),
  base: { y: 76.3, lthL: 0.3, lthR: 0.3, legL: 12, legR: 12, shinL: -7, shinR: -7, armL: 88, armR: 88, elbowL: 92, elbowR: 92 },
  keys: [{ p: 0, luaL: 1, luaR: 1 }, { p: 1, luaL: 0.22, luaR: 0.22 }],
  gear: [{ k: "rect", x: 38, y: 32, w: 24, h: 46, cls: "pad", rx: 3, back: true }, { k: "rect", x: 30, y: 78, w: 40, h: 4, cls: "pad seat", back: true }],
};
const cableFly = {
  view: "front", mus: M(["pecs"], ["delts", "biceps"]),
  keys: [{ p: 0, armL: 100, armR: 100, elbowL: 16, elbowR: 16 }, { p: 1, armL: 26, armR: 26, elbowL: -36, elbowR: -36, luaL: 0.8, luaR: 0.8, lfaL: 0.8, lfaR: 0.8 }],
  gear: [{ k: "cable", from: [[6, 12], [94, 12]], post: [[4, 6, 4, 100], [96, 6, 96, 100]] }],
};
const lowFly = {
  ...cableFly,
  keys: [{ p: 0, armL: 40, armR: 40, elbowL: 10, elbowR: 10 }, { p: 1, armL: -38, armR: -38, elbowL: 0, elbowR: 0, luaL: 0.32, luaR: 0.32, lfaL: 0.32, lfaR: 0.32 }],
  gear: [{ k: "cable", from: [[6, 92], [94, 92]], post: [[4, 6, 4, 100], [96, 6, 96, 100]] }],
};
const dbFly = {
  label: "Vue de dessus",
  view: "front", mus: M(["pecs"], ["delts", "biceps"]), noFloor: true,
  base: { x: 56, y: 60, rot: -90, legL: 12, legR: 12, lshL: 0.3, lshR: 0.3 },
  keys: [{ p: 0, armL: 90, armR: 90, elbowL: 0, elbowR: 0, luaL: 0.14, luaR: 0.14, lfaL: 0.14, lfaR: 0.14 }, { p: 1, armL: 90, armR: 90, elbowL: 14, elbowR: 14, luaL: 0.95, luaR: 0.95, lfaL: 0.9, lfaR: 0.9 }],
  gear: [{ k: "rect", x: 22, y: 54.4, w: 44, h: 11.2, cls: "pad", rx: 2.4, back: true }, { k: "db" }],
};
const pullover = {
  mus: M(["lats", "pecs"], ["triceps", "abs"]), base: BENCH,
  keys: [{ p: 0, uarm: 4, farm: 0 }, { p: 1, uarm: -68, farm: -78 }],
  gear: [bench(22, 81.4, 46), { k: "db", at: "W", r: 4.4 }],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [0, -6] }],
};
const BACK_ARMS = [{ p: 0, armL: 14, armR: 14, elbowL: 6, elbowR: 6, luaL: 0.3, luaR: 0.3, lfaL: 0.3, lfaR: 0.3 }, { p: 1, armL: 90, armR: 90, elbowL: 10, elbowR: 10 }];
const reversePecDeck = {
  view: "front", back: true, mus: M(["delts", "traps"], ["lats"]),
  base: { y: 76.3, lthL: 0.3, lthR: 0.3, legL: 12, legR: 12, shinL: -7, shinR: -7 },
  keys: [{ p: 0, armL: 88, armR: 88, elbowL: 0, elbowR: 0, luaL: 0.2, luaR: 0.2, lfaL: 0.2, lfaR: 0.2 }, { p: 1, armL: 90, armR: 90, elbowL: 6, elbowR: 6 }],
  gear: [{ k: "rect", x: 30, y: 78, w: 40, h: 4, cls: "pad seat", back: true }],
};
const rearDelt = { view: "front", back: true, mus: M(["delts", "traps"], ["lats"]), base: { y: FSTAND_Y + 2, kneeL: 24, kneeR: 24 }, keys: BACK_ARMS, gear: [{ k: "db" }] };
const bandPullApart = {
  view: "front", mus: M(["delts", "traps"], []),
  keys: [{ p: 0, armL: 88, armR: 88, elbowL: 0, elbowR: 0, luaL: 0.2, luaR: 0.2, lfaL: 0.2, lfaR: 0.2 }, { p: 1, armL: 90, armR: 90, elbowL: 4, elbowR: 4 }],
  gear: [{ k: "band", sag: 0.4 }],
};
const facePull = {
  mus: M(["delts", "traps"], ["biceps"]), xrot: true,
  keys: [
    { p: 0, ...stand({ torso: -4, Wt: [76, 34], eb: -1, A2t: [40, ANK], foot2: 110 }) },
    { p: 1, ...stand({ torso: -4, Wt: [58, 26], eb: -1, luarm: 0.75, A2t: [40, ANK], foot2: 110 }) },
  ],
  gear: [{ k: "cable", from: [90, 30], to: "W", post: [94, 10, 94, 100], back: true }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const cableLateral = {
  view: "front", mus: M(["delts"], ["traps"]),
  base: { armR: 24, elbowR: 4 },
  keys: [{ p: 0, armL: 18, elbowL: -14 }, { p: 1, armL: 90, elbowL: -6 }],
  gear: [{ k: "cable", from: [[86, 94]], to: ["WL"], post: [[90, 30, 90, 100]] }],
};
const lateralMachine = {
  view: "front", mus: M(["delts"], ["traps"]),
  base: { y: 76.3, lthL: 0.3, lthR: 0.3, legL: 12, legR: 12, shinL: -7, shinR: -7, elbowL: 80, elbowR: 80, lfaL: 0.25, lfaR: 0.25 },
  keys: [{ p: 0, armL: 12, armR: 12 }, { p: 1, armL: 88, armR: 88 }],
  gear: [{ k: "rect", x: 38, y: 32, w: 24, h: 46, cls: "pad", rx: 3, back: true }, { k: "rect", x: 30, y: 78, w: 40, h: 4, cls: "pad seat", back: true }],
};
const frontRaise = {
  mus: M(["delts"], ["pecs", "traps"]),
  keys: [{ p: 0, ...stand({ uarm: 172, farm: 168 }) }, { p: 1, ...stand({ uarm: 92, farm: 88 }) }],
  gear: [db("W")],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const uprightRow = {
  mus: M(["delts", "traps"], ["biceps"]), xrot: true,
  keys: [{ p: 0, ...stand({ Wt: [54, 62], eb: -1 }) }, { p: 1, ...stand({ Wt: [56, 40], eb: -1, luarm: 0.8 }) }],
  gear: [plate({ j: "W", dy: 1.2 }, 5.6)],
  aids: [{ k: "path", of: "W" }, { k: "arrow", of: "W", off: [10, 0] }],
};
const armCircles = {
  dur: 1400,
  view: "front", mus: M(["delts"], ["traps"]), loop: true, linear: true,
  keys: [{ p: 0, armL: 90, armR: 90, luaL: 1, luaR: 1 }, { p: 0.25, armL: 100, armR: 100, luaL: 0.96, luaR: 0.96 }, { p: 0.5, armL: 90, armR: 90, luaL: 1, luaR: 1 },
    { p: 0.75, armL: 80, armR: 80, luaL: 0.96, luaR: 0.96 }, { p: 1, armL: 90, armR: 90, luaL: 1, luaR: 1 }],
};
const wallSlide = {
  view: "front", mus: M(["delts", "traps"], []),
  keys: [{ p: 0, armL: 52, armR: 52, elbowL: 122, elbowR: 122 }, { p: 1, armL: 150, armR: 150, elbowL: 14, elbowR: 14 }],
  gear: [{ k: "rect", x: 24, y: 6, w: 52, h: 94, cls: "box", rx: 1, back: true }],
};
const bandExtRot = {
  view: "front", mus: M(["delts"], []),
  base: { armL: 6, elbowL: 84, armR: 8 },
  keys: [{ p: 0, lfaL: 0.15 }, { p: 1, lfaL: 0.92 }],
  gear: [{ k: "cable", band: true, from: [[86, 62]], to: ["WL"] }],
};
const shrug = {
  view: "front", mus: M(["traps"], ["forearms"]),
  keys: [{ p: 0, armL: 7, armR: 7 }, { p: 1, armL: 7, armR: 7, shrug: 5.5 }],
  gear: [{ k: "db" }],
};
const barShrug = { ...shrug, gear: [{ k: "bar", half: 21, r: 6.5 }] };
const walk = (o = {}) => [
  { p: 0, At: [60, 96], A2t: [40, 91.6], foot: 76, foot2: 125, ...o },
  { p: 0.25, At: [51, ANK], A2t: [50, 90], foot: 90, foot2: 100, ...o },
  { p: 0.5, At: [40, 91.6], A2t: [60, 96], foot: 125, foot2: 76, ...o },
  { p: 0.75, At: [50, 90], A2t: [51, ANK], foot: 100, foot2: 90, ...o },
  { p: 1, At: [60, 96], A2t: [40, 91.6], foot: 76, foot2: 125, ...o },
];
const farmer = {
  dur: 1400,
  mus: M(["forearms", "traps"], ["abs", "glutes"]), loop: true, linear: true,
  base: { at: "hip", x: 50, y: 58.4, torso: 0, kb: -1, kb2: -1, uarm: 182, farm: 180 },
  keys: walk(),
  gear: [db("W2", { back: true }), db("W")],
};

/* ---------- Bras ---------- */
const curl = {
  mus: M(["biceps"], ["forearms", "delts"]),
  keys: [
    { p: 0, ...stand({ uarm: 182, farm: 176 }) },
    { p: 1, ...stand({ uarm: 176, farm: 34 }) },
  ],
  gear: [db()],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const pushdown = {
  mus: M(["triceps"], ["forearms"]),
  keys: [
    { p: 0, ...stand({ torso: 8, uarm: 182, farm: 52 }) },
    { p: 1, ...stand({ torso: 8, uarm: 182, farm: 176 }) },
  ],
  gear: [{ k: "cable", from: [62, 16], to: "W", post: [70, 12, 70, 100], back: true }],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};

const barbellCurl = { ...curl, mus: M(["biceps"], ["forearms"]), keys: [{ p: 0, ...stand({ uarm: 184, farm: 178 }) }, { p: 1, ...stand({ uarm: 176, farm: 32 }) }], gear: [plate({ j: "W", dy: 1 }, 6.2)] };
const inclineCurl = {
  mus: M(["biceps"], ["forearms"]), base: { ...INCLINE, torso: 318 },
  keys: [{ p: 0, uarm: 186, farm: 182 }, { p: 1, uarm: 186, farm: 40 }],
  gear: [{ k: "pad", x: 53.6, y: 77.6, len: 34, ang: 318, th: 4, legs: [[0.1, 56, 100], [0.7]], back: true }, { k: "pad", x: 50, y: 79.4, len: 16, ang: 90, th: 3.6, back: true }, db("W")],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const concentration = {
  mus: M(["biceps"], ["forearms"]), base: { ...SEATED, x: 40, torso: 40, head: -20, W2t: [64, 72], eb2: 1 },
  keys: [{ p: 0, uarm: 180, farm: 182 }, { p: 1, uarm: 180, farm: 26 }],
  gear: [{ k: "pad", x: 28, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, db("W")],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const spiderCurl = {
  mus: M(["biceps"], ["forearms"]), base: { at: "hip", x: 42, y: 66, torso: 52, head: -10, At: [30, 90], kb: -1, foot: 150 },
  keys: [{ p: 0, uarm: 180, farm: 180 }, { p: 1, uarm: 180, farm: 30 }],
  gear: [{ k: "pad", x: 46, y: 75, len: 34, ang: 52, th: 4, legs: [[0.15, 50, 100], [0.7]], back: true }, db("W")],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const preacher = {
  mus: M(["biceps"], ["forearms"]), base: { ...SEATED, x: 40, torso: 0, head: 0 },
  keys: [{ p: 0, uarm: 140, farm: 146 }, { p: 1, uarm: 140, farm: 10 }],
  gear: [{ k: "pad", x: 28, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, { k: "pad", x: 36.6, y: 56.2, len: 17, ang: 140, th: 3.6, legs: [[0.9, 52, 100]], mid: true }, plate({ j: "W", dy: 1 }, 6)],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, 0] }],
};
const cableCurl = { ...curl, gear: [{ k: "cable", from: [78, 96], to: "W", post: [82, 40, 82, 100], back: true }] };
const bandCurl = { ...curl, gear: [{ k: "band", from: { j: "toe", dx: -4 }, to: "W" }] };
const wristCurl = {
  mus: M(["forearms"], []), base: { ...SEATED, x: 40, torso: 34, head: -16, Wt: [66, 71], eb: 1 },
  keys: [{ p: 0, hand: 50 }, { p: 1, hand: -40 }],
  gear: [{ k: "pad", x: 28, y: 84.6, len: 24, ang: 90, th: 3.6, legs: [[0.5]], back: true }, db({ j: "grip" }, { r: 3.4 })],
  aids: [{ k: "pin", of: "W" }],
};
const cableOverhead = {
  mus: M(["triceps"], []),
  keys: [
    { p: 0, ...stand({ torso: 22, uarm: 26, farm: -124, A2t: [36, ANK], foot2: 110, head: -6 }) },
    { p: 1, ...stand({ torso: 22, uarm: 26, farm: 30, A2t: [36, ANK], foot2: 110, head: -6 }) },
  ],
  gear: [{ k: "cable", from: [18, 34], to: "W", post: [14, 20, 14, 100], back: true }],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [6, -4] }],
};
const overheadExt = {
  mus: M(["triceps"], []), base: { ...SEATED, torso: 0, head: 0 },
  keys: [{ p: 0, uarm: 4, farm: 2 }, { p: 1, uarm: 4, farm: -146 }],
  gear: [...DB_SEAT, db("W", { r: 4.2 })],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [7, 0] }],
};
const skull = {
  mus: M(["triceps"], []), base: BENCH,
  keys: [{ p: 0, uarm: 12, farm: 8 }, { p: 1, uarm: 12, farm: -110 }],
  gear: [bench(22, 81.4, 46), plate({ j: "W", dy: -0.6 }, 6.2)],
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [0, -7] }],
};
const kickback = {
  mus: M(["triceps"], []), base: { ...dbRow.base },
  keys: [{ p: 0, uarm: 262, farm: 180 }, { p: 1, uarm: 262, farm: 266 }],
  gear: dbRow.gear,
  aids: [{ k: "pin", of: "E" }, { k: "arrow", of: "W", off: [0, 6] }],
};

/* ---------- Tronc ---------- */
const plank = {
  mus: M(["abs"], ["obliques", "glutes", "delts", "quads"]),
  base: { at: "toe", x: 20, y: 99.6, thigh: 254, shin: 254, foot: 164, torso: 74, uarm: 180, farm: 90, hand: 0 },
  keys: [{ p: 0 }, { p: 1, torso: 74.6, thigh: 254.6, shin: 254.6 }],
  aids: [{ k: "line", from: "S", to: "A", ext: 0.08 }],
};

const SUPINE = { at: "hip", x: 50, y: 93.4, At: [72, ANK], kb: -1 };
const crunch = {
  mus: M(["abs"], ["obliques"]), base: { ...SUPINE, Wr: [-6, 6.4], eb: 1 },
  keys: [{ p: 0, torso: 270, spine: 0, head: 0 }, { p: 1, torso: 294, spine: 34, head: 10 }],
  gear: [{ k: "mat", x: 16, w: 76 }],
  aids: [{ k: "arrow", of: "S", off: [0, -7] }],
};
const bicycle = {
  dur: 2000,
  mus: M(["abs", "obliques"], ["hipflex"]), loop: true, xrot: true,
  base: { at: "hip", x: 50, y: 93.4, torso: 296, spine: 30, head: 10, Wr: [1, -3], eb: 1 },
  keys: [
    { p: 0, thigh: -15, shin: 96, foot: 10, thigh2: 72, shin2: 74, foot2: -10 },
    { p: 0.5, thigh: 72, shin: 74, foot: -10, thigh2: -15, shin2: 96, foot2: 10 },
    { p: 1, thigh: -15, shin: 96, foot: 10, thigh2: 72, shin2: 74, foot2: -10 },
  ],
  gear: [{ k: "mat", x: 16, w: 84 }],
};
const cableCrunch = {
  mus: M(["abs"], ["obliques"]),
  base: { at: "knee", x: 44, y: 95.4, thigh: 180, shin: 270, foot: 268, Wr: [1, 6], eb: 1 },
  keys: [{ p: 0, torso: 22, spine: 0, head: 0 }, { p: 1, torso: 98, spine: 44, head: 12 }],
  gear: [{ k: "mat", x: 16, w: 56 }, { k: "cable", from: [74, 10], to: "W", post: [78, 6, 78, 100], back: true }],
  aids: [{ k: "arrow", of: "S", off: [6, -4] }],
};
const legRaise = {
  mus: M(["abs", "hipflex"], ["obliques"]),
  base: { at: "hip", x: 46, y: 93.4, torso: 270, uarm: 90, farm: 90, hand: 0 },
  keys: [{ p: 0, thigh: 84, shin: 84, foot: 354 }, { p: 1, thigh: 2, shin: 2, foot: 272 }],
  gear: [{ k: "mat", x: 10, w: 90 }],
  aids: [{ k: "path", of: "A" }, { k: "arrow", of: "A", off: [6, 0] }],
};
const hangingRaise = {
  ...pullup, mus: M(["abs", "hipflex"], ["forearms", "lats"]),
  base: { ...pullup.base, x: 51, y: 31.2, torso: -2 },
  keys: [{ p: 0, thigh: 184, shin: 214, foot: 150 }, { p: 1, thigh: 76, shin: 172, foot: 110 }],
  aids: [{ k: "arrow", of: "K", off: [6, 0] }],
};
const abWheel = {
  mus: M(["abs"], ["lats", "delts", "hipflex"]),
  base: { at: "knee", x: 34, y: 95.4, shin: 270, foot: 268, hand: -90 },
  keys: [{ p: 0, thigh: 196, torso: 48, Wt: [60, 93], head: 0 }, { p: 1, thigh: 248, torso: 76, Wt: [92, 93], head: -4 }],
  gear: [{ k: "mat", x: 14, w: 36 }, { k: "roller", at: "W" }],
  aids: [{ k: "line", from: "K", to: "S", ext: 0.08, at: 1 }, { k: "arrow", of: "W", off: [0, -8] }],
};
const russianTwist = {
  dur: 2400,
  view: "front", mus: M(["obliques", "abs"], []), loop: true,
  base: { y: 86, lthL: 0.3, lthR: 0.3, legL: 14, legR: 14, shinL: -12, shinR: -12, lshL: 0.6, lshR: 0.6 },
  keys: [0, 0.5, 1].map(p => {
    const side = p === 0.5 ? -1 : 1, q = { y: 86, lean: 9 * side }, T = [50 + 13 * side, 73];
    return { p, ...q, ...frontReach(q, "L", T, -1), ...frontReach(q, "R", T, -1) };
  }),
  gear: [{ k: "rect", x: 20, y: 98.6, w: 60, h: 1.4, cls: "mat" }],
};
const deadBug = {
  mus: M(["abs"], ["hipflex", "obliques"]),
  base: { at: "hip", x: 50, y: 93.4, torso: 270, head: 0, uarm2: 2, farm2: 2, thigh: 0, shin: 90, foot: 0 },
  keys: [{ p: 0, uarm: 2, farm: 2, thigh2: 0, shin2: 90, foot2: 0 }, { p: 1, uarm: -76, farm: -80, thigh2: 82, shin2: 84, foot2: 0 }],
  gear: [{ k: "mat", x: 8, w: 92 }],
  aids: [{ k: "arrow", of: "W", off: [0, -6] }, { k: "arrow", of: "A2", off: [0, -6] }],
};
const sidePlank = {
  view: "front", mus: M(["obliques", "abs"], ["abductors", "delts"]),
  base: { x: 50, y: 82, rot: 72, legL: 2, legR: 2, armR: 72, elbowR: 0, lfaR: 0.25, head: -6 },
  keys: [{ p: 0, armL: 10, elbowL: 0 }, { p: 1, armL: 108, elbowL: 0 }],
  gear: [{ k: "rect", x: 2, y: 98.6, w: 100, h: 1.4, cls: "mat" }],
};
const hollow = {
  mus: M(["abs"], ["hipflex"]),
  base: { at: "hip", x: 50, y: 93.4, foot: 350, uarm: 282, farm: 282, hand: 0 },
  keys: [{ p: 0, torso: 270, spine: 0, thigh: 88, shin: 88, head: 0 }, { p: 1, torso: 282, spine: 16, thigh: 78, shin: 78, head: 8 }],
  gear: [{ k: "mat", x: 4, w: 96 }],
  aids: [{ k: "arrow", of: { j: "H", u: 6, n: -6 }, off: [0, 3] }],
};
const pallof = {
  mus: M(["obliques", "abs"], ["delts"]),
  keys: [{ p: 0, ...stand({ Wt: [58, 50], eb: 1, luarm: 0.8, shin: 186, thigh: 172 }) }, { p: 1, ...stand({ Wt: [76, 50], eb: 1, shin: 186, thigh: 172 }) }],
  gear: [{ k: "cable", from: [46, 50], to: "W", back: true }],
  aids: [{ k: "arrow", of: "W", off: [0, -7] }],
};
const ALL4 = { at: "knee", x: 36, y: 96.4, thigh: 180, shin: 270, foot: 270, torso: 74, head: 0, hand: -90 };
const birdDog = {
  mus: M(["lowerback", "glutes", "abs"], ["delts"]),
  base: { ...ALL4, W2t: [59, 98] },
  keys: [{ p: 0, Wt: [59, 98], thigh2: 180, shin2: 270, foot2: 270 }, { p: 1, uarm: 86, farm: 86, thigh2: 268, shin2: 268, foot2: 180, torso: 76 }],
  gear: [{ k: "mat", x: 4, w: 96 }],
  aids: [{ k: "line", from: "W", to: "A2", ext: 0.02, at: 1 }],
};

/* ---------- Cardio ---------- */
const burpee = {
  dur: 4800,
  mus: M(["quads", "pecs"], ["glutes", "delts", "abs", "triceps"]), loop: true,
  base: { at: "hip", kb: -1, hand: -90 },
  keys: [
    { p: 0, x: 50, y: 57.8, torso: 0, At: [50, ANK], foot: 90, uarm: 180, farm: 180, head: 0 },
    { p: 0.12, x: 43, y: 80, torso: 70, At: [50, ANK], foot: 90, Wt: [66, 98], head: -16 },
    { p: 0.22, x: 48, y: 70, torso: 60, At: [26, 80], foot: 220, Wt: [66, 98], head: -10 },
    { p: 0.32, x: 43, y: 79, torso: 73, At: [6, 90.7], foot: 163, Wt: [66, 98], head: -4 },
    { p: 0.39, x: 47, y: 72, torso: 62, At: [32, 82], foot: 215, Wt: [66, 98], head: -10 },
    { p: 0.46, x: 43, y: 80, torso: 70, At: [50, ANK], foot: 90, Wt: [66, 98], head: -16 },
    { p: 0.58, x: 50, y: 56, torso: 4, At: [50, 89.5], foot: 150, uarm: 20, farm: 12, head: -2 },
    { p: 0.68, x: 50, y: 47, torso: 0, At: [50, 84], foot: 150, uarm: 4, farm: 2, head: 0 },
    { p: 0.8, x: 49, y: 63, torso: 14, At: [50, ANK], foot: 90, uarm: 120, farm: 100, head: -6 },
    { p: 0.9, x: 50, y: 57.8, torso: 2, At: [50, ANK], foot: 90, uarm: 176, farm: 174, head: 0 },
    { p: 1, x: 50, y: 57.8, torso: 0, At: [50, ANK], foot: 90, uarm: 180, farm: 180, head: 0 },
  ],
};
const jumpingJack = {
  dur: 1300,
  view: "front", mus: M(["calves", "delts"], ["quads", "abductors"]), loop: true,
  keys: [
    { p: 0, legL: 3, legR: 3, armL: 6, armR: 6 },
    { p: 0.25, legL: 10, legR: 10, armL: 90, armR: 90, y: FSTAND_Y - 4 },
    { p: 0.5, legL: 17, legR: 17, armL: 168, armR: 168, elbowL: 6, elbowR: 6 },
    { p: 0.75, legL: 10, legR: 10, armL: 90, armR: 90, y: FSTAND_Y - 4 },
    { p: 1, legL: 3, legR: 3, armL: 6, armR: 6 },
  ],
};
const highKnees = {
  dur: 900,
  mus: M(["hipflex", "quads"], ["calves", "abs"]), loop: true, linear: true,
  base: { at: "hip", x: 50, y: 55, torso: 2, kb: -1, kb2: -1 },
  keys: [
    { p: 0, thigh: 84, shin: 172, foot: 130, A2t: [51, 93.8], foot2: 120, uarm: 210, farm: 120, uarm2: 140, farm2: 40 },
    { p: 0.5, At: [51, 93.8], foot: 120, thigh2: 84, shin2: 172, foot2: 130, uarm: 140, farm: 40, uarm2: 210, farm2: 120 },
    { p: 1, thigh: 84, shin: 172, foot: 130, A2t: [51, 93.8], foot2: 120, uarm: 210, farm: 120, uarm2: 140, farm2: 40 },
  ],
};
const mountain = {
  dur: 900,
  mus: M(["abs", "hipflex"], ["delts", "quads"]), loop: true, linear: true,
  base: { at: "wrist", x: 84, y: 97, farm: 180, uarm: 180, torso: 76, hand: -90, kb: -1, kb2: -1 },
  keys: [
    { p: 0, At: [62, 88], foot: 205, A2t: [24, 91.4], foot2: 160 },
    { p: 0.25, At: [43, 85], foot: 215, A2t: [43, 85], foot2: 215 },
    { p: 0.5, At: [24, 91.4], foot: 160, A2t: [62, 88], foot2: 205 },
    { p: 0.75, At: [43, 85], foot: 215, A2t: [43, 85], foot2: 215 },
    { p: 1, At: [62, 88], foot: 205, A2t: [24, 91.4], foot2: 160 },
  ],
};
const jumpRope = {
  dur: 800,
  mus: M(["calves"], ["quads", "delts", "forearms"]), loop: true, linear: true,
  base: { at: "ankle", x: 50, uarm: 168, farm: 112, uarm2: 168, farm2: 112, torso: 2 },
  keys: [
    { p: 0, y: ANK - 5, foot: 126, shin: 186, thigh: 168, ropeT: 0 },
    { p: 0.5, y: ANK - 10, foot: 140, shin: 180, thigh: 178, ropeT: 0.5 },
    { p: 1, y: ANK - 5, foot: 126, shin: 186, thigh: 168, ropeT: 1 },
  ],
  gear: [{ k: "rope" }],
};
const battleRope = {
  dur: 900,
  mus: M(["delts", "abs"], ["forearms", "quads"]), loop: true,
  base: { ...stand({ shin: 200, thigh: 128, torso: 26, head: -10 }), eb: 1, eb2: 1 },
  keys: [
    { p: 0, Wt: [72, 58], W2t: [70, 74], ropeT: 0 },
    { p: 0.5, Wt: [70, 74], W2t: [72, 58], ropeT: 0.5 },
    { p: 1, Wt: [72, 58], W2t: [70, 74], ropeT: 1 },
  ],
  gear: [{ k: "wave", x: 108, y: 96 }],
};
const treadmill = {
  dur: 900,
  mus: M(["quads", "calves"], ["glutes", "hams"]), loop: true, linear: true,
  base: { at: "hip", x: 46, y: 53.6, torso: 8, kb: -1, kb2: -1 },
  keys: [
    { p: 0, At: [58, 90.4], A2t: [32, 86], foot: 78, foot2: 140, uarm: 210, farm: 130, uarm2: 150, farm2: 60 },
    { p: 0.25, At: [47, 91.6], A2t: [44, 80], foot: 92, foot2: 110, uarm: 180, farm: 100, uarm2: 180, farm2: 100 },
    { p: 0.5, At: [32, 86], A2t: [58, 90.4], foot: 140, foot2: 78, uarm: 150, farm: 60, uarm2: 210, farm2: 130 },
    { p: 0.75, At: [44, 80], A2t: [47, 91.6], foot: 110, foot2: 92, uarm: 180, farm: 100, uarm2: 180, farm2: 100 },
    { p: 1, At: [58, 90.4], A2t: [32, 86], foot: 78, foot2: 140, uarm: 210, farm: 130, uarm2: 150, farm2: 60 },
  ],
  gear: [{ k: "pad", x: 14, y: 96.4, len: 66, ang: 90, th: 3.2, back: true }, { k: "post", x: 80, y: 46, x2: 76, y2: 96, back: true }, { k: "pad", x: 72, y: 44, len: 14, ang: 60, th: 3, back: true }],
};
const BIKE_C = [56, 84], BIKE_R = 8;
const crank = t => [BIKE_C[0] + BIKE_R * Math.cos(t * 2 * Math.PI), BIKE_C[1] + BIKE_R * Math.sin(t * 2 * Math.PI)];
const bike = {
  dur: 1100,
  mus: M(["quads", "glutes"], ["hams", "calves"]), loop: true, linear: true,
  base: { at: "hip", x: 40, y: 52, torso: 40, head: -18, kb: -1, kb2: -1, Wt: [70, 40], eb: 1, foot: 100, foot2: 100 },
  keys: Array.from({ length: 9 }, (_, i) => ({ p: i / 8, At: crank(i / 8), A2t: crank(i / 8 + 0.5), ropeT: i / 8 })),
  gear: [{ k: "pad", x: 33, y: 57.4, len: 12, ang: 90, th: 3.4, back: true }, { k: "post", x: 40, y: 58, x2: BIKE_C[0], y2: BIKE_C[1], back: true },
    { k: "post", x: BIKE_C[0], y: BIKE_C[1], x2: 70, y2: 42, back: true }, { k: "post", x: 30, y: 98, x2: 84, y2: 98, back: true }, { k: "circle", x: BIKE_C[0], y: BIKE_C[1], r: BIKE_R, cls: "frame", spin: true, back: true }],
};
const rower = {
  dur: 2800,
  mus: M(["lats", "quads"], ["glutes", "hams", "biceps", "abs"]), loop: true,
  base: { at: "hip", y: 87.6, kb: -1, At: [78, 86], foot: 40, eb: 1 },
  keys: [
    { p: 0, x: 48, torso: 24, Wt: [84, 78], head: 0 },
    { p: 0.35, x: 36, torso: -8, Wt: [58, 74], head: 0, luarm: 0.9 },
    { p: 0.5, x: 36, torso: -8, Wt: [58, 74], head: 0, luarm: 0.9 },
    { p: 0.75, x: 40, torso: 20, Wt: [80, 78], head: 0 },
    { p: 1, x: 48, torso: 24, Wt: [84, 78], head: 0 },
  ],
  gear: [{ k: "post", x: 10, y: 95, x2: 96, y2: 95, back: true }, { k: "pad", at: { j: "H", dx: -6, dy: 6.2 }, ang: 90, len: 12, th: 3, back: true },
    { k: "pad", x: 82.6, y: 96, len: 13, ang: 310, th: 2.6, back: true }, { k: "cable", from: [96, 80], to: "W", back: true }],
};
const ELL_C = [58, 88];
const ellipse = t => [ELL_C[0] + 9 * Math.cos(t * 2 * Math.PI), ELL_C[1] + 4 * Math.sin(t * 2 * Math.PI)];
const elliptical = {
  dur: 1400,
  mus: M(["quads", "glutes"], ["hams", "calves", "delts"]), loop: true, linear: true,
  base: { at: "hip", x: 50, y: 50, torso: 4, kb: -1, kb2: -1, foot: 90, foot2: 90, eb: 1, eb2: 1 },
  keys: Array.from({ length: 9 }, (_, i) => ({ p: i / 8, At: ellipse(i / 8), A2t: ellipse(i / 8 + 0.5), Wt: [70 + 6 * Math.cos(i / 4 * Math.PI + Math.PI), 46], W2t: [70 + 6 * Math.cos(i / 4 * Math.PI), 46] })),
  gear: [{ k: "post", x: 30, y: 97, x2: 84, y2: 97, back: true }, { k: "post", x: 80, y: 30, x2: 78, y2: 97, back: true }, { k: "line", from: [80, 30], to: "W", cls: "frame", back: true }],
};
const stairs = {
  dur: 1400,
  mus: M(["quads", "glutes"], ["calves", "hams"]), loop: true, linear: true,
  base: { at: "hip", x: 46, y: 50, torso: 10, kb: -1, kb2: -1, Wt: [70, 50], W2t: [70, 50], eb: 1, eb2: 1 },
  keys: [
    { p: 0, At: [60, 82], A2t: [48, 92], foot: 90, foot2: 110 },
    { p: 0.5, At: [48, 92], A2t: [60, 82], foot: 110, foot2: 90 },
    { p: 1, At: [60, 82], A2t: [48, 92], foot: 90, foot2: 110 },
  ],
  gear: [{ k: "box", x: 40, y: 95.2, w: 30, back: true }, { k: "box", x: 52, y: 85.2, w: 18, back: true }, { k: "post", x: 74, y: 44, back: true }],
};

/* ---------- Mobilité et étirements ---------- */
const MAT = { k: "mat", x: 4, w: 100 };
const catCow = {
  mus: M(["lowerback", "abs"], ["traps"]), base: { ...ALL4, Wt: [59, 98], W2t: [59, 98] },
  keys: [{ p: 0, spine: -42, head: -24 }, { p: 1, spine: 46, head: 26 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: { j: "H", u: 12, n: -7 }, off: [0, -4] }],
};
const worldsGreatest = {
  mus: M(["hipflex", "hams", "glutes"], ["obliques", "adductors"]), xrot: true, // le buste tourne : le bras monte vers le plafond
  base: { at: "ankle", x: 66, y: ANK, shin: 200, thigh: 98, torso: 66, head: -10, A2t: [24, 91.4], kb2: -1, foot2: 160, W2t: [70, 98] },
  keys: [{ p: 0, Wt: [72, 98] }, { p: 1, uarm: 4, farm: 2, torso: 60, head: -40 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "W", off: [6, 0] }],
};
const hipFlexor = {
  mus: M(["hipflex", "quads"], ["abs"]),
  base: { at: "knee", x: 40, y: 96.4, shin: 270, foot: 270, A2t: [62, ANK], kb2: -1, foot2: 90, head: 0 },
  keys: [{ p: 0, thigh: 182, torso: 0, uarm: 180, farm: 180 }, { p: 1, thigh: 156, torso: -6, uarm: 4, farm: 2 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "H", off: [0, -8] }],
};
const pigeon = {
  mus: M(["glutes", "hipflex"], ["lowerback"]),
  base: { at: "hip", x: 44, y: 90, thigh: 256, shin: 266, foot: 245, thigh2: 100, shin2: 250, foot2: 250 },
  keys: [{ p: 0, torso: 36, spine: -32, Wt: [58, 97], W2t: [58, 97], head: -6 }, { p: 1, torso: 66, spine: 18, uarm: 82, farm: 84, uarm2: 82, farm2: 84, head: 6 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "S", off: [4, -6] }],
};
const hamstringStretch = {
  mus: M(["hams"], ["calves", "lowerback"]),
  base: { at: "hip", x: 46, y: 60, A2t: [44, ANK], kb2: -1, foot2: 90, thigh: 128, shin: 128, foot: 20 },
  keys: [{ p: 0, torso: 2, uarm: 180, farm: 180, head: 0 }, { p: 1, torso: 48, Wt: [70, 80], eb: -1, head: -6 }],
  gear: [{ k: "box", x: 70, y: 82, w: 18, back: true }],
  aids: [{ k: "line", from: "H", to: "S", ext: 0.2, at: 1, label: "dos plat", labelAt: "start" }, { k: "arrow", of: "S", off: [4, -6] }],
};
const thoracic = {
  mus: M(["traps", "lowerback"], ["lats"]),
  base: { at: "hip", x: 54, y: 88, At: [76, ANK], kb: -1, Wr: [5, -2], eb: 1 },
  keys: [{ p: 0, torso: 284, spine: 4, head: 6 }, { p: 1, torso: 278, spine: -40, head: -4 }],
  gear: [{ k: "circle", x: 40, y: 96.2, r: 3.8, cls: "pad roll", back: true }, MAT],
  aids: [{ k: "arrow", of: "C", off: [0, 6] }],
};
const childPose = {
  mus: M(["lowerback", "lats"], ["glutes"]),
  base: { at: "knee", x: 50, y: 96.2, shin: 270, foot: 270, hand: 0 },
  keys: [{ p: 0, thigh: 180, torso: 0, head: 0, uarm: 180, farm: 180 }, { p: 1, thigh: 112, torso: 96, spine: 12, head: -14, uarm: 88, farm: 90 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "W", off: [6, 0] }],
};
const dislocates = {
  mus: M(["delts", "pecs"], ["traps"]), xrot: true, // prise large : les bras passent sur les côtés
  keys: [{ p: 0, ...stand({ uarm: 160, farm: 160 }) }, { p: 0.5, ...stand({ uarm: 0, farm: 0 }) }, { p: 1, ...stand({ uarm: -150, farm: -150 }) }],
  aids: [{ k: "path", of: "W" }],
};
const foamRoll = {
  mus: M(["quads"], ["hipflex"]),
  base: { at: "hip", y: 87.6, thigh: 270, shin: 272, foot: 190, torso: 80, uarm: 180, farm: 90, hand: 0, head: -6 },
  keys: [{ p: 0, x: 48 }, { p: 1, x: 62 }],
  gear: [{ k: "circle", x: 46, y: 96.2, r: 3.8, cls: "pad roll" }, MAT],
  aids: [{ k: "arrow", of: "S", off: [0, -8] }],
};
const neckTilt = { view: "front", mus: M(["traps"], []), keys: [{ p: 0, head: 0 }, { p: 1, head: 30 }] };
const neckRot = { view: "front", mus: M(["traps"], []), keys: [{ p: 0, turn: -0.85 }, { p: 1, turn: 0.85 }] };
const chinTuck = { mus: M(["traps"], []), keys: [{ p: 0, ...stand({ chin: -1.2 }) }, { p: 1, ...stand({ chin: 2.2, head: 4 }) }], aids: [{ k: "arrow", of: "C", off: [8, 0] }] };
const doorwayPec = {
  mus: M(["pecs", "delts"], []),
  base: { at: "hip", y: 57.8, At: [50, ANK], A2t: [64, ANK], kb: -1, kb2: -1, foot2: 90, torso: 6, Wt: [36, 31], eb: 1, luarm: 0.5 },
  keys: [{ p: 0, x: 48 }, { p: 1, x: 55, torso: 10 }],
  gear: [{ k: "post", x: 34, y: 4, back: true }],
  aids: [{ k: "arrow", of: "S", off: [7, 0] }],
};
const crossArm = {
  view: "front", mus: M(["delts"], ["traps"]),
  keys: [{ p: 0, armL: 10, elbowL: 0, armR: 10, elbowR: 0 }, { p: 1, armL: -84, elbowL: 0, luaL: 0.9, armR: 30, elbowR: -112 }],
};
const triStretch = {
  mus: M(["triceps", "lats"], []),
  keys: [{ p: 0, ...stand({ uarm: 2, farm: 2, uarm2: 180, farm2: 180 }) }, { p: 1, ...stand({ uarm: -6, farm: -156, W2t: [47, 19] }) }],
  aids: [{ k: "pin", of: "E" }],
};
const latStretch = {
  mus: M(["lats"], ["hams", "triceps"]),
  keys: [{ p: 0, ...stand({ Wt: [80, 58], eb: 1 }) }, { p: 1, ...stand({ shin: 184, thigh: 160, torso: 84, Wt: [80, 58], eb: 1, head: 0 }) }],
  gear: [{ k: "post", x: 82, y: 50, back: true }, { k: "post", x: 78, y: 58, x2: 86, y2: 58, back: true }],
  aids: [{ k: "line", from: "H", to: "W", ext: 0.08, at: 1 }],
};
const wristCircles = { dur: 2000, mus: M(["forearms"], []), loop: true, linear: true, keys: [0, 0.25, 0.5, 0.75, 1].map((p, i) => ({ p, ...stand({ uarm: 92, farm: 90, hand: [0, -40, 0, 40, 0][i] }) })) };
const forearmStretch = {
  mus: M(["forearms"], []),
  keys: [{ p: 0, ...stand({ uarm: 92, farm: 90, hand: 0, uarm2: 180, farm2: 180 }) }, { p: 1, ...stand({ uarm: 92, farm: 90, hand: -78, W2t: [76, 35], eb2: 1 }) }],
};
const threadNeedle = {
  mus: M(["traps", "lats"], ["obliques"]), xrot: true, // le buste tourne : le bras s'ouvre vers le plafond
  base: { ...ALL4, W2t: [59, 98] },
  keys: [{ p: 0, Wt: [52, 96], luarm: 0.4, torso: 78, head: 10 }, { p: 1, uarm: 0, farm: 0, torso: 72, head: -30 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "W", off: [6, 0] }],
};
const cobra = {
  mus: M(["abs", "hipflex"], ["lowerback"]),
  base: { at: "hip", x: 46, y: 93.2, thigh: 270, shin: 270, foot: 245, Wt: [66, 98], eb: 1, hand: -90 },
  keys: [{ p: 0, torso: 90, spine: 0, head: -6 }, { p: 1, torso: 56, spine: -30, head: -26 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "S", off: [0, -8] }],
};
const kneeHug = {
  mus: M(["lowerback", "glutes"], []),
  base: { at: "hip", x: 52, y: 93.4, torso: 270, head: 0, kb: -1 },
  keys: [{ p: 0, At: [72, ANK], foot: 90, uarm: 90, farm: 90, hand: 0 }, { p: 1, thigh: -30, shin: 125, foot: 40, Wt: [46, 80], eb: 1, head: 14 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "K", off: [-6, 0] }],
};
const supineTwist = {
  label: "Vue de dessus",
  view: "front", mus: M(["obliques", "lowerback"], ["glutes"]), noFloor: true,
  base: { x: 56, y: 60, rot: -90, armL: 90, armR: 90, lthL: 0.32, lthR: 0.32 },
  keys: [{ p: 0, legL: 6, legR: 6, shinL: -4, shinR: -4, lshL: 0.55, lshR: 0.55 }, { p: 1, legL: -50, legR: 64, shinL: 40, shinR: -40, lthL: 0.95, lthR: 0.9, lshL: 0.8, lshR: 0.8, head: 0 }],
  gear: [{ k: "rect", x: 4, y: 40, w: 100, h: 40, cls: "mat", rx: 3, back: true }],
};
const sideBend = { view: "front", mus: M(["obliques", "lats"], []), keys: [{ p: 0, armL: 160, elbowL: 12, armR: 10 }, { p: 1, lean: -22, armL: 172, elbowL: 14, armR: 20, elbowR: -20 }] };
const deadHang = {
  ...pullup, mus: M(["lats", "forearms"], ["delts"]),
  keys: [{ p: 0, x: 51, y: 31.2, torso: -2 }, { p: 1, x: 51, y: 32.6, torso: -1 }],
  aids: [],
};
const hipCircles = {
  dur: 3200,
  view: "front", mus: M(["glutes", "lowerback"], ["obliques"]), loop: true,
  base: { legL: 8, legR: 8, kneeL: 14, kneeR: 14 },
  keys: [0, 0.25, 0.5, 0.75, 1].map((p, i) => {
    const q = { x: 50 + [-4, 0, 4, 0, -4][i], lean: [5, 0, -5, 0, 5][i], y: FSTAND_Y + 1 + [0, 1.2, 0, -0.4, 0][i] };
    return { p, ...q, ...frontReach(q, "L", [q.x - 6.4, q.y + 2], -1), ...frontReach(q, "R", [q.x + 6.4, q.y + 2], -1) }; // mains sur les hanches
  }),
};
const legSwings = {
  mus: M(["hipflex", "hams"], ["glutes"]),
  base: { at: "hip", x: 50, y: 57.8, torso: 2, A2t: [50, ANK], kb2: -1, foot2: 90, Wt: [72, 46], eb: 1 },
  keys: [{ p: 0, thigh: 132, shin: 140, foot: 50 }, { p: 1, thigh: 214, shin: 222, foot: 132 }],
  gear: [{ k: "wall", x: 74, y: 12, back: true }],
  aids: [{ k: "path", of: "A" }],
};
const hip9090 = {
  view: "front", mus: M(["glutes", "hipflex"], ["adductors"]),
  base: { y: 92, lthL: 0.3, legL: 10, shinL: -96, lshL: 1, legR: 90, shinR: -54, lthR: 1, lshR: 0.3, armL: 18, armR: 18 },
  keys: [{ p: 0, lean: 0 }, { p: 1, lean: 8, armL: 30, elbowL: -40, armR: 10 }],
  gear: [{ k: "rect", x: 10, y: 98.6, w: 90, h: 1.4, cls: "mat" }],
};
const butterfly = {
  view: "front", mus: M(["adductors"], ["glutes"]),
  base: { y: 92, lthL: 0.82, lthR: 0.82, lshL: 0.75, lshR: 0.75, armL: 10, armR: 10, elbowL: -14, elbowR: -14 },
  keys: [{ p: 0, legL: 52, legR: 52, shinL: -110, shinR: -110 }, { p: 1, legL: 78, legR: 78, shinL: -126, shinR: -126 }],
  gear: [{ k: "rect", x: 10, y: 98.6, w: 90, h: 1.4, cls: "mat" }],
};
const rockBack = {
  mus: M(["adductors", "glutes"], ["lowerback"]),
  base: { at: "knee", x: 40, y: 96.4, shin: 270, foot: 270, hand: -90, W2t: [70, 98] },
  keys: [{ p: 0, thigh: 180, torso: 74, Wt: [70, 98], head: 0 }, { p: 1, thigh: 128, torso: 100, Wt: [70, 98], head: 6 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "H", off: [-6, -4] }],
};
const fig4 = {
  mus: M(["glutes"], ["hams"]),
  base: { at: "hip", x: 52, y: 93.4, torso: 270, head: 0, kb: -1, kb2: -1, lshin: 1 },
  keys: [{ p: 0, A2t: [72, ANK], foot2: 90, thigh: 30, shin: 150, foot: 60, uarm: 90, farm: 90 }, { p: 1, thigh2: -6, shin2: 80, foot2: 0, thigh: -20, shin: 110, foot: 30, Wt: [60, 70], eb: 1, head: 12 }],
  gear: [MAT],
};
const quadStretch = {
  mus: M(["quads", "hipflex"], []),
  base: { at: "hip", x: 50, y: 57.8, torso: 0, A2t: [51, ANK], kb2: -1, foot2: 90, W2t: [70, 40], eb2: 1 },
  keys: [{ p: 0, thigh: 180, shin: 180, foot: 90, uarm: 180, farm: 180 }, { p: 0.3, thigh: 182, shin: 230, foot: 120, uarm: 182, farm: 176 },
    { p: 1, thigh: 184, shin: 340, foot: 262, Wt: [45, 58], eb: 1 }],
  gear: [{ k: "wall", x: 72, y: 12, back: true }],
};
const calfStretch = {
  mus: M(["calves"], ["hams"]),
  base: { at: "hip", y: 58.6, At: [62, ANK], A2t: [28, ANK], kb: -1, kb2: -1, foot: 90, foot2: 90, Wt: [82, 40], W2t: [82, 40] },
  keys: [{ p: 0, x: 44, torso: 16 }, { p: 1, x: 50, torso: 26 }],
  gear: [{ k: "wall", x: 84, y: 12, back: true }],
  aids: [{ k: "line", from: "A2", to: "S", ext: 0.04, at: 1 }],
};
const ankleRock = {
  mus: M(["calves"], []),
  base: { at: "ankle", x: 60, y: ANK, foot: 90, A2t: [21, 95], kb2: -1, foot2: 270, Wt: [70, 66], eb: 1 },
  keys: [{ p: 0, shin: 182, thigh: 92, torso: 2 }, { p: 1, shin: 210, thigh: 100, torso: 6 }],
  gear: [MAT],
  aids: [{ k: "arrow", of: "K", off: [6, 0] }],
};
const breathing = {
  dur: 6000,
  mus: M(["abs"], []), loop: true,
  base: { ...SUPINE, torso: 270, head: 0, eb: 1 },
  keys: [{ p: 0, Wr: [-21, 7] }, { p: 0.5, Wr: [-21, 9], spine: -6 }, { p: 1, Wr: [-21, 7] }],
  gear: [{ k: "mat", x: 10, w: 84 }],
  aids: [{ k: "arrow", of: "W", off: [0, -5] }],
};

/* ---------- Vue de face ---------- */
const lateral = {
  view: "front", mus: M(["delts"], ["traps"]),
  keys: [{ p: 0, armL: 10, armR: 10, elbowL: -8, elbowR: -8 }, { p: 1, armL: 88, armR: 88, elbowL: -10, elbowR: -10 }],
  gear: [{ k: "db" }],
};

export const MOVES = {
  squat: squatBar, smith_squat: smithSquat, hack_squat: hackSquat, jump_squat: jumpSquat, wall_sit: wallSit, box_jump: boxJump, deep_squat: deepSquat,
  kb_goblet: kbGoblet, db_lunge: dbLunge, walking_lunge: dbLunge, bulgarian, step_up: stepUp, leg_ext: legExt, adductor, abductor, tke,
  db_rdl: dbRdl, good_morning: goodMorning, sumo_deadlift: sumo, kb_swing: kbSwing, back_ext: backExt, superman, seated_fold: seatedFold, inchworm, down_dog: downDog,
  glute_bridge: gluteBridge, pelvic_tilt: pelvicTilt, clamshell, band_walk: bandWalk, glute_machine: gluteMachine, cable_kickback: cableKickback,
  leg_curl: legCurl, seated_leg_curl: seatedLegCurl, nordic, calf, seated_calf: seatedCalf, press_calf: pressCalf, calf_bw: calfBw, front_squat: frontSquat, goblet, air_squat: airSquat,
  deadlift, rdl, lunge, leg_press: legPress, hip_thrust: hipThrust,
  bench: benchPress, close_grip: benchPress, db_bench: dbBench, smith_bench: smithBench, incline, decline, incline_db: inclineDb, smith_incline: smithIncline,
  chest_press: chestPress, incline_machine: inclineMachine, band_press: bandPress, incline_pushup: inclinePushup, decline_pushup: declinePushup, diamond: pushup, pike,
  ohp, db_press: dbPress, arnold, shoulder_machine: shoulderMachine, smith_ohp: smithOhp, kb_press: kbPress, bench_dips: benchDips, dip_machine: dipMachine,
  pushup, dips, row, pullup, chinup: pullup, lat_pull: latPull, cable_row: cableRow, assisted_pullup: assistedPullup, close_pulldown: latPull,
  straight_pulldown: straightPulldown, tbar_row: tbarRow, machine_row: machineRow, db_row: dbRow, chest_row: chestRow, inverted_row: invertedRow, band_row: bandRow,
  pec_deck: pecDeck, fly: cableFly, low_fly: lowFly, db_fly: dbFly, pullover, rear_delt: rearDelt, reverse_pec_deck: reversePecDeck, band_pull_apart: bandPullApart,
  face_pull: facePull, cable_lateral: cableLateral, lateral_machine: lateralMachine, front_raise: frontRaise, upright_row: uprightRow, arm_circles: armCircles,
  wall_slide: wallSlide, band_ext_rot: bandExtRot, shrug, bar_shrug: barShrug, farmer,
  crunch, bicycle, cable_crunch: cableCrunch, leg_raise: legRaise, hanging_raise: hangingRaise, ab_wheel: abWheel, russian_twist: russianTwist, dead_bug: deadBug,
  side_plank: sidePlank, hollow, pallof, bird_dog: birdDog,
  cat_cow: catCow, worlds_greatest: worldsGreatest, hip_flexor: hipFlexor, pigeon, hamstring: hamstringStretch, thoracic, child_pose: childPose, dislocates,
  foam_roll: foamRoll, neck_tilt: neckTilt, neck_rot: neckRot, chin_tuck: chinTuck, doorway_pec: doorwayPec, cross_arm: crossArm, sleeper: crossArm,
  tri_stretch: triStretch, lat_stretch: latStretch, wrist_circles: wristCircles, forearm_stretch: forearmStretch, thread_needle: threadNeedle,
  open_book: threadNeedle, cobra, knee_hug: kneeHug, supine_twist: supineTwist, side_bend: sideBend, dead_hang: deadHang, hip_circles: hipCircles,
  leg_swings: legSwings, hip_9090: hip9090, frog: rockBack, butterfly, adductor_rock: rockBack, fig4, quad_stretch: quadStretch, calf_stretch: calfStretch,
  ankle_rock: ankleRock, breathing,
  burpee, jumping_jack: jumpingJack, high_knees: highKnees, mountain, jump_rope: jumpRope, battle_rope: battleRope, treadmill, bike, rower, elliptical, stairs, curl, barbell_curl: barbellCurl, ez_curl: barbellCurl, hammer: curl,
  incline_curl: inclineCurl, concentration, spider_curl: spiderCurl, preacher, cable_curl: cableCurl, band_curl: bandCurl, wrist_curl: wristCurl,
  cable_overhead: cableOverhead, overhead_ext: overheadExt, skull, kickback,
  pushdown, rope_pushdown: pushdown, plank, lateral,
};
// Mouvement par défaut de chaque famille (exercices perso sans dessin dédié)
const BY_PATTERN = { squat: airSquat, lunge, hinge: rdl, bridge: hipThrust, press_h: benchPress, pushup, dips, press_v: ohp, raise: lateral, fly: cableFly,
  pull_v: latPull, row, curl, tri_ext: pushdown, plank, crunch, cardio: jumpingJack, stretch: childPose, legext: legExt, legcurl: legCurl, shrug, calf: calfBw };
export const moveOf = id => MOVES[id] || BY_PATTERN[patternOf(id)] || airSquat;
export const hasMove = id => !!MOVES[id];
export const viewLabel = m => m.label || (m.view === "front" ? (m.back ? "Vue de dos" : "Vue de face") : "");

// Phase d'effort de chaque type de mouvement : celle où l'on pousse ou tire, où l'on souffle ; null : maintien, étirement.
// Le mouvement dessiné va de la position clé 0 à 1 (« go ») puis revient (« back »).
const EFFORT = { squat: "back", lunge: "back", legext: "go", legcurl: "go", hinge: "back", bridge: "go", press_h: "back", pushup: "back", dips: "back",
  press_v: "go", raise: "go", fly: "back", pull_v: "go", row: "go", curl: "go", tri_ext: "go", shrug: "go", calf: "go", crunch: "go", plank: null, cardio: null, stretch: null };
export const effortOf = id => (SAY[id] && "effort" in SAY[id] ? SAY[id].effort : EFFORT[patternOf(id)] ?? null);
// Phase jouée plus vite dans la démo : l'effort, sauf mouvement volontairement freiné (fast dans les consignes)
export const fastOf = id => (SAY[id] && "fast" in SAY[id] ? SAY[id].fast : effortOf(id));

/* ---------- Consignes propres à un exercice (le reste vient de son type de mouvement) ---------- */
// setup : mise en place · go / back : étapes 1 et 2 · effort : phase où l'on souffle · fast : phase rapide si ce n'est pas l'effort
// steps : étapes d'un mouvement en boucle [début, texte]
const press = { go: "Pousse les poignées devant toi.", back: "Reviens lentement, coudes vers l'arrière.", effort: "go" };
const closeArms = { go: "Ramène les bras devant toi en serrant les pectoraux.", back: "Rouvre lentement jusqu'à sentir l'étirement.", effort: "go",
  mistakes: ["Bras complètement tendus : les coudes souffrent", "Épaules qui avancent"] };
const lungeSay = { go: "Descends jusqu'à frôler le sol avec le genou arrière, buste droit.", back: "Remonte en poussant sur le talon avant." };
const liftUp = { go: "Pousse dans le sol et redresse-toi, la barre glisse le long des jambes.", back: "Redescends la barre en poussant les fesses en arrière, dos plat.", effort: "go" };
const dbPressSay = { go: "Descends les haltères de chaque côté de la poitrine, coudes à environ 45°.", back: "Pousse les haltères vers le haut en les rapprochant." };
const SAY = {
  deadlift: { ...liftUp },
  sumo_deadlift: { setup: "Pieds très écartés, pointes ouvertes, mains entre les jambes, dos plat.", ...liftUp },
  good_morning: { setup: "Barre sur le haut du dos, pieds largeur de hanches, genoux légèrement fléchis.", go: "Penche le buste en poussant les fesses loin derrière, dos bien plat.",
    back: "Remonte en serrant les fessiers." },
  lunge: { setup: "Un grand pas en avant, pied arrière sur la pointe, buste droit.", ...lungeSay },
  db_lunge: { setup: "Un haltère dans chaque main, un grand pas en avant, pied arrière sur la pointe.", ...lungeSay },
  walking_lunge: { setup: "Debout, un haltère dans chaque main.", go: "Fais un grand pas en avant et descends, genou arrière près du sol.",
    back: "Pousse sur le pied avant et enchaîne avec l'autre jambe." },
  db_bench: { setup: "Allongé, un haltère dans chaque main au-dessus de la poitrine, omoplates serrées, pieds au sol.", ...dbPressSay },
  incline_db: { setup: "Sur le banc incliné, un haltère dans chaque main au-dessus du haut de la poitrine, omoplates serrées.", ...dbPressSay },
  hack_squat: { setup: "Dos et épaules contre les coussins, pieds au milieu de la plateforme.", go: "Descends en pliant les genoux jusqu'à environ 90°.", back: "Pousse dans la plateforme pour remonter, sans verrouiller les genoux." },
  leg_press: { setup: "Dos et fesses bien calés, pieds largeur de hanches sur la plateforme.", go: "Plie les genoux en amenant la plateforme vers toi.", back: "Pousse sans verrouiller les genoux en haut.",
    mistakes: ["Fesses qui décollent du siège en bas", "Genoux verrouillés en haut", "Genoux qui rentrent"] },
  jump_squat: { setup: "Pieds largeur d'épaules, bras prêts à lancer.", steps: [[0, "Descends en squat, bras en arrière"], [0.32, "Explose vers le haut et saute"], [0.62, "Réception souple, genoux fléchis"]] },
  wall_sit: { setup: "Dos plaqué au mur, pieds à environ 50 cm du mur.", go: "Glisse le long du mur jusqu'à avoir les cuisses parallèles au sol.", back: "Tiens la position, genoux au-dessus des chevilles.", effort: null,
    mistakes: ["Genoux qui dépassent les orteils", "Mains appuyées sur les cuisses", "Bloquer sa respiration"] },
  box_jump: { setup: "Face à une box stable, pieds largeur de hanches.", steps: [[0, "Fléchis les jambes, bras en arrière"], [0.18, "Saute en lançant les bras"], [0.42, "Réception douce sur la box, genoux fléchis"], [0.56, "Redresse-toi sur la box"], [0.68, "Redescends en marchant, un pied après l'autre"]],
    mistakes: ["Atterrir jambes tendues", "Redescendre en sautant en arrière", "Box trop haute"] },
  deep_squat: { go: "Descends le plus bas possible, talons au sol, coudes à l'intérieur des genoux.", back: "Remonte doucement." },
  bulgarian: { setup: "Pied arrière posé sur un banc, pied avant un grand pas devant.", go: "Descends en pliant le genou avant, buste droit.", back: "Remonte en poussant sur le talon avant." },
  step_up: { setup: "Face à une box ou une marche, un pied posé dessus.", go: "Pousse sur le pied posé sur la box pour monter.", back: "Redescends en contrôlant, un pied après l'autre.", effort: "go" },
  adductor: { setup: "Assis, dos au dossier, coussins contre l'intérieur des genoux.", go: "Serre les jambes l'une vers l'autre.", back: "Rouvre lentement en contrôlant.", mistakes: ["Lâcher la charge d'un coup", "Se pencher en avant"] },
  abductor: { setup: "Assis, dos au dossier, coussins contre l'extérieur des genoux.", go: "Écarte les genoux contre la résistance.", back: "Ramène lentement les jambes.", effort: "go", mistakes: ["Lâcher la charge d'un coup", "Se pencher en avant"] },
  tke: { setup: "Élastique derrière le genou, attaché devant toi.", go: "Tends complètement le genou en serrant la cuisse.", back: "Relâche doucement, le genou se plie un peu." },
  seated_leg_curl: { setup: "Assis, rouleau sous les mollets, cuisses bloquées par le coussin.", go: "Ramène les talons sous le siège.", back: "Tends les jambes lentement." },
  nordic: { setup: "À genoux, chevilles bloquées, corps droit des genoux à la tête.", go: "Laisse-toi descendre vers l'avant le plus lentement possible.", back: "Rattrape-toi avec les mains, puis remonte.", effort: "go", fast: "back",
    mistakes: ["Plier les hanches", "Tomber d'un coup"] },
  kb_swing: { setup: "Pieds un peu plus larges que les hanches, kettlebell devant toi.", steps: [[0, "Le kettlebell redescend entre les jambes"], [0.3, "Hanches en arrière, dos plat"], [0.5, "Claque les hanches vers l'avant"], [0.75, "Il monte à hauteur d'épaules, bras tendus"]] },
  back_ext: { setup: "Hanches sur le coussin, chevilles bloquées, bras croisés.", go: "Remonte jusqu'à aligner le buste avec les jambes.", back: "Redescends lentement, dos plat.", effort: "go" },
  superman: { setup: "Allongé sur le ventre, bras tendus devant.", go: "Décolle bras et jambes en serrant les fessiers.", back: "Repose doucement.", effort: "go" },
  seated_fold: { setup: "Assis, jambes tendues devant toi.", go: "Penche-toi vers tes pieds en gardant le dos long.", back: "Reviens lentement.", effort: null },
  inchworm: { setup: "Debout, pieds largeur de hanches.", steps: [[0, "Penche-toi, mains au sol"], [0.2, "Avance les mains jusqu'en planche"], [0.5, "Ramène les mains vers les pieds"], [0.8, "Redresse-toi"]] },
  down_dog: { setup: "En planche, mains sous les épaules.", go: "Pousse les hanches vers le haut et l'arrière, talons vers le sol.", back: "Reviens en planche.", effort: null },
  pelvic_tilt: { setup: "Allongé, genoux pliés, pieds au sol.", go: "Plaque le bas du dos au sol en basculant le bassin.", back: "Relâche, le bas du dos se creuse un peu." },
  clamshell: { setup: "Allongé sur le côté, genoux pliés, pieds joints.", go: "Ouvre le genou du dessus, pieds collés.", back: "Referme lentement." },
  band_walk: { setup: "Élastique autour des chevilles ou des genoux, mi-squat.", steps: [[0, "Un pas sur le côté, élastique tendu"], [0.5, "Ramène l'autre pied sans relâcher"]] },
  glute_machine: { setup: "Buste en appui, un pied sur la plateforme.", go: "Pousse la jambe vers l'arrière en serrant le fessier.", back: "Reviens sans à-coup." },
  cable_kickback: { setup: "Sangle à la cheville, mains sur la machine, légèrement penché.", go: "Tends la jambe vers l'arrière en serrant le fessier.", back: "Reviens lentement sans cambrer." },
  chest_press: { setup: "Assis, dos au dossier, poignées à hauteur de poitrine.", ...press },
  incline_machine: { setup: "Assis, dos au dossier, poignées à hauteur du haut de la poitrine.", ...press },
  band_press: { setup: "Élastique accroché derrière toi à hauteur de poitrine.", ...press },
  pike: { setup: "Hanches hautes, mains au sol, corps en V.", go: "Plie les coudes pour amener la tête vers le sol.", back: "Repousse le sol." },
  bench_dips: { setup: "Mains sur le bord d'un banc derrière toi, jambes devant.", go: "Descends en pliant les coudes vers l'arrière.", back: "Remonte en poussant dans le banc." },
  dip_machine: { setup: "Assis, poignées à hauteur de poitrine.", go: "Pousse les poignées vers le bas jusqu'aux bras tendus.", back: "Remonte lentement.", effort: "go" },
  arnold: { setup: "Assis, haltères devant le visage, paumes vers toi.", go: "Pousse vers le haut en tournant les paumes vers l'avant.", back: "Redescends en tournant les paumes vers toi." },
  front_raise: { go: "Monte les bras devant toi jusqu'à hauteur d'épaules.", back: "Redescends lentement." },
  upright_row: { setup: "Barre tenue mains serrées, bras tendus.", go: "Tire la barre le long du corps, coudes hauts.", back: "Redescends lentement." },
  arm_circles: { setup: "Bras tendus sur les côtés.", steps: [[0, "Fais de petits cercles, dans un sens puis dans l'autre"]] },
  wall_slide: { setup: "Dos, tête et bras contre le mur, bras en W.", go: "Fais glisser les bras vers le haut sans décoller du mur.", back: "Redescends en W." },
  band_ext_rot: { setup: "Coude collé au corps, plié à 90°, élastique en main.", go: "Tourne l'avant-bras vers l'extérieur, coude fixe.", back: "Reviens lentement." },
  pec_deck: { setup: "Assis, dos au dossier, avant-bras contre les coussins.", ...closeArms },
  fly: { setup: "Entre les deux poulies hautes, un pas en avant, bras ouverts.", ...closeArms },
  low_fly: { setup: "Entre les deux poulies basses, bras le long du corps.", ...closeArms, go: "Ramène les mains vers le haut et devant toi." },
  pullover: { setup: "Allongé, haltère tenu à deux mains au-dessus de la poitrine.", go: "Descends l'haltère derrière la tête, bras presque tendus.", back: "Ramène-le au-dessus de la poitrine.", effort: "back" },
  rear_delt: { setup: "Penché en avant, dos plat, haltères sous les épaules.", go: "Écarte les bras sur les côtés, coudes légèrement fléchis.", back: "Redescends lentement.", effort: "go" },
  reverse_pec_deck: { setup: "Assis face à la machine, bras tendus devant.", go: "Ouvre les bras vers l'arrière en serrant les omoplates.", back: "Reviens lentement.", effort: "go" },
  band_pull_apart: { setup: "Bras tendus devant toi, élastique à largeur d'épaules.", go: "Écarte les mains jusqu'à la poitrine.", back: "Reviens en contrôlant.", effort: "go" },
  face_pull: { setup: "Corde à hauteur du visage, bras tendus.", go: "Tire la corde vers ton visage, coudes hauts.", back: "Tends les bras lentement.", effort: "go" },
  straight_pulldown: { setup: "Debout face à la poulie haute, buste un peu penché, bras tendus.", go: "Descends la barre jusqu'aux cuisses, bras tendus.", back: "Remonte lentement." },
  chest_row: { setup: "Poitrine sur un banc incliné, haltères sous les épaules." },
  machine_row: { setup: "Assis, poitrine contre le coussin, bras tendus." },
  cable_row: { setup: "Assis, pieds calés, dos droit, bras tendus." },
  inverted_row: { setup: "Sous une barre, corps gainé, talons au sol.", go: "Tire la poitrine vers la barre.", back: "Redescends bras tendus." },
  band_row: { setup: "Assis, jambes tendues, élastique autour des pieds." },
  db_row: { setup: "Un genou et une main sur le banc, dos plat, haltère bras tendu." },
  wrist_curl: { setup: "Assis, avant-bras posés sur les cuisses, poignets dans le vide.", go: "Monte l'haltère en pliant le poignet.", back: "Redescends lentement." },
  cable_overhead: { setup: "Dos à la poulie, bras au-dessus de la tête, coudes pliés.", go: "Tends les bras vers l'avant et le haut.", back: "Reviens lentement derrière la tête." },
  overhead_ext: { setup: "Assis, haltère tenu à deux mains au-dessus de la tête.", go: "Descends l'haltère derrière la tête, coudes vers le haut.", back: "Tends les bras pour remonter.", effort: "back" },
  skull: { setup: "Allongé, barre tenue bras tendus au-dessus du front.", go: "Plie les coudes pour descendre la barre vers le front.", back: "Tends les bras.", effort: "back" },
  kickback: { setup: "Penché, un genou et une main sur le banc, bras collé au corps.", go: "Tends le bras vers l'arrière.", back: "Reviens à 90°." },
  farmer: { setup: "Un haltère lourd dans chaque main, épaules basses.", steps: [[0, "Marche à petits pas, buste droit et gainé"]] },
  seated_calf: { setup: "Assis, genoux sous le coussin, avant des pieds sur la cale." },
  press_calf: { setup: "Sur la presse, avant des pieds au bord de la plateforme, jambes presque tendues.", go: "Pousse avec la pointe des pieds.", back: "Laisse revenir lentement." },
  bicycle: { setup: "Sur le dos, épaules décollées, mains derrière la tête.", steps: [[0, "Coude vers le genou opposé, l'autre jambe tendue"], [0.5, "Change de côté"]] },
  cable_crunch: { setup: "À genoux face à la poulie, corde tenue près de la tête.", go: "Enroule le buste vers le sol, coudes vers les genoux.", back: "Remonte lentement." },
  leg_raise: { setup: "Allongé sur le dos, jambes tendues, bras au sol.", go: "Monte les jambes jusqu'à la verticale.", back: "Redescends lentement sans toucher le sol." },
  hanging_raise: { setup: "Suspendu à une barre, épaules actives.", go: "Monte les genoux vers la poitrine sans te balancer.", back: "Redescends en contrôlant." },
  ab_wheel: { setup: "À genoux, mains sur la roue sous les épaules.", go: "Roule vers l'avant, dos plat et abdos serrés.", back: "Ramène la roue en contractant les abdos.", effort: "back" },
  russian_twist: { setup: "Assis, buste penché en arrière, mains jointes.", steps: [[0, "Tourne le buste d'un côté"], [0.5, "Puis de l'autre, en contrôlant"]] },
  dead_bug: { setup: "Sur le dos, bras vers le plafond, genoux à 90°.", go: "Tends un bras derrière toi et la jambe opposée, bas du dos au sol.", back: "Reviens et change de côté." },
  side_plank: { setup: "Sur le côté, coude sous l'épaule, jambes tendues.", go: "Monte les hanches et tiens, corps aligné.", back: "Respire calmement sans bouger." },
  hollow: { setup: "Sur le dos, bras tendus derrière la tête.", go: "Décolle épaules et jambes, bas du dos plaqué au sol.", back: "Tiens la position en respirant." },
  pallof: { setup: "De profil à la poulie, poignée contre la poitrine.", go: "Pousse la poignée devant toi sans laisser le buste tourner.", back: "Ramène-la à la poitrine.", effort: "go" },
  bird_dog: { setup: "À quatre pattes, mains sous les épaules, genoux sous les hanches.", go: "Tends un bras devant et la jambe opposée derrière.", back: "Reviens et change de côté." },
  burpee: { setup: "Debout, pieds largeur de hanches.", steps: [[0, "Accroupis-toi, mains au sol"], [0.14, "Saute les pieds en arrière, en planche"], [0.34, "Ramène les pieds vers les mains"], [0.48, "Saute bras en l'air"], [0.72, "Réception souple, puis redresse-toi"]] },
  jumping_jack: { steps: [[0, "Saute en écartant bras et jambes"], [0.5, "Reviens pieds joints, bras le long du corps"]] },
  high_knees: { setup: "Debout, sur l'avant des pieds.", steps: [[0, "Cours sur place en montant les genoux à hauteur de hanches"]] },
  mountain: { setup: "En planche, mains sous les épaules.", steps: [[0, "Ramène un genou vers la poitrine"], [0.5, "Puis l'autre, vite, hanches basses"]] },
  jump_rope: { setup: "Coudes près du corps, la corde tourne avec les poignets.", steps: [[0, "Petits sauts sur l'avant des pieds"]] },
  battle_rope: { setup: "Mi-squat, une corde dans chaque main.", steps: [[0, "Fais onduler les cordes en alternant les bras"]] },
  treadmill: { setup: "Au milieu du tapis, sans tenir les poignées.", steps: [[0, "Cours en posant le pied sous toi, buste droit"]] },
  bike: { setup: "Selle à hauteur de hanche, genou un peu fléchi en bas.", steps: [[0, "Pédale à cadence régulière, buste stable"]] },
  rower: { setup: "Pieds sanglés, bras tendus, genoux pliés.", steps: [[0, "Pousse avec les jambes, puis bascule le buste, puis tire les bras"], [0.5, "Reviens : bras, buste, puis jambes"]] },
  elliptical: { steps: [[0, "Pousse avec les jambes et tire avec les bras, en rythme"]] },
  stairs: { steps: [[0, "Monte les marches à rythme régulier, sans t'appuyer de tout ton poids"]] },
  wrist_circles: { steps: [[0, "Fais tourner les poignets lentement, dans les deux sens"]] },
  hip_circles: { steps: [[0, "Fais de grands cercles avec le bassin, dans les deux sens"]] },
  breathing: { steps: [[0, "Inspire par le nez : le ventre se gonfle"], [0.5, "Souffle lentement : le ventre redescend"]] },
};
export const sayOf = id => SAY[id] || {};
