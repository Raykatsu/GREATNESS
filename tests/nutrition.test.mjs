// Nutrition : objectifs, journal, lecture d'un repas écrit, Open Food Facts, codes-barres, synchro.
import test from "node:test";
import assert from "node:assert/strict";
import {
  targets, dayKey, shiftKey, addItem, updateItem, removeItem, setWater, sumItems, itemTotals, dayOf, copyMeal, lastDays,
  weekNutrition, pruneFood, searchLocal, parseMeal, offFood, cleanBarcode, mergeFood, nutritionContext, template,
  aiInfoFood, learnFood, refFood, foodFacts,
} from "../js/nutrition.js";
import { FOODS, norm } from "../js/foods.js";
import { mergeData } from "../js/merge.js";

const fresh = (profile = {}) => ({ profile: { bodyweight: 80, height: 180, age: 28, sex: "h", activity: "light", days: 4, goal: "muscle", ...profile }, food: {}, deleted: {} });
const find = name => FOODS.find(f => f.name === name);

test("objectifs : Mifflin-St Jeor, activité, objectif, macros cohérentes", () => {
  const t = targets(fresh().profile);
  assert.equal(t.bmr, 1790);
  assert.equal(t.kcal, 2820); // dépense ~2559 kcal + 10 % (prise de muscle)
  assert.equal(t.p, 160);     // 2 g/kg
  assert.ok(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal) < 10, "les macros font les calories");
  const cut = targets(fresh({ sex: "f", bodyweight: 60, height: 165, age: 30, days: 3, goal: "seche" }).profile);
  assert.equal(cut.kcal, 1510); // -20 %
  assert.equal(cut.p, 132);     // 2,2 g/kg en sèche
  assert.ok(targets(fresh({ activity: "high" }).profile).kcal > t.kcal);
  // jamais en dessous d'un plancher raisonnable
  assert.ok(targets({ bodyweight: 40, height: 150, age: 70, sex: "f", activity: "sed", days: 0, goal: "seche" }).kcal >= 1300);
  // objectifs personnalisés
  const own = targets(fresh({ nutri: { custom: true, kcal: 2000, p: 150 } }).profile);
  assert.deepEqual([own.kcal, own.p, own.custom], [2000, 150, true]);
  // profil incomplet : valeurs par défaut, pas de NaN
  assert.ok(Number.isFinite(targets({}).kcal));
});

test("journal : ajout, modification, suppression, eau, copie d'un repas", () => {
  const s = fresh(), k = "2026-10-13";
  const it = addItem(s, k, find("Blanc de poulet"), { g: 150, meal: "lunch" });
  addItem(s, k, find("Riz blanc cuit"), { g: 200, meal: "lunch" });
  let t = sumItems(dayOf(s, k).items);
  assert.equal(Math.round(t.k), 508);    // 247,5 + 260
  assert.equal(Math.round(t.p * 10) / 10, 51.9);
  assert.equal(s.foodRecent[0].name, "Riz blanc cuit");
  assert.equal(s.foodRecent[0].lastG, 200);
  updateItem(s, k, it.id, { g: 100, meal: "dinner" });
  assert.equal(dayOf(s, k).items[0].meal, "dinner");
  assert.equal(Math.round(itemTotals(dayOf(s, k).items[0]).k), 165);
  removeItem(s, k, it.id);
  assert.equal(dayOf(s, k).items.length, 1);
  assert.deepEqual(s.deleted.food, [it.id]);
  setWater(s, k, 5); setWater(s, k, 99);
  assert.equal(dayOf(s, k).water, 20);
  const copied = copyMeal(s, k, shiftKey(k, 1), "lunch");
  assert.equal(copied.length, 1);
  assert.notEqual(copied[0].id, dayOf(s, k).items[0].id);
  // une entrée ne garde que l'utile (synchronisée entre appareils)
  const x = addItem(s, k, { name: "  Skyr ", per: { k: 63, p: 11, c: 4, f: 0.2, fi: null, su: "" }, src: "off", code: "123", img: "https://x" }, { g: 150, meal: "snack" });
  assert.deepEqual(x.per, { k: 63, p: 11, c: 4, f: 0.2 });
  assert.equal(x.img, undefined);
  assert.equal(x.name, "Skyr");
});

