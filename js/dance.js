// Le mannequin musclé qui danse sur ta musique : des pas de danse vus de face (mêmes réglages de pose que les démos
// 3D : bassin, buste, bras, jambes, body.js solveFront), enchaînés toutes les 2 mesures (8 temps) et calés sur le tempo
// du morceau. Tempo : celui du morceau quand on le connaît, sinon celui que tu tapes en rythme, sinon 100 BPM. Sur
// chaque temps, le corps « pulse » (act). Les pieds restent au sol (sauf les sauts). Sans DOM : testé dans Node.
import { FSTAND, solveFront, L, FLOOR } from "./body.js";

export const DEFAULT_BPM = 100;
export const PHRASE = 8; // temps par pas de danse
const TAU = Math.PI * 2;
const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
const lerp = (a, b, t) => a + (b - a) * t;
// rebond : au plus bas sur le temps (f = 0), remonté entre deux temps
const bounce = f => 0.5 + 0.5 * Math.cos(TAU * f);
// pulsation d'un temps : 1 sur le temps, s'éteint avant le suivant
export const beatPulse = f => Math.exp(-5 * (((f % 1) + 1) % 1));

// Les pas : b = temps dans la phrase (0 → 8), f = fraction du temps en cours. Chacun renvoie une pose partielle (FSTAND
// complète le reste) et les muscles qui travaillent.
export const MOVES = {
  // groove : rebond des genoux, bras pliés qui balancent l'un après l'autre, hanches qui ondulent
  groove: (b, f) => {
    const s = Math.sin(Math.PI * b), k = 32 * bounce(f);
    return { kneeL: k, kneeR: k, legL: 7, legR: 7, armL: 22 + 14 * s, armR: 22 - 14 * s, elbowL: 98, elbowR: 98,
      luaL: 0.8 + 0.15 * s, luaR: 0.8 - 0.15 * s, x: 50 + 1.4 * s, lean: -3 * s, head: 5 * s };
  },
  // pas chassé : un pas d'un côté sur deux temps, puis de l'autre ; les bras s'ouvrent avec le pas
  step: (b, f) => {
    const side = Math.floor(b / 2) % 2 ? -1 : 1, t = ease((b % 2) / 2), k = 26 * bounce(f), open = Math.sin(Math.PI * ((b % 2) / 2));
    return { x: 50 + side * lerp(-3.5, 3.5, t), kneeL: k, kneeR: k, legL: 6 + (side < 0 ? 10 : 0) * open, legR: 6 + (side > 0 ? 10 : 0) * open,
      armL: 18 + 40 * open, armR: 18 + 40 * open, elbowL: 30, elbowR: 30, lean: side * -2 * open, head: side * 4 * open };
  },
  // « raise the roof » : mains en l'air, coudes pliés, on pousse vers le haut sur chaque temps
  roof: (b, f) => {
    const push = bounce(f), k = 28 * bounce(f);
    return { armL: 152, armR: 152, elbowL: 72 - 46 * push, elbowR: 72 - 46 * push, kneeL: k, kneeR: k, legL: 8, legR: 8, head: 4 * Math.sin(Math.PI * b), shrug: 1.5 * push };
  },
  // double biceps : la pose du culturiste, contractée sur les temps 1 et 5, relâchée entre deux
  flex: (b, f) => {
    const hit = Math.floor(b) % 4 === 0 ? Math.exp(-2.4 * f) : 0.35, sq = 12 + 14 * hit;
    return { armL: 92, armR: 92, elbowL: 98 + 22 * hit, elbowR: 98 + 22 * hit, legL: 12, legR: 12, kneeL: sq, kneeR: sq, shrug: 2.2 * hit, luaL: 0.97, luaR: 0.97 };
  },
  // vague : bras à l'horizontale, une ondulation qui passe d'une main à l'autre
  wave: (b, f) => {
    const w = TAU * (b / 4), k = 22 * bounce(f);
    return { armL: 88 + 14 * Math.sin(w), armR: 88 + 14 * Math.sin(w + Math.PI), elbowL: 28 * Math.sin(w + 1), elbowR: 28 * Math.sin(w + Math.PI + 1),
      kneeL: k, kneeR: k, legL: 7, legR: 7, lean: 3 * Math.sin(w), shrug: 1.2 * Math.max(0, Math.sin(w)) };
  },
  // sauts (morceaux rapides) : petits bonds sur les temps, bras en l'air qui battent la mesure
  jump: (b, f) => {
    const air = Math.max(0, Math.sin(Math.PI * f)), k = 40 * bounce(f);
    return { hop: 3.2 * air, kneeL: k, kneeR: k, legL: 8, legR: 8, armL: 165 - 25 * bounce(f), armR: 165 - 25 * bounce(f), elbowL: 18, elbowR: 18 };
  },
};
// L'enchaînement selon le tempo : lent (balancé, poses), moyen, rapide (sauts)
export const SEQUENCE = { slow: ["groove", "flex", "wave", "flex"], mid: ["groove", "step", "roof", "flex"], fast: ["groove", "jump", "roof", "flex"] };
export const bandOf = bpm => (bpm < 90 ? "slow" : bpm > 125 ? "fast" : "mid");

// Pose à l'instant `beat` (temps écoulés depuis le début, nombre réel) pour un tempo donné
export function danceQ(beat, bpm = DEFAULT_BPM) {
  const seq = SEQUENCE[bandOf(bpm)], phrase = Math.floor(beat / PHRASE), b = ((beat % PHRASE) + PHRASE) % PHRASE, f = b % 1;
  const name = seq[((phrase % seq.length) + seq.length) % seq.length], prev = seq[(((phrase - 1) % seq.length) + seq.length) % seq.length];
  let q = { ...FSTAND, ...MOVES[name](b, f) };
  // passage d'un pas à l'autre : fondu sur les deux premiers temps, depuis la dernière pose du pas précédent (sans à-coup)
  if (b < 2 && prev !== name) {
    const from = { ...FSTAND, ...MOVES[prev](PHRASE - 1e-6, 1 - 1e-6) }, t = ease(b / 2);
    for (const k of Object.keys(q)) if (typeof q[k] === "number" && typeof from[k] === "number") q[k] = lerp(from[k], q[k], t);
  }
  // les pieds au sol : le bassin descend quand les genoux plient (puis le saut, s'il y en a un)
  const j = solveFront(q), lowest = Math.max(j.AL[1], j.AR[1]);
  q.y += FLOOR - L.ankle - lowest - (q.hop || 0);
  delete q.hop;
  return { q, move: name, act: name === "flex" ? Math.max(beatPulse(f) * 0.6, Math.floor(b) % 4 === 0 ? Math.exp(-2.4 * f) : 0) : beatPulse(f) };
}

// « Tape en rythme » : le tempo des derniers coups (au moins 4, intervalles cohérents), et le temps du dernier coup
export function tapTempo(times) {
  const t = times.slice(-8);
  if (t.length < 4) return null;
  const gaps = t.slice(1).map((x, i) => x - t[i]).filter(g => g > 250 && g < 1500).sort((a, b) => a - b);
  if (gaps.length < 3) return null;
  const med = gaps[Math.floor(gaps.length / 2)];
  if (gaps.some(g => Math.abs(g - med) > med * 0.35)) return null; // pas régulier : on attend
  const bpm = Math.round(60000 / med);
  return bpm >= 50 && bpm <= 220 ? { bpm, at: t.at(-1) } : null;
}
