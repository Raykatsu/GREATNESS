// Calories adaptatives : ta vraie dépense se lit dans tes données. La tendance du poids est lissée (moyenne
// exponentielle : les variations d'eau d'un jour à l'autre ne comptent pas) ; avec les calories notées, le bilan
// énergétique (1 kg ≈ 7 700 kcal) donne ta dépense réelle, et l'objectif est recalculé chaque semaine pour suivre
// le rythme voulu (kg par semaine). Tout est calculé sur le téléphone (testé dans Node).
import { lastDays, dayKey, bmrOf, tdeeOf } from "./nutrition.js";

export const KCAL_KG = 7700;
export const RATES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5]; // kg par semaine
export const DEFAULT_RATE = { seche: -0.5, muscle: 0.25, force: 0.1, forme: 0 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

// Tendance du poids : [{ t (ms), w (pesée), trend }], la plus ancienne d'abord
export function weightTrend(body = []) {
  const pts = body.filter(b => b.weight > 0 && b.date).sort((a, b) => a.date - b.date);
  const out = [];
  let trend = null, last = 0;
  for (const b of pts) {
    if (trend == null) trend = b.weight;
    else trend += (1 - Math.pow(0.9, Math.max(0.25, (b.date - last) / 864e5))) * (b.weight - trend); // 10 % par jour
    last = b.date;
    out.push({ t: b.date, w: b.weight, trend: Math.round(trend * 100) / 100 });
  }
  return out;
}

// Rythme de la tendance (kg par semaine) sur les `days` derniers jours, par régression linéaire ; null s'il manque des pesées
export function trendRate(tr, now = Date.now(), days = 21) {
  const pts = tr.filter(p => p.t >= now - days * 864e5 && p.t <= now);
  if (pts.length < 3 || (pts.at(-1).t - pts[0].t) / 864e5 < 6) return null;
  const xs = pts.map(p => (p.t - pts[0].t) / 864e5), ys = pts.map(p => p.trend), mx = avg(xs), my = avg(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den ? (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7 : null;
}

// Dépense réelle estimée sur 3 semaines : calories moyennes des jours bien notés − variation de la tendance × 7 700.
// Tant qu'il y a peu de données, elle se mélange à la formule ; elle reste bornée (un oubli de saisie ne fausse pas tout).
export function expenditure(state, now = new Date()) {
  const p = state.profile || {}, bmr = bmrOf(p), formula = tdeeOf(p);
  const today = dayKey(now);
  const days = lastDays(state, 22, now).filter(d => d.key !== today && d.logged && d.t.k >= bmr * 0.6); // 21 jours pleins vraiment notés
  const tr = weightTrend(state.body), rate = trendRate(tr, now.getTime());
  const weighs = tr.filter(x => x.t >= now.getTime() - 21 * 864e5).length;
  const base = { formula, bmr, days: days.length, weighs, rate, trend: tr.at(-1)?.trend ?? null };
  if (days.length < 7 || rate == null) return { ...base, tdee: formula, observed: null, intake: null, confidence: 0 };
  const intake = avg(days.map(d => d.t.k)), observed = intake - (rate / 7) * KCAL_KG;
  const confidence = clamp((days.length - 6) / 8, 0, 1) * clamp((weighs - 2) / 4, 0, 1);
  const bounded = clamp(observed, formula * 0.75, formula * 1.3);
  return { ...base, tdee: Math.round(formula + (bounded - formula) * confidence), observed: Math.round(observed), intake: Math.round(intake), confidence };
}

// Calories pour suivre le rythme voulu, avec des garde-fous : jamais sous le métabolisme de base (+5 %), au plus
// 1 000 kcal de déficit ou 500 de surplus
export function rateKcal(tdee, rate, { bmr, sex } = {}) {
  const floor = Math.max((bmr || 0) * 1.05, sex === "f" ? 1300 : 1500);
  return Math.round(clamp(tdee + (rate * KCAL_KG) / 7, Math.max(floor, tdee - 1000), tdee + 500) / 10) * 10;
}

// Lundi de la semaine (clé du recalcul hebdomadaire)
export function weekKey(now = new Date()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

// Recalcul du lundi : met à jour state.profile.nutri.adapt et renvoie le changement (ou null si rien à faire)
export function weeklyUpdate(state, now = new Date(), { force = false } = {}) {
  const n = state.profile?.nutri;
  if (!n?.adaptive) return null;
  const wk = weekKey(now);
  if (!force && n.adapt?.week === wk) return null;
  const e = expenditure(state, now), rate = n.rate ?? DEFAULT_RATE[state.profile.goal] ?? 0;
  const kcal = rateKcal(e.tdee, rate, { bmr: e.bmr, sex: state.profile.sex });
  const before = n.adapt?.kcal ?? null;
  n.adapt = { week: wk, kcal, tdee: e.tdee, rate, confidence: Math.round(e.confidence * 100) / 100, trend: e.trend, at: now.getTime() };
  return { before, kcal, tdee: e.tdee, rate, e };
}

// Où en est l'objectif de poids : reste à perdre / prendre, semaines estimées au rythme actuel
export function goalProgress(state, now = Date.now()) {
  const n = state.profile?.nutri, goal = +n?.goalWeight;
  const tr = weightTrend(state.body), cur = tr.at(-1)?.trend ?? +state.profile?.bodyweight;
  if (!(goal > 0) || !(cur > 0)) return null;
  const left = Math.round((goal - cur) * 10) / 10, rate = trendRate(tr, now);
  const weeks = rate && Math.sign(rate) === Math.sign(left) && Math.abs(left) > 0.2 ? Math.ceil(Math.abs(left / rate)) : null;
  return { goal, current: cur, left, rate, weeks, reached: Math.abs(left) <= 0.3 };
}
