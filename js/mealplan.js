// Plan de repas et liste de courses. En ligne, l'IA compose le plan (variété, goûts, régime) ; hors ligne (ou en
// secours), l'app assemble des repas simples, mis à l'échelle de tes objectifs (calories, protéines) et de ton
// régime. La liste de courses additionne tout, en quantités à acheter (crues), rangées par rayon. Testé dans Node.
import { FOODS } from "./foods.js";
import { refFood, r1, newId } from "./nutrition.js";

export const MEAL_IDS = ["breakfast", "lunch", "dinner", "snack"];
export const DIETS = [
  { id: "vegetarien", name: "Végétarien" }, { id: "sans_porc", name: "Sans porc" }, { id: "sans_lactose", name: "Sans lactose" },
  { id: "sans_gluten", name: "Sans gluten" }, { id: "budget", name: "Petit budget" }, { id: "rapide", name: "Rapide à préparer" },
];
const byName = Object.fromEntries(FOODS.map(f => [f.name, f]));

// Repas simples : [nom, [[aliment de la base, grammes]…], étiquettes (viande, poisson)]
const T = {
  breakfast: [
    ["Porridge banane", [["Flocons d'avoine", 60], ["Lait demi-écrémé", 250], ["Banane", 120], ["Skyr", 150]]],
    ["Œufs et tartines", [["Pain complet", 70], ["Œuf", 110], ["Fromage blanc 0 %", 150], ["Kiwi", 75]]],
    ["Bol yaourt grec, muesli et fraises", [["Yaourt grec", 150], ["Muesli", 50], ["Fraises", 125], ["Amandes", 20]]],
    ["Tartines beurre de cacahuète", [["Pain complet", 70], ["Beurre de cacahuète", 20], ["Banane", 120], ["Lait demi-écrémé", 250]]],
  ],
  lunch: [
    ["Poulet, riz et brocoli", [["Blanc de poulet", 150], ["Riz blanc cuit", 200], ["Brocoli", 150], ["Huile d'olive", 10]], ["viande"]],
    ["Saumon, pâtes complètes et haricots verts", [["Saumon", 125], ["Pâtes complètes cuites", 200], ["Haricots verts", 150], ["Huile d'olive", 5]], ["poisson"]],
    ["Bowl lentilles, riz et œufs", [["Lentilles cuites", 200], ["Riz complet cuit", 150], ["Œuf", 110], ["Carotte", 80], ["Huile d'olive", 10]]],
    ["Dinde, quinoa et courgettes", [["Escalope de dinde", 150], ["Quinoa cuit", 180], ["Courgette", 200], ["Huile d'olive", 10]], ["viande"]],
    ["Tofu sauté, nouilles et légumes", [["Tofu", 150], ["Pâtes cuites", 200], ["Poivron", 100], ["Brocoli", 100], ["Sauce soja", 15], ["Huile d'olive", 10]]],
    ["Steak haché, pommes de terre et salade", [["Steak haché 5 %", 125], ["Pomme de terre", 250], ["Salade verte", 80], ["Vinaigrette", 15]], ["viande"]],
    ["Wrap thon crudités", [["Wrap / tortilla", 60], ["Thon au naturel", 110], ["Tomate", 120], ["Salade verte", 40], ["Fromage blanc 0 %", 50]], ["poisson"]],
  ],
  dinner: [
    ["Cabillaud, patate douce et épinards", [["Cabillaud", 150], ["Patate douce", 200], ["Épinards", 150], ["Huile d'olive", 10]], ["poisson"]],
    ["Omelette, pain et salade", [["Œuf", 165], ["Fromage râpé", 20], ["Pain complet", 50], ["Salade verte", 80], ["Vinaigrette", 15]]],
    ["Poulet au curry maison et riz", [["Blanc de poulet", 150], ["Lait de coco", 50], ["Riz blanc cuit", 180], ["Poivron", 100], ["Oignon", 50]], ["viande"]],
    ["Chili sin carne", [["Haricots rouges cuits", 200], ["Riz blanc cuit", 150], ["Sauce tomate", 120], ["Maïs", 80], ["Avocat", 50], ["Oignon", 40]]],
    ["Pâtes bolognaise maison", [["Pâtes cuites", 220], ["Steak haché 5 %", 100], ["Sauce tomate", 150], ["Fromage râpé", 15], ["Salade verte", 50]], ["viande"]],
    ["Dal de lentilles et riz", [["Lentilles cuites", 220], ["Lait de coco", 40], ["Tomate", 100], ["Oignon", 50], ["Riz complet cuit", 150]]],
    ["Saumon, riz et haricots verts", [["Saumon", 125], ["Riz blanc cuit", 180], ["Haricots verts", 150]], ["poisson"]],
  ],
  snack: [
    ["Skyr et pomme", [["Skyr", 150], ["Pomme", 150]]],
    ["Amandes et banane", [["Amandes", 30], ["Banane", 120]]],
    ["Fromage blanc et myrtilles", [["Fromage blanc 3 %", 150], ["Myrtilles", 100]]],
    ["Galettes de riz et beurre de cacahuète", [["Galette de riz", 18], ["Beurre de cacahuète", 15], ["Pomme", 150]]],
  ],
};
const PROTEIN_SNACK = ["Shake protéiné", [["Whey (poudre)", 30], ["Lait demi-écrémé", 250]]];
// Remplacements selon le régime : aliment → [remplaçant (null : retiré), [mot du nom du repas, nouveau mot], ratio]
const LACTOSE = {
  "Lait demi-écrémé": ["Boisson végétale", [/lait/i, "boisson végétale"]], Skyr: ["Yaourt de soja", [/skyr/i, "yaourt de soja"]],
  "Fromage blanc 0 %": ["Yaourt de soja", [/fromage blanc/i, "yaourt de soja"]], "Fromage blanc 3 %": ["Yaourt de soja", [/fromage blanc/i, "yaourt de soja"]],
  "Yaourt grec": ["Yaourt de soja", [/yaourt grec/i, "yaourt de soja"]], "Fromage râpé": [null],
};
const GLUTEN = {
  "Pain complet": ["Galette de riz", [/tartines?|pain/i, "galettes de riz"], 0.6], // 70 g de pain → ~40 g de galettes de riz
  "Pâtes cuites": ["Riz blanc cuit", [/pâtes|nouilles/i, "riz"]], "Pâtes complètes cuites": ["Riz complet cuit", [/pâtes complètes/i, "riz complet"]],
  Muesli: ["Flocons d'avoine", [/muesli/i, "flocons d'avoine"]], "Wrap / tortilla": [null, [/^wrap/i, "salade"]],
};
// Un repas adapté au régime, son nom suivant les remplacements (« Pâtes bolognaise » → « Riz bolognaise »)
function adapt(name, items, diet) {
  let base = items.map(([n, g]) => [n, g]);
  for (const [id, map] of [["sans_lactose", LACTOSE], ["sans_gluten", GLUTEN]]) {
    if (!diet.includes(id)) continue;
    base = base.flatMap(([n, g]) => {
      if (!map[n]) return [[n, g]];
      const [to, re, ratio = 1] = map[n];
      if (re) name = name.replace(re[0], re[1]);
      return to ? [[to, Math.round(g * ratio)]] : [];
    });
  }
  return { name: name.charAt(0).toUpperCase() + name.slice(1), base };
}
const allowed = (tpl, diet) => !(diet.includes("vegetarien") && (tpl[2] || []).some(t => t === "viande" || t === "poisson"));
// Valeurs d'une liste d'aliments
export function totalsOf(items) {
  const t = { k: 0, p: 0, c: 0, f: 0 };
  for (const it of items) { const m = (it.g || 0) / 100, per = it.per || {}; t.k += (per.k || 0) * m; t.p += (per.p || 0) * m; t.c += (per.c || 0) * m; t.f += (per.f || 0) * m; }
  return t;
}
// Quantité arrondie comme on la sert : à l'unité pour les œufs et les fruits, sinon par 5 ou 10 g
export const UNIT = /^(œuf|banane|pomme|kiwi|orange|poire|wrap|galette)$/;
function roundG(food, g) {
  const u = food.unit;
  if (u && UNIT.test(u.label)) return Math.max(1, Math.round(g / u.g)) * u.g;
  return g < 100 ? Math.max(5, Math.round(g / 5) * 5) : Math.round(g / 10) * 10;
}
// Portions plafonnées : pas d'omelette de 7 œufs ni de 50 g d'huile, même pour de gros besoins
const MAXG = { "Œuf": 220, "Whey (poudre)": 40, "Huile d'olive": 20, Vinaigrette: 20, Amandes: 40, "Beurre de cacahuète": 30, "Fromage râpé": 40, "Lait de coco": 100, Avocat: 150 };
const serve = (name, g) => roundG(byName[name], Math.min(g, MAXG[name] ?? Infinity));
const item = (name, g) => { const f = byName[name]; return { name, g: serve(name, g), per: f.per, unit: f.unit }; };

