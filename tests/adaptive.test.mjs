// Calories adaptatives : tendance du poids lissée, dépense réelle, objectif recalculé chaque semaine.
import test from "node:test";
import assert from "node:assert/strict";
import { weightTrend, trendRate, expenditure, rateKcal, weeklyUpdate, goalProgress, weekKey } from "../js/adaptive.js";
import { targets, dayKey, shiftKey, tdeeOf } from "../js/nutrition.js";

const NOW = new Date(2026, 9, 14, 12); // mercredi 14 octobre 2026, midi
const D = 864e5;
// Pesées tous les 2 jours sur `n` jours, perte de `rate` kg / semaine, bruit d'eau ±0,6 kg
const weighs = (start, rate, n = 35, noise = 0.6) => Array.from({ length: Math.floor(n / 2) + 1 }, (_, i) => {
  const day = n - i * 2;
  return { date: NOW.getTime() - day * D, weight: Math.round((start + (rate / 7) * (n - day) + (i % 2 ? noise : -noise)) * 10) / 10 };
}).reverse();
// Journal : `kcal` par jour sur les `n` derniers jours (sans aujourd'hui)
const journal = (kcal, n = 21) => Object.fromEntries(Array.from({ length: n }, (_, i) => [shiftKey(dayKey(NOW), -(i + 1)), { items: [{ id: "x" + i, name: "Repas", per: { k: kcal / 10, p: 2, c: 10, f: 3 }, g: 1000 }], water: 0 }]));
const profile = { bodyweight: 80, sex: "h", age: 30, height: 180, activity: "light", days: 4, goal: "seche" };

test("tendance du poids : lisse les variations d'eau, suit la vraie évolution", () => {
  const tr = weightTrend(weighs(82, -0.5));
  assert.ok(tr.length > 10 && tr.every((p, i) => !i || p.t > tr[i - 1].t));
  const raw = tr.map(p => p.w), smooth = tr.map(p => p.trend);
  const jumps = a => Math.max(...a.slice(1).map((v, i) => Math.abs(v - a[i])));
  assert.ok(jumps(smooth) < jumps(raw) / 3, `lissage ${jumps(smooth)} vs ${jumps(raw)}`);
  const rate = trendRate(tr, NOW.getTime());
  assert.ok(rate < -0.3 && rate > -0.7, `rythme ${rate}`);
  assert.equal(trendRate(tr.slice(-2), NOW.getTime()), null); // trop peu de pesées
  assert.deepEqual(weightTrend([{ date: 1, weight: 0 }, { date: 2 }]), []);
});

test("dépense réelle : calories notées + variation du poids (7 700 kcal par kg)", () => {
  const state = { profile, body: weighs(82, -0.5), food: journal(2500) };
  const e = expenditure(state, NOW);
  assert.equal(e.days, 21);
  assert.ok(e.confidence > 0.9);
  // 2 500 kcal mangées et ~0,5 kg perdu par semaine : dépense ≈ 2 500 + 550
  assert.ok(e.observed > 2850 && e.observed < 3250, `observée ${e.observed}`);
  assert.equal(e.tdee, Math.round(Math.min(e.observed, tdeeOf(profile) * 1.3)));
  // peu de données : on reste sur la formule
  const few = expenditure({ profile, body: weighs(82, -0.5).slice(-2), food: journal(2500, 3) }, NOW);
  assert.equal(few.tdee, tdeeOf(profile)); assert.equal(few.confidence, 0);
  // saisie incomplète (500 kcal par jour) : ignorée, la dépense reste plausible
  const bad = expenditure({ profile, body: weighs(82, 0), food: journal(500) }, NOW);
  assert.equal(bad.days, 0); assert.equal(bad.tdee, tdeeOf(profile));
});

test("objectif au rythme voulu, avec garde-fous", () => {
  assert.equal(rateKcal(2600, -0.5, { bmr: 1700 }), 2050);
  assert.equal(rateKcal(2600, 0, { bmr: 1700 }), 2600);
  assert.equal(rateKcal(2600, 0.5, { bmr: 1700 }), 3100); // surplus plafonné à +500
  assert.equal(rateKcal(2600, -1, { bmr: 1700 }), 1790); // jamais sous le métabolisme de base + 5 %
  assert.equal(rateKcal(2000, -1, { bmr: 1300, sex: "f" }), 1370);
});

test("recalcul du lundi : une fois par semaine, utilisé par les objectifs du jour", () => {
  const state = { profile: { ...profile, nutri: { adaptive: true, rate: -0.5, goalWeight: 76 } }, body: weighs(82, -0.5), food: journal(2500) };
  const r = weeklyUpdate(state, NOW);
  assert.ok(r && r.kcal > 2000 && r.kcal < 2800, JSON.stringify(r));
  assert.equal(state.profile.nutri.adapt.week, weekKey(NOW));
  assert.equal(weeklyUpdate(state, NOW), null); // déjà fait cette semaine
  assert.ok(weeklyUpdate(state, NOW, { force: true }));
  const t = targets(state.profile);
  assert.equal(t.kcal, state.profile.nutri.adapt.kcal); assert.equal(t.adaptive, true);
  assert.equal(t.c, Math.max(50, Math.round((t.kcal - t.p * 4 - t.f * 9) / 4)));
  assert.equal(weeklyUpdate({ profile }, NOW), null); // pas activé
  assert.equal(targets({ ...profile, nutri: { adaptive: false, adapt: { kcal: 1000 } } }).adaptive, false);
  // objectifs personnalisés : ils l'emportent
  assert.equal(targets({ ...profile, nutri: { custom: true, kcal: 2222, adaptive: true, adapt: { kcal: 1900 } } }).kcal, 2222);
});

test("objectif de poids : reste à faire et semaines estimées", () => {
  const state = { profile: { ...profile, nutri: { goalWeight: 76 } }, body: weighs(82, -0.5) };
  const g = goalProgress(state, NOW.getTime());
  assert.ok(g.left < -2 && g.left > -6, `reste ${g.left}`);
  assert.ok(g.weeks >= 4 && g.weeks <= 16, `semaines ${g.weeks}`);
  assert.equal(goalProgress({ profile }, NOW.getTime()), null);
  assert.equal(goalProgress({ profile: { ...profile, nutri: { goalWeight: 80 } } }, NOW.getTime()).reached, true);
});

test("hydratation : objectif du jour et retard sur le rythme", async () => {
  const { waterGoal, waterBehind } = await import("../js/nutrition.js");
  assert.equal(waterGoal({ water: 2500 }), 10);
  assert.equal(waterGoal({ water: 2500 }, true), 12); // jour d'entraînement : +0,5 L
  const at = h => new Date(2026, 9, 14, h, 0);
  assert.equal(waterBehind(0, 10, at(8)), null);               // avant la plage
  assert.deepEqual(waterBehind(0, 10, at(11)), { n: 0, goal: 10, expected: 1 });
  assert.equal(waterBehind(6, 10, at(13)), null);              // dans les temps
  assert.equal(waterBehind(10, 10, at(20)), null);             // objectif atteint
  assert.equal(waterBehind(0, 10, at(22)), null);              // jamais la nuit
  assert.equal(waterBehind(0, 10, at(12), { from: "13:00", to: "18:00" }), null);
});
