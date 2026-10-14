// Nutrition : objectifs du jour, journal des repas et calculs. Aucun affichage ici (testé dans Node).
// Un aliment (« modèle ») : { name, brand?, per: { k, p, c, f, fi?, su?, sa? } pour 100 g, unit?: { label, g },
//   src: db | off | custom | ai | manual, code?, nutri?, img? }
// Une entrée du journal : le modèle + { id, meal, g (quantité en grammes), at }.
import { FOODS, norm } from "./foods.js";

export const MEALS = [
  { id: "breakfast", name: "Petit-déjeuner" },
  { id: "lunch", name: "Déjeuner" },
  { id: "dinner", name: "Dîner" },
  { id: "snack", name: "Collations" },
];
export const ACTIVITY = {
  sed: { name: "Sédentaire", hint: "Bureau, peu de marche", f: 1.2 },
  light: { name: "Peu actif", hint: "Un peu de marche chaque jour", f: 1.35 },
  mod: { name: "Actif", hint: "Souvent debout ou en mouvement", f: 1.5 },
  high: { name: "Très actif", hint: "Travail physique", f: 1.65 },
};
const GOAL_ADJ = { seche: -0.2, muscle: 0.1, force: 0.05, forme: 0 };
const PROTEIN = { seche: 2.2, muscle: 2, force: 1.8, forme: 1.6 }; // g par kg de poids de corps

export const r1 = x => Math.round((+x || 0) * 10) / 10;
const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Objectifs du jour : métabolisme de base (Mifflin-St Jeor) × activité + entraînement, ajusté à l'objectif.
// Calories adaptatives (adaptive.js) : l'objectif recalculé chaque semaine d'après ta vraie dépense remplace la formule.
export function bmrOf(p = {}) {
  const w = +p.bodyweight || 75, female = p.sex === "f", h = +p.height || (female ? 165 : 177), a = +p.age || 28;
  return 10 * w + 6.25 * h - 5 * a + (female ? -161 : 5);
}
export const tdeeOf = (p = {}) => Math.round(bmrOf(p) * (ACTIVITY[p.activity] || ACTIVITY.light).f + ((+p.days || 3) * 250) / 7);
export function targets(p = {}) {
  const w = +p.bodyweight || 75, female = p.sex === "f", days = +p.days || 3;
  const bmr = bmrOf(p), tdee = bmr * (ACTIVITY[p.activity] || ACTIVITY.light).f + (days * 250) / 7;
  const goal = GOAL_ADJ[p.goal] != null ? p.goal : "forme";
  const ad = p.nutri?.adaptive && p.nutri.adapt?.kcal > 0 ? p.nutri.adapt : null;
  const kcal = ad ? ad.kcal : Math.round(Math.max(tdee * (1 + GOAL_ADJ[goal]), bmr * 1.05, female ? 1300 : 1500) / 10) * 10;
  const prot = Math.round(w * PROTEIN[goal]);
  const fat = Math.round(Math.max(w * 0.7, (kcal * 0.27) / 9));
  const auto = {
    kcal, p: prot, f: fat, c: Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4)),
    fi: Math.round((kcal / 1000) * 14), water: Math.round((w * 35 + (days * 500) / 7) / 250) * 250,
    bmr: Math.round(bmr), tdee: ad ? ad.tdee : Math.round(tdee), custom: false, adaptive: !!ad,
  };
  const n = p.nutri;
  if (!n?.custom) return auto;
  return { ...auto, custom: true, adaptive: false, kcal: +n.kcal || auto.kcal, p: +n.p || auto.p, c: +n.c || auto.c, f: +n.f || auto.f };
}

/* ---------- Journal ---------- */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const keyDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const shiftKey = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d); };

export const dayOf = (state, key) => state.food?.[key] || { items: [], water: 0 };
export function ensureDay(state, key) {
  state.food ||= {};
  return (state.food[key] ||= { items: [], water: 0, at: 0 });
}

// Valeurs d'une entrée pour sa quantité
export function itemTotals(it) {
  const m = (+it.g || 0) / 100, per = it.per || {};
  return { k: (per.k || 0) * m, p: (per.p || 0) * m, c: (per.c || 0) * m, f: (per.f || 0) * m, fi: (per.fi || 0) * m };
}
export function sumItems(items = []) {
  const t = { k: 0, p: 0, c: 0, f: 0, fi: 0 };
  for (const it of items) { const v = itemTotals(it); for (const x in t) t[x] += v[x]; }
  return t;
}
export const dayTotals = day => day?.sum || sumItems(day?.items);