// Deux leviers pour tomber juste sur les calories ET les protéines : les aliments riches en protéines (au moins 30 %
// des calories : viande, poisson, œufs, skyr, tofu…) sont mis à l'échelle `a`, les féculents, fruits secs et matières
// grasses à l'échelle `b` ; les légumes gardent leur portion. On cherche le meilleur couple dans des bornes qui gardent
// des portions normales : les calories au plus juste, et les protéines au moins à l'objectif.
const rich = per => (per.p * 4) / Math.max(1, per.k) >= 0.3;
const veg = n => byName[n].per.k < 45 && aisleOf(n) === "Fruits et légumes";
const scaleOf = (n, s) => (veg(n) ? 1 : rich(byName[n].per) ? s.a : s.b);
// Les totaux sont calculés sur les quantités arrondies, telles qu'elles seront servies ; recherche grossière puis fine
function scales(meals, t) {
  const list = meals.flatMap(m => m.base.map(([n, g]) => ({ n, f: byName[n], g, cls: veg(n) ? 0 : rich(byName[n].per) ? 1 : 2 })));
  let best = null;
  const tryAB = (a, b) => {
    if (a < 0.5 || a > 2.2 || b < 0.4 || b > 2.5) return;
    let k = 0, p = 0;
    for (const x of list) { const g = serve(x.n, x.g * (x.cls === 0 ? 1 : x.cls === 1 ? a : b)) / 100; k += x.f.per.k * g; p += x.f.per.p * g; }
    const err = 1.2 * Math.abs(k - t.kcal) / t.kcal + Math.max(0, t.p - p) / t.p + 0.01 * (Math.abs(Math.log(a)) + Math.abs(Math.log(b)));
    if (!best || err < best.err) best = { a, b, k, p, err };
  };
  for (let i = 0; i <= 17; i++) for (let j = 0; j <= 21; j++) tryAB(0.5 + i * 0.1, 0.4 + j * 0.1);
  const { a, b } = best;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) tryAB(a + i * 0.025, b + j * 0.025);
  return best;
}

