// Persistance locale (localStorage) — tout reste sur l'appareil.
import { RANKS } from "./data.js";

const KEY = "greatness.v2";

const DEFAULT = {
  profile: { name: "", voice: true, aiKey: "", aiEnabled: false, bodyweight: 75, goal: "force" },
  sessions: [],
  lifts: {},
  chat: [],
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

export const totalXp = () => state.sessions.reduce((s, x) => s + (x.xp || 0), 0);

export function rankInfo(xp = totalXp()) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  const pct = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { rank: cur, next, pct, xp, level: i + 1 };
}

// Série de jours consécutifs avec au moins une séance (tolère "aujourd'hui pas encore fait").
export function streak() {
  const days = new Set(state.sessions.map(s => new Date(s.date).toDateString()));
  let n = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Volume (kg × reps) par jour sur les 7 derniers jours.
export function weekVolume() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const vol = state.sessions
      .filter(s => new Date(s.date).toDateString() === d.toDateString())
      .reduce((a, s) => a + (s.volume || 0), 0);
    out.push({ day: d.toLocaleDateString("fr-FR", { weekday: "narrow" }), vol, today: i === 0 });
  }
  return out;
}

// Estimation 1RM (Epley)
export const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : 0);

export function recordLift(exId, weight, reps) {
  const prev = state.lifts[exId];
  const est = e1rm(weight, reps);
  const isPR = !!prev && (est > (prev.best || 0) + 0.01 || (weight === 0 && reps > (prev.bestReps || 0)));
  state.lifts[exId] = {
    weight, reps, date: Date.now(),
    best: Math.max(prev?.best || 0, est),
    bestReps: Math.max(prev?.bestReps || 0, weight === 0 ? reps : 0),
  };
  return isPR;
}
