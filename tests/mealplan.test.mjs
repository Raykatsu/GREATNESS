// Plan de repas et liste de courses : à l'échelle des objectifs, régimes respectés, courses en quantités crues.
import test from "node:test";
import assert from "node:assert/strict";
import { localPlan, totalsOf, shoppingList, fromAiPlan, shoppingText, aisleOf, MEAL_IDS } from "../js/mealplan.js";
import { FOODS } from "../js/foods.js";

const byName = Object.fromEntries(FOODS.map(f => [f.name, f]));
const items = days => days.flatMap(d => d.meals.flatMap(m => m.items));
const TARGETS = [[1400, 100], [2000, 150], [2600, 180], [3400, 190]];
const DIETS = [[], ["vegetarien"], ["sans_lactose", "sans_gluten"], ["vegetarien", "sans_lactose"]];

test("plan hors ligne : chaque jour tombe sur les calories (±6 %) et les protéines (≥ 94 %)", () => {
  for (const [kcal, p] of TARGETS) for (const diet of DIETS) for (const start of [0, 4]) {
    const days = localPlan({ kcal, p }, { days: 7, diet, start });
    assert.equal(days.length, 7);
    for (const d of days) {
      const t = totalsOf(d.meals.flatMap(m => m.items)), why = `${kcal} kcal / ${p} g, ${diet.join("+") || "sans régime"}, ${d.name} : ${Math.round(t.k)} kcal, ${Math.round(t.p)} g`;
      assert.ok(Math.abs(t.k - kcal) / kcal <= 0.06, why);
      assert.ok(t.p >= p * 0.94, why);
      assert.ok(d.meals.length >= 3 && d.meals.length <= 7, why);
      assert.ok(d.meals.every(m => MEAL_IDS.includes(m.meal) && m.name && m.items.length), why);
    }
  }
});

test("plan hors ligne : des portions qu'on sert vraiment, des aliments de la base", () => {
  for (const [kcal, p] of [[1300, 90], [4000, 220]]) for (const diet of DIETS) {
    for (const it of items(localPlan({ kcal, p }, { days: 7, diet }))) {
      assert.ok(byName[it.name], `aliment inconnu ${it.name}`);
      assert.deepEqual(it.per, byName[it.name].per);
      assert.ok(it.g >= 5, `${it.name} ${it.g} g`);
      const max = { "Œuf": 220, "Whey (poudre)": 40, "Huile d'olive": 20, Amandes: 40 }[it.name];
      if (max) assert.ok(it.g <= max, `${it.name} ${it.g} g`);
      if (it.name === "Œuf" || it.name === "Banane") assert.equal(it.g % it.unit.g, 0, `${it.name} à l'unité`);
    }
  }
});

test("plan hors ligne : varié d'un jour à l'autre et reproductible", () => {
  const days = localPlan({ kcal: 2200, p: 140 }, { days: 5 });
  for (let i = 1; i < days.length; i++) assert.notEqual(days[i].meals[1].name, days[i - 1].meals[1].name);
  assert.deepEqual(localPlan({ kcal: 2200, p: 140 }, { days: 3, start: 2 }), localPlan({ kcal: 2200, p: 140 }, { days: 3, start: 2 }));
  assert.notDeepEqual(localPlan({ kcal: 2200, p: 140 }, { days: 1, start: 0 })[0].meals[1].name, localPlan({ kcal: 2200, p: 140 }, { days: 1, start: 1 })[0].meals[1].name);
});

test("régimes : végétarien, sans lactose, sans gluten, et des noms de repas qui suivent", () => {
  const all = diet => localPlan({ kcal: 2300, p: 140 }, { days: 7, diet });
  const veg = all(["vegetarien"]);
  assert.ok(!items(veg).some(x => /poulet|dinde|steak|saumon|cabillaud|thon|jambon/i.test(x.name)));
  const lac = all(["sans_lactose"]);
  assert.ok(!items(lac).some(x => /^lait demi|skyr|fromage|yaourt grec/i.test(x.name)), "sans lactose");
  assert.ok(!lac.flatMap(d => d.meals).some(m => /skyr|fromage blanc|yaourt grec/i.test(m.name)), "noms sans lactose");
  const glu = all(["sans_gluten"]);
  assert.ok(!items(glu).some(x => /pain|pâtes|muesli|wrap/i.test(x.name)), "sans gluten");
  const names = glu.flatMap(d => d.meals.map(m => m.name));
  assert.ok(!names.some(n => /pain|pâtes|nouilles|muesli|tartine|wrap/i.test(n)), names.join(" | "));
  assert.ok(names.some(n => /galettes de riz|riz/i.test(n)));
  // les deux à la fois, et le shake reste sans lait de vache
  const both = all(["sans_lactose", "sans_gluten", "vegetarien"]);
  assert.ok(!items(both).some(x => /^lait demi|skyr|fromage|pain|pâtes|poulet|saumon/i.test(x.name)));
  assert.ok(names.every(n => n[0] === n[0].toUpperCase()));
});