// Garde seulement ce qui sert (pas de valeurs vides) : le journal est synchronisé entre appareils.
function compactPer(per = {}) {
  const out = {};
  for (const k of ["k", "p", "c", "f", "fi", "su", "sa"]) if (per[k] != null && per[k] !== "" && isFinite(+per[k])) out[k] = r1(per[k]);
  out.k ??= 0;
  return out;
}
export function template(f) {
  const t = { name: clip(f.name, 80) || "Aliment", per: compactPer(f.per), src: f.src || "manual" };
  if (f.brand) t.brand = clip(f.brand, 40);
  if (f.unit?.g > 0) t.unit = { label: clip(f.unit.label, 30) || "portion", g: r1(f.unit.g) };
  if (f.code) t.code = String(f.code);
  if (f.nutri) t.nutri = f.nutri;
  if (f.liquid) t.liquid = true;
  return t;
}
export const foodKey = f => (f.code ? `#${f.code}` : `${norm(f.name)}|${norm(f.brand)}`);

export function addItem(state, key, food, { g, meal }) {
  const day = ensureDay(state, key);
  const it = { ...template(food), id: newId(), meal: meal || "snack", g: Math.max(0, r1(g)), at: Date.now() };
  day.items.push(it);
  day.at = Date.now();
  remember(state, food, it.g);
  return it;
}
export function updateItem(state, key, id, patch) {
  const day = ensureDay(state, key), it = day.items.find(x => x.id === id);
  if (!it) return null;
  if (patch.g != null) it.g = Math.max(0, r1(patch.g));
  if (patch.meal) it.meal = patch.meal;
  day.at = Date.now();
  return it;
}
export function removeItem(state, key, id) {
  const day = ensureDay(state, key);
  day.items = day.items.filter(x => x.id !== id);
  day.at = Date.now();
  state.deleted ||= {};
  (state.deleted.food ||= []).push(id);
  if (state.deleted.food.length > 1000) state.deleted.food.splice(0, state.deleted.food.length - 1000);
}
export function setWater(state, key, n) {
  const day = ensureDay(state, key);
  day.water = Math.max(0, Math.min(20, Math.round(n)));
  day.at = Date.now();
}

