// Objectifs chiffrés sur 8 à 12 semaines : « 100 kg au développé couché », « 15 tractions d'affilée », « 3 min de
// gainage ». L'app construit la progression semaine par semaine (volume, force, intensité, semaines allégées,
// affûtage, test final), prescrit séries, répétitions et charges dans les séances, se recale sur ce que tu réussis
// vraiment, et fait passer le test final. Testé dans Node.
import { EXERCISES } from "./data.js";
import { state, e1rm } from "./store.js";

const DAY = 864e5, WEEK = 7 * DAY;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const roundTo = (v, step) => Math.round(v / step) * step;
const exName = id => EXERCISES[id]?.name || id;

export const KINDS = { load: { name: "Charge maximale", unit: "kg" }, reps: { name: "Répétitions d'affilée", unit: "reps" }, time: { name: "Temps tenu", unit: "s" } };
export const POPULAR = {
  load: ["bench", "squat", "deadlift", "ohp", "hip_thrust", "row"],
  reps: ["pullup", "pushup", "dips", "chinup", "air_squat"],
  time: ["plank", "wall_sit", "dead_hang", "side_plank"],
};
export const kindOf = exId => (EXERCISES[exId]?.type === "load" ? "load" : EXERCISES[exId]?.type === "time" ? "time" : "reps");
const stepOf = exId => Math.max(1, EXERCISES[exId]?.step || 2.5);
export const fmtValue = (kind, v) => (kind === "load" ? `${String(v).replace(".", ",")} kg` : kind === "time" ? (v >= 60 ? `${Math.floor(v / 60)} min${v % 60 ? ` ${String(v % 60).padStart(2, "0")}` : ""}` : `${v} s`) : `${v} rep${v > 1 ? "s" : ""}`);
// « Développé couché : 100 kg », « Tractions : 15 reps »
export const goalTitle = g => `${exName(g.exId)} : ${fmtValue(g.kind, g.target)}`;

// 1RM estimé en tenant compte du ressenti : 6 reps à RPE 8 (2 en réserve) ≈ 8 reps à l'échec
export const e1rmRpe = s => (s.weight > 0 ? e1rm(s.weight, (s.reps || 0) + (s.rpe ? clamp(10 - s.rpe, 0, 4) : 0)) : 0);
const measure = (kind, s) => (kind === "load" ? e1rmRpe(s) : s.reps || 0);

// Niveau actuel : meilleur 1RM estimé (charge) ou meilleure série (reps, secondes) des 6 dernières semaines, sinon le record
export function currentLevel(exId, st = state, now = Date.now()) {
  const kind = kindOf(exId);
  let best = 0;
  for (const s of st.sessions || []) if (s.date >= now - 42 * DAY) for (const x of s.sets || []) if (x.exId === exId) best = Math.max(best, measure(kind, x));
  const l = st.lifts?.[exId];
  if (!best && l) best = kind === "load" ? l.best || 0 : l.bestReps || 0;
  return kind === "load" ? roundTo(best, 0.5) : Math.round(best);
}
const sessionsWith = (exId, st) => (st.sessions || []).filter(s => s.sets?.some(x => x.exId === exId)).length;

// Objectif réaliste pour la durée : ~0,75 % de force par semaine (1,1 % pour qui débute sur l'exercice), plus pour les
// répétitions et le temps ; c'est aussi la limite du « réaliste » ci-dessous
const RATE = { load: [0.0075, 0.011], reps: [0.05, 0.07], time: [0.06, 0.08] };
const MIN_INC = { load: 2.5, reps: 2, time: 10 }, HARD = { load: 0.018, reps: 0.11, time: 0.12 };
export function suggestTarget(exId, base, weeks, st = state) {
  const kind = kindOf(exId), rate = RATE[kind][sessionsWith(exId, st) < 10 ? 1 : 0], v = base * (1 + rate * weeks);
  if (kind === "load") { const s = Math.max(2.5, stepOf(exId)); return Math.max(base + s, Math.floor(v / s) * s); } // arrondi vers le bas : reste réaliste
  if (kind === "time") return Math.max(base + MIN_INC.time, Math.floor(v / 5) * 5);
  return Math.max(base + MIN_INC.reps, Math.floor(v));
}
export function ambition(kind, base, target, weeks) {
  if (!(base > 0) || !(target > base)) return { level: 0, label: target <= base ? "Déjà atteint" : "À tester" };
  const ok = Math.max(base + MIN_INC[kind], base * (1 + RATE[kind][1] * weeks)) * 1.005;
  const hard = Math.max(ok + MIN_INC[kind], base * (1 + HARD[kind] * weeks));
  return target <= ok ? { level: 1, label: "Réaliste" } : target <= hard ? { level: 2, label: "Ambitieux" } : { level: 3, label: "Très ambitieux" };
}