// Plan hors ligne : `days` jours de 4 repas (plus de collations si les besoins sont élevés), variés, à l'échelle des objectifs { kcal, p }
export function localPlan(t, { days = 3, diet = [], start = 0 } = {}) {
  const pick = (meal, d) => { const list = T[meal].filter(x => allowed(x, diet)); return list[(d + start) % list.length]; };
  const plate = (meal, [name, items]) => ({ meal, ...adapt(name, items, diet) });
  const out = [];
  for (let d = 0; d < days; d++) {
    let meals = MEAL_IDS.map(meal => plate(meal, pick(meal, d))), s = scales(meals, t);
    const off = () => Math.abs(s.k - t.kcal) > t.kcal * 0.05 || s.p < t.p * 0.95;
    const tryAlt = alt => { const s2 = scales(alt, t); if (s2.err < s.err - 0.005) { meals = alt; s = s2; } };
    // l'objectif n'est pas tenable avec ces repas : la collation devient un shake protéiné (riche en protéines, léger)…
    if (off()) tryAlt(meals.map((m, i) => (i === 3 ? plate("snack", PROTEIN_SNACK) : m)));
    if (s.p < t.p * 0.95) tryAlt([...meals, plate("snack", PROTEIN_SNACK)]); // gros besoin en protéines (végétarien…) : un 2e shake
    // …gros besoins : une collation de plus plutôt que des assiettes démesurées ; petits besoins : pas de collation
    for (let i = 1; s.k < t.kcal * 0.95 && i <= 3; i++) tryAlt([...meals, plate("snack", pick("snack", d + i))]);
    if (s.k > t.kcal * 1.05) tryAlt(meals.filter(m => m.meal !== "snack"));
    out.push({ name: `Jour ${d + 1}`, meals: meals.map(m => ({ meal: m.meal, name: m.name,
      items: m.base.map(([n, g]) => item(n, g * scaleOf(n, s))) })) });
  }
  return out;
}

/* ---------- Liste de courses ---------- */
// Quantité à acheter : féculents et légumineuses crus (cuits ≈ 2,5 fois plus lourds), viandes et poissons crus (−25 % à la cuisson)
const RAW = { "Riz blanc cuit": ["Riz", 0.4], "Riz complet cuit": ["Riz complet", 0.4], "Pâtes cuites": ["Pâtes", 0.4], "Pâtes complètes cuites": ["Pâtes complètes", 0.4],
  "Quinoa cuit": ["Quinoa", 0.4], "Lentilles cuites": ["Lentilles", 0.4], "Haricots rouges cuits": ["Haricots rouges", 0.45], "Semoule / couscous": ["Semoule", 0.4] };