// Hydratation : objectif du jour en verres de 250 ml (+ 0,5 L un jour d'entraînement)
export const waterGoal = (t, trained = false) => Math.round(((t?.water || 2000) + (trained ? 500 : 0)) / 250);
// Rappels d'eau : entre « from » et « to », on attend un rythme régulier ; null si l'on est dans les temps
export function waterBehind(n, goal, now = new Date(), { from = "09:00", to = "21:00" } = {}) {
  const mins = s => { const [h, m] = String(s).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const cur = now.getHours() * 60 + now.getMinutes(), a = mins(from), b = mins(to);
  if (b <= a || cur < a || cur > b || n >= goal) return null;
  const expected = Math.floor((goal * (cur - a)) / (b - a));
  return n < expected ? { n, goal, expected } : null;
}

// Aliments récents (ajout rapide), du plus récent au plus ancien
export function remember(state, food, g) {
  const t = { ...template(food), lastG: r1(g), used: Date.now() }, k = foodKey(t);
  state.foodRecent = [t, ...(state.foodRecent || []).filter(x => foodKey(x) !== k)].slice(0, 40);
}

// Copie un repas d'un jour vers un autre (nouvelles entrées)
export function copyMeal(state, fromKey, toKey, meal) {
  const src = dayOf(state, fromKey).items.filter(x => x.meal === meal);
  return src.map(x => addItem(state, toKey, x, { g: x.g, meal }));
}

// Les jours de plus de `keep` jours ne gardent que leurs totaux (le journal reste léger à synchroniser).
export function pruneFood(state, now = new Date(), keep = 120) {
  const limit = shiftKey(dayKey(now), -keep);
  for (const [k, day] of Object.entries(state.food || {})) {
    if (k < limit && day.items?.length) {
      const s = sumItems(day.items);
      state.food[k] = { sum: Object.fromEntries(Object.entries(s).map(([x, v]) => [x, r1(v)])), water: day.water || 0, at: day.at || 0 };
    }
  }
}

// Les `n` derniers jours (le plus ancien d'abord)
export function lastDays(state, n = 7, now = new Date()) {
  const today = dayKey(now);
  return Array.from({ length: n }, (_, i) => {
    const key = shiftKey(today, i - n + 1), day = state.food?.[key];
    const logged = !!(day?.sum || day?.items?.length);
    return { key, date: keyDate(key), t: dayTotals(day), water: day?.water || 0, logged };
  });
}

// Bilan sur 7 jours (jours renseignés seulement)
export function weekNutrition(state, t, now = new Date()) {
  const days = lastDays(state, 7, now).filter(d => d.logged && d.key !== dayKey(now)); // aujourd'hui n'est pas fini
  if (!days.length) return null;
  const avg = x => days.reduce((s, d) => s + d.t[x], 0) / days.length;
  const inRange = days.filter(d => Math.abs(d.t.k - t.kcal) <= t.kcal * 0.1).length;
  const protOk = days.filter(d => d.t.p >= t.p * 0.9).length;
  return { n: days.length, k: Math.round(avg("k")), p: Math.round(avg("p")), c: Math.round(avg("c")), f: Math.round(avg("f")), inRange, protOk };
}

// Pour le coach : la nutrition en quelques lignes (vide si rien n'est noté)
export function nutritionContext(state, now = new Date()) {
  const t = targets(state.profile), today = sumItems(dayOf(state, dayKey(now)).items), w = weekNutrition(state, t, now);
  if (!today.k && !w) return "";
  const lines = [`Objectifs nutrition : ${t.kcal} kcal, ${t.p} g de protéines, ${t.c} g de glucides, ${t.f} g de lipides par jour.`];
  if (today.k) lines.push(`Mangé aujourd'hui (jusqu'ici) : ${Math.round(today.k)} kcal, ${Math.round(today.p)} g de protéines, ${Math.round(today.c)} g de glucides, ${Math.round(today.f)} g de lipides.`);
  if (w) lines.push(`Moyenne des ${w.n} derniers jours renseignés : ${w.k} kcal et ${w.p} g de protéines par jour ; ${w.inRange} jour(s) dans l'objectif calorique, ${w.protOk} avec assez de protéines.`);
  return lines.join("\n");
}

/* ---------- Recherche dans les aliments connus ---------- */
// Tolère les fautes de frappe (« bananne », « poulé »), les pluriels et l'ordre des mots.
export function searchLocal(q, state = {}, limit = 12) {
  const n = norm(q);
  if (!n) return [];
  const qw = n.split(" ").filter(Boolean);
  const own = f => ({ ...f, keys: [norm(f.name), norm(`${f.name} ${f.brand || ""}`), ...(f.aka || [])] });
  const pool = [...Object.values(state.foodCustom || {}).map(own), ...(state.foodRecent || []).map(own), ...FOODS];
  const scored = [];
  for (const f of pool) {
    let best = 0;
    for (const key of f.keys) {
      if (key === n) best = Math.max(best, 100);
      else if (key.startsWith(n)) best = Math.max(best, 80 - key.length / 10);
      else if (key.includes(n)) best = Math.max(best, 60 - key.length / 10);
      else if (qw.every(w => key.includes(w))) best = Math.max(best, 40 - key.length / 10);
      else if (best < 30) { const z = fuzzy(qw, key); if (z) best = Math.max(best, z - key.length / 10); }
    }
    if (best) scored.push([best + (f.src === "db" ? 0 : 25), f]); // tes produits et tes récents d'abord
  }
  const seen = new Set();
  return scored.sort((a, b) => b[0] - a[0]).map(([, f]) => f).filter(f => { const k = foodKey(f); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit);
}
const sing = w => (w.length > 3 ? w.replace(/(s|x)$/, "") : w);
// Distance d'édition bornée (au-delà de max, on arrête de compter)
function editDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      low = Math.min(low, cur[j]);
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
// Chaque mot cherché retrouve un mot du nom (pluriel, début de mot, ou une ou deux fautes) → score, sinon 0
function fuzzy(qw, key) {
  const kw = key.split(" ");
  let exact = 0;
  for (const w of qw) {
    if (w.length < 3) { if (!kw.includes(w)) return 0; exact++; continue; }
    const s = sing(w), max = w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
    let hit = false;
    for (const k of kw) {
      if (sing(k) === s || k.startsWith(w)) { hit = true; exact++; break; }
      if (max && (editDist(s, sing(k), max) <= max || (w.length >= 5 && k.length > w.length && editDist(w, k.slice(0, w.length), 1) <= 1))) { hit = true; break; }
    }
    if (!hit) return 0;
  }
  return 30 + exact;
}

/* ---------- Aliments estimés par l'IA (cherchés par leur nom) ---------- */
// Réponse de l'IA (valeurs pour 100 g, portion habituelle) → modèle d'aliment
export function aiInfoFood(x = {}) {
  const per = { k: +x.kcal || 0, p: +x.protein || 0, c: +x.carbs || 0, f: +x.fat || 0 };
  if (x.fiber > 0) per.fi = +x.fiber;
  if (x.sugars > 0) per.su = +x.sugars;
  if (x.salt > 0) per.sa = +x.salt;
  return { name: clip(x.name, 80) || "Aliment", ...(x.brand ? { brand: clip(x.brand, 40) } : {}), per, src: "ai",
    unit: x.portion_grams > 0 ? { label: clip(x.portion_label, 30) || "portion", g: r1(x.portion_grams) } : null, ...(x.liquid ? { liquid: true } : {}) };
}
// L'app retient un aliment trouvé par l'IA : il est reconnu ensuite, même hors ligne, aussi sous le nom cherché
export function learnFood(state, food, query = "") {
  state.foodCustom ||= {};
  const id = `ai:${norm(food.name)}`, prev = state.foodCustom[id];
  const aka = [...new Set([...(prev?.aka || []), norm(query)])].filter(k => k && k !== norm(food.name)).slice(-5);
  state.foodCustom[id] = { ...template({ ...food, src: "ai" }), ...(aka.length ? { aka } : {}), used: Date.now() };
  const ai = Object.keys(state.foodCustom).filter(k => k.startsWith("ai:"));
  if (ai.length > 200) ai.sort((a, b) => (state.foodCustom[a].used || 0) - (state.foodCustom[b].used || 0)).slice(0, ai.length - 200).forEach(k => delete state.foodCustom[k]);
  return state.foodCustom[id];
}

/* ---------- Lecture d'un repas écrit (« 200 g de poulet, du riz et 2 œufs ») ---------- */
const NUMS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, demi: 0.5, demie: 0.5, moitie: 0.5, quelques: 3 };
const UNITS = [
  [/^(kg|kilos?)$/, () => 1000], [/^(g|gr|grammes?)$/, () => 1], [/^(l|litres?)$/, () => 1000], [/^dl$/, () => 100], [/^cl$/, () => 10], [/^ml$/, () => 1],
  [/^tranches?$/, f => (f.unit.label === "tranche" ? f.unit.g : 30)],
  [/^bols?$/, f => (f.unit.label === "bol" ? f.unit.g : 250)],
  [/^verres?$/, f => (f.unit.label === "verre" ? f.unit.g : 200)],
  [/^(tasses?|mugs?)$/, f => (f.unit.label === "tasse" ? f.unit.g : 200)],
  [/^(cas|cs|cuilleres? a soupe|c a s)$/, f => (/cuill/.test(f.unit.label) ? f.unit.g : 15)],
  [/^(cac|cc|cuilleres? a cafe|c a c)$/, () => 5],
  [/^cuilleres?$/, f => (/cuill/.test(f.unit.label) ? f.unit.g : 15)],
  [/^poignees?$/, f => (f.unit.label === "poignée" ? f.unit.g : 30)],
  [/^(canettes?|cannettes?)$/, () => 330], [/^bouteilles?$/, () => 500], [/^carres?$/, () => 10], [/^boules?$/, () => 50],
  [/^(pots?|portions?|parts?|assiettes?|doses?|scoops?|barres?|pieces?|morceaux?|filets?|paves?|boites?|sachets?)$/, f => f.unit.g],
];
const singular = s => s.split(" ").map(w => (w.length > 3 ? w.replace(/(s|x)$/, "") : w)).join(" ");
// Mots seuls, sans articles élidés (« d'huile » → « huile ») ni unités (« cuillère à soupe » n'est pas une soupe)
const words = s => norm(s).replace(/\b(d|l|j|qu)'/g, " ").replace(/cuill?eres? a (soupe|cafe)/g, " ").replace(/[^a-z0-9% ]/g, " ").replace(/\s+/g, " ").trim();
const KEYS = FOODS.map(f => [f, f.keys.map(k => { const w = words(k); return [w, singular(w)]; })]);

export function matchFood(text) {
  const t = ` ${words(text)} `, ts = ` ${singular(t.trim())} `;
  let best = null, len = 0;
  for (const [f, keys] of KEYS) for (const [k, ks] of keys) {
    if (k.length > len && (t.includes(` ${k} `) || ts.includes(` ${ks} `))) { best = f; len = k.length; }
  }
  return best;
}

export function parseMeal(text) {
  const chunks = norm(text)
    .replace(/(\d),(\d)/g, "$1.$2")                                  // « 1,5 kg » n'est pas une liste
    .replace(/\b(?:une?|la)?\s*(?:demie?|moitie)(?: de)?\b/g, " 0.5 ").replace(/\b(?:un )?quart(?: de)?\b/g, " 0.25 ")
    .split(/,|;|\+|\n|\bet\b|\bavec\b|\bpuis\b/).map(s => s.trim()).filter(Boolean);
  const items = [], unknown = [];
  for (const raw of chunks) {
    const food = matchFood(raw);
    if (!food) { if (/[a-z]{3}/.test(raw)) unknown.push(raw); continue; }
    let qty = null, grams = null;
    const m = raw.match(/(\d+(?:[.,]\d+)?)\s*([a-z][a-z ]*)?/);
    const word = raw.match(new RegExp(`\\b(${Object.keys(NUMS).join("|")})\\b\\s*([a-z][a-z ]*)?`));
    const found = m ? [parseFloat(m[1].replace(",", ".")), m[2] || ""] : word ? [NUMS[word[1]], word[2] || ""] : null;
    if (found) {
      qty = found[0];
      const after = found[1].trim();
      for (const [re, g] of UNITS) {
        const unit = after.split(" ").slice(0, 4).join(" ");
        // l'unité peut faire plusieurs mots (« cuillères à soupe »)
        const hit = [4, 3, 2, 1].map(n => unit.split(" ").slice(0, n).join(" ")).find(u => re.test(u));
        if (hit) { grams = qty * g(food); break; }
      }
      grams ??= qty * food.unit.g; // « 2 œufs », « 3 bananes »
    }
    grams ??= food.unit.g; // pas de quantité : une portion
    items.push({ food, g: r1(grams) });
  }
  return { items, unknown };
}

// Aliment de la base portant exactement ce nom (ou un de ses autres noms, au pluriel près) : sert à fiabiliser
// une estimation de l'IA avec des valeurs de référence
export function refFood(name) {
  const n = singular(words(name));
  if (!n) return null;
  for (const [f, keys] of KEYS) if (keys.some(([k, ks]) => k === n || ks === n)) return f;
  return null;
}

// « Combien de calories dans une banane ? » : les valeurs d'un aliment connu (null si ce n'est pas la question)
const ASK = /\b(calories?|kcal|proteines?|glucides?|lipides?|macros?|valeurs? nutritionnelles?|apports?)\b/;
const FILLER = /\b(combien|y a t il|ya t il|il y a|est ce que|quelles?|quels?|sont|est|les|le|la|l|un|une|des|du|de|d|dans|pour|par|en|a|t|il|y|ce|que|qu|apporte|apportent|contient|contiennent|calories?|kcal|proteines?|glucides?|lipides?|macros?|valeurs?|nutritionnelles?|apports?|portion|grammes?|g|100|c|quoi|moyenne)\b/g;
export function foodFacts(q, state = {}) {
  const t = norm(q);
  if (!ASK.test(t) || /\b(mal|douleur|blesse)/.test(t)) return null;
  const rest = words(t).replace(FILLER, " ").replace(/\s+/g, " ").trim();
  if (rest.length < 3) return null;
  // mots entiers seulement (pas de rapprochement approximatif dans une phrase) : la base, puis tes aliments à toi
  const own = Object.values(state.foodCustom || {}).find(f => [norm(f.name), ...(f.aka || [])].some(k => k && ` ${rest} `.includes(` ${words(k)} `)));
  const f = matchFood(rest) || own;
  if (!f) return null;
  const nb = v => String(r1(v)).replace(".", ","), u = /verre|canette|tasse|demi|bouteille|coupe/.test(f.unit?.label || "") || f.liquid ? "ml" : "g";
  const lines = [`**${f.name}**${f.brand ? ` (${f.brand})` : ""} : ${Math.round(f.per.k)} kcal pour 100 ${u}, protéines ${nb(f.per.p || 0)} g, glucides ${nb(f.per.c || 0)} g, lipides ${nb(f.per.f || 0)} g${f.per.fi ? `, fibres ${nb(f.per.fi)} g` : ""}.`];
  const qty = parseMeal(rest).items.find(x => x.food === f); // « 2 œufs », « 200 g de riz »
  if (qty && Math.abs(qty.g - (f.unit?.g || 0)) > 0.5) lines.push(`• Pour ${nb(qty.g)} ${u} : ${Math.round((f.per.k * qty.g) / 100)} kcal et ${nb(((f.per.p || 0) * qty.g) / 100)} g de protéines.`);
  if (f.unit?.g) { const m = f.unit.g / 100; lines.push(`• 1 ${f.unit.label} (${nb(f.unit.g)} ${u}) ≈ ${Math.round(f.per.k * m)} kcal et ${nb((f.per.p || 0) * m)} g de protéines.`); }
  lines.push("Ajoute-le dans l'onglet Repas pour qu'il compte dans ta journée.");
  return lines.join("\n");
}

/* ---------- Open Food Facts ---------- */
const num = v => (v === "" || v == null || !isFinite(+v) ? null : +v);
export function offFood(p, code) {
  const n = p?.nutriments || {};
  let k = num(n["energy-kcal_100g"]);
  if (k == null && num(n.energy_100g) != null) k = num(n.energy_100g) / 4.184;
  const name = clip(p?.product_name_fr || p?.product_name || p?.generic_name_fr || p?.generic_name, 80);
  if (k == null || !name) return null;
  const brands = Array.isArray(p.brands) ? p.brands : String(p.brands || "").split(",");
  const sq = num(p.serving_quantity);
  return {
    name, brand: clip(brands.map(s => String(s).trim()).find(Boolean), 40), src: "off", code: String(code || p.code || ""),
    per: { k, p: num(n.proteins_100g) ?? 0, c: num(n.carbohydrates_100g) ?? 0, f: num(n.fat_100g) ?? 0, fi: num(n.fiber_100g), su: num(n.sugars_100g), sa: num(n.salt_100g) },
    unit: sq > 0 && sq < 3000 ? { label: p.serving_size ? `portion (${clip(p.serving_size, 24)})` : "portion", g: sq } : null,
    nutri: /^[a-e]$/.test(p.nutriscore_grade || "") ? p.nutriscore_grade : null,
    img: /^https:\/\//.test(p.image_front_small_url || "") ? p.image_front_small_url : null,
  };
}

// Code-barres EAN-8 / EAN-13 / UPC-A valide (clé de contrôle) ; renvoie la forme à 8 ou 13 chiffres.
export function cleanBarcode(raw) {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.length === 12) s = "0" + s; // UPC-A → EAN-13
  if (s.length !== 8 && s.length !== 13) return null;
  const digits = [...s].map(Number), check = digits.pop();
  const sum = digits.reverse().reduce((t, d, i) => t + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? s : null;
}

/* ---------- Synchronisation entre appareils ---------- */
export function mergeFood(older = {}, newer = {}, deletedIds = []) {
  const gone = new Set(deletedIds), out = {};
  for (const k of new Set([...Object.keys(older || {}), ...Object.keys(newer || {})])) {
    const a = older?.[k], b = newer?.[k];
    if (!a || !b) { const d = a || b; out[k] = d.items ? { ...d, items: d.items.filter(x => !gone.has(x.id)) } : d; continue; }
    const [lo, hi] = (a.at || 0) > (b.at || 0) ? [b, a] : [a, b];
    if (!a.items || !b.items) { out[k] = hi.items ? hi : lo.items ? lo : hi; continue; }
    const items = new Map(lo.items.map(x => [x.id, x]));
    for (const x of hi.items) items.set(x.id, x);
    out[k] = { items: [...items.values()].filter(x => !gone.has(x.id)).sort((x, y) => (x.at || 0) - (y.at || 0)), water: hi.water || 0, at: Math.max(a.at || 0, b.at || 0) };
  }
  return out;
}
