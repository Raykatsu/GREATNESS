// Planification : programme de la semaine et adaptation à l'objectif.
import { GOALS } from "./data.js";
import { state, save, getProgram, todayIndex, sessionsOn, weekStart } from "./store.js";

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
  if (!g || program.simple || program.cat === "cardio" || program.cat === "custom") return program;
  let mains = 0;
  return {
    ...program,
    exercises: program.exercises.map(e => {
      if (e.reps[0] >= 20) return e; // exercices en secondes / endurance : on garde
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
