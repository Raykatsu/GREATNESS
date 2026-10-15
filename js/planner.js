// Planification : programme de la semaine et adaptation à l'objectif.
import { GOALS, EXERCISES } from "./data.js";
import { state, save, getProgram, todayIndex, sessionsOn, weekStart } from "./store.js";
import { CLASSICS, CLASSIC_DAYS } from "./classics.js";

// Jours (0 = lundi) et séances selon le nombre de jours et le matériel.
const LAYOUTS = {
  gym: {
    2: [[0, "full_a"], [3, "full_b"]],
    3: [[0, "push"], [2, "pull"], [4, "legs"]],
    4: [[0, "upper"], [1, "lower"], [3, "upper_b"], [4, "lower_b"]],
    5: [[0, "push"], [1, "pull"], [2, "legs"], [4, "upper"], [5, "lower"]],
    6: [[0, "push"], [1, "pull"], [2, "legs"], [3, "push_b"], [4, "pull_b"], [5, "legs_b"]],
  },
  db: {
    2: [[0, "home_db"], [3, "home_full"]],
    3: [[0, "home_db"], [2, "home_upper"], [4, "home_lower"]],
    4: [[0, "home_db"], [1, "home_lower"], [3, "home_upper"], [5, "hiit"]],
    5: [[0, "home_db"], [1, "home_lower"], [2, "hiit"], [4, "home_upper"], [5, "core"]],
    6: [[0, "home_db"], [1, "home_lower"], [2, "hiit"], [3, "home_upper"], [4, "core"], [5, "home_full"]],
  },
  home: {
    2: [[0, "home_full"], [3, "home_full"]],
    3: [[0, "home_upper"], [2, "home_lower"], [4, "hiit"]],
    4: [[0, "home_upper"], [1, "home_lower"], [3, "home_full"], [5, "hiit"]],
    5: [[0, "home_upper"], [1, "home_lower"], [2, "hiit"], [4, "home_full"], [5, "core"]],
    6: [[0, "home_upper"], [1, "home_lower"], [2, "hiit"], [3, "home_full"], [4, "core"], [5, "cardio_rope"]],
  },
};

export function generateWeekPlan({ days = state.profile.days, equipment = state.profile.equipment, goal = state.profile.goal } = {}) {
  // programme célèbre en cours : ses jours d'entraînement (la séance suivante du programme), mobilité le dimanche
  if (state.classic && CLASSICS[state.classic.id]) {
    const plan = { 6: "mobility" };
    CLASSIC_DAYS[CLASSICS[state.classic.id].days].forEach(d => (plan[d] = "classic"));
    return plan;
  }
  const layout = (LAYOUTS[equipment] || LAYOUTS.gym)[Math.min(6, Math.max(2, days))];
  const plan = {};
  layout.forEach(([d, id]) => (plan[d] = id));
  // En sèche ou forme, on ajoute du cardio sur un jour libre.
  if ((goal === "seche" || goal === "forme") && days <= 4) {
    const free = [5, 6, 2, 3].find(d => !plan[d]);
    if (free !== undefined) plan[free] = "hiit";
  }
  // Mobilité le dimanche si libre.
  if (!plan[6]) plan[6] = "mobility";
  // On garde les séances perso déjà placées par l'utilisateur.
  Object.entries(state.weekPlan || {}).forEach(([d, id]) => { if (String(id).startsWith("c") && getProgram(id)) plan[d] = id; });
  return plan;
}

export function ensureWeekPlan() {
  if (!state.weekPlan) { state.weekPlan = generateWeekPlan(); save(); }
  return state.weekPlan;
}

// Séance du jour : planifiée, sinon une séance de récupération.
export function todaysMission() {
  const plan = ensureWeekPlan();
  const id = plan[todayIndex()];
  const doneToday = sessionsOn(new Date()).length > 0;
  const p = id ? getProgram(id) : null;
  if (p) return { program: p, planned: true, doneToday, rest: p.id === "mobility" };
  return { program: getProgram("mobility"), planned: false, doneToday, rest: true };
}

// État de chaque jour de la semaine pour la frise.
export function weekStrip() {
  const plan = ensureWeekPlan();
  const start = weekStart();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const done = sessionsOn(d);
    return {
      i, date: d, label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
      num: d.getDate(), program: plan[i] ? getProgram(plan[i]) : null, done: done.length > 0,
      today: i === todayIndex(), past: i < todayIndex(),
    };
  });
}

// Adapte reps / repos / RPE à l'objectif. Les 2 premiers exercices "charge" sont les mouvements principaux.
export function adaptToGoal(program, goal = state.profile.goal) {
  const g = GOALS[goal];
  if (!g || program.simple || program.cat === "cardio" || program.cat === "custom" || program.classic) return program; // programme célèbre : ses propres séries
  let mains = 0;
  return {
    ...program,
    exercises: program.exercises.map(e => {
      if (e.reps[0] >= 20 || e.fixed) return e; // exercices en secondes / endurance, charge imposée (objectif chiffré) : on garde
      const main = mains < 2 && e.weight > 0 && (mains++, true);
      return {
        ...e,
        reps: main ? g.mainReps : g.accReps,
        rest: main ? g.mainRest : Math.min(e.rest, g.accRest + 15),
        rpe: Math.min(e.rpe, g.rpe + (main ? 0 : 0.5)),
      };
    }),
  };
}