/* ---------- Progression ---------- */
export const PHASES = { base: "Volume", force: "Force", pic: "Intensité", allege: "Semaine allégée", affute: "Affûtage", test: "Test final" };
// Dernière semaine : test ; avant-dernière : affûtage ; une semaine allégée toutes les 4 ; le reste en trois blocs
export function phaseOf(w, weeks) {
  if (w >= weeks) return "test";
  if (w === weeks - 1) return "affute";
  if (w % 4 === 0) return "allege";
  const r = (w - 1) / Math.max(1, weeks - 2);
  return r < 0.4 ? "base" : r < 0.75 ? "force" : "pic";
}
// Charge : séries × reps à un % du 1RM attendu ; répétitions et temps : séries à un % du max attendu
const PRESC = {
  load: { base: [4, 6, 0.78], force: [5, 4, 0.82], pic: [5, 3, 0.87], allege: [3, 5, 0.65], affute: [3, 2, 0.85], test: [1, 1, 1] },
  reps: { base: [5, 0, 0.5], force: [6, 0, 0.6], pic: [4, 0, 0.75], allege: [3, 0, 0.4], affute: [2, 0, 0.5], test: [1, 0, 1] },
};
export const weekOf = (g, now = Date.now()) => clamp(Math.floor((now - g.start) / WEEK) + 1, 1, g.weeks);
export const endOf = g => g.start + g.weeks * WEEK;
// Niveau attendu en semaine w si tout va bien : du départ à l'objectif, atteint à l'affûtage
export const expected = (g, w) => g.base + (g.target - g.base) * clamp((w - 1) / Math.max(1, g.weeks - 2), 0, 1);

// Ce qu'il faut faire en semaine w : { week, phase, sets, reps, weight? } (recalé par g.adjust selon les séances réussies)
export function prescription(g, w = weekOf(g)) {
  const phase = phaseOf(w, g.weeks), [sets, reps, pct] = PRESC[g.kind === "load" ? "load" : "reps"][phase];
  const E = expected(g, w) * (phase === "test" ? 1 : g.adjust || 1);
  if (g.kind === "load") { const step = stepOf(g.exId); return { week: w, phase, sets, reps, weight: phase === "test" ? g.target : Math.max(step, roundTo(E * pct, step)) }; }
  const unit = g.kind === "time" ? 5 : 1;
  return { week: w, phase, sets, reps: phase === "test" ? g.target : Math.max(unit, roundTo(E * pct, unit)) };
}
// Le programme complet, semaine par semaine
export const planOf = g => Array.from({ length: g.weeks }, (_, i) => prescription(g, i + 1));

export function newGoal({ exId, base, target, weeks = 10, perWeek = 2, now = Date.now() }) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const kind = kindOf(exId);
  return { id: `g${now.toString(36)}`, exId, kind, base: +base, target: +target, weeks: clamp(Math.round(weeks), 4, 16), perWeek: clamp(Math.round(perWeek), 1, 3),
    start: d.getTime(), adjust: 1, log: [], status: "active", at: now };
}
export const activeGoals = (st = state, now = Date.now()) => (st.goals || []).filter(g => g.status === "active" && now < endOf(g) + 7 * DAY);
export const activeGoal = (exId, st = state, now = Date.now()) => activeGoals(st, now).find(g => g.exId === exId) || null;

// Pour le moteur de séance : la prescription de la semaine sur l'exercice d'un objectif en cours (la semaine du test,
// les autres séances restent légères : celles de l'affûtage)
export function goalFix(exId, st = state, now = Date.now()) {
  const g = activeGoal(exId, st, now);
  if (!g) return null;
  const w = weekOf(g, now), p = prescription(g, phaseOf(w, g.weeks) === "test" ? Math.max(1, g.weeks - 1) : w);
  return { sets: p.sets, goal: p.reps, weight: p.weight || 0,
    note: `Objectif « ${goalTitle(g)} », semaine ${w}/${g.weeks} (${PHASES[phaseOf(w, g.weeks)].toLowerCase()}) : ${p.sets} × ${p.reps}${g.kind === "time" ? " s" : ""}${p.weight ? ` à ${String(p.weight).replace(".", ",")} kg` : ""}.` };
}