test("7 derniers jours, bilan, allègement des vieux jours", () => {
  const s = fresh(), now = new Date(2026, 9, 13, 12), t = targets(s.profile);
  for (let i = 1; i <= 3; i++) addItem(s, shiftKey(dayKey(now), -i), { name: "Repas", per: { k: t.kcal / 3, p: 60 }, src: "manual" }, { g: 300, meal: "lunch" });
  addItem(s, dayKey(now), { name: "Petit-déj", per: { k: 500, p: 20 }, src: "manual" }, { g: 100, meal: "breakfast" });
  const days = lastDays(s, 7, now);
  assert.equal(days.length, 7);
  assert.equal(days[6].key, "2026-10-13");
  assert.equal(days.filter(d => d.logged).length, 4);
  const w = weekNutrition(s, t, now); // aujourd'hui n'est pas compté (journée pas finie)
  assert.deepEqual([w.n, w.k, w.p, w.inRange, w.protOk], [3, t.kcal, 180, 3, 3]);
  const ctx = nutritionContext(s, now);
  assert.match(ctx, /Objectifs nutrition : 2820 kcal, 160 g de protéines/);
  assert.match(ctx, /Mangé aujourd'hui \(jusqu'ici\) : 500 kcal, 20 g de protéines/);
  assert.match(ctx, /Moyenne des 3 derniers jours renseignés : 2820 kcal et 180 g/);
  assert.equal(nutritionContext(fresh(), now), "");
  // vieux jour → totaux seulement
  addItem(s, "2026-01-02", { name: "Vieux", per: { k: 200, p: 10 }, src: "manual" }, { g: 150, meal: "lunch" });
  pruneFood(s, now, 120);
  assert.deepEqual(s.food["2026-01-02"].sum, { k: 300, p: 15, c: 0, f: 0, fi: 0 });
  assert.equal(s.food["2026-01-02"].items, undefined);
  assert.ok(s.food[shiftKey(dayKey(now), -1)].items.length, "les jours récents gardent le détail");
  assert.equal(Math.round(lastDays(s, 300, now).find(d => d.key === "2026-01-02").t.k), 300);
});

test("recherche : aliments courants, récents et produits perso, sans accents", () => {
  const s = fresh();
  assert.equal(searchLocal("poulet", s)[0].name, "Blanc de poulet");
  assert.equal(searchLocal("oeufs", s)[0].name, "Œuf");
  assert.equal(searchLocal("pates", s)[0].name, "Pâtes cuites");
  assert.equal(searchLocal("NUTELLA", s)[0].name, "Pâte à tartiner");
  s.foodCustom = { "3017620422003": template({ name: "Skyr vanille", brand: "Siggi's", per: { k: 80, p: 9 }, src: "custom", code: "3017620422003" }) };
  assert.deepEqual(searchLocal("skyr", s).slice(0, 2).map(f => f.name), ["Skyr vanille", "Skyr"]); // le produit perso passe devant
  assert.deepEqual(searchLocal("", s), []);
  assert.deepEqual(searchLocal("zzzz", s), []);
  assert.equal(norm("Œufs brouillés – d’Avoine"), "oeufs brouilles d'avoine");
});

test("lecture d'un repas écrit : aliments, quantités et unités", () => {
  const read = t => parseMeal(t).items.map(i => [i.food.name, i.g]);
  assert.deepEqual(read("200 g de poulet, du riz et 2 œufs"), [["Blanc de poulet", 200], ["Riz blanc cuit", 200], ["Œuf", 110]]);
  assert.deepEqual(read("1 bol de flocons d’avoine avec une banane et 250 ml de lait"), [["Flocons d'avoine", 50], ["Banane", 120], ["Lait demi-écrémé", 250]]);
  assert.deepEqual(read("2 cuillères à soupe d'huile d'olive"), [["Huile d'olive", 20]]);
  assert.deepEqual(read("1,5 kg de pommes de terre + une demi pizza"), [["Pomme de terre", 1500], ["Pizza", 62.5]]);
  assert.deepEqual(read("un sandwich jambon-beurre et un coca-cola"), [["Sandwich jambon-beurre", 220], ["Soda", 330]]);
  assert.deepEqual(read("3 tranches de jambon"), [["Jambon blanc", 120]]);
  assert.deepEqual(read("la moitié d'un avocat, un quart de baguette"), [["Avocat", 75], ["Pain / baguette", 12.5]]);
  assert.deepEqual(read("2 cuillères à soupe de miel"), [["Miel", 30]]);
  const r = parseMeal("du blabla inconnu et 150g de saumon");
  assert.deepEqual(r.items.map(i => [i.food.name, i.g]), [["Saumon", 150]]);
  assert.deepEqual(r.unknown, ["du blabla inconnu"]);
});

