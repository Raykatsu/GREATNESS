// Nutrition qui s'adapte au jour le jour (nutriadapt.js) et onglet « Comprendre » (nutrilearn.js, nutri-refs.js) :
// en sèche un excès est réparti sur les 3 jours suivants, en prise de masse un manque est rattrapé, en maintien la
// moitié de l'écart compte ; plafond, minimum sûr, journées incomplètes, protéines inchangées ; le jour du plan de
// repas suit ; les explications reprennent tes chiffres et chaque étude citée existe.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { targets, dayKey, shiftKey } from "../js/nutrition.js";
import { dailyAdjust, planDayIndex, adaptPlanDay, keepsPortion, safeFloor, CAP } from "../js/nutriadapt.js";
import { localPlan, totalsOf } from "../js/mealplan.js";
import { learnHtml, adjustCard, MACROS, MICROS } from "../js/nutrilearn.js";
import { REFS, refBy } from "../js/nutri-refs.js";

const NOW = new Date(2026, 10, 18, 12); // mercredi 18 novembre, midi
const fresh = (profile = {}) => ({ profile: { bodyweight: 80, height: 180, age: 28, sex: "h", activity: "light", days: 4, goal: "seche", ...profile }, food: {}, deleted: {} });
// un jour noté (2 aliments) pour un total de kcal
const ate = (st, ago, kcal) => {
  st.food[shiftKey(dayKey(NOW), -ago)] = { water: 0, items: [
    { id: `a${ago}`, name: "A", meal: "lunch", g: 100, per: { k: kcal / 2, p: 20, c: 40, f: 10 } },
    { id: `b${ago}`, name: "B", meal: "dinner", g: 100, per: { k: kcal / 2, p: 20, c: 40, f: 10 } }] };
  return st;
};

test("sèche : un excès est réparti sur les 3 jours suivants, un jour sous l'objectif n'est pas rattrapé", () => {
  const P = { activity: "mod" }, base = targets(fresh(P).profile);
  assert.equal(base.kcal, 2260);
  const st = ate(fresh(P), 1, 2860); // 600 kcal de trop hier
  const a = dailyAdjust(st, NOW);
  assert.deepEqual(a.days.map(d => [d.ago, d.eaten, d.gap, d.share]), [[1, 2860, 600, -200]]);
  assert.equal(a.kcal, 2060); assert.equal(a.delta, -200);
  assert.equal(a.p, base.p, "protéines inchangées");
  assert.ok(a.c < base.c && a.f < base.f, "glucides et lipides baissent");
  assert.ok(Math.abs(a.p * 4 + a.c * 4 + a.f * 9 - a.kcal) < 15, "les macros font toujours les calories");
  assert.equal(a.base.kcal, 2260, "l'objectif de base reste disponible");
  // deux jours d'excès s'additionnent
  ate(st, 2, 2560);
  assert.equal(dailyAdjust(st, NOW).delta, -300);
  // un jour sous l'objectif ne fait pas manger plus
  const under = dailyAdjust(ate(fresh(P), 1, 1900), NOW);
  assert.deepEqual([under.delta, under.days.length, under.kcal], [0, 0, 2260]);
  // au-delà de 3 jours, l'écart est déjà compensé ; un écart de moins de 100 kcal ne compte pas
  assert.equal(dailyAdjust(ate(fresh(P), 4, 3500), NOW).delta, 0);
  assert.equal(dailyAdjust(ate(fresh(P), 1, 2350), NOW).delta, 0);
});

test("prise de masse : un manque est rattrapé, un excès n'est pas retiré, une journée incomplète ne compte pas", () => {
  const p = { goal: "muscle" }, base = targets(fresh(p).profile);
  assert.equal(base.kcal, 2820);
  const a = dailyAdjust(ate(fresh(p), 1, 2300), NOW); // 520 kcal de moins hier
  assert.equal(a.days[0].share, 173);
  assert.equal(a.delta, 170); assert.equal(a.kcal, 2990);
  assert.equal(a.p, base.p);
  assert.ok(a.c > base.c && a.f > base.f);
  assert.equal(dailyAdjust(ate(fresh(p), 1, 3400), NOW).delta, 0, "un excès n'est pas retiré");
  assert.equal(dailyAdjust(ate(fresh(p), 1, 1000), NOW).delta, 0, "moins de 60 % de l'objectif : journal incomplet");
  const one = fresh(p);
  one.food[shiftKey(dayKey(NOW), -1)] = { items: [{ id: "x", name: "X", g: 100, per: { k: 500 } }] };
  assert.equal(dailyAdjust(one, NOW).delta, 0, "un seul aliment noté : jour pas suivi");
  assert.equal(dailyAdjust(ate(fresh({ goal: "force" }), 1, 2300), NOW).dir, "deficit");
});