/* ---------- Suivi ---------- */
export function progressOf(g, st = state, now = Date.now()) {
  const w = weekOf(g, now), sessions = (st.sessions || []).filter(s => s.date >= g.start && s.sets?.some(x => x.exId === g.exId));
  let best = 0;
  for (const s of sessions) for (const x of s.sets) if (x.exId === g.exId) best = Math.max(best, measure(g.kind, x));
  best = g.kind === "load" ? roundTo(best, 0.5) : Math.round(best);
  const weekStart = g.start + (w - 1) * WEEK, thisWeek = sessions.filter(s => s.date >= weekStart && s.date < weekStart + WEEK && !s.programId?.startsWith("goal_test")).length;
  const a = g.adjust || 1, status = g.result ? (g.result.success ? "done" : "missed") : a > 1.02 ? "ahead" : a < 0.97 ? "behind" : "on";
  const reach = Math.max(best, g.result?.value || 0);
  return { week: w, phase: phaseOf(w, g.weeks), expected: expected(g, w), best, thisWeek, status,
    pct: g.target > g.base ? clamp((reach - g.base) / (g.target - g.base), 0, 1) : 1, daysLeft: Math.max(0, Math.ceil((endOf(g) - now) / DAY)) };
}
export const STATUS = { ahead: "En avance", on: "Dans les temps", behind: "Un peu en retard", done: "Objectif atteint", missed: "Test passé" };

// Après une séance : test final (résultat) ou séance du programme (on se recale : séries ratées → −4 %, toutes réussies
// facilement → +2 %). Renvoie ce qui a changé, pour l'écran de fin.
export function goalAfterSession(sum, st = state, now = Date.now()) {
  const out = [];
  for (const g of activeGoals(st, now)) {
    const sets = (sum.sets || []).filter(x => x.exId === g.exId && x.reps > 0);
    if (sum.goalTest === g.id || sum.programId === `goal_test_${g.id}`) {
      const value = g.kind === "load" ? Math.max(0, ...sets.map(x => x.weight)) : Math.max(0, ...sets.map(x => x.reps));
      g.result = { value, success: value >= g.target, at: sum.date };
      g.status = "finished"; g.at = now;
      out.push({ g, test: true, value, success: value >= g.target });
      continue;
    }
    if (!sets.length) continue;
    const p = prescription(g, weekOf(g, sum.date));
    if (p.phase === "test") continue;
    const hit = sets.filter(x => x.reps >= p.reps && (g.kind !== "load" || x.weight >= p.weight * 0.97)).length / sets.length;
    const rpes = sets.map(x => x.rpe).filter(Boolean), rpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 8;
    const before = g.adjust || 1;
    g.adjust = hit < 0.6 ? Math.max(0.85, before * 0.96) : hit === 1 && rpe <= 7.5 ? Math.min(1.1, before * 1.02) : before;
    g.adjust = Math.round(g.adjust * 1000) / 1000;
    g.log = [...(g.log || []), { d: sum.date, w: p.week, hit: Math.round(hit * 100) / 100, best: Math.round(Math.max(...sets.map(x => measure(g.kind, x))) * 10) / 10 }].slice(-40);
    g.at = now;
    out.push({ g, test: false, hit, adjust: g.adjust, change: g.adjust - before });
  }
  return out;
}

/* ---------- Séances ---------- */
const ACC = {
  bench: ["incline_db", "db_fly", "pushdown", "pushup", "dips"], squat: ["leg_press", "bulgarian", "rdl", "leg_curl", "lunge"],
  deadlift: ["row", "hip_thrust", "back_ext", "plank"], ohp: ["db_press", "lateral", "pushdown", "pike"],
  row: ["pullup", "face_pull", "curl", "inverted_row"], hip_thrust: ["rdl", "bulgarian", "glute_bridge", "leg_curl"],
  pullup: ["inverted_row", "row", "curl", "dead_hang"], chinup: ["inverted_row", "curl", "row", "dead_hang"],
  pushup: ["incline_pushup", "diamond", "plank", "bench_dips"], dips: ["pushup", "diamond", "pushdown", "bench_dips"],
  air_squat: ["lunge", "glute_bridge", "wall_sit", "jump_squat"], plank: ["side_plank", "dead_bug", "hollow", "bird_dog"],
  wall_sit: ["air_squat", "lunge", "glute_bridge"], dead_hang: ["pullup", "inverted_row", "farmer"], side_plank: ["plank", "dead_bug", "russian_twist"],
};
const ALLOWED = { gym: null, db: ["db", "bw", "band", "kb"], home: ["bw", "band"] };
export function accessoriesFor(exId, equipment = "gym") {
  const ok = id => EXERCISES[id] && id !== exId && (!ALLOWED[equipment] || ALLOWED[equipment].includes(EXERCISES[id].equip));
  const own = (ACC[exId] || []).filter(ok);
  const same = Object.keys(EXERCISES).filter(id => ok(id) && EXERCISES[id].muscle === EXERCISES[exId]?.muscle && !own.includes(id));
  return [...own, ...same].slice(0, 3);
}
const accItem = (id, st) => {
  const e = EXERCISES[id], last = st.lifts?.[id];
  if (e.type === "time") return { id, sets: 3, reps: [30, 45], weight: 0, rest: 45, rpe: 7 };
  if (e.type === "bw") return { id, sets: 3, reps: [8, 15], weight: 0, rest: 75, rpe: 8 };
  return { id, sets: 3, reps: [8, 12], weight: last?.weight || ({ machine: 20, cable: 10, bar: 20, smith: 20, db: 10, kb: 12 }[e.equip] || 0), rest: 90, rpe: 8 };
};
const catOf = exId => (["bw", "band"].includes(EXERCISES[exId]?.equip) ? "home" : "gym");