test("Open Food Facts : conversion d'un produit, kJ → kcal, produits incomplets", () => {
  const f = offFood({
    product_name_fr: "Nutella", brands: "Ferrero, Nutella", serving_quantity: "15", serving_size: "15 g", nutriscore_grade: "e",
    image_front_small_url: "https://images.openfoodfacts.org/x.jpg",
    nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, salt_100g: 0.107 },
  }, "3017620422003");
  assert.deepEqual([f.name, f.brand, f.per.k, f.per.su, f.unit.g, f.unit.label, f.nutri, f.code], ["Nutella", "Ferrero", 539, 56.3, 15, "portion (15 g)", "e", "3017620422003"]);
  assert.equal(offFood({ product_name: "Eau", brands: ["Evian"], nutriments: { energy_100g: 0 } }).per.k, 0);
  assert.equal(Math.round(offFood({ product_name: "X", nutriments: { energy_100g: 1000 } }).per.k), 239); // kJ
  assert.equal(offFood({ product_name: "Sans valeurs", nutriments: {} }), null);
  assert.equal(offFood({ nutriments: { "energy-kcal_100g": 10 } }), null);
  assert.equal(offFood({ product_name: "X", nutriments: { "energy-kcal_100g": 10 }, image_front_small_url: "javascript:alert(1)" }).img, null);
});

test("codes-barres : clé de contrôle, UPC-A, saisie avec espaces", () => {
  assert.equal(cleanBarcode("3017620422003"), "3017620422003");
  assert.equal(cleanBarcode("3017620422004"), null);
  assert.equal(cleanBarcode("96385074"), "96385074");          // EAN-8
  assert.equal(cleanBarcode("012345678905"), "0012345678905"); // UPC-A → EAN-13
  assert.equal(cleanBarcode("3 017620 422003"), "3017620422003");
  assert.equal(cleanBarcode("123"), null);
  assert.equal(cleanBarcode(null), null);
});

test("synchro : journal fusionné jour par jour, suppressions respectées", () => {
  const a = { id: "a", g: 100, at: 1 }, b = { id: "b", g: 50, at: 2 }, c = { id: "c", g: 10, at: 3 };
  const older = { "2026-10-12": { items: [a, b], water: 3, at: 10 }, "2026-10-11": { items: [a], water: 1, at: 5 } };
  const newer = { "2026-10-12": { items: [{ ...a, g: 120 }, c], water: 5, at: 20 }, "2026-10-10": { sum: { k: 1 }, water: 0, at: 1 } };
  const m = mergeFood(older, newer, ["b"]);
  assert.deepEqual(m["2026-10-12"].items.map(x => [x.id, x.g]), [["a", 120], ["c", 10]]);
  assert.equal(m["2026-10-12"].water, 5);
  assert.ok(m["2026-10-11"] && m["2026-10-10"]);
  // via mergeData : les deux appareils gardent leurs repas
  const d1 = { meta: { updatedAt: 100 }, food: { "2026-10-13": { items: [a], water: 2, at: 100 } }, foodRecent: [{ name: "Riz", used: 5 }], deleted: { food: [] } };
  const d2 = { meta: { updatedAt: 200 }, food: { "2026-10-13": { items: [c], water: 4, at: 200 } }, foodRecent: [{ name: "Riz", used: 9 }, { name: "Pomme", used: 1 }], foodCustom: { 123: { name: "X" } }, deleted: { food: ["zz"] } };
  const md = mergeData(d1, d2);
  assert.deepEqual(md.food["2026-10-13"].items.map(x => x.id), ["a", "c"]);
  assert.equal(md.food["2026-10-13"].water, 4);
  assert.deepEqual(md.foodRecent.map(f => [f.name, f.used]), [["Riz", 9], ["Pomme", 1]]);
  assert.deepEqual(md.foodCustom, { 123: { name: "X" } });
  assert.deepEqual(md.deleted.food, ["zz"]);
});

