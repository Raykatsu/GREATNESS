// Données de l'utilisateur connecté. Chaque compte a ses propres données ;
// elles sont gardées sur l'appareil et synchronisées en ligne (voir cloud.js).
import { RANKS, PROGRAMS, EXERCISES } from "./data.js";

export const LEGACY_KEY = "greatness.v2"; // ancienne version à compte unique
const dataKey = user => `greatness.data.${user}`;

const DEFAULT = {
  profile: {
    name: "", bodyweight: 75, goal: "muscle", days: 3, equipment: "gym",
    voice: true, mascot: true, sound: true, aiKey: "", aiEnabled: false,
  },
  sessions: [],
  lifts: {},
  chat: [],
  customPrograms: [],
  customExercises: {}, // { id: { name, muscle, type, equip, step, cues, alts } }
  exNotes: {},        // { exerciseId: "note" }
  body: [],           // [{ date, weight, waist, chest, arm, thigh }]
  badges: {},         // { badgeId: date }
  cycleStart: null,   // début du cycle d'entraînement (pour les semaines allégées)
  weekPlan: null, // { 0..6 (lundi..dimanche): programId }
  meta: { updatedAt: 0 },
};

const merge = data => ({ ...structuredClone(DEFAULT), ...data, profile: { ...DEFAULT.profile, ...data?.profile }, meta: { ...DEFAULT.meta, ...data?.meta } });

// L'objet est partagé par tous les modules : on le remplit, on ne le remplace jamais.
export const state = merge({});
export let currentUser = null;
let onSave = null;

export function readLocal(user) {
  try { return JSON.parse(localStorage.getItem(dataKey(user)) || "null"); } catch { return null; }
}

export function setUser(user, data) {
  currentUser = user;
  const next = merge(data || readLocal(user) || {});
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, next);
  syncCustomExercises();
}

// Les exercices créés par l'utilisateur rejoignent la bibliothèque commune.
export function syncCustomExercises() {
  Object.keys(EXERCISES).forEach(k => { if (EXERCISES[k].custom) delete EXERCISES[k]; });
  Object.entries(state.customExercises || {}).forEach(([id, e]) => (EXERCISES[id] = { cues: [], alts: [], ...e, custom: true }));
}

export function clearUser() {
  currentUser = null;
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, merge({}));
  syncCustomExercises();
}

export const setSaveHook = fn => (onSave = fn);

export function save({ silent = false } = {}) {
  if (!currentUser) return;
  if (!silent) state.meta.updatedAt = Date.now();
  try { localStorage.setItem(dataKey(currentUser), JSON.stringify(state)); } catch { /* quota / mode privé */ }
  if (!silent) onSave?.(state);
}

// Efface les séances et réglages du compte connecté (le compte reste).
export function resetAll() {
  const keep = { name: state.profile.name };
  setUser(currentUser, { profile: keep });
  save();
  location.reload();
}

export function legacyData() {
  try { const d = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"); return d?.profile?.name ? d : null; } catch { return null; }
}

export const allPrograms = () => [...PROGRAMS, ...state.customPrograms.map(p => ({ ...p, cat: "custom" }))];
export const getProgram = id => allPrograms().find(p => p.id === id);

export const totalXp = () => state.sessions.reduce((s, x) => s + (x.xp || 0), 0);

export function rankInfo(xp = totalXp()) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  const pct = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { rank: cur, next, pct, xp, level: i + 1 };
}

const dayKey = d => new Date(d).toDateString();

// Série de jours d'affilée avec au moins une séance (tolère "aujourd'hui pas encore fait").
export function streak() {
  const days = new Set(state.sessions.map(s => dayKey(s.date)));
  let n = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Lundi de la semaine courante à 00:00
export function weekStart(ref = new Date()) {
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const todayIndex = () => (new Date().getDay() + 6) % 7;

export function sessionsOn(date) {
  const k = dayKey(date);
  return state.sessions.filter(s => dayKey(s.date) === k);
}

export function weekStats(offsetWeeks = 0) {
  const start = weekStart(); start.setDate(start.getDate() - 7 * offsetWeeks);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const list = state.sessions.filter(s => s.date >= start && s.date < end);
  return {
    count: list.length,
    volume: list.reduce((a, s) => a + (s.volume || 0), 0),
    minutes: Math.round(list.reduce((a, s) => a + (s.durationSec || 0), 0) / 60),
    prs: list.reduce((a, s) => a + (s.prs?.length || 0), 0),
  };
}

// Estimation 1RM (Epley)
export const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : 0);

export function recordLift(exId, weight, reps) {
  const prev = state.lifts[exId];
  state.lifts[exId] = {
    weight, reps, date: Date.now(),
    best: Math.max(prev?.best || 0, e1rm(weight, reps)),
    bestReps: Math.max(prev?.bestReps || 0, weight === 0 ? reps : 0),
  };
}

// Historique d'un exercice : une entrée par séance.
export function exerciseHistory(exId) {
  return state.sessions
    .filter(s => s.sets.some(x => x.exId === exId))
    .map(s => {
      const sets = s.sets.filter(x => x.exId === exId);
      const top = sets.reduce((b, x) => (score(x) > score(b) ? x : b), sets[0]);
      return { date: s.date, sets, top, e1rm: e1rm(top.weight, top.reps), volume: sets.reduce((a, x) => a + x.weight * x.reps, 0) };
    });
}
const score = s => (s.weight > 0 ? e1rm(s.weight, s.reps) : s.reps);

// Séries de la dernière séance où cet exercice a été fait.
export function lastPerformance(exId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const sets = state.sessions[i].sets.filter(x => x.exId === exId);
    if (sets.length) return sets;
  }
  return null;
}

export const exName = id => EXERCISES[id]?.name || id;

// Résumé public visible par les amis (rien d'autre n'est partagé).
export function publicSummary() {
  const w = weekStats(), r = rankInfo();
  const ws = weekStart().getTime();
  const weekPrs = state.sessions.filter(s => s.date >= ws).reduce((a, s) => a + (s.prs?.length || 0), 0);
  return {
    name: state.profile.name, goal: state.profile.goal, level: r.level, rank: r.rank.name, xp: r.xp, streak: streak(),
    week: { start: ws, count: w.count, volume: Math.round(w.volume), minutes: w.minutes, prs: weekPrs },
    total: { sessions: state.sessions.length, volume: Math.round(state.sessions.reduce((a, s) => a + (s.volume || 0), 0)) },
    records: Object.entries(state.lifts).filter(([id]) => EXERCISES[id]?.type === "load").sort((a, b) => b[1].best - a[1].best).slice(0, 5)
      .map(([id, l]) => ({ n: exName(id), kg: Math.round(l.best) })),
    recent: state.sessions.slice(-5).reverse().map(s => ({ d: s.date, n: s.name, v: s.volume, s: s.sets.length, pr: s.prs?.length || 0 })),
    badges: Object.keys(state.badges || {}).length,
    updatedAt: Date.now(),
  };
}
