// L'avis du coach sur ce que tu manges (js/plate.js) : chaque aliment de la base reçoit un avis cohérent (les pièges
// de nom : « jus d'orange », « pomme de terre », « beurre de cacahuète », « soda zéro »…), Nutri-Score et valeurs des
// produits, sucres ajoutés, sel et alcool d'une portion ; la revue d'une journée (bien, à éviter, à réduire, ce qui
// manque, échanges, note) et de la semaine ; les répliques du coach taquin qui vont avec ; tout est traduit.
import test from "node:test";
import assert from "node:assert/strict";
import EN from "../js/lang/en.js";
import { FOODS } from "../js/foods.js";
import { isText } from "../scripts/i18n.mjs";
import { LINES, fillLine, foodSituation } from "../js/banter.js";
import { TIERS, GROUPS, GRADES, classify, judgeFood, dayReview, weekStats, plateSituation, itemSituation, portionFact } from "../js/plate.js";

const db = name => { const f = FOODS.find(x => x.name === name); assert.ok(f, name); return f; };
const it = (name, g) => ({ ...db(name), g: g ?? db(name).unit.g });
const grp = (name, g) => judgeFood(db(name), g ?? db(name).unit.g)?.group;

test("chaque aliment de la base : un avis connu, des textes traduits", () => {
  let known = 0;
  for (const f of FOODS) {
    const v = judgeFood(f, f.unit.g);
    if (!v) continue;
    known++;
    assert.ok(TIERS[v.tier], `${f.name} : avis ${v.tier}`);
    assert.ok(GROUPS[v.group], `${f.name} : famille ${v.group}`);
    for (const k of ["sugar", "salt", "alc", "fv", "red", "deli", "fish", "legume"]) assert.ok(Number.isFinite(v[k]) && v[k] >= 0, `${f.name} : ${k}`);
  }
  assert.ok(known >= FOODS.length * 0.95, `${known} aliments reconnus sur ${FOODS.length}`);
  // familles, avis, titres : des phrases affichables, toutes traduites
  const texts = [...Object.values(TIERS), ...Object.values(GRADES), ...Object.values(GROUPS).flatMap(g => [g.name, g.why, g.tip].filter(Boolean))];
  for (const t of texts) { assert.ok(isText(t), `affichable : ${t}`); assert.ok(EN[t], `traduit : ${t}`); }
  // chaque réplique de famille existe chez le coach taquin
  for (const g of Object.values(GROUPS)) if (g.quip) assert.ok(LINES[g.quip]?.length, g.quip);
  for (const k of ["plateGreat", "plateBad", "plateNoVeg", "plateDeli", "plateAlcohol"]) assert.ok(LINES[k]?.length, k);
});

test("les pièges de nom : le bon avis pour la bonne famille", () => {
  const want = {
    "Soda": "sweetdrink", "Soda zéro": "zerodrink", "Jus d'orange": "juice", "Smoothie": "juice", "Bière": "alcohol", "Eau": "water", "Café": "drink",
    "Boisson énergisante": "energy", "Boisson protéinée": "supplement", "Pomme de terre": "starch", "Pomme": "fruit", "Frites": "fried",
    "Beurre de cacahuète": "nuts", "Beurre": "fat", "Huile d'olive": "goodfat", "Pâte à tartiner": "sweet", "Pâtes cuites": "starch",
    "Pâtes complètes cuites": "whole", "Riz complet cuit": "whole", "Riz au lait": "sweet", "Pain au chocolat": "pastry", "Pain complet": "whole",
    "Chocolat noir": "darkchoc", "Chocolat au lait": "sweet", "Saucisson sec": "deli", "Blanc de poulet en tranches": "deli", "Blanc de poulet": "poultry",
    "Steak haché 5 %": "redmeat", "Saumon": "fatfish", "Thon au naturel": "fish", "Thon à l'huile": "fish", "Sardines à l'huile": "fatfish",
    "Poulet pané / nuggets": "fried", "Lentilles cuites": "legume", "Haricots verts": "veg", "Haricots rouges cuits": "legume", "Tofu": "soy",
    "Fromage blanc 0 %": "dairy", "Yaourt aux fruits": "sweetdairy", "Raclette (fromage)": "cheese", "Raclette": "rich", "Sauce burger": "fat",
    "Sauce tomate": "veg", "Ketchup": "sauce", "Raisins secs": "dried", "Raisin": "fruit", "Salade de fruits": "fruit", "Salade verte": "veg",
    "Noix de Saint-Jacques": "fish", "Noix": "nuts", "Fruits au sirop": "sweet", "Lait de coco": "fat", "Lait demi-écrémé": "dairy",
    "Lait chocolaté": "sweet", "Burger": "fastfood", "Chips": "snack", "Olives": "salty", "Sauce soja": "salty", "Croissant": "pastry",
  };
  for (const [name, g] of Object.entries(want)) assert.equal(grp(name), g, name);
  // produits (Open Food Facts) : le nom d'abord, puis le Nutri-Score et les valeurs
  assert.equal(judgeFood({ name: "Coca-Cola", per: { k: 42, c: 10.6, su: 10.6 } }, 330).group, "sweetdrink");
  assert.equal(judgeFood({ name: "Coca-Cola sans sucres", per: { k: 0, c: 0 } }, 330).group, "zerodrink");
  assert.equal(judgeFood({ name: "Compote pomme sans sucres ajoutés", per: { k: 50, c: 12, su: 11 } }, 100).sugar, 0);
  assert.equal(judgeFood({ name: "Fraise Tagada", code: "123", per: { k: 340, c: 80, su: 60 } }, 30).group, "sweet");
  assert.equal(judgeFood({ name: "Activia fraise", code: "456", per: { k: 95, p: 3.6, c: 14, su: 12.5 } }, 125).group, "sweetdairy");
  assert.equal(judgeFood({ name: "Truc mystère", nutri: "e", per: { k: 500, c: 50 } }, 100).group, "nutriBad");
  assert.equal(judgeFood({ name: "Truc mystère", nutri: "a", per: { k: 80, c: 5 } }, 100).group, "nutriGood");
  assert.equal(judgeFood({ name: "Muesli croustillant", nutri: "d", per: { k: 450, c: 65 } }, 50).tier, "ok"); // complet, mais noté D
  assert.equal(classify({ name: "Noix de coco" }), null);
  assert.equal(judgeFood({ name: "Brown rice", per: { k: 120, c: 25 } }, 150).group, "whole");
  assert.equal(judgeFood({ name: "Orange juice", per: { k: 45, c: 10 } }, 250).group, "juice");
});

