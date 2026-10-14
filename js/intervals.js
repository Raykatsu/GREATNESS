// Minuteur d'intervalles : Tabata, EMOM, AMRAP, circuits. Tout se déduit du temps écoulé (rien ne dérive, même si le
// téléphone se met en veille) : la suite des segments (préparation, effort, repos), où l'on en est, et les annonces
// à faire entre deux instants (voix et bips). En fin de séance, ce qui a été fait devient une séance de l'historique.
// Testé dans Node.
import { EXERCISES } from "./data.js";

export const MODES = {
  tabata: { name: "Tabata", desc: "20 s à fond, 10 s de repos, 8 tours : 4 minutes qui comptent." },
  emom: { name: "EMOM", desc: "Au début de chaque minute, tes répétitions ; le reste de la minute, tu récupères." },
  amrap: { name: "AMRAP", desc: "Le plus de tours possible du circuit dans le temps donné." },
  circuit: { name: "Circuit", desc: "Chaque exercice en temps, puis le suivant ; repos entre les tours." },
};
export const PRESETS = [
  { id: "tabata_burpee", name: "Tabata burpees", mode: "tabata", ex: [{ id: "burpee" }], work: 20, rest: 10, rounds: 8 },
  { id: "tabata_cardio", name: "Tabata cardio", mode: "tabata", ex: [{ id: "jumping_jack" }, { id: "mountain" }, { id: "high_knees" }, { id: "jump_squat" }], work: 20, rest: 10, rounds: 8 },
  { id: "tabata_abdos", name: "Tabata abdos", mode: "tabata", ex: [{ id: "crunch" }, { id: "plank" }, { id: "bicycle" }, { id: "leg_raise" }], work: 20, rest: 10, rounds: 8 },
  { id: "emom_10", name: "EMOM 10 min", mode: "emom", ex: [{ id: "pushup", reps: 10 }, { id: "air_squat", reps: 15 }], minutes: 10 },
  { id: "emom_burpee", name: "EMOM burpees", mode: "emom", ex: [{ id: "burpee", reps: 8 }], minutes: 8 },
  { id: "emom_kb", name: "EMOM kettlebell", mode: "emom", ex: [{ id: "kb_swing", reps: 15 }, { id: "kb_goblet", reps: 10 }], minutes: 12 },
  { id: "amrap_12", name: "AMRAP 12 min", mode: "amrap", ex: [{ id: "pushup", reps: 10 }, { id: "air_squat", reps: 15 }, { id: "crunch", reps: 20 }], minutes: 12 },
  { id: "amrap_20", name: "AMRAP 20 min", mode: "amrap", ex: [{ id: "burpee", reps: 5 }, { id: "lunge", reps: 20 }, { id: "pushup", reps: 10 }, { id: "mountain", reps: 30 }], minutes: 20 },
  { id: "circuit_full", name: "Circuit full body", mode: "circuit", ex: [{ id: "jumping_jack" }, { id: "pushup" }, { id: "air_squat" }, { id: "mountain" }, { id: "lunge" }, { id: "plank" }], work: 40, rest: 20, rounds: 3, restRound: 60 },
  { id: "circuit_jambes", name: "Circuit jambes", mode: "circuit", ex: [{ id: "air_squat" }, { id: "lunge" }, { id: "glute_bridge" }, { id: "jump_squat" }, { id: "wall_sit" }], work: 45, rest: 15, rounds: 3, restRound: 60 },
];

const clamp = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export const exName = id => EXERCISES[id]?.name || id;
// À dire : « 12 pompes », « 30 secondes de gainage » quand il y a un nombre à faire (EMOM, AMRAP), sinon le nom
export const exLabel = e => {
  if (!e?.reps) return exName(e?.id);
  const n = exName(e.id).toLowerCase();
  return EXERCISES[e.id]?.type === "time" ? `${e.reps} secondes de ${n}` : `${e.reps} ${n}`;
};

// Réglages valides, quoi qu'on reçoive (bornes, exercices connus)
export function normalize(cfg = {}) {
  const mode = MODES[cfg.mode] ? cfg.mode : "tabata";
  const reps = mode === "emom" || mode === "amrap";
  let ex = (Array.isArray(cfg.ex) ? cfg.ex : []).filter(e => e && EXERCISES[e.id]).slice(0, 12)
    .map(e => (reps ? { id: e.id, reps: clamp(e.reps, 1, 200, defaultReps(e.id)) } : { id: e.id }));
  if (!ex.length) ex = [reps ? { id: "burpee", reps: 8 } : { id: "burpee" }];
  return {
    mode, ex, name: String(cfg.name || "").slice(0, 40),
    work: clamp(cfg.work, 5, 300, mode === "circuit" ? 40 : 20),
    rest: clamp(cfg.rest, 0, 300, mode === "circuit" ? 20 : 10),
    rounds: clamp(cfg.rounds, 1, 30, mode === "circuit" ? 3 : 8),
    minutes: clamp(cfg.minutes, 1, 60, mode === "amrap" ? 12 : 10),
    restRound: clamp(cfg.restRound, 0, 300, 60),
    prep: clamp(cfg.prep, 0, 30, 10),
  };
}
const defaultReps = id => (EXERCISES[id]?.type === "time" ? 30 : /burpee|jump|box/.test(id) ? 8 : 12);

