// Planification : programme de la semaine et adaptation à l'objectif.
import { GOALS, EXERCISES } from "./data.js";
import { state, save, getProgram, sessionsOn, weekStart } from "./store.js";
import { CLASSICS, CLASSIC_DAYS } from "./classics.js";
import { LOC } from "./i18n.js";

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

// Semaine adaptée (js/weekadapt.js) : séances déplacées, séance allégée, propositions refusées, pour la semaine en cours
// seulement (le programme type ne change pas). moves : { jour (0 = lundi) : programme, ou null pour un jour de repos }.
export function adaptOf(now = new Date()) {
  const week = weekStart(now).getTime(), a = state.weekAdapt;
  return a && a.week === week ? a : { week, moves: {}, light: [], skip: [] };
}
// Programme de la semaine en cours : le programme type, avec les déplacements de cette semaine
export function weekPlanNow(now = new Date()) {
  return { ...ensureWeekPlan(), ...adaptOf(now).moves };
}
const dayOf = now => (now.getDay() + 6) % 7;

// Séance du jour : planifiée, sinon une séance de récupération.
export function todaysMission(now = new Date()) {
  const plan = weekPlanNow(now);
  const id = plan[dayOf(now)];
  const doneToday = sessionsOn(now).length > 0;
  const p = id ? getProgram(id) : null;
  const light = adaptOf(now).light.includes(dayOf(now)); // allégée cette semaine (pic de charge)
  if (p) return { program: p, planned: true, doneToday, rest: p.id === "mobility", light };
  return { program: getProgram("mobility"), planned: false, doneToday, rest: true, light: false };
}

// État de chaque jour de la semaine pour la frise.
export function weekStrip(now = new Date()) {
  const plan = weekPlanNow(now);
  const start = weekStart(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const done = sessionsOn(d);
    return {
      i, date: d, label: d.toLocaleDateString(LOC(), { weekday: "short" }).replace(".", ""),
      num: d.getDate(), program: plan[i] ? getProgram(plan[i]) : null, done: done.length > 0,
      today: i === dayOf(now), past: i < dayOf(now),
    };
  });
}

// Adapte reps / repos / RPE à l'objectif, au niveau et au bloc du cycle. Les 2 premiers exercices "charge" sont les
// mouvements principaux. Le niveau règle l'intensité : un débutant garde de la marge (RPE plus bas), un avancé pousse un
// peu plus près de l'échec. Le bloc (voir cycleInfo) déplace la fourchette : plus de reps en Volume, moins en Pic.
export function adaptToGoal(program, goal = state.profile.goal, experience = state.profile.experience, block = cycleInfo().block) {
  const g = GOALS[goal];
  if (!g || program.simple || program.cat === "cardio" || program.cat === "custom" || program.classic) return program; // programme célèbre : ses propres séries
  const expDelta = experience === "debutant" ? -1 : experience === "avance" ? 0.5 : 0;
  const T = blockTargets(goal, block);
  let mains = 0;
  return {
    ...program,
    exercises: program.exercises.map(e => {
      if (e.reps[0] >= 20 || e.fixed) return e; // exercices en secondes / endurance, charge imposée (objectif chiffré) : on garde
      const main = mains < 2 && e.weight > 0 && (mains++, true);
      return {
        ...e,
        reps: main ? T.main : T.acc,
        rest: main ? T.mainRest : Math.min(e.rest, g.accRest + 15),
        rpe: Math.max(5, Math.min(9.5, Math.min(e.rpe, T.rpe + (main ? 0 : 0.5)) + expDelta)),
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

/* ---------- Cycles de 7 semaines : Volume, Force, Pic, puis une semaine allégée ---------- */
// Périodisation : trois blocs de 2 semaines, puis la récupération. La fourchette de reps et le ressenti visé suivent le
// bloc ; la double progression (engine.js) fait monter les charges quand la fourchette descend (Volume → Force → Pic).
export const BLOCKS = {
  volume: { name: "Volume", text: "Plus de répétitions, avec un peu de marge : on construit la base." },
  force: { name: "Force", text: "La fourchette de ton objectif, avec des charges qui montent." },
  pic: { name: "Pic", text: "Moins de répétitions, plus lourd : tu vas chercher tes records." },
  deload: { name: "Récupération", text: "Charges et volume réduits : le corps encaisse le cycle pour repartir plus fort." },
};
export const blockAt = pos => (pos >= 7 ? "deload" : pos >= 5 ? "pic" : pos >= 3 ? "force" : "volume");
// Cibles d'un bloc pour un objectif : fourchettes des mouvements principaux et des accessoires, ressenti, repos
export function blockTargets(goal = state.profile.goal, block = null) {
  const g = GOALS[goal] || GOALS.muscle, [lo, hi] = g.mainReps, mid = Math.round((lo + hi) / 2), [alo, ahi] = g.accReps;
  if (block === "volume") return { main: [mid, hi + 2], acc: [Math.min(20, alo + 2), Math.min(20, ahi + 2)], rpe: g.rpe - 0.5, mainRest: g.mainRest };
  if (block === "pic") return { main: [Math.max(3, lo - 2), mid], acc: [alo, ahi], rpe: g.rpe + 0.5, mainRest: g.mainRest + 30 };
  return { main: [lo, hi], acc: [alo, ahi], rpe: g.rpe, mainRest: g.mainRest };
}
export function cycleInfo(now = Date.now()) {
  if (!state.cycleStart || state.profile.deload === false) return { week: 0, deload: false, next: null, block: null };
  const week = Math.floor((now - state.cycleStart) / (7 * 864e5)) + 1;
  const pos = ((week - 1) % 7) + 1; // 1..7, la 7e est allégée
  return { week, pos, deload: pos === 7, next: pos === 7 ? 0 : 7 - pos, block: blockAt(pos) };
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