test("une portion : sucres ajoutés, sel, alcool, fruits et légumes, viande rouge et charcuterie", () => {
  const soda = judgeFood(db("Soda"), 330);
  assert.ok(soda.sugar >= 30 && soda.sugar <= 40, `${soda.sugar} g`);
  assert.deepEqual(portionFact(soda), { t: "Cette portion : ≈ %n g de sucres ajoutés, soit %s morceaux de sucre.", v: { n: Math.round(soda.sugar), s: 7 } });
  const beer = judgeFood(db("Bière"), 500);
  assert.equal(beer.alc, 2);
  assert.match(portionFact(beer).t, /verre\(s\) standard/);
  assert.equal(judgeFood(db("Vin"), 100).alc, 1);
  assert.ok(judgeFood(db("Saucisson sec"), 50).salty);
  assert.match(portionFact(judgeFood(db("Saucisson sec"), 50)).t, /g de sel/);
  assert.equal(portionFact(judgeFood(db("Riz blanc cuit"), 200)), null); // un féculent n'est pas « très salé »
  assert.equal(judgeFood(db("Brocoli"), 160).fv, 160);
  assert.equal(judgeFood(db("Chili con carne"), 400).red, 80);
  assert.equal(judgeFood(db("Choucroute garnie"), 400).deli, 140);
  assert.equal(judgeFood(db("Sushi / maki"), 200).fish, 60);
});

const GOOD = () => [it("Flocons d'avoine", 60), it("Banane", 120), it("Skyr", 150), it("Amandes", 30), it("Blanc de poulet", 180), it("Riz complet cuit", 200),
  it("Brocoli", 200), it("Saumon", 150), it("Lentilles cuites", 150), it("Pomme", 150), it("Carotte", 100)];
const BAD = () => [it("Croissant", 60), it("Soda", 660), it("Pizza", 350), it("Chips", 50), it("Saucisson sec", 60), it("Bière", 500), it("Cookie", 50)];

test("une bonne journée : ce qui est bien, une belle note", () => {
  const rv = dayReview(GOOD(), { kcal: 2400, protein: 140, hour: 21 });
  assert.equal(rv.grade, "great", `${rv.score}`);
  assert.deepEqual(rv.avoid, []);
  const ids = rv.good.map(x => x.id);
  for (const id of ["fv", "protein", "fiber", "legume", "fatfish", "whole", "nuts"]) assert.ok(ids.includes(id), id);
  assert.ok(rv.stats.fv >= 5);
  assert.equal(plateSituation(rv, 21).kind, "plateGreat");
  assert.equal(plateSituation(rv, 12), null); // la journée n'est pas finie
});