// Segments : { kind: prep | work | rest, dur (s), t0 (début), ex (exercice en cours, ou le suivant pendant un repos),
// round, step (exercice dans le tour), last (dernier repos avant la fin), roundRest (repos entre deux tours) }
export function timeline(cfg) {
  const c = normalize(cfg), ex = c.ex, out = [];
  const push = (kind, dur, o = {}) => { if (dur > 0) out.push({ kind, dur, ...o }); };
  push("prep", c.prep, { ex: ex[0], round: 1, step: 0 });
  if (c.mode === "tabata") {
    for (let r = 1; r <= c.rounds; r++) {
      push("work", c.work, { ex: ex[(r - 1) % ex.length], round: r, step: (r - 1) % ex.length });
      if (r < c.rounds) push("rest", c.rest, { ex: ex[r % ex.length], round: r, step: r % ex.length });
    }
  } else if (c.mode === "emom") {
    for (let m = 1; m <= c.minutes; m++) push("work", 60, { ex: ex[(m - 1) % ex.length], round: m, step: (m - 1) % ex.length });
  } else if (c.mode === "amrap") {
    push("work", c.minutes * 60, { ex: ex[0], round: 1, step: 0, amrap: true });
  } else {
    for (let r = 1; r <= c.rounds; r++) ex.forEach((e, i) => {
      push("work", c.work, { ex: e, round: r, step: i });
      const end = i === ex.length - 1;
      if (!(end && r === c.rounds)) push("rest", end ? c.restRound : c.rest, { ex: end ? ex[0] : ex[i + 1], round: end ? r + 1 : r, step: end ? 0 : i + 1, roundRest: end });
    });
  }
  let t = 0;
  for (const s of out) { s.t0 = t; t += s.dur; }
  return out;
}
export const totalOf = segs => (segs.length ? segs.at(-1).t0 + segs.at(-1).dur : 0);
export const workOf = segs => segs.filter(s => s.kind === "work").reduce((a, s) => a + s.dur, 0);

// Où l'on en est à l'instant t (secondes de minuteur, pauses exclues)
export function at(segs, t) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t < s.t0 + s.dur) return { i, seg: s, left: s.t0 + s.dur - t, into: Math.max(0, t - s.t0), done: false };
  }
  return { i: segs.length, seg: null, left: 0, into: 0, done: true };
}

// Tours à afficher : « Tour 3 / 8 », « Minute 4 / 10 »
export function roundLabel(cfg, seg) {
  const c = normalize(cfg);
  if (!seg) return "";
  if (c.mode === "emom") return `Minute ${seg.round} / ${c.minutes}`;
  if (c.mode === "amrap") return `${c.minutes} min`;
  if (c.mode === "circuit") return `Tour ${Math.min(seg.round, c.rounds)} / ${c.rounds} · exercice ${seg.step + 1} / ${c.ex.length}`;
  return `Tour ${seg.round} / ${c.rounds}`;
}

// Annonce au début d'un segment
function sayStart(c, s, segs, i) {
  const n = exName(s.ex?.id);
  if (s.kind === "prep") return c.mode === "amrap" ? `Prépare-toi. ${c.minutes} minutes, le plus de tours possible.` : `Prépare-toi : ${c.mode === "emom" ? exLabel(s.ex) : n}.`;
  if (s.kind === "rest") {
    if (s.roundRest) return `Fin du tour ${s.round - 1}. Repos ${s.dur} secondes.`;
    const left = segs.slice(i).filter(x => x.kind === "work").length, one = c.ex.length === 1;
    if (left === 1) return one ? "Repos. Dernier tour !" : `Repos. Dernier effort : ${n} !`;
    return one ? `Repos. Encore ${left} tours.` : `Repos. Ensuite : ${n}.`;
  }
  if (c.mode === "emom") return `Minute ${s.round} : ${exLabel(s.ex)}.`;
  if (c.mode === "amrap") return "C'est parti !";
  if (c.mode === "circuit") return `${n}, ${s.dur} secondes.`;
  return c.ex.length > 1 ? `${n} !` : "C'est parti !";
}