test("liste de courses : quantités crues, à l'unité, rangées par rayon", () => {
  const meal = (...its) => ({ meal: "lunch", name: "Test", items: its.map(([name, g]) => ({ name, g, per: byName[name].per, unit: byName[name].unit })) });
  const days = [
    { name: "Jour 1", meals: [meal(["Riz blanc cuit", 200], ["Blanc de poulet", 160], ["Œuf", 110], ["Sauce tomate", 100]), meal(["Lait demi-écrémé", 250], ["Lait de coco", 15])] },
    { name: "Jour 2", meals: [meal(["Riz blanc cuit", 150], ["Œuf", 55], ["Banane", 120], ["Lait demi-écrémé", 1000])] },
  ];
  const list = shoppingList(days), get = n => list.find(x => x.name === n);
  assert.equal(get("Riz").qty, "140 g");             // 350 g cuits → 140 g crus
  assert.ok(!get("Riz blanc cuit"));
  assert.equal(get("Blanc de poulet").qty, "200 g"); // la viande perd ~20 % à la cuisson
  assert.equal(get("Œuf").qty, "3");
  assert.equal(get("Banane").qty, "1");
  assert.equal(get("Lait demi-écrémé").qty, "1,3 L");
  assert.equal(get("Lait de coco").qty, "20 ml");
  assert.equal(get("Sauce tomate").aisle, "Épicerie");
  assert.equal(get("Banane").aisle, "Fruits et légumes");
  assert.equal(get("Blanc de poulet").aisle, "Viandes et poissons");
  assert.equal(get("Œuf").aisle, "Crèmerie et œufs");
  const order = ["Fruits et légumes", "Viandes et poissons", "Crèmerie et œufs", "Pain", "Épicerie"];
  const idx = list.map(x => order.indexOf(x.aisle));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  assert.ok(list.every(x => x.id && x.done === false));
  const txt = shoppingText(list);
  assert.match(txt, /^Fruits et légumes\n• Banane : 1/);
  assert.match(txt, /Épicerie\n(• .*\n)*• Riz : 140 g/);
  for (const [n, a] of [["Pomme de terre", "Fruits et légumes"], ["Concombre", "Fruits et légumes"], ["Beurre de cacahuète", "Épicerie"],
    ["Pain complet", "Pain"], ["Yaourt de soja", "Crèmerie et œufs"], ["Escalope de dinde", "Viandes et poissons"]]) assert.equal(aisleOf(n), a, n);
});

test("plan de l'IA : valeurs de référence pour les aliments connus, garde-fous sur le reste", () => {
  const r = fromAiPlan({
    days: [
      { meals: [
        { meal: "breakfast", name: "Porridge", items: [{ name: "flocons d'avoine", grams: 60, kcal: 999, protein: 1, carbs: 1, fat: 1 }, { name: "Banane", grams: 120, kcal: 100, protein: 1, carbs: 25, fat: 0 }] },
        { meal: "goûter", name: "Smoothie maison", items: [{ name: "Smoothie mangue-passion", grams: 250, kcal: 150, protein: 2, carbs: 34, fat: 1 }] },
        { meal: "lunch", name: "Vide", items: [{ name: "Rien", grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }] },
      ] },
      { meals: [] },
    ],
    shopping: [{ name: "Flocons d'avoine", qty: "500 g", aisle: "Épicerie" }, { name: "Bananes", qty: "6", aisle: "Rayon inventé" }, { qty: "1" }],
    tips: "Prépare le riz pour 3 jours.",
  });
  assert.equal(r.days.length, 1);
  const [bf, snack] = r.days[0].meals;
  assert.equal(r.days[0].meals.length, 2);
  assert.equal(bf.items[0].name, "Flocons d'avoine");
  assert.deepEqual(bf.items[0].per, byName["Flocons d'avoine"].per); // pas les 999 kcal inventées
  assert.equal(snack.meal, "snack");
  assert.deepEqual(snack.items[0].per, { k: 60, p: 0.8, c: 13.6, f: 0.4 }); // inconnu : valeurs de l'IA ramenées à 100 g
  assert.deepEqual(r.shopping.map(x => [x.name, x.qty, x.aisle]), [["Flocons d'avoine", "500 g", "Épicerie"], ["Bananes", "6", "Fruits et légumes"]]);
  assert.equal(r.tips, "Prépare le riz pour 3 jours.");
  // sans liste fournie, l'app la calcule
  const r2 = fromAiPlan({ days: [{ meals: [{ meal: "dinner", name: "Riz", items: [{ name: "Riz blanc cuit", grams: 250, kcal: 325, protein: 6, carbs: 70, fat: 1 }] }] }] });
  assert.deepEqual(r2.shopping.map(x => [x.name, x.qty]), [["Riz", "100 g"]]);
  assert.deepEqual(fromAiPlan(), { days: [], shopping: [], tips: "" });
});