test("la base d'aliments est cohérente (calories ≈ macros, portions, noms uniques)", () => {
  const names = new Set();
  for (const f of FOODS) {
    assert.ok(!names.has(f.name), `doublon ${f.name}`); names.add(f.name);
    assert.ok(f.unit.g > 0 && f.unit.label, f.name);
    const { k, p, c, f: fat, fi } = f.per, est = p * 4 + c * 4 + fat * 9 + fi * 2; // fibres : 2 kcal/g (étiquetage européen)
    // l'alcool (bière, vin, cidre…) explique leur écart
    if (!/Bière|Vin|Cidre|Champagne|Alcool|Cocktail/.test(f.name)) assert.ok(Math.abs(est - k) <= Math.max(25, k * 0.2), `${f.name} : ${k} kcal annoncées, ${Math.round(est)} d'après les macros`);
  }
  // un nom ou un autre nom ne désigne qu'un seul aliment
  const owner = new Map();
  for (const f of FOODS) for (const key of f.keys) { assert.ok(!owner.has(key) || owner.get(key) === f, `« ${key} » : ${owner.get(key)?.name} et ${f.name}`); owner.set(key, f); }
  assert.ok(FOODS.length >= 350, `${FOODS.length} aliments`);
});

test("recherche tolérante : fautes de frappe, pluriels, plats du monde", () => {
  const first = q => searchLocal(q, {})[0]?.name;
  assert.equal(first("bananne"), "Banane");
  assert.equal(first("croisant"), "Croissant");
  assert.equal(first("tiramissu"), "Tiramisu");
  assert.equal(first("yogourt grec"), "Yaourt grec");
  assert.equal(first("pho"), "Phở");
  assert.equal(first("thieb"), "Thiéboudienne");
  assert.equal(first("attieke"), "Attiéké");
  assert.equal(first("bo bun"), "Bo bun");
  assert.deepEqual(searchLocal("zzzqx", {}), []);
});

test("aliment trouvé par l'IA : converti, retenu et retrouvé ensuite hors ligne", () => {
  const f = aiInfoFood({ name: "Bún chả", kcal: 150, protein: 9, carbs: 15, fat: 6, fiber: 1, sugars: 0, salt: 1.2, portion_label: "bol", portion_grams: 400, liquid: false });
  assert.deepEqual(f, { name: "Bún chả", per: { k: 150, p: 9, c: 15, f: 6, fi: 1, sa: 1.2 }, src: "ai", unit: { label: "bol", g: 400 } });
  assert.equal(aiInfoFood({ name: "Bubble tea", kcal: 70, protein: 0.5, carbs: 15, fat: 1, portion_label: "verre", portion_grams: 500, liquid: true }).liquid, true);
  const state = {};
  learnFood(state, f, "bun cha hanoi");
  const saved = state.foodCustom["ai:bun cha"];
  assert.equal(saved.src, "ai"); assert.deepEqual(saved.aka, ["bun cha hanoi"]); assert.ok(saved.used > 0);
  assert.equal(searchLocal("bun cha hanoi", state)[0].name, "Bún chả"); // retrouvé sous le nom cherché
  assert.equal(searchLocal("bún chả", state)[0].name, "Bún chả");
  for (let i = 0; i < 210; i++) learnFood(state, { ...f, name: `Plat ${i}` });
  assert.equal(Object.keys(state.foodCustom).filter(k => k.startsWith("ai:")).length, 200); // les plus anciens partent
});

test("valeurs de référence pour fiabiliser l'IA ; réponses « combien de calories »", () => {
  assert.equal(refFood("Riz blanc cuit").name, "Riz blanc cuit");
  assert.equal(refFood("Bananes").name, "Banane");
  assert.equal(refFood("Poulet grillé au curry, sauce maison"), null); // pas d'à-peu-près
  assert.match(foodFacts("Combien de calories dans une banane ?"), /\*\*Banane\*\* : 90 kcal pour 100 g/);
  assert.match(foodFacts("combien de kcal dans 2 oeufs"), /Pour 110 g : 160 kcal/);
  assert.match(foodFacts("proteines du skyr"), /1 pot \(150 g\) ≈ 95 kcal/);
  assert.equal(foodFacts("combien de calories par jour pour secher"), null);
  assert.equal(foodFacts("j'ai mal au ventre, combien de calories ?"), null);
  const state = { foodCustom: { "ai:bun cha": { name: "Bún chả", aka: ["bun cha hanoi"], per: { k: 150, p: 9, c: 15, f: 6 }, unit: { label: "bol", g: 400 }, src: "ai" } } };
  assert.match(foodFacts("combien de calories dans un bun cha", state), /Bún chả/);
});