export function estimateMinutes(program) {
  const sec = program.exercises.reduce((a, e) => a + e.sets * (e.rest + (e.reps[1] > 20 ? e.reps[1] : 40)), 0);
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

/* ---------- Génération automatique d'une séance ---------- */

// Groupes proposés à l'utilisateur → muscles de la bibliothèque.
export const GROUPS = {
  pecs: { name: "Pecs", muscles: ["Pectoraux"] },
  dos: { name: "Dos", muscles: ["Dos", "Lombaires"] },
  epaules: { name: "Épaules", muscles: ["Épaules", "Trapèzes"] },
  biceps: { name: "Biceps", muscles: ["Biceps", "Avant-bras"] },
  triceps: { name: "Triceps", muscles: ["Triceps"] },
  jambes: { name: "Jambes", muscles: ["Quadriceps", "Ischios", "Chaîne post.", "Mollets"] },
  fessiers: { name: "Fessiers", muscles: ["Fessiers", "Ischios"] },
  abdos: { name: "Abdos", muscles: ["Abdos"] },
  cardio: { name: "Cardio", muscles: ["Cardio"] },
  mobilite: { name: "Mobilité", muscles: ["Mobilité"] },
};
// Raccourcis
export const GROUP_SETS = {
  bras: ["biceps", "triceps"], haut: ["pecs", "dos", "epaules", "biceps", "triceps"], bas: ["jambes", "fessiers"],
  push: ["pecs", "epaules", "triceps"], pull: ["dos", "biceps"], full: ["jambes", "pecs", "dos", "epaules", "abdos"],
};

const ALLOWED = { gym: null, db: ["db", "bw", "band", "kb"], home: ["bw", "band"] };

export function generateSession({ groups = ["full"], minutes = 45, equipment = state.profile.equipment, goal = state.profile.goal, name } = {}) {
  const keys = [...new Set(groups.flatMap(g => GROUP_SETS[g] || [g]).filter(g => GROUPS[g]))];
  if (!keys.length) keys.push(...GROUP_SETS.full);
  const allowed = ALLOWED[equipment] || null;
  const g = GOALS[goal] || GOALS.muscle;
  const onlyCardio = keys.every(k => k === "cardio" || k === "mobilite");
  const count = Math.max(3, Math.min(9, Math.round(minutes / (onlyCardio ? 5 : 7))));
  // candidats par groupe, dans l'ordre de la bibliothèque (exercices de base d'abord)
  const pools = keys.map(k => Object.entries(EXERCISES)
    .filter(([, e]) => GROUPS[k].muscles.includes(e.muscle) && (!allowed || allowed.includes(e.equip)))
    .map(([id]) => id));
  const picked = [];
  for (let round = 0; picked.length < count && round < 6; round++) {
    pools.forEach(pool => {
      if (picked.length >= count) return;
      // un peu de variété : on pioche parmi les 3 premiers restants
      const left = pool.filter(id => !picked.includes(id));
      if (!left.length) return;
      const choice = left[Math.floor(Math.random() * Math.min(round === 0 ? 2 : 3, left.length))];
      picked.push(choice);
    });
  }
  const exercises = picked.map((id, i) => {
    const e = EXERCISES[id];
    const last = state.lifts[id];
    if (e.type === "time") {
      const mob = e.muscle === "Mobilité", machine = e.equip === "machine";
      return { id, sets: machine ? 1 : mob ? 2 : 3, reps: machine ? [300, 600] : mob ? [40, 60] : [30, 45], weight: 0, rest: mob ? 10 : machine ? 30 : 45, rpe: mob ? 5 : 7 };
    }
    const main = i < 2 && e.type === "load";
    const defW = { machine: 20, cable: 10, bar: 20, smith: 20, db: 10, kb: 12 }[e.equip] || 0;
    return {
      id, sets: main ? 4 : 3, reps: main ? g.mainReps : g.accReps,
      weight: e.type === "load" ? last?.weight || defW : 0,
      rest: main ? g.mainRest : g.accRest + 15, rpe: g.rpe,
    };
  });
  const isFull = groups.includes("full") || keys.length > 3;
  const label = name || `${isFull ? "Full body" : keys.map(k => GROUPS[k].name).join(" & ")} · ${minutes} min`;
  return { name: label.slice(0, 40), tag: `${keys.map(k => GROUPS[k].name).join(" · ")} · générée`, exercises };
}

/* ---------- Cycles : semaine allégée toutes les 7 semaines ---------- */
export function cycleInfo(now = Date.now()) {
  if (!state.cycleStart || state.profile.deload === false) return { week: 0, deload: false, next: null };
  const week = Math.floor((now - state.cycleStart) / (7 * 864e5)) + 1;
  const pos = ((week - 1) % 7) + 1; // 1..7, la 7e est allégée
  return { week, pos, deload: pos === 7, next: pos === 7 ? 0 : 7 - pos };
}

// Séances de musculation / cardio (pas les étirements) : on propose l'échauffement et le retour au calme.
const LIGHT = new Set(["mobility", "stretch", "care"]);
export const isWorkout = p => !!p && !p.free && !LIGHT.has(p.cat) && !p.simple;

// Échauffement adapté aux muscles de la séance.
const UPPER = new Set(["Pectoraux", "Dos", "Épaules", "Trapèzes", "Biceps", "Triceps", "Avant-bras"]);
const LOWER = new Set(["Quadriceps", "Ischios", "Fessiers", "Mollets", "Lombaires", "Chaîne post."]);
export function warmupFor(p) {
  const ms = (p?.exercises || []).map(e => EXERCISES[e.id]?.muscle).filter(Boolean);
  const up = ms.filter(m => UPPER.has(m)).length, low = ms.filter(m => LOWER.has(m)).length;
  if (ms.length && up / ms.length >= 0.7) return "warmup_upper";
  if (ms.length && low / ms.length >= 0.7) return "warmup_lower";
  return "warmup_full";
}
