// Fusion des données d'un compte venant de deux appareils : rien ne se perd.
// - séances, mesures, succès : réunion des deux côtés (sauf ce qui a été supprimé)
// - records : le meilleur des deux
// - séances / exercices perso : réunion ; en cas de conflit, la version la plus récente
// - réglages, programme de la semaine, discussion : le côté le plus récent

import { mergeFood } from "./nutrition.js";

const byId = list => new Map((list || []).map(x => [x.id, x]));

export function mergeData(a = {}, b = {}) {
  const aAt = a.meta?.updatedAt || 0, bAt = b.meta?.updatedAt || 0;
  const [older, newer] = aAt >= bAt ? [b, a] : [a, b];

  const deleted = {};
  for (const k of ["sessions", "programs", "exercises", "food", "memory", "duels", "goals"]) deleted[k] = [...new Set([...(a.deleted?.[k] || []), ...(b.deleted?.[k] || [])])].slice(-1000);
  const gone = k => new Set(deleted[k]);

  const unionById = (x, y, kind) => {
    const m = byId(x);
    for (const [id, v] of byId(y)) m.set(id, v); // y (le plus récent) gagne en cas de conflit
    const g = gone(kind);
    return [...m.values()].filter(v => !g.has(v.id));
  };

  const sessions = unionById(older.sessions, newer.sessions, "sessions").sort((p, q) => p.date - q.date);
  const customPrograms = unionById(older.customPrograms, newer.customPrograms, "programs");

  const gx = gone("exercises");
  const customExercises = Object.fromEntries(Object.entries({ ...older.customExercises, ...newer.customExercises }).filter(([id]) => !gx.has(id)));

  const lifts = { ...older.lifts };
  for (const [id, l] of Object.entries(newer.lifts || {})) {
    const o = lifts[id];
    if (!o) { lifts[id] = l; continue; }
    const latest = (l.date || 0) >= (o.date || 0) ? l : o;
    lifts[id] = { ...latest, best: Math.max(o.best || 0, l.best || 0), bestReps: Math.max(o.bestReps || 0, l.bestReps || 0) };
  }

  const bodyMap = new Map([...(older.body || []), ...(newer.body || [])].map(e => [e.date, e]));
  const badges = { ...newer.badges };
  for (const [k, d] of Object.entries(older.badges || {})) badges[k] = badges[k] ? Math.min(badges[k], d) : d;

  // nutrition : journal fusionné jour par jour, récents et produits perso réunis
  const food = mergeFood(older.food, newer.food, deleted.food);
  const seen = new Set();
  const foodRecent = [...(newer.foodRecent || []), ...(older.foodRecent || [])].sort((x, y) => (y.used || 0) - (x.used || 0))
    .filter(f => { const k = f.code || `${f.name}|${f.brand || ""}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
  const foodMeals = unionById(older.foodMeals, newer.foodMeals, "food");
  const memory = unionById(older.memory, newer.memory, "memory").sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-30);
  const reviews = { ...older.reviews, ...newer.reviews };
  // défis entre amis : duels réunis (sauf annulés), palmarès réuni, déjà-vu du côté le plus récent
  const recent = Date.now() - 35 * 864e5;
  const duels = unionById(older.duels, newer.duels, "duels").filter(d => d.w > recent);
  const duelLog = unionById(older.duelLog, newer.duelLog, "duelLog").sort((x, y) => x.w - y.w).slice(-100);
  // objectifs chiffrés : réunis ; pour un même objectif, la version modifiée en dernier
  const goals = [...byId(older.goals)].reduce((m, [id, g]) => { const o = m.get(id); if (!o || (g.at || 0) > (o.at || 0)) m.set(id, g); return m; }, byId(newer.goals));
  const gg = gone("goals");

  return {
    ...older, ...newer,
    sessions, customPrograms, customExercises, lifts, badges, deleted,
    food, foodRecent, foodMeals, foodCustom: { ...older.foodCustom, ...newer.foodCustom }, memory, reviews, duels, duelLog,
    goals: [...goals.values()].filter(g => !gg.has(g.id)).sort((x, y) => x.start - y.start),
    body: [...bodyMap.values()].sort((p, q) => p.date - q.date),
    exNotes: { ...older.exNotes, ...newer.exNotes },
    cycleStart: Math.min(...[a.cycleStart, b.cycleStart].filter(Boolean)) || null,
    meta: { ...newer.meta, updatedAt: Math.max(aAt, bAt) },
  };
}

// Vrai si la fusion apporte quelque chose de nouveau par rapport à `base`.
export function differs(merged, base) {
  // les listes / objets vides comptent comme absents
  const empty = v => v == null || (typeof v === "object" && !Object.values(v).some(x => !empty(x)));
  const clean = (k, v) => (empty(v) ? undefined : v);
  const pick = d => JSON.stringify([d.sessions?.map(s => s.id), d.customPrograms, d.customExercises, d.lifts, d.body, d.badges, d.exNotes, d.profile, d.weekPlan, d.deleted, d.chat?.length,
    d.food, d.foodMeals, d.foodCustom, d.memory, d.reviews, d.duels, d.duelLog, d.mealPlan, d.goals], clean);
  return pick(merged) !== pick(base);
}