test("maintien : la moitié de l'écart, dans les deux sens", () => {
  const p = { goal: "forme" };
  assert.equal(targets(fresh(p).profile).kcal, 2560);
  assert.equal(dailyAdjust(ate(fresh(p), 1, 3160), NOW).delta, -100); // +600 → moitié, sur 3 jours
  assert.equal(dailyAdjust(ate(fresh(p), 1, 1960), NOW).delta, 100);
});

test("garde-fous : plafond de 350 kcal et 15 %, minimum sûr, protéines fixes, glucides et lipides planchers", () => {
  const st = fresh({ activity: "mod" });
  for (const ago of [1, 2, 3]) ate(st, ago, 3460); // 1 200 kcal de trop trois jours de suite
  const a = dailyAdjust(st, NOW), cap = Math.min(CAP, 2260 * 0.15);
  assert.equal(a.capped, true);
  assert.equal(a.delta, -330);
  // minimum sûr (métabolisme de base + 5 %) : 1 880 kcal ici, la correction s'arrête là
  const lim = dailyAdjust(ate(fresh(), 1, 2650), NOW);
  assert.deepEqual([lim.kcal, lim.delta, lim.floored], [1880, -170, true]);
  // une femme dont l'objectif est déjà au plancher ne descend pas
  const low = fresh({ sex: "f", bodyweight: 55, height: 160, age: 30, activity: "sed", days: 2 });
  const lb = targets(low.profile);
  assert.equal(lb.kcal, 1300); assert.equal(safeFloor(low.profile, lb), 1300);
  const f = dailyAdjust(ate(low, 1, 2300), NOW);
  assert.deepEqual([f.kcal, f.delta, f.floored], [1300, 0, true]);
  // sur tous les profils : plafond, minimum sûr, protéines fixes, au moins 50 g de glucides et 0,6 g de lipides par kg
  for (const bodyweight of [50, 80, 120, 150]) for (const activity of ["sed", "light", "mod", "high"]) for (const goal of ["seche", "muscle", "forme"]) for (const gap of [-900, 900]) {
    const pr = { bodyweight, activity, goal, sex: bodyweight < 60 ? "f" : "h" }, b = targets(fresh(pr).profile);
    const r = dailyAdjust(ate(fresh(pr), 1, b.kcal + gap), NOW), where = `${bodyweight} kg ${activity} ${goal} ${gap}`;
    assert.ok(Math.abs(r.delta) <= Math.min(CAP, b.kcal * 0.15), where);
    assert.ok(r.delta >= 0 || r.kcal >= safeFloor(fresh(pr).profile, b), where);
    assert.equal(r.p, b.p, where);
    assert.ok(r.c >= 50 && r.f >= Math.round(0.6 * bodyweight), where);
  }
  assert.ok(cap > 330);
});

test("désactivable, et en pause avec des objectifs personnalisés", () => {
  const off = ate(fresh({ nutri: { dailyAdapt: false } }), 1, 2650);
  const a = dailyAdjust(off, NOW);
  assert.deepEqual([a.off, a.delta, a.kcal], [true, 0, 2050]);
  const own = ate(fresh({ nutri: { custom: true, kcal: 2200, p: 150 } }), 1, 3000);
  const b = dailyAdjust(own, NOW);
  assert.deepEqual([b.off, b.kcal, b.p], [true, 2200, 150]);
  assert.equal(adjustCard(a), "");
});

