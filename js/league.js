// Ligues et saisons entre amis. Une saison dure 4 semaines ; chaque semaine rapporte des points (séances, minutes,
// records, défi de la semaine réussi), les mêmes pour tous quel que soit le style d'entraînement : pas de volume, le
// poids du corps vaut la fonte. En fin de saison, le haut du classement entre amis monte d'une division, le bas
// descend (sauf avec un minimum d'activité) ; sans amis, on monte en atteignant un palier. Aucun serveur dédié :
// chacun publie ses points dans son résumé public. Logique pure, testée dans Node.
import { ordinal } from "./i18n.js";
import { weeklyChallenge } from "./rivals.js";

const DAY = 864e5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const SEASON_WEEKS = 4;
export const DIVS = [
  { id: "bronze", name: "Bronze", icon: "🥉" }, { id: "argent", name: "Argent", icon: "🥈" }, { id: "or", name: "Or", icon: "🥇" },
  { id: "platine", name: "Platine", icon: "💠" }, { id: "diamant", name: "Diamant", icon: "💎" }, { id: "legende", name: "Légende", icon: "👑" },
];
// Points d'une semaine : 20 par séance (6 au plus), 1 par 2 minutes d'entraînement (6 h au plus), 15 par record,
// 25 pour le défi de la semaine réussi
export const PTS = { session: 20, maxSessions: 6, perMinutes: 2, maxMinutes: 360, pr: 15, challenge: 25 };
export const SAFE = 160;   // maintien assuré (~1 séance par semaine)
export const MIN_UP = 240; // minimum pour monter, même en tête du classement
export const SOLO_UP = [300, 400, 500, 600, 700, Infinity]; // sans amis : palier pour monter, selon la division

const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const plusDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const EPOCH = () => new Date(2026, 0, 5).getTime(); // lundi 5 janvier 2026 : début de la saison 1
// Numéro de la saison d'une date, début et fin d'une saison (heure locale)
export const seasonOf = (d = new Date()) => Math.floor(Math.round((monday(d) - EPOCH()) / (7 * DAY)) / SEASON_WEEKS) + 1;
export const seasonStart = s => plusDays(EPOCH(), (s - 1) * SEASON_WEEKS * 7);
export const seasonEnd = s => seasonStart(s + 1);
export const daysLeft = (now = Date.now()) => Math.max(1, Math.ceil((seasonEnd(seasonOf(new Date(now))) - now) / DAY));

// Stats d'une semaine d'après les séances (comme le résumé public : séances, volume, minutes, records).
// Les séances importées d'une autre app ne comptent pas (sinon un fichier suffirait à gagner la ligue).
export function weekStats(sessions = [], ws) {
  const we = plusDays(ws, 7), list = sessions.filter(s => !s.imported && s.date >= ws && s.date < we);
  return { start: ws, count: list.length, volume: Math.round(list.reduce((a, s) => a + (s.volume || 0), 0)),
    minutes: Math.round(list.reduce((a, s) => a + (s.durationSec || 0), 0) / 60), prs: list.reduce((a, s) => a + (s.prs?.length || 0), 0) };
}
export function weekPoints(w) {
  const ch = weeklyChallenge(new Date(w.start + DAY)), challenge = ch.val({ week: w }) >= ch.goal;
  return Math.round(Math.min(PTS.maxSessions, w.count) * PTS.session + Math.min(PTS.maxMinutes, w.minutes) / PTS.perMinutes + (w.prs || 0) * PTS.pr + (challenge ? PTS.challenge : 0));
}
// Points d'une saison (semaines à venir : null)
export function seasonPoints(sessions = [], s, now = Date.now()) {
  const weeks = Array.from({ length: SEASON_WEEKS }, (_, i) => { const ws = plusDays(seasonStart(s), 7 * i); return ws > now ? null : weekPoints(weekStats(sessions, ws)); });
  return { total: weeks.reduce((a, p) => a + (p || 0), 0), weeks };
}

/* ---------- Résumé public et classement ---------- */
export function leaguePublic(st = {}, now = Date.now()) {
  const s = seasonOf(new Date(now)), L = st.league || {};
  return { s, end: seasonEnd(s), div: L.div || 0, pts: seasonPoints(st.sessions, s, now).total, last: { s: s - 1, pts: seasonPoints(st.sessions, s - 1, now).total } };
}
// Points d'un ami pour la saison s, d'après son résumé public (saison en cours, ou celle d'avant s'il a déjà changé)
export function pointsOf(p, s) {
  const L = p?.league;
  if (!L) return 0;
  if (L.s === s) return L.pts || 0;
  if (L.s === s + 1 && L.last?.s === s) return L.last.pts || 0;
  return 0;
}
export const divOf = p => clamp(Math.round(p?.league?.div ?? 0), 0, DIVS.length - 1);

