// Plan alimentaire qui s'adapte au jour le jour. Le corps fait le bilan sur plusieurs jours, pas sur une seule journée :
// - en sèche, un excès (plus de 100 kcal au-dessus de l'objectif) est réparti sur les 3 jours suivants ;
// - en prise de masse (muscle, force), un manque est rattrapé de la même façon ;
// - en forme (maintien), la moitié de l'écart est compensée, dans les deux sens.
// Garde-fous : au plus 350 kcal (et 15 % de l'objectif) par jour, jamais sous le minimum sûr (métabolisme de base + 5 %,
// 1 300 / 1 500 kcal) ; les protéines ne bougent pas, glucides (75 %) et lipides (25 %) absorbent l'écart, sans descendre
// sous 50 g de glucides ni 0,6 g de lipides par kg. Un jour noté à moins de 60 % de l'objectif est sans doute incomplet :
// il ne compte pas comme un manque. Les sources scientifiques sont dans nutri-refs.js (onglet « Comprendre »). Testé dans Node.
import { targets, dayKey, shiftKey, dayOf, sumItems } from "./nutrition.js";

export const SPREAD = 3, THRESH = 100, CAP = 350;
// sens de l'écart à compenser selon l'objectif
export const DIRECTION = { seche: "excess", muscle: "deficit", force: "deficit", forme: "both" };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Minimum sûr : métabolisme de base + 5 %, au moins 1 300 kcal (femme) ou 1 500 kcal (homme) ; si l'objectif est déjà
// plus bas (objectif personnalisé), pas plus bas que lui
export const safeFloor = (p, base) => Math.min(base.kcal, Math.round(Math.max(base.bmr * 1.05, p.sex === "f" ? 1300 : 1500)));

// Objectif du jour (now) : celui de base, corrigé de l'écart des 3 jours d'avant
export function dailyAdjust(state, now = new Date()) {
  const p = state.profile || {}, base = targets(p), dir = DIRECTION[p.goal] || "both";
  const key = dayKey(now), w = +p.bodyweight || 75;
  const out = { ...base, base, delta: 0, days: [], dir, floored: false, capped: false, off: false };
  if (base.custom || p.nutri?.dailyAdapt === false) return { ...out, off: true };
  for (let i = 1; i <= SPREAD; i++) {
    const k = shiftKey(key, -i), items = dayOf(state, k).items || [];
    if (items.length < 2) continue; // jour pas noté
    const eaten = sumItems(items).k, gap = eaten - base.kcal;
    if (gap < 0 && eaten < base.kcal * 0.6) continue; // journal sans doute incomplet
    let g = 0;
    if (gap > THRESH && dir !== "deficit") g = gap;
    if (gap < -THRESH && dir !== "excess") g = gap;
    if (dir === "both") g /= 2;
    if (g) out.days.push({ key: k, ago: i, eaten: Math.round(eaten), gap: Math.round(gap), share: Math.round(-g / SPREAD) });
  }
  const want = out.days.reduce((s, d) => s + d.share, 0), cap = Math.min(CAP, base.kcal * 0.15);
  out.capped = Math.abs(want) > cap;
  // arrondi à 10 kcal vers l'objectif de base (le plafond n'est jamais dépassé), jamais sous le minimum sûr
  const d = Math.trunc(clamp(want, -cap, cap) / 10) * 10, floor = Math.ceil(safeFloor(p, base) / 10) * 10;
  const kcal = Math.max(base.kcal + d, Math.min(base.kcal, floor)), dk = kcal - base.kcal;
  if (!dk) return { ...out, floored: d < 0 };
  // glucides et lipides absorbent l'écart ; protéines inchangées
  let f = base.f + (dk * 0.25) / 9, c = base.c + (dk * 0.75) / 4;
  const fMin = Math.round(0.6 * w);
  if (f < fMin) { c -= ((fMin - f) * 9) / 4; f = fMin; }
  if (c < 50) { f = Math.max(fMin, f - ((50 - c) * 4) / 9); c = 50; }
  return { ...out, kcal, c: Math.round(c), f: Math.round(f), delta: dk, floored: dk > d };
}

// Pour le coach (IA) : l'objectif du jour, quand il diffère de l'objectif de base
export function adjustContext(state, now = new Date()) {
  const a = dailyAdjust(state, now);
  if (!a.delta) return "";
  return `Objectif du jour ajusté par l'app : ${a.kcal} kcal (${a.delta > 0 ? "+" : ""}${a.delta} kcal), ${a.c} g de glucides, ${a.f} g de lipides, protéines inchangées : ${a.delta < 0 ? "excès des jours précédents réparti sur 3 jours" : "manque des jours précédents rattrapé sur 3 jours"}.`;
}

/* ---------- Le plan de repas suit l'objectif du jour ---------- */
// Jour du plan qui tombe aujourd'hui : les jours du plan se suivent depuis sa création, puis recommencent (J1, J2, J3, J1…)
export function planDayIndex(plan, now = new Date()) {
  if (!plan?.days?.length) return -1;
  const start = new Date(plan.at || Date.now()); start.setHours(0, 0, 0, 0);
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const n = Math.round((d - start) / 864e5);
  return n < 0 ? -1 : n % plan.days.length;
}
const UNIT = /^(œuf|banane|pomme|kiwi|orange|poire|wrap|galette)$/;
const serve = (x, g) => {
  const u = x.unit;
  if (u?.g && UNIT.test(u.label)) return Math.max(1, Math.round(g / u.g)) * u.g;
  return g < 100 ? Math.max(5, Math.round(g / 5) * 5) : Math.round(g / 10) * 10;
};
const kcalOf = x => ((x.per?.k || 0) * (x.g || 0)) / 100;
// Aliments qui gardent leur portion : riches en protéines (au moins 30 % des calories) ou très peu caloriques (légumes)
export const keepsPortion = x => { const per = x.per || {}; return (per.k || 0) < 45 || ((per.p || 0) * 4) / Math.max(1, per.k || 0) >= 0.3; };
// Une journée du plan à l'échelle d'un nouvel objectif : les féculents, fruits et matières grasses absorbent l'écart
// (entre −50 % et +60 %), protéines et légumes ne bougent pas. Les portions sont servies arrondies (à l'unité, par 5
// ou 10 g) : parmi les échelles proches, on garde celle dont le total servi tombe le plus juste.
export function adaptPlanDay(day, kcal) {
  const items = day.meals.flatMap(m => m.items);
  const fixed = items.filter(keepsPortion).reduce((s, x) => s + kcalOf(x), 0), flex = items.filter(x => !keepsPortion(x)).reduce((s, x) => s + kcalOf(x), 0);
  const b0 = flex > 0 ? clamp((kcal - fixed) / flex, 0.5, 1.6) : 1;
  if (Math.abs(b0 - 1) < 0.02) return { ...day, scale: 1 };
  const scaled = b => day.meals.map(m => ({ ...m, items: m.items.map(x => (keepsPortion(x) ? x : { ...x, g: serve(x, x.g * b) })) }));
  let best = null;
  for (const k of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7, -8, 8]) {
    const b = clamp(b0 * (1 + k * 0.025), 0.5, 1.6), meals = scaled(b);
    const err = Math.abs(meals.reduce((s, m) => s + m.items.reduce((t, x) => t + kcalOf(x), 0), 0) - kcal);
    if (!best || err < best.err - 1) best = { b, meals, err };
  }
  return { ...day, scale: Math.round(best.b * 100) / 100, meals: best.meals };
}