test("une journée à rattraper : à éviter, à réduire, échanges, note basse", () => {
  const rv = dayReview(BAD(), { kcal: 2400, protein: 140, hour: 22 });
  assert.equal(rv.grade, "bad", `${rv.score}`);
  assert.deepEqual(rv.avoid.map(x => x.id), ["soda", "alcohol"]);
  assert.ok(["sugar", "deli", "processed"].every(id => rv.reduce.some(x => x.id === id)), rv.reduce.map(x => x.id).join());
  assert.equal(rv.avoid[0].v.s, Math.round(rv.avoid[0].v.n / 5)); // morceaux de sucre
  assert.equal(rv.stats.alc, 2);
  assert.ok(rv.swaps.length >= 3 && rv.swaps.every(s => s.f && s.tip));
  assert.ok(rv.missing.some(x => x.id === "fv"));
  assert.ok(rv.junk.includes("Soda") && rv.junk.includes("Saucisson sec"));
  assert.equal(plateSituation(rv, 22).kind, "plateBad");
  // gabarits : des phrases traduites
  for (const x of [...rv.good, ...rv.avoid, ...rv.reduce, ...rv.missing]) { assert.ok(isText(x.t), x.t); assert.ok(EN[x.t], `traduit : ${x.t}`); }
});

test("au fil de la journée : les manques attendent le soir, sauf les fruits et légumes", () => {
  const items = [it("Croissant", 60), it("Café", 150)];
  const morning = dayReview(items, { kcal: 2200, protein: 140, hour: 9 });
  assert.deepEqual(morning.missing.map(x => x.id), ["fv"]);
  assert.match(morning.missing[0].t, /pour l'instant/);
  const night = dayReview(items, { kcal: 2200, protein: 140, hour: 22, water: 2, waterGoal: 8 });
  assert.ok(["fv", "protein", "water"].every(id => night.missing.some(x => x.id === id)));
  assert.equal(dayReview([], {}).grade, null);
});

test("la semaine : charcuterie, viande rouge, poisson, légumineuses, alcool", () => {
  const days = Array.from({ length: 7 }, (_, i) => [it("Jambon blanc", 40), it("Steak haché 5 %", 100), ...(i % 3 === 0 ? [it("Saumon", 125)] : []), it("Bière", 250)]);
  const w = weekStats(days);
  assert.deepEqual([w.logged, w.deli, w.red, w.fishDays, w.fatFishDays, w.legumeDays, w.alc], [7, 280, 700, 3, 3, 0, 7]);
  const rv = dayReview(days[6], { kcal: 2200, protein: 140, hour: 21, week: w });
  assert.ok(rv.reduce.some(x => x.id === "deli" && x.v.n === 280));
  assert.ok(rv.reduce.some(x => x.id === "red" && x.v.n === 700));
  assert.ok(rv.missing.some(x => x.id === "legumeWeek"));
  assert.equal(plateSituation(rv, 21).kind, "plateDeli");
  // moins de 3 jours notés : pas de semaine (des chiffres trompeurs)
  assert.equal(dayReview(days[6], { week: weekStats([days[0], days[1]]) }).week, null);
});

test("coach taquin : la réplique d'un aliment, la pique de l'assiette, accords et ordre des situations", () => {
  const soda = judgeFood(db("Soda"), 330);
  assert.deepEqual(itemSituation(soda, { name: "Soda" }), { kind: "eatSoda", vals: { f: "Soda", n: Math.round(soda.sugar), s: 7 } });
  const veg = judgeFood(db("Brocoli"), 150);
  assert.equal(itemSituation(veg, { first: true }).kind, "eatVeg");
  assert.equal(itemSituation(veg, { first: false }), null); // on ne félicite pas à chaque brocoli
  assert.equal(itemSituation(judgeFood(db("Saucisson sec"), 50), { week: { deli: 210 } }).vals.n, 210);
  assert.equal(itemSituation(judgeFood(db("Riz blanc cuit"), 200)), null);
  // « h » (Mes objectifs) : accordé au masculin
  assert.equal(fillLine("T'es [[censé|censée|censé·e]] sécher.", {}, "h"), "T'es censé sécher.");
  // l'assiette parle après l'objectif dépassé et le rattrapage du matin, avant les aliments « plaisir »
  const plate = { kind: "plateAlcohol", vals: { n: 3 } };
  const base = { goal: "seche", target: 2000, protein: 150, proteinTarget: 150, hour: 21, junk: ["Pizza"], plate };
  assert.equal(foodSituation({ ...base, eaten: 2600 }).kind, "overCut");
  assert.deepEqual(foodSituation({ ...base, eaten: 1900 }), plate);
  assert.equal(foodSituation({ ...base, eaten: 1900, plate: null }).kind, "junk");
});
