// Persistance locale (localStorage) — tout reste sur l'appareil.
import { RANKS, PROGRAMS, EXERCISES } from "./data.js";

const KEY = "greatness.v2";

const DEFAULT = {
  profile: {
    name: "", bodyweight: 75, goal: "muscle", days: 3, equipment: "gym",
    voice: true, mascot: true, sound: true, aiKey: "", aiEnabled: false,
  },
  sessions: [],
  lifts: {},
  chat: [],
  customPrograms: [],
  weekPlan: null, // { 0..6 (lundi..dimanche): programId }
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...data, profile: { ...DEFAULT.profile, ...data.profile } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export const state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota / mode privé */ }
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
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