test("plan de repas : le jour qui tombe aujourd'hui, et ses portions à l'échelle de l'objectif du jour", () => {
  const plan = { at: new Date(2026, 10, 16, 20).getTime(), days: [{}, {}, {}] };
  assert.deepEqual([16, 17, 18, 19, 22].map(d => planDayIndex(plan, new Date(2026, 10, d, 9))), [0, 1, 2, 0, 0]);
  assert.equal(planDayIndex(plan, new Date(2026, 10, 15, 9)), -1, "avant le début du plan");
  assert.equal(planDayIndex({ days: [] }, NOW), -1);
  const [day] = localPlan({ kcal: 2500, p: 160 }, { days: 1 });
  const items = d => d.meals.flatMap(m => m.items), k0 = totalsOf(items(day)).k;
  for (const delta of [-300, 300]) {
    const d = adaptPlanDay(day, k0 + delta), k1 = totalsOf(items(d)).k;
    assert.ok(Math.abs(k1 - (k0 + delta)) < Math.abs(delta) * 0.35, `${delta} : ${Math.round(k0)} → ${Math.round(k1)} kcal`);
    assert.ok(delta < 0 ? d.scale < 1 : d.scale > 1);
    items(day).forEach((x, i) => {
      const y = items(d)[i];
      if (keepsPortion(x)) assert.equal(y.g, x.g, `${x.name} : portion gardée (protéines, légumes)`);
    });
    assert.ok(Math.abs(totalsOf(items(d)).p - totalsOf(items(day)).p) < 12, "protéines presque inchangées");
  }
  assert.equal(adaptPlanDay(day, k0 + 10).scale, 1, "écart minuscule : plan intact");
});

test("Comprendre : le calcul avec tes chiffres, l'adaptation d'hier, les nutriments, les minéraux selon le sexe", () => {
  const st = ate(fresh({ activity: "mod" }), 1, 2860), h = learnHtml(st, NOW);
  assert.match(h, /10 × 80 kg \+ 6,25 × 180 cm − 5 × 28 ans \+ 5/);
  assert.match(h, /× 1,5/);
  assert.match(h, /Sèche/);
  assert.match(h, /Ajustement du jour/);
  assert.match(h, /<b>Hier<\/b>/);
  assert.match(h, /−200 kcal/);
  for (const m of MACROS) assert.match(h, new RegExp(`id="nl-${m.id}"`));
  assert.match(h, /id="nl-adapt"/); assert.match(h, /id="nl-min"/); assert.match(h, /id="nl-refs"/);
  assert.match(h, /176 g/, "protéines : 2,2 g/kg × 80 kg");
  assert.match(h, /Fer<\/b><span class="tnum">11 mg/);
  assert.match(learnHtml(fresh({ sex: "f", bodyweight: 60, height: 165 }), NOW), /Fer<\/b><span class="tnum">16 mg/);
  // objectifs personnalisés : le calcul de l'app, pour comparer
  assert.match(learnHtml(fresh({ nutri: { custom: true, kcal: 2200 } }), NOW), /Tu as fixé tes objectifs toi-même/);
  // carte du journal
  const card = adjustCard(dailyAdjust(st, NOW));
  assert.match(card, /Objectif du jour ajusté/); assert.match(card, /−200 kcal/); assert.match(card, /data-learn="adapt"/);
  assert.ok(MICROS.length >= 10);
});

test("Comprendre : chaque étude citée existe, chaque étude de la liste est citée, DOI valides", () => {
  const cited = new Set();
  for (const goal of ["seche", "muscle", "force", "forme"]) for (const adaptive of [false, true]) {
    const st = ate(fresh({ goal, nutri: adaptive ? { adaptive: true, adapt: { kcal: 2400, tdee: 2600 }, rate: -0.5 } : {} }), 1, 3200);
    for (const m of learnHtml(st, NOW).matchAll(/data-ref="([^"]+)"/g)) cited.add(m[1]);
  }
  for (const id of cited) assert.ok(refBy[id], `étude inconnue : ${id}`);
  assert.deepEqual(REFS.filter(r => !cited.has(r.id)).map(r => r.id), [], "études de la liste jamais citées");
  assert.equal(new Set(REFS.map(r => r.id)).size, REFS.length, "identifiants uniques");
  for (const r of REFS) {
    assert.ok(r.short && r.text.length > 40, r.id);
    if (r.doi) assert.match(r.doi, /^10\.\d{4,9}\/\S+$/, r.id);
  }
});