// Classement d'une saison : moi et mes amis ; le premier tiers monte, le dernier tiers descend (à partir de 3)
export function standings(me, friends = [], s) {
  const rows = [{ ...me, me: true }, ...friends.map(f => ({ username: f.username, name: f.public?.name || f.username, pts: pointsOf(f.public, s), div: divOf(f.public) }))]
    .sort((a, b) => b.pts - a.pts || (a.me ? -1 : b.me ? 1 : String(a.name).localeCompare(String(b.name), "fr")));
  const n = rows.length, zone = n >= 3 ? Math.max(1, Math.round(n / 3)) : 0;
  return rows.map((r, i) => ({ ...r, rank: i + 1, up: zone > 0 && i < zone, down: zone > 0 && i >= n - zone }));
}
export function outcome(div, rank, n, pts) {
  let move = 0;
  if (n >= 3) {
    const zone = Math.max(1, Math.round(n / 3));
    if (rank <= zone && pts >= MIN_UP) move = 1;
    else if (rank > n - zone && pts < SAFE) move = -1;
  } else if (pts >= SOLO_UP[div]) move = 1;
  else if (pts < SAFE) move = -1;
  const to = clamp(div + move, 0, DIVS.length - 1);
  return { to, move: to - div };
}

// Au début d'une nouvelle saison : classement final de la précédente, montée ou descente d'une division.
// Met à jour st.league et renvoie le résultat (null s'il n'y a rien à faire).
export function settleLeague(st, friends = [], now = Date.now()) {
  const cur = seasonOf(new Date(now));
  if (!st.league) { st.league = { div: 0, season: cur, history: [], at: now }; return null; }
  const L = st.league;
  if ((L.season || 0) >= cur) return null;
  const s = cur - 1, pts = seasonPoints(st.sessions, s, now).total;
  const table = standings({ username: "", name: "Toi", pts, div: L.div || 0 }, friends, s), me = table.find(r => r.me);
  const o = outcome(L.div || 0, me.rank, table.length, pts);
  const res = { s, rank: me.rank, n: table.length, pts, from: L.div || 0, to: o.to, move: o.move, champion: me.rank === 1 && table.length >= 3 && pts >= MIN_UP, at: now };
  Object.assign(L, { div: o.to, season: cur, at: now, history: [...(L.history || []), res].slice(-24) });
  return res;
}
const ord = n => ordinal(n);
export function resultText(r) {
  const d = DIVS[r.to], rank = r.n >= 3 ? ` ${ord(r.rank)} sur ${r.n},` : "";
  if (r.move > 0) return `Saison ${r.s} terminée :${rank} tu montes en ${d.name} ${d.icon} !`;
  if (r.move < 0) return `Saison ${r.s} terminée : tu redescends en ${d.name}. Nouvelle saison, nouvelle chance !`;
  return `Saison ${r.s} terminée :${rank} tu restes en ${d.name} ${d.icon} (${r.pts} points).`;
}
// Ce qu'il manque : « 35 pts pour monter », « encore 60 pts pour assurer ton maintien »
export function nextStep(table, div) {
  const me = table.find(r => r.me), n = table.length;
  if (!me) return "";
  if (n < 3) return div >= DIVS.length - 1 ? "Tu es au sommet : garde ta place !" : me.pts >= SOLO_UP[div] ? `Palier atteint : tu montes en ${DIVS[div + 1].name} à la fin de la saison !` : `Encore ${SOLO_UP[div] - me.pts} pts pour monter en ${DIVS[div + 1].name}`;
  const zone = Math.max(1, Math.round(n / 3));
  if (me.up) return me.pts >= MIN_UP ? `Zone de montée : tu montes en ${DIVS[Math.min(div + 1, DIVS.length - 1)].name} si tu tiens jusqu'au bout !` : `Zone de montée : encore ${MIN_UP - me.pts} pts et la montée est à toi`;
  const target = table[zone - 1], gap = target.pts - me.pts + 1;
  if (me.down && me.pts < SAFE) return `Zone de descente : ${SAFE - me.pts} pts pour assurer ton maintien`;
  return `${gap} pt${gap > 1 ? "s" : ""} pour passer devant ${target.name} et entrer dans la zone de montée`;
}