const MEAT = /poulet|dinde|steak|saumon|cabillaud|boeuf|bœuf|porc|veau|agneau|truite|dorade/i;
const AISLES = [
  ["Fruits et légumes", /^(banane|kiwi|fraise|framboise|myrtille|pomme|poire|orange|clémentine|mandarine|citron|pamplemousse|raisin|mangue|ananas|melon|pastèque|pêche|abricot|cerise|prune|figue|grenade|brocoli|haricots verts|salade|laitue|mâche|roquette|endive|tomate|concombre|courgette|aubergine|carotte|poivron|épinard|chou|poireau|petits pois|asperge|radis|betterave|céleri|fenouil|potiron|courge|butternut|navet|champignon|patate|pomme de terre|avocat|oignon|échalote|ail|gingembre|persil|coriandre|basilic|ciboulette|menthe|herbes|légumes|fruits)/i],
  ["Viandes et poissons", /poulet|dinde|steak|saumon|cabillaud|colin|merlu|truite|dorade|crevette|bœuf|boeuf|porc|veau|agneau|canard|jambon|lardon|saucisse|merguez|escalope|filet de|poisson/i],
  ["Crèmerie et œufs", /^lait (demi|entier|écrémé)|skyr|fromage|yaourt|œuf|^beurre$|crème|tofu|mozzarella|feta|parmesan/i],
  ["Pain", /^pain|wrap|tortilla|baguette|brioche/i],
  ["Épicerie", /./],
];
export const aisleOf = name => AISLES.find(([, re]) => re.test(name))[0];
const kilo = g => r1(g / 1000).toString().replace(".", ",");
const fmtQty = (g, liquid) => (liquid ? (g >= 1000 ? `${kilo(g)} L` : `${g < 200 ? Math.max(10, Math.round(g / 10) * 10) : Math.round(g / 50) * 50} ml`)
  : g >= 1000 ? `${kilo(g)} kg` : `${Math.max(5, Math.round(g / 10) * 10)} g`);

export function shoppingList(days) {
  const sum = new Map();
  for (const d of days) for (const m of d.meals) for (const it of m.items) {
    const [name, ratio] = RAW[it.name] || [it.name, MEAT.test(it.name) ? 1.25 : 1];
    const cur = sum.get(name) || { name, g: 0, unit: it.unit, liquid: /lait|boisson/i.test(name) };
    cur.g += (it.g || 0) * ratio;
    sum.set(name, cur);
  }
  return [...sum.values()].map(x => {
    const u = x.unit, count = u && UNIT.test(u.label) ? Math.ceil(x.g / u.g - 0.05) : 0;
    return { id: newId(), name: x.name, qty: count ? `${count}` : fmtQty(x.g, x.liquid), aisle: aisleOf(x.name), done: false };
  }).sort((a, b) => AISLES.findIndex(([n]) => n === a.aisle) - AISLES.findIndex(([n]) => n === b.aisle) || a.name.localeCompare(b.name, "fr"));
}

/* ---------- Plan de l'IA ---------- */
// Réponse de l'IA → plan de l'app : les aliments connus gardent leurs valeurs de référence (l'IA donne la quantité)
export function fromAiPlan(r = {}) {
  const per100 = x => { const m = 100 / (x.grams > 0 ? x.grams : 100); return { k: r1(x.kcal * m), p: r1(x.protein * m), c: r1(x.carbs * m), f: r1(x.fat * m) }; };
  const days = (r.days || []).slice(0, 7).map((d, i) => ({
    name: `Jour ${i + 1}`,
    meals: (d.meals || []).slice(0, 5).map(m => ({
      meal: MEAL_IDS.includes(m.meal) ? m.meal : "snack", name: String(m.name || "Repas").slice(0, 60),
      items: (m.items || []).slice(0, 8).filter(x => x.grams > 0).map(x => {
        const ref = refFood(x.name);
        return ref ? { name: ref.name, g: r1(x.grams), per: ref.per, unit: ref.unit } : { name: String(x.name).slice(0, 60), g: r1(x.grams), per: per100(x) };
      }),
    })).filter(m => m.items.length),
  })).filter(d => d.meals.length);
  const shopping = (r.shopping || []).slice(0, 80).filter(x => x.name).map(x => ({ id: newId(), name: String(x.name).slice(0, 60), qty: String(x.qty || "").slice(0, 30),
    aisle: AISLES.some(([n]) => n === x.aisle) ? x.aisle : aisleOf(String(x.name)), done: false }));
  return { days, shopping: shopping.length ? shopping : shoppingList(days), tips: String(r.tips || "").slice(0, 400) };
}
// Texte de la liste (partage, copie)
export const shoppingText = list => {
  const by = {};
  for (const x of list) (by[x.aisle] ||= []).push(`${x.done ? "✓" : "•"} ${x.name}${x.qty ? ` : ${x.qty}` : ""}`);
  return Object.entries(by).map(([a, l]) => `${a}\n${l.join("\n")}`).join("\n\n");
};
