// Mes repas : tes propres repas, composés aliment par aliment (quantités, nombre de portions, préparation), gardés
// depuis le plan de repas ou depuis ton journal. Ajoutés en un geste, une portion à la fois. Stockés avec les repas
// enregistrés (state.foodMeals : { id, name, items, prep, time, servings }).
import { state, save } from "./store.js";
import { MEALS, addItem, dayKey, searchLocal, sumItems, itemTotals, newId } from "./nutrition.js";
import { cleanSteps } from "./recipes.js";
import { $, $$, esc, I, sheet, toast, fmtNum, confirmSheet } from "./ui.js";

const MAX = 40;
const portion = m => Math.max(1, Math.min(12, Math.round(+m.servings || 1)));
// un aliment de la base ou de tes récents → ingrédient d'un repas
const ingredient = (f, g) => ({ name: f.name, ...(f.brand ? { brand: f.brand } : {}), per: f.per, ...(f.unit ? { unit: f.unit } : {}), src: f.src || "db", g });
// le repas qu'on prend à cette heure-ci
const mealNow = (h = new Date().getHours()) => (h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snack" : "dinner");
const mealName = id => MEALS.find(m => m.id === id)?.name || "Repas";
let onChange = () => {};
export const onMyMealsChange = fn => { onChange = fn || (() => {}); };

// Garder un repas (plan de repas, journal) dans « Mes repas »
export function keepMeal({ name, items, prep = [], time = 0, servings = 1 }) {
  const nm = String(name || "Mon repas").slice(0, 60);
  // même nom : on remplace ce repas en gardant son identifiant (la synchro ne le dédouble pas)
  const old = (state.foodMeals || []).find(x => x.name === nm);
  const m = { id: old?.id || newId(), name: nm, items: items.map(x => ingredient(x, x.g)), prep: cleanSteps(prep), time: +time || 0, servings: portion({ servings }) };
  state.foodMeals = [m, ...(state.foodMeals || []).filter(x => x.name !== m.name)].slice(0, MAX);
  save(); onChange();
  return m;
}

// Ajouter une portion d'un repas au journal du jour
export function addMealToDay(m, meal = mealNow(), key = dayKey()) {
  const k = 1 / portion(m);
  m.items.forEach(x => addItem(state, key, x, { g: Math.round(x.g * k), meal }));
  save(); onChange();
  return Math.round(sumItems(m.items).k * k);
}

/* ---------- La liste ---------- */
export function openMyMeals() {
  const sh = sheet(`<div class="mm-sheet"><h2 class="h2">Mes repas</h2>
    <p class="muted small">Tes repas à toi : compose-les une fois (aliments, quantités, préparation), ajoute-les ensuite en un geste.</p>
    <button class="btn btn-primary btn-block mt" id="mm-new">${I.plus} Créer un repas</button>
    <div id="mm-list" class="mt"></div></div>`, { z: 90 });
  const draw = () => {
    const list = state.foodMeals || [];
    $("#mm-list", sh.el).innerHTML = list.length ? list.map(m => {
      const n = portion(m), k = sumItems(m.items).k / n;
      return `<div class="card mm-row"><div class="grow"><b class="ellipsis">${esc(m.name)}</b>
        <span class="xs muted"><span class="tnum">${fmtNum(k)}</span> kcal${n > 1 ? ` <span>par portion</span> · <span class="tnum">${n}</span> <span>portions</span>` : ""}${m.prep?.length ? ` · <span>recette</span>` : ""}</span></div>
        <button class="btn btn-soft btn-sm" data-mm-add="${m.id}">${I.plus} Ajouter</button>
        <button class="icon-btn sm" data-mm-open="${m.id}" aria-label="Voir et modifier">${I.chev}</button></div>`;
    }).join("") : `<p class="muted small">Aucun repas pour l'instant. Crée le tien, ou garde un repas de ton plan de repas.</p>`;
    $$("[data-mm-add]", sh.el).forEach(b => b.onclick = () => {
      const m = (state.foodMeals || []).find(x => x.id === b.dataset.mmAdd);
      if (!m) return;
      const meal = mealNow(), k = addMealToDay(m, meal);
      toast(`« ${m.name} » ajouté à ton ${mealName(meal).toLowerCase()} · ${fmtNum(k)} kcal`);
    });
    $$("[data-mm-open]", sh.el).forEach(b => b.onclick = () => openMeal((state.foodMeals || []).find(x => x.id === b.dataset.mmOpen), draw));
  };
  $("#mm-new", sh.el).onclick = () => openEditor(null, draw);
  draw();
  return sh;
}

/* ---------- Un repas : sa recette, l'ajouter, le modifier ---------- */
function openMeal(m, redraw) {
  if (!m) return;
  const n = portion(m), tot = sumItems(m.items);
  const sh = sheet(`<div class="mm-sheet"><h2 class="h2">${esc(m.name)}</h2>
    <p class="muted small"><span class="tnum">${fmtNum(tot.k / n)}</span> kcal · P <span class="tnum">${Math.round(tot.p / n)}</span> g${n > 1 ? ` · <span>par portion</span> (<span class="tnum">${n}</span> <span>portions</span>)` : ""}</p>
    <div class="eyebrow mt">Ingrédients</div>
    <ul class="pl-items">${m.items.map(x => `<li><span class="grow">${esc(x.name)}</span><span class="tnum muted">${fmtNum(x.g)} g</span></li>`).join("")}</ul>
    ${m.prep?.length ? `<div class="eyebrow mt">Préparation${m.time ? ` · <span class="tnum">${m.time}</span> min` : ""}</div><ol class="mm-steps" translate="no">${m.prep.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    <div class="eyebrow mt">Ajouter une portion à</div>
    <div class="chips" id="mo-meal">${MEALS.map(x => `<button class="chip ${x.id === mealNow() ? "on" : ""}" data-m="${x.id}">${esc(x.name)}</button>`).join("")}</div>
    <button class="btn btn-primary btn-block mt" id="mo-add">${I.plus} Ajouter au journal</button>
    <div class="grid2 mt-s"><button class="btn btn-soft" id="mo-edit">Modifier</button><button class="btn btn-ghost danger" id="mo-del">${I.x} Supprimer</button></div></div>`, { z: 95 });
  let meal = mealNow();
  $$("#mo-meal .chip", sh.el).forEach(b => b.onclick = () => { meal = b.dataset.m; $$("#mo-meal .chip", sh.el).forEach(c => c.classList.toggle("on", c === b)); });
  $("#mo-add", sh.el).onclick = () => { const k = addMealToDay(m, meal); sh.close(); toast(`« ${m.name} » ajouté à ton ${mealName(meal).toLowerCase()} · ${fmtNum(k)} kcal`); };
  $("#mo-edit", sh.el).onclick = () => { sh.close(); openEditor(m, redraw); };
  $("#mo-del", sh.el).onclick = async () => {
    if (!(await confirmSheet("Supprimer ce repas ?", "Les repas déjà notés dans ton journal ne changent pas.", "Supprimer", true))) return;
    state.foodMeals = (state.foodMeals || []).filter(x => x.id !== m.id);
    (state.deleted ||= {}); (state.deleted.food ||= []).push(m.id); // la synchro ne le fera pas revenir
    save(); onChange(); sh.close(); redraw?.();
  };
}

/* ---------- Créer ou modifier un repas ---------- */
export function openEditor(m = null, redraw) {
  const draft = m ? { ...m, items: m.items.map(x => ({ ...x })), prep: [...(m.prep || [])] } : { name: "", items: [], prep: [], time: 0, servings: 1 };
  const sh = sheet(`<div class="mm-sheet"><h2 class="h2">${m ? "Modifier le repas" : "Créer un repas"}</h2>
    <label class="field"><span>Nom</span><input class="input" id="me-name" maxlength="60" placeholder="Ex. : Mon bowl poulet-riz" value="${esc(draft.name)}"/></label>
    <div class="eyebrow mt">Ingrédients</div>
    <div id="me-items"></div>
    <label class="field mt-s"><span>Ajouter un ingrédient</span><input class="input" id="me-q" placeholder="Cherche : riz, poulet, avocat…" autocomplete="off" enterkeyhint="search"/></label>
    <div id="me-res"></div>
    <div class="me-tot card mt-s" id="me-tot"></div>
    <div class="grid2 mt">
      <label class="field"><span>Portions</span><input class="input" id="me-serv" type="number" inputmode="numeric" min="1" max="12" value="${portion(draft)}"/></label>
      <label class="field"><span>Temps <i class="dim">(min)</i></span><input class="input" id="me-time" type="number" inputmode="numeric" min="0" max="240" value="${draft.time || ""}" placeholder="facultatif"/></label></div>
    <label class="field mt-s"><span>Préparation <i class="dim">(une étape par ligne, facultatif)</i></span>
      <textarea class="input" id="me-prep" rows="4" maxlength="1200" placeholder="Fais cuire le riz 12 min.&#10;Fais dorer le poulet 8 min.&#10;Assemble et assaisonne.">${esc(draft.prep.join("\n"))}</textarea></label>
    <button class="btn btn-primary btn-block mt" id="me-ok">${I.check} Enregistrer le repas</button></div>`, { z: 96 });
  const drawItems = () => {
    $("#me-items", sh.el).innerHTML = draft.items.length ? draft.items.map((x, i) => `<div class="me-item"><span class="grow ellipsis">${esc(x.name)}</span>
      <input class="input me-g" type="number" inputmode="decimal" min="1" max="2000" value="${x.g}" data-g="${i}" aria-label="Grammes"/><span class="xs muted">g</span>
      <span class="tnum xs muted me-k">${fmtNum(itemTotals(x).k)} kcal</span><button class="icon-btn sm" data-rm="${i}" aria-label="Retirer">${I.x}</button></div>`).join("")
      : `<p class="muted small">Ajoute au moins un aliment.</p>`;
    $$("[data-g]", sh.el).forEach(inp => inp.oninput = () => { const v = parseFloat(String(inp.value).replace(",", ".")); if (v > 0) { draft.items[+inp.dataset.g].g = Math.round(v); drawTot(); } });
    $$("[data-rm]", sh.el).forEach(b => b.onclick = () => { draft.items.splice(+b.dataset.rm, 1); drawItems(); });
    drawTot();
  };
  const drawTot = () => {
    const n = Math.max(1, +$("#me-serv", sh.el).value || 1), t = sumItems(draft.items);
    $("#me-tot", sh.el).innerHTML = draft.items.length ? `<b class="tnum">${fmtNum(t.k)}</b> <span>kcal au total</span>${n > 1 ? ` · <b class="tnum">${fmtNum(t.k / n)}</b> <span>par portion</span>` : ""}
      <span class="xs muted">P <span class="tnum">${Math.round(t.p / n)}</span> g · G <span class="tnum">${Math.round(t.c / n)}</span> g · L <span class="tnum">${Math.round(t.f / n)}</span> g</span>` : "";
  };
  const q = $("#me-q", sh.el), res = $("#me-res", sh.el);
  q.oninput = () => {
    const found = searchLocal(q.value, state, 8);
    res.innerHTML = found.map((f, i) => `<button class="food-row" data-f="${i}"><span class="grow fr-txt"><span class="fr-name ellipsis">${esc(f.name)}</span>
      <span class="fr-sub">${fmtNum(f.per.k)} kcal / 100 g</span></span><span class="food-add">${I.plus}</span></button>`).join("");
    $$("[data-f]", res).forEach(b => b.onclick = () => {
      const f = found[+b.dataset.f];
      draft.items.push(ingredient(f, f.unit?.g || 100));
      q.value = ""; res.innerHTML = ""; drawItems();
    });
  };
  $("#me-serv", sh.el).oninput = drawTot;
  $("#me-ok", sh.el).onclick = () => {
    const name = $("#me-name", sh.el).value.trim();
    if (!name) { $("#me-name", sh.el).focus(); return toast("Donne un nom à ton repas"); }
    if (!draft.items.length) { q.focus(); return toast("Ajoute au moins un aliment"); }
    const out = { id: m?.id || newId(), name: name.slice(0, 60), items: draft.items, prep: cleanSteps($("#me-prep", sh.el).value),
      time: Math.min(240, Math.max(0, Math.round(+$("#me-time", sh.el).value || 0))), servings: portion({ servings: $("#me-serv", sh.el).value }) };
    const list = (state.foodMeals || []).filter(x => x.id !== out.id);
    state.foodMeals = [out, ...list].slice(0, MAX);
    save(); onChange(); sh.close(); redraw?.();
    toast(m ? "Repas modifié ✓" : `« ${out.name} » enregistré dans tes repas ✓`);
  };
  drawItems();
  // nouveau repas : le curseur sur le nom, sauf si on a déjà commencé à remplir autre chose
  setTimeout(() => { if (!m && !sh.el.querySelector("input:focus, textarea:focus")) $("#me-name", sh.el)?.focus({ preventScroll: true }); }, 300);
  return sh;
}

/* ---------- La carte de l'onglet Repas ---------- */
export function myMealsCard() {
  const n = (state.foodMeals || []).length;
  return `<section class="card plan-card tap mm-card" id="mm-open" role="button" tabindex="0">
    <span class="plan-ic">${I.plus}</span>
    <div class="grow"><b>Mes repas</b><div class="small muted">${n ? `<span class="tnum">${n}</span> <span>${n > 1 ? "repas enregistrés" : "repas enregistré"}</span> · <span>créer, préparer, ajouter en un geste</span>` : "Crée tes propres repas : aliments, quantités, préparation"}</div></div>
    <span class="chev">${I.chev}</span></section>`;
}
export function bindMyMealsCard(root, refresh) {
  onMyMealsChange(refresh);
  const el = $("#mm-open", root);
  if (!el) return;
  el.onclick = () => openMyMeals();
  el.onkeydown = e => { if (e.key === "Enter") openMyMeals(); };
}