// La séance du programme cette semaine : l'exercice de l'objectif (prescrit) puis 2 à 3 exercices d'appoint
export function goalSession(g, st = state, now = Date.now()) {
  const p = prescription(g, weekOf(g, now));
  if (p.phase === "test") return testProgram(g);
  const main = { id: g.exId, sets: p.sets, reps: [p.reps, p.reps], weight: p.weight || 0, rpe: 8,
    rest: g.kind === "load" ? (p.reps <= 3 ? 180 : 150) : 120, fixed: { weight: p.weight || 0, goal: p.reps, sets: p.sets } };
  const acc = p.phase === "affute" ? [] : accessoriesFor(g.exId, st.profile?.equipment).slice(0, p.phase === "allege" ? 2 : 3);
  return { id: `goal_${g.id}`, name: `Objectif · ${exName(g.exId)}`.slice(0, 40), tag: `Semaine ${p.week}/${g.weeks} · ${PHASES[p.phase]}`, cat: catOf(g.exId), goalId: g.id,
    exercises: [main, ...acc.map(id => accItem(id, st))] };
}

// Test final : montée en charge fixée d'avance puis la tentative (et un 2e essai, plus haut si c'est réussi) ;
// pour les répétitions et le temps : une série d'échauffement puis la série au maximum
export function testProgram(g) {
  const step = stepOf(g.exId), T = g.target;
  const ramp = g.kind === "load"
    ? [[0.5, 5], [0.7, 3], [0.8, 2], [0.9, 1]].map(([p, r]) => ({ weight: Math.max(step, roundTo(T * p, step)), reps: r }))
      .concat({ weight: T, reps: 1, attempt: true }, { weight: T, reps: 1, attempt: true, retry: true })
    : [{ weight: 0, reps: Math.max(g.kind === "time" ? 10 : 1, roundTo(T * 0.3, g.kind === "time" ? 5 : 1)) }, { weight: 0, reps: T, attempt: true }];
  return { id: `goal_test_${g.id}`, name: `Test final · ${exName(g.exId)}`.slice(0, 40), tag: `Objectif : ${fmtValue(g.kind, T)}`, cat: catOf(g.exId), goalId: g.id, goalTest: g.id,
    exercises: [{ id: g.exId, sets: ramp.length, reps: [1, Math.max(...ramp.map(r => r.reps))], weight: ramp[0].weight, rest: g.kind === "load" ? 180 : 150, rpe: 9,
      fixed: { weight: ramp[0].weight, goal: ramp[0].reps, sets: ramp.length }, ramp }] };
}

// Pour le coach (IA en ligne ou locale)
export function goalsContext(st = state, now = Date.now()) {
  const list = activeGoals(st, now);
  if (!list.length) return "";
  return list.map(g => {
    const pr = progressOf(g, st, now), p = prescription(g, pr.week);
    return `Objectif chiffré en cours : « ${goalTitle(g)} » (départ ${fmtValue(g.kind, g.base)}), semaine ${pr.week}/${g.weeks} (${PHASES[p.phase]}), `
      + `prescription ${p.sets} × ${p.reps}${g.kind === "time" ? " s" : ""}${p.weight ? ` à ${p.weight} kg` : ""}, meilleur niveau mesuré ${fmtValue(g.kind, pr.best)}, ${STATUS[pr.status].toLowerCase()}.`;
  }).join(" ");
}