// Ce qui se passe entre t0 (exclu) et t1 (inclus) : [{ t, beep: tick | go | rest | end, say? }], dans l'ordre.
// Bips : 3, 2, 1 avant chaque changement, un long au départ de l'effort. Pour les longs efforts (AMRAP…) :
// mi-temps, dernière minute, 10 secondes.
export function events(cfg, segs, t0, t1) {
  const c = normalize(cfg), out = [], total = totalOf(segs);
  const add = (t, e) => { if (t > t0 && t <= t1) out.push({ t, ...e }); };
  segs.forEach((s, i) => {
    add(s.t0 || 1e-6, { beep: s.kind === "work" ? "go" : s.kind === "rest" ? "rest" : null, say: sayStart(c, s, segs, i), seg: i });
    const end = s.t0 + s.dur;
    for (const k of [3, 2, 1]) if (s.dur > k + 1) add(end - k, { beep: "tick" });
    if (s.kind === "work" && s.dur >= 180) {
      add(s.t0 + Math.round(s.dur / 2), { say: "Mi-temps !" });
      add(end - 60, { say: "Dernière minute !" });
    }
    if (s.kind === "work" && s.dur >= 45 && c.mode !== "emom") add(end - 10, { say: "10 secondes !" });
  });
  add(total, { beep: "end", say: "Terminé ! Bien joué." });
  return out.sort((a, b) => a.t - b.t).map(({ seg, ...e }) => (e.beep == null ? (delete e.beep, e) : e));
}

// La séance pour l'historique : le travail fait (temps d'effort par exercice, ou tours de l'AMRAP), sans séries de
// musculation (pour ne pas fausser records et charges) ; XP selon le temps d'effort. `skipped` : les plages de temps
// sautées avec « Passer » [[de, à]…], qui ne comptent pas.
export function sessionOf(cfg, { startedAt = Date.now(), elapsed = 0, amrapRounds = 0, skipped = [], id } = {}) {
  const c = normalize(cfg), segs = timeline(c);
  const lost = (a, b) => skipped.reduce((n, [x, y]) => n + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
  const spent = s => { const a = s.t0, b = Math.min(s.t0 + s.dur, elapsed); return b > a ? Math.max(0, b - a - lost(a, b)) : 0; };
  let work = [], workSec = 0, rounds = 0;
  if (c.mode === "amrap") {
    workSec = spent(segs.find(x => x.amrap));
    rounds = Math.max(0, Math.round(amrapRounds));
    for (let r = 0; r < rounds; r++) for (const e of c.ex) work.push({ exId: e.id, reps: e.reps });
  } else {
    for (const s of segs) {
      if (s.kind !== "work") continue;
      const sec = spent(s);
      if (sec < Math.min(10, s.dur * 0.5)) continue; // à peine commencé : ne compte pas
      workSec += sec;
      work.push({ exId: s.ex.id, sec: Math.round(sec), ...(c.mode === "emom" ? { reps: s.ex.reps } : {}) });
      rounds = Math.max(rounds, s.round);
    }
  }
  const name = c.name || `${MODES[c.mode].name} · ${c.ex.length === 1 ? exName(c.ex[0].id) : `${c.ex.length} exercices`}`;
  return {
    id: id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
    date: startedAt, programId: `interval_${c.mode}`, name, kind: "interval",
    durationSec: Math.round(Math.max(0, elapsed - lost(0, elapsed))), volume: 0, sets: [], prs: [], xp: Math.round(workSec / 6 + work.length * 4),
    iv: { mode: c.mode, rounds, workSec: Math.round(workSec), work, cfg: c },
  };
}
// Résumé court d'une séance d'intervalles : « 8 tours · 2 min 40 d'effort »
export function ivSummary(s) {
  const iv = s.iv || {}, m = Math.floor((iv.workSec || 0) / 60), sec = (iv.workSec || 0) % 60;
  const effort = m ? `${m} min${sec ? ` ${String(sec).padStart(2, "0")}` : ""}` : `${sec} s`;
  const r = iv.mode === "amrap" ? `${iv.rounds} tour${iv.rounds > 1 ? "s" : ""} complet${iv.rounds > 1 ? "s" : ""}` : iv.mode === "emom" ? `${iv.rounds} minute${iv.rounds > 1 ? "s" : ""}` : `${iv.rounds} tour${iv.rounds > 1 ? "s" : ""}`;
  return `${MODES[iv.mode]?.name || "Intervalles"} · ${r} · ${effort} d'effort`;
}
