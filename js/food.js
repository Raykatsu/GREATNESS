// Onglet Repas : journal alimentaire façon MyFitnessPal. Calories et macros du jour face à l'objectif,
// repas, eau, recherche (aliments courants + Open Food Facts), scanner de code-barres, analyse d'un repas
// par l'IA (description ou photo), repas enregistrés, historique sur 7 jours.
import { state, save } from "./store.js";
import { GOALS } from "./data.js";
import {
  MEALS, ACTIVITY, targets, dayKey, keyDate, shiftKey, dayOf, itemTotals, sumItems, addItem, updateItem, removeItem,
  setWater, copyMeal, lastDays, weekNutrition, searchLocal, parseMeal, template, r1, newId,
} from "./nutrition.js";
import { lookupBarcode, searchOff } from "./off.js";
import { openScanner, askCode } from "./scan.js";
import { foodAI, OnlineError } from "./online.js";
import { isOnlineMode, authToken } from "./cloud.js";
import { $, $$, esc, I, sheet, toast, confirmSheet, fmtNum, ring, animateRings } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const IC = {
  barcode: svg('<path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12M3 4h3M18 4h3M3 20h3M18 20h3" stroke-width="1.8"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>'),
  glass: svg('<path d="M6 4h12l-1.5 16h-9z"/><path class="w" d="M7 11h10l-.9 9H7.9z" fill="currentColor" stroke="none"/>'),
  apple: svg('<path d="M12 7c-1-2-4-2.5-5.5-.5S5 12 7 16s4 4.5 5 3.5c1 1 3 .5 5-3.5s1.5-7.5 0-9.5S13 5 12 7z"/><path d="M12 7c0-2 1-3.5 3-4"/>'),
  save: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
};

let viewKey = null, host = null;
const mealName = id => MEALS.find(m => m.id === id)?.name || "Repas";
const liquid = f => /verre|canette|tasse|demi|bouteille/.test(f.unit?.label || "") || /\b(lait|jus|soda|cafe|café|the|thé|biere|bière|vin|boisson|smoothie|eau)\b/i.test(f.name);
const unitWord = f => (liquid(f) ? "ml" : "g");
const nice = n => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));
const SRC = { db: "Aliment courant", off: "Open Food Facts", custom: "Ajouté par toi", ai: "Estimé par l'IA", text: "Estimé", manual: "Ajout rapide" };
const nutriBadge = n => (n ? `<span class="nutri nutri-${n}" title="Nutri-Score ${n.toUpperCase()}">${n.toUpperCase()}</span>` : "");

// « 2 œufs (110 g) », « 150 g »
function qtyLabel(it) {
  const u = it.unit, w = unitWord(it);
  if (u?.g) {
    const n = it.g / u.g, label = u.label.replace(/ \(.*\)$/, ""); // « portion (15 g) » → « portion »
    if (Math.abs(n * 2 - Math.round(n * 2)) < 0.02 && n <= 20) return `${n === 0.5 ? "½" : nice(n)} ${label}${n > 1 && !/s$/.test(label) ? "s" : ""} (${nice(it.g)} ${w})`;
  }
  return `${nice(it.g)} ${w}`;
}

/* ---------- Carte de l'accueil ---------- */
export function foodHomeCard() {
  const t = targets(state.profile), day = dayOf(state, dayKey()), tot = sumItems(day.items);
  const left = Math.round(t.kcal - tot.k);
  return `<div class="card tap nut-home mt" id="nut-home" role="link" tabindex="0">
    ${ring(Math.min(1, tot.k / t.kcal), IC.apple, 56)}
    <div class="grow"><div class="eyebrow">Nutrition du jour</div>
      <div class="h3"><span class="tnum">${fmtNum(tot.k)}</span><small class="muted"> / ${fmtNum(t.kcal)} kcal</small></div>
      <div class="xs muted">${tot.k ? (left >= 0 ? `Reste ${fmtNum(left)} kcal` : `${fmtNum(-left)} kcal au-dessus`) : "Rien de noté pour l'instant"} · Protéines ${Math.round(tot.p)}/${t.p} g</div></div>
    <button class="icon-btn nut-scan" id="nut-scan" aria-label="Scanner un code-barres">${IC.barcode}</button>
  </div>`;
}
export function bindFoodCard(root) {
  const card = $("#nut-home", root);
  if (!card) return;
  card.onclick = e => { if (!e.target.closest("#nut-scan")) location.hash = "#/food"; };
  card.onkeydown = e => { if (e.key === "Enter") location.hash = "#/food"; };
  $("#nut-scan", root).onclick = () => scan(defaultMeal());
}

// Repas le plus probable selon l'heure
export function defaultMeal(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h >= 18 && h < 23 ? "dinner" : "snack";
}

/* ---------- Écran ---------- */
const macroBar = (name, v, goal, k) => `<div class="mb mb-${k}"><div class="mb-l"><span>${name}</span><span class="tnum"><b>${Math.round(v)}</b> / ${goal} g</span></div>
  <div class="bar"><i style="width:${Math.min(100, (v / Math.max(1, goal)) * 100)}%"></i></div></div>`;

export function renderFood(view) {
  host = view;
  const p = state.profile, t = targets(p), today = dayKey();
  if (!viewKey || viewKey > today) viewKey = today;
  const day = dayOf(state, viewKey), tot = sumItems(day.items), isToday = viewKey === today;
  const left = Math.round(t.kcal - tot.k);
  const label = isToday ? "Aujourd'hui" : viewKey === shiftKey(today, -1) ? "Hier"
    : keyDate(viewKey).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const incomplete = !p.height || !p.age || !p.sex;

  view.innerHTML = `
    <header class="page-head"><h1 class="h1">Nutrition</h1><button class="icon-btn" id="f-set" aria-label="Mes objectifs">${IC.target}</button></header>
    <div class="day-nav"><button class="icon-btn" id="d-prev" aria-label="Jour précédent">${I.back}</button>
      <b>${esc(label)}</b><button class="icon-btn" id="d-next" ${isToday ? "disabled" : ""} aria-label="Jour suivant">${I.chev}</button></div>
    ${incomplete ? `<button class="card banner b-blue nut-tip" id="f-tip"><div class="bi">${IC.target}</div><div class="grow"><b>Des objectifs sur mesure</b><div class="small muted">Indique ta taille, ton âge et ton activité : je calcule tes besoins exacts.</div></div>${I.chev}</button>` : ""}
    <section class="card nut-sum">
      ${ring(Math.min(1, tot.k / t.kcal), `<b class="tnum">${fmtNum(Math.abs(left))}</b><small>${left >= 0 ? "kcal restantes" : "kcal en trop"}</small>`, 116)}
      <div class="grow nut-macros">
        <div class="nut-kcal"><b class="tnum">${fmtNum(tot.k)}</b> / ${fmtNum(t.kcal)} kcal</div>
        ${macroBar("Protéines", tot.p, t.p, "p")}${macroBar("Glucides", tot.c, t.c, "c")}${macroBar("Lipides", tot.f, t.f, "f")}
        <div class="xs muted">Fibres ${Math.round(tot.fi)} / ${t.fi} g</div>
      </div>
    </section>
    <div class="nut-actions">
      <button class="card nut-act" data-act="scan">${IC.barcode}<span>Scanner</span></button>
      <button class="card nut-act" data-act="search">${I.search}<span>Chercher</span></button>
      <button class="card nut-act" data-act="photo">${I.camera}<span>Photo</span></button>
      <button class="card nut-act" data-act="text">${I.sparkle}<span>Décrire</span></button>
    </div>
    ${MEALS.map(m => mealCard(m, day)).join("")}
    ${waterCard(day, t)}
    ${historyCard(t)}`;

  $("#f-set").onclick = () => openTargets();
  $("#f-tip")?.addEventListener("click", () => openTargets());
  $("#d-prev").onclick = () => { viewKey = shiftKey(viewKey, -1); renderFood(view); };
  $("#d-next").onclick = () => { if (viewKey < today) { viewKey = shiftKey(viewKey, 1); renderFood(view); } };
  $$(".nut-act", view).forEach(b => b.onclick = () => openAdd(isToday ? defaultMeal() : "lunch", b.dataset.act));
  $$("[data-add]", view).forEach(b => b.onclick = () => openAdd(b.dataset.add));
  $$("[data-copy]", view).forEach(b => b.onclick = () => {
    const n = copyMeal(state, shiftKey(viewKey, -1), viewKey, b.dataset.copy).length;
    save(); renderFood(view); toast(`${n} aliment${n > 1 ? "s" : ""} copié${n > 1 ? "s" : ""} d'hier`);
  });
  $$("[data-savemeal]", view).forEach(b => b.onclick = () => saveMeal(b.dataset.savemeal));
  $$("[data-item]", view).forEach(b => b.onclick = () => {
    const it = dayOf(state, viewKey).items.find(x => x.id === b.dataset.item);
    if (it) openPortion(it, { item: it });
  });
  $$(".glass", view).forEach(b => b.onclick = () => {
    const i = +b.dataset.g, n = dayOf(state, viewKey).water || 0;
    setWater(state, viewKey, i < n ? i : i + 1); save(); renderFood(view);
    if (i >= n) navigator.vibrate?.(8);
  });
  $$(".nh-b", view).forEach(b => b.onclick = () => { viewKey = b.dataset.day; renderFood(view); window.scrollTo({ top: 0, behavior: "smooth" }); });
  animateRings(view);
}
const refresh = () => { if (host?.isConnected && location.hash.startsWith("#/food")) renderFood(host); };

function mealCard(m, day) {
  const items = day.items.filter(x => x.meal === m.id), tot = sumItems(items);
  const yesterday = dayOf(state, shiftKey(viewKey, -1)).items?.filter(x => x.meal === m.id) || [];
  return `<section class="card meal" data-meal="${m.id}">
    <div class="meal-head"><b>${m.name}</b>${items.length ? `<span class="tnum muted small">${fmtNum(tot.k)} kcal · P ${Math.round(tot.p)} g</span>` : ""}</div>
    ${items.map(it => `<button class="food-row" data-item="${it.id}"><span class="grow fr-txt"><span class="fr-name ellipsis">${esc(it.name)}</span>
      <span class="fr-sub ellipsis">${esc([it.brand, qtyLabel(it)].filter(Boolean).join(" · "))}</span></span><span class="fr-k tnum">${fmtNum(itemTotals(it).k)}</span></button>`).join("")}
    <div class="meal-foot"><button class="btn btn-ghost btn-sm" data-add="${m.id}">${I.plus} Ajouter</button>
      ${!items.length && yesterday.length ? `<button class="btn btn-ghost btn-sm" data-copy="${m.id}">${I.undo} Comme hier</button>` : ""}
      ${items.length > 1 ? `<button class="btn btn-ghost btn-sm" data-savemeal="${m.id}">${IC.save} Enregistrer</button>` : ""}</div>
  </section>`;
}

function waterCard(day, t) {
  const goal = Math.round(t.water / 250), n = day.water || 0;
  return `<section class="card meal water"><div class="meal-head"><b>Eau</b><span class="tnum muted small">${nice(n * 0.25)} L / ${nice(t.water / 1000)} L</span></div>
    <div class="glasses">${Array.from({ length: Math.max(goal, n + 1) }, (_, i) => `<button class="glass ${i < n ? "full" : ""}" data-g="${i}" aria-label="${i < n ? "Retirer" : "Ajouter"} un verre (${i + 1})">${IC.glass}</button>`).join("")}</div></section>`;
}

function historyCard(t) {
  const days = lastDays(state, 7, keyDate(dayKey()));
  const max = Math.max(t.kcal * 1.3, ...days.map(d => d.t.k));
  const w = weekNutrition(state, t);
  return `<div class="section"><h2>7 derniers jours</h2></div>
    <div class="card nut-hist">
      <div class="nh-chart"><i class="nh-goal" style="bottom:${(t.kcal / max) * 100}%"><span>${fmtNum(t.kcal)}</span></i>
        ${days.map(d => `<button class="nh-b ${d.key === viewKey ? "on" : ""} ${d.t.k > t.kcal * 1.1 ? "over" : ""}" data-day="${d.key}" aria-label="${d.date.toLocaleDateString("fr-FR", { weekday: "long" })} : ${fmtNum(d.t.k)} kcal"><i style="height:${d.logged ? Math.max(3, (d.t.k / max) * 100) : 0}%"></i></button>`).join("")}</div>
      <div class="nh-days">${days.map(d => `<span>${"DLMMJVS"[d.date.getDay()]}</span>`).join("")}</div>
      ${w ? `<div class="nh-stats"><div><b class="tnum">${fmtNum(w.k)}</b><small>kcal / jour</small></div><div><b class="tnum">${w.p} g</b><small>protéines / jour</small></div><div><b class="tnum">${w.inRange}/${w.n}</b><small>jours dans l'objectif</small></div></div>`
        : `<p class="small muted nh-empty">Note tes repas quelques jours : tes moyennes apparaîtront ici.</p>`}
    </div>`;
}

/* ---------- Ajouter un aliment ---------- */
export function openAdd(meal = defaultMeal(), mode = "search") {
  if (mode === "scan") return scan(meal);
  if (mode === "photo") return pickPhoto(meal);
  if (mode === "text") return describe(meal);
  let cur = meal, seq = 0, abort = null, timer = 0;
  const sh = sheet(`<h2 class="h2">Ajouter un aliment</h2>
    <div class="chips mt-s" id="a-meal">${MEALS.map(m => `<button class="chip ${m.id === cur ? "on" : ""}" data-m="${m.id}">${m.name}</button>`).join("")}</div>
    <label class="search-box mt">${I.search}<input id="a-q" type="search" placeholder="Poulet, riz, skyr, Nutella…" autocomplete="off" enterkeyhint="search" aria-label="Chercher un aliment"/></label>
    <div class="add-tools">
      <button class="btn btn-soft btn-sm" data-t="scan">${IC.barcode} Code-barres</button>
      <button class="btn btn-soft btn-sm" data-t="photo">${I.camera} Photo</button>
      <button class="btn btn-soft btn-sm" data-t="text">${I.sparkle} Décrire</button>
      <button class="btn btn-soft btn-sm" data-t="quick">${I.bolt} Rapide</button>
    </div>
    <div class="a-res" id="a-res"></div>`);
  const res = $("#a-res", sh.el), input = $("#a-q", sh.el);
  let shown = [];
  const row = (f, k) => `<button class="food-row" data-k="${k}"><span class="grow fr-txt"><span class="fr-name ellipsis">${esc(f.name)}</span>
    <span class="fr-sub ellipsis">${esc([f.brand, `${fmtNum(f.per.k)} kcal / 100 ${unitWord(f)}`, f.src === "db" ? "" : f.lastG ? `dernière fois ${nice(f.lastG)} ${unitWord(f)}` : ""].filter(Boolean).join(" · "))}</span></span>
    ${nutriBadge(f.nutri)}<span class="fr-add">${I.plus}</span></button>`;
  const bindRows = () => $$("[data-k]", res).forEach(b => b.onclick = () => openPortion(shown[+b.dataset.k], { meal: cur, then: () => input.focus({ preventScroll: true }) }));

  function home() {
    const recent = state.foodRecent || [], meals = state.foodMeals || [];
    shown = recent.slice(0, 15);
    res.innerHTML = (meals.length ? `<div class="a-sec">Mes repas enregistrés</div>${meals.map(m => `<div class="food-row saved-meal"><button class="grow fr-txt" data-sm="${m.id}"><span class="fr-name ellipsis">${esc(m.name)}</span>
        <span class="fr-sub ellipsis">${m.items.length} aliments · ${fmtNum(sumItems(m.items).k)} kcal</span></button><button class="icon-btn sm" data-smx="${m.id}" aria-label="Supprimer">${I.x}</button></div>`).join("")}` : "")
      + (shown.length ? `<div class="a-sec">Récents</div>${shown.map(row).join("")}` : `<div class="a-empty">${I.search}<b>Cherche un aliment</b><span>Aliments courants et produits de marque (Open Food Facts), ou scanne le code-barres.</span></div>`);
    bindRows();
    $$("[data-sm]", res).forEach(b => b.onclick = () => {
      const m = meals.find(x => x.id === b.dataset.sm);
      m.items.forEach(it => addItem(state, viewKey || dayKey(), it, { g: it.g, meal: cur }));
      save(); refresh(); toast(`« ${m.name} » ajouté`); sh.close();
    });
    $$("[data-smx]", res).forEach(b => b.onclick = async () => {
      if (!(await confirmSheet("Supprimer ce repas enregistré ?", "Les repas déjà notés ne changent pas.", "Supprimer", true))) return;
      state.foodMeals = meals.filter(x => x.id !== b.dataset.smx);
      (state.deleted ||= {}); (state.deleted.food ||= []).push(b.dataset.smx); // la synchro ne le fera pas revenir
      save(); home();
    });
  }

  function search(q) {
    const local = searchLocal(q, state);
    shown = [...local];
    const online = isOnlineMode() || navigator.onLine !== false;
    res.innerHTML = (local.length ? local.map(row).join("") : "") + (online && q.length >= 3 ? `<div class="a-sec" id="a-off">Produits de marque <i class="spinner"></i></div>` : local.length ? "" : `<div class="a-empty"><b>Rien trouvé</b><span>Essaie un autre mot, ou l'ajout rapide.</span></div>`);
    bindRows();
    clearTimeout(timer); abort?.abort();
    if (!online || q.length < 3) return;
    const my = ++seq;
    timer = setTimeout(async () => {
      abort = new AbortController();
      try {
        const list = (await searchOff(q, { signal: abort.signal })).filter(f => !local.some(l => l.code && l.code === f.code)).slice(0, 15);
        if (my !== seq) return;
        const at = shown.length;
        shown.push(...list);
        const sec = $("#a-off", res);
        if (sec) sec.outerHTML = list.length ? `<div class="a-sec">Produits de marque · Open Food Facts</div>${list.map((f, i) => row(f, at + i)).join("")}` : `<div class="a-sec">Aucun produit de marque trouvé</div>`;
        bindRows();
      } catch (e) {
        if (my === seq && e?.name !== "AbortError") { const sec = $("#a-off", res); if (sec) sec.textContent = "Produits de marque : pas de réponse (connexion ?)"; }
      }
    }, 450);
  }

  input.oninput = () => { const q = input.value.trim(); if (q) search(q); else { seq++; abort?.abort(); home(); } };
  $$("#a-meal .chip", sh.el).forEach(b => b.onclick = () => { cur = b.dataset.m; $$("#a-meal .chip", sh.el).forEach(c => c.classList.toggle("on", c === b)); });
  $$("[data-t]", sh.el).forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    if (t === "quick") return quickAdd(cur);
    sh.close();
    if (t === "scan") scan(cur); else if (t === "photo") pickPhoto(cur); else describe(cur, input.value.trim());
  });
  home();
  setTimeout(() => input.focus({ preventScroll: true }), 320);
}

/* ---------- Quantité ---------- */
export function openPortion(food, { meal = defaultMeal(), item = null, then } = {}) {
  const unit = food.unit?.g ? food.unit : null, w = unitWord(food);
  let g = item ? item.g : food.lastG || unit?.g || 100, cur = item ? item.meal : meal;
  const sh = sheet(`<div class="pf-head">${food.img ? `<img class="pf-img" src="${esc(food.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : ""}
      <div class="grow"><h2 class="h2">${esc(food.name)}</h2><div class="small muted">${esc(food.brand || SRC[food.src] || "")}</div></div>${nutriBadge(food.nutri)}</div>
    <div class="pf-qty"><button class="st-btn" data-d="-1" aria-label="Moins">${I.minus}</button>
      <label class="pf-in"><input id="pf-g" type="number" inputmode="decimal" min="0" step="any" value="${nice(g).replace(",", ".")}" aria-label="Quantité en ${w}"/><span>${w}</span></label>
      <button class="st-btn" data-d="1" aria-label="Plus">${I.plus}</button></div>
    <div class="chips mt-s pf-units">${unit ? [0.5, 1, 2, 3].map(x => `<button class="chip" data-gg="${unit.g * x}">${x === 0.5 ? "½" : x} ${esc(unit.label.replace(/ \(.*\)$/, ""))}${x > 1 && !/s$/.test(unit.label) ? "s" : ""}</button>`).join("") : ""}
      ${[50, 100, 150, 200, 250].map(x => `<button class="chip" data-gg="${x}">${x} ${w}</button>`).join("")}</div>
    <div class="pf-macros" id="pf-m"></div>
    <div class="chips mt" id="pf-meal">${MEALS.map(m => `<button class="chip ${m.id === cur ? "on" : ""}" data-m="${m.id}">${m.name}</button>`).join("")}</div>
    <div class="grid2 mt">${item ? `<button class="btn btn-soft" id="pf-del">${I.trash} Supprimer</button>` : `<button class="btn btn-soft" id="pf-no">Annuler</button>`}
      <button class="btn btn-primary" id="pf-ok">${I.check} ${item ? "Enregistrer" : "Ajouter"}</button></div>
    <p class="xs muted mt-s">Pour 100 ${w} : ${fmtNum(food.per.k)} kcal · protéines ${nice(food.per.p || 0)} g · glucides ${nice(food.per.c || 0)} g${food.per.su != null ? ` (dont sucres ${nice(food.per.su)} g)` : ""} · lipides ${nice(food.per.f || 0)} g${food.per.fi != null ? ` · fibres ${nice(food.per.fi)} g` : ""}${food.per.sa != null ? ` · sel ${nice(food.per.sa)} g` : ""}</p>`, { z: 90 });
  const input = $("#pf-g", sh.el);
  const upd = () => {
    const v = itemTotals({ ...food, g });
    $("#pf-m", sh.el).innerHTML = [["kcal", fmtNum(v.k)], ["Protéines", `${nice(r1(v.p))} g`], ["Glucides", `${nice(r1(v.c))} g`], ["Lipides", `${nice(r1(v.f))} g`]]
      .map(([l, x], i) => `<div class="pm ${i ? "" : "pm-k"}"><b class="tnum">${x}</b><small>${l}</small></div>`).join("");
  };
  const setG = v => { g = Math.max(0, Math.min(5000, r1(v))); input.value = String(g); upd(); };
  input.oninput = () => { g = Math.max(0, parseFloat(String(input.value).replace(",", ".")) || 0); upd(); };
  $$("[data-d]", sh.el).forEach(b => b.onclick = () => setG(g + +b.dataset.d * (unit && unit.g <= 60 ? unit.g : g >= 100 ? 25 : 10)));
  $$("[data-gg]", sh.el).forEach(b => b.onclick = () => setG(+b.dataset.gg));
  $$("#pf-meal .chip", sh.el).forEach(b => b.onclick = () => { cur = b.dataset.m; $$("#pf-meal .chip", sh.el).forEach(c => c.classList.toggle("on", c === b)); });
  $("#pf-no")?.addEventListener("click", () => sh.close());
  $("#pf-del")?.addEventListener("click", () => { removeItem(state, viewKey, item.id); save(); sh.close(); refresh(); toast("Aliment retiré"); });
  $("#pf-ok", sh.el).onclick = () => {
    if (!(g > 0)) { input.focus(); return; }
    const key = viewKey || dayKey();
    if (item) updateItem(state, key, item.id, { g, meal: cur });
    else addItem(state, key, food, { g, meal: cur });
    save(); sh.close(); refresh();
    toast(item ? "Modifié ✓" : `${food.name} ajouté · ${fmtNum(itemTotals({ ...food, g }).k)} kcal`);
    then?.();
  };
  upd();
  if (!item) setTimeout(() => input.select?.(), 350);
}

/* ---------- Code-barres ---------- */
function scan(meal) { openScanner({ onCode: code => findCode(code, meal) }); }

async function findCode(code, meal) {
  const mine = state.foodCustom?.[code];
  if (mine) return openPortion(mine, { meal });
  toast("Recherche du produit…", 8000);
  try {
    const f = await lookupBarcode(code);
    if (f) { toast(f.name, 1200); return openPortion(f, { meal }); }
    toast("Produit inconnu d'Open Food Facts", 2200);
    newProduct(code, meal);
  } catch {
    toast("Open Food Facts ne répond pas (connexion ?)", 3000);
    newProduct(code, meal);
  }
}

// Produit inconnu : on recopie l'étiquette une fois, il sera reconnu ensuite (même hors ligne).
function newProduct(code, meal) {
  const fields = [["k", "Calories", "kcal"], ["p", "Protéines", "g"], ["c", "Glucides", "g"], ["f", "Lipides", "g"], ["su", "dont sucres", "g"], ["fi", "Fibres", "g"]];
  const sh = sheet(`<h2 class="h2">Nouveau produit</h2><p class="muted small">Code ${esc(code)}. Recopie l'étiquette (valeurs pour 100 g) : il sera reconnu au prochain scan.</p>
    <label class="field"><span>Nom</span><input class="input" id="np-name" maxlength="80" placeholder="Ex : Skyr vanille"/></label>
    <label class="field"><span>Marque <i class="dim">(facultatif)</i></span><input class="input" id="np-brand" maxlength="40"/></label>
    <div class="grid2">${fields.map(([k, l, u]) => `<label class="field"><span>${l} <i class="dim">(${u})</i></span><input class="input" id="np-${k}" type="number" inputmode="decimal" step="any" min="0"/></label>`).join("")}</div>
    <label class="field"><span>Portion <i class="dim">(g, facultatif)</i></span><input class="input" id="np-unit" type="number" inputmode="decimal" step="any" min="0" placeholder="Ex : 150"/></label>
    <p class="xs" id="np-err" style="color:var(--red);min-height:1.2em"></p>
    <button class="btn btn-primary btn-block" id="np-ok">${I.check} Enregistrer le produit</button>`, { z: 90 });
  setTimeout(() => $("#np-name", sh.el).focus(), 300);
  $("#np-ok", sh.el).onclick = () => {
    const v = id => parseFloat(String($(id, sh.el).value).replace(",", "."));
    const name = $("#np-name", sh.el).value.trim(), k = v("#np-k");
    if (!name || !(k >= 0)) { $("#np-err", sh.el).textContent = "Il faut au moins le nom et les calories."; return; }
    const per = { k };
    for (const [x] of fields.slice(1)) { const n = v(`#np-${x}`); if (n >= 0) per[x] = n; }
    const u = v("#np-unit");
    const f = template({ name, brand: $("#np-brand", sh.el).value.trim(), per, unit: u > 0 ? { label: "portion", g: u } : null, src: "custom", code });
    (state.foodCustom ||= {})[code] = f;
    save(); sh.close();
    openPortion(f, { meal });
  };
}

/* ---------- Ajout rapide (juste les calories) ---------- */
function quickAdd(meal) {
  const sh = sheet(`<h2 class="h2">Ajout rapide</h2><p class="muted small">Quand tu connais juste les calories (restaurant, plat préparé…).</p>
    <label class="field"><span>Nom <i class="dim">(facultatif)</i></span><input class="input" id="q-name" maxlength="60" placeholder="Ex : Resto midi"/></label>
    <div class="grid2"><label class="field"><span>Calories</span><input class="input" id="q-k" type="number" inputmode="decimal" min="0"/></label>
      <label class="field"><span>Protéines <i class="dim">(g)</i></span><input class="input" id="q-p" type="number" inputmode="decimal" min="0"/></label>
      <label class="field"><span>Glucides <i class="dim">(g)</i></span><input class="input" id="q-c" type="number" inputmode="decimal" min="0"/></label>
      <label class="field"><span>Lipides <i class="dim">(g)</i></span><input class="input" id="q-f" type="number" inputmode="decimal" min="0"/></label></div>
    <button class="btn btn-primary btn-block mt" id="q-ok">${I.check} Ajouter</button>`, { z: 90 });
  setTimeout(() => $("#q-k", sh.el).focus(), 300);
  $("#q-ok", sh.el).onclick = () => {
    const v = id => Math.max(0, parseFloat(String($(id, sh.el).value).replace(",", ".")) || 0);
    if (!v("#q-k") && !v("#q-p")) { $("#q-k", sh.el).focus(); return; }
    addItem(state, viewKey || dayKey(), { name: $("#q-name", sh.el).value.trim() || "Ajout rapide", per: { k: v("#q-k"), p: v("#q-p"), c: v("#q-c"), f: v("#q-f") }, unit: { label: "portion", g: 100 }, src: "manual" }, { g: 100, meal });
    save(); sh.close(); refresh(); toast("Ajouté ✓");
  };
}

/* ---------- IA : description ou photo du repas ---------- */
const aiAvailable = () => isOnlineMode() && !!authToken() && navigator.onLine !== false;

function describe(meal, initial = "") {
  const sh = sheet(`<h2 class="h2">Décris ton repas</h2><p class="muted small">${aiAvailable() ? "L'IA estime les quantités et les calories." : "Hors ligne : je reconnais les aliments courants et leurs quantités."}</p>
    <textarea class="input" id="ds-t" rows="4" maxlength="600" placeholder="Ex : 200 g de poulet, une assiette de riz, une salade avec 1 cuillère d'huile d'olive et une pomme">${esc(initial)}</textarea>
    <div class="chips mt-s">${["2 œufs, 2 tranches de pain complet et un café", "Un bol de flocons d'avoine avec une banane et du lait", "Un kebab frites et un coca"].map(x => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <button class="btn btn-primary btn-block mt" id="ds-go">${I.sparkle} Analyser</button>`, { z: 90 });
  const ta = $("#ds-t", sh.el);
  setTimeout(() => ta.focus(), 300);
  $$("[data-ex]", sh.el).forEach(b => b.onclick = () => { ta.value = b.dataset.ex; ta.focus(); });
  $("#ds-go", sh.el).onclick = () => { const text = ta.value.trim(); if (!text) return ta.focus(); sh.close(); review(meal, { text }); };
}

function pickPhoto(meal) {
  if (!aiAvailable()) { toast("L'analyse de photo demande l'IA en ligne (comptes en ligne + connexion).", 3500); return describe(meal); }
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try { review(meal, { photo: await shrink(file) }); } catch { toast("Photo illisible : essaie une autre image."); }
  };
  input.click();
}

// Réduit la photo (≈ 1024 px, JPEG) : envoi rapide et léger
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    return { dataUrl, image: { mime: "image/jpeg", data: dataUrl.split(",")[1] } };
  } finally { URL.revokeObjectURL(url); }
}

// Résultat de l'analyse : liste à vérifier (quantités modifiables) avant l'ajout.
async function review(meal, { text = "", photo = null }) {
  const sh = sheet(`<h2 class="h2">${photo ? "Photo du repas" : "Ton repas"}</h2>
    ${photo ? `<img class="rv-photo" src="${photo.dataUrl}" alt="Photo du repas"/>` : `<p class="muted small rv-text">« ${esc(text)} »</p>`}
    <div id="rv-body"><div class="rv-wait"><i class="spinner"></i><span>${photo ? "J'analyse la photo…" : "J'analyse ton repas…"}</span></div></div>`, { z: 90 });
  const body = $("#rv-body", sh.el);
  let items = [], note = "", src = "ai";
  try {
    if (aiAvailable()) {
      const r = await foodAI(photo ? { text, image: photo.image } : { text });
      items = r.items.map(x => ({ name: x.name, g: x.grams || 100, per: per100(x), on: true }));
      note = r.note;
    } else throw new OnlineError("DOWN", "hors ligne");
  } catch (e) {
    if (photo) { body.innerHTML = `<div class="a-empty">${I.alert}<b>Analyse impossible</b><span>${esc(e.message || "")}${e.detail ? ` (${esc(e.detail)})` : ""}</span></div>`; return; }
    const r = parseMeal(text); // secours hors ligne : aliments courants
    src = "text";
    items = r.items.map(x => ({ name: x.food.name, g: x.g, per: x.food.per, unit: x.food.unit, on: true }));
    note = (r.unknown.length ? `Non reconnu : ${r.unknown.join(", ")}. Cherche-le dans la liste. ` : "") + (e instanceof OnlineError && aiAvailable() ? `IA en ligne indisponible (${e.detail || e.message}) : estimation simple.` : "");
  }
  if (!sh.el.isConnected) return;
  if (!items.length) { body.innerHTML = `<div class="a-empty">${I.search}<b>Aucun aliment reconnu</b><span>${esc(note || "Précise les aliments et les quantités.")}</span></div>`; return; }
  const draw = () => {
    const tot = sumItems(items.filter(x => x.on));
    body.innerHTML = `<div class="rv-list">${items.map((x, i) => `<div class="rv-row ${x.on ? "" : "off"}"><button class="rv-check" data-on="${i}" aria-label="${x.on ? "Retirer" : "Garder"}">${x.on ? I.check : ""}</button>
        <span class="grow fr-txt"><span class="fr-name ellipsis">${esc(x.name)}</span><span class="fr-sub tnum">${fmtNum(itemTotals(x).k)} kcal · P ${nice(r1(itemTotals(x).p))} g</span></span>
        <label class="rv-g"><input type="number" inputmode="decimal" min="0" step="any" value="${nice(x.g).replace(",", ".")}" data-g="${i}" aria-label="Quantité de ${esc(x.name)}"/><span>${unitWord(x)}</span></label></div>`).join("")}</div>
      <div class="rv-tot tnum"><b>${fmtNum(tot.k)} kcal</b> · P ${Math.round(tot.p)} g · G ${Math.round(tot.c)} g · L ${Math.round(tot.f)} g</div>
      ${note ? `<p class="xs muted">${esc(note)}</p>` : ""}
      <p class="xs muted">${src === "ai" ? "Estimation de l'IA : vérifie les quantités, elles comptent plus que tout." : "Estimation à partir des aliments courants."}</p>
      <div class="chips mt-s" id="rv-meal">${MEALS.map(m => `<button class="chip ${m.id === meal ? "on" : ""}" data-m="${m.id}">${m.name}</button>`).join("")}</div>
      <button class="btn btn-primary btn-block mt" id="rv-ok" ${items.some(x => x.on) ? "" : "disabled"}>${I.check} Ajouter ${items.filter(x => x.on).length} aliment${items.filter(x => x.on).length > 1 ? "s" : ""}</button>`;
    $$("[data-on]", body).forEach(b => b.onclick = () => { items[+b.dataset.on].on = !items[+b.dataset.on].on; draw(); });
    $$("[data-g]", body).forEach(inp => inp.onchange = () => { items[+inp.dataset.g].g = Math.max(0, parseFloat(String(inp.value).replace(",", ".")) || 0); draw(); });
    $$("#rv-meal .chip", body).forEach(b => b.onclick = () => { meal = b.dataset.m; $$("#rv-meal .chip", body).forEach(c => c.classList.toggle("on", c === b)); });
    $("#rv-ok", body).onclick = () => {
      const key = viewKey || dayKey(), keep = items.filter(x => x.on && x.g > 0);
      keep.forEach(x => addItem(state, key, { name: x.name, per: x.per, unit: x.unit, src }, { g: x.g, meal }));
      save(); sh.close(); refresh();
      toast(`${keep.length} aliment${keep.length > 1 ? "s" : ""} ajouté${keep.length > 1 ? "s" : ""} · ${fmtNum(sumItems(keep).k)} kcal`);
    };
  };
  draw();
}
// Valeurs de l'IA (pour la quantité) → pour 100 g
function per100(x) {
  const g = x.grams > 0 ? x.grams : 100, m = 100 / g;
  return { k: r1(x.kcal * m), p: r1(x.protein * m), c: r1(x.carbs * m), f: r1(x.fat * m), ...(x.fiber ? { fi: r1(x.fiber * m) } : {}) };
}

/* ---------- Repas enregistrés ---------- */
function saveMeal(meal) {
  const items = dayOf(state, viewKey).items.filter(x => x.meal === meal);
  const sh = sheet(`<h2 class="h2">Enregistrer ce repas</h2><p class="muted small">Pour l'ajouter en un geste les prochaines fois (${items.length} aliments, ${fmtNum(sumItems(items).k)} kcal).</p>
    <label class="field"><span>Nom</span><input class="input" id="sm-n" maxlength="40" value="${esc(`${mealName(meal)} habituel`)}"/></label>
    <button class="btn btn-primary btn-block mt" id="sm-ok">${IC.save} Enregistrer</button>`, { z: 90 });
  $("#sm-ok", sh.el).onclick = () => {
    const name = $("#sm-n", sh.el).value.trim() || mealName(meal);
    state.foodMeals = [{ id: newId(), name, items: items.map(x => ({ ...template(x), g: x.g })) }, ...(state.foodMeals || [])].slice(0, 30);
    save(); sh.close(); toast(`« ${name} » enregistré`);
  };
}

/* ---------- Objectifs ---------- */
export function openTargets() {
  const p = state.profile;
  const draft = { sex: p.sex || "h", age: p.age || "", height: p.height || "", bodyweight: p.bodyweight, activity: p.activity || "light", goal: p.goal, nutri: { custom: false, ...(p.nutri || {}) } };
  const sh = sheet(`<h2 class="h2">Mes objectifs</h2><p class="muted small">Calcul : métabolisme de base (Mifflin-St Jeor) × activité + tes séances, ajusté à ton objectif.</p>
    <div class="seg mt" id="t-sex" style="--n:2"><button data-v="h">Homme</button><button data-v="f">Femme</button></div>
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <label class="field"><span>Âge</span><input class="input" id="t-age" type="number" inputmode="numeric" min="12" max="99" value="${draft.age}"/></label>
      <label class="field"><span>Taille <i class="dim">(cm)</i></span><input class="input" id="t-h" type="number" inputmode="numeric" min="120" max="230" value="${draft.height}"/></label>
      <label class="field"><span>Poids <i class="dim">(kg)</i></span><input class="input" id="t-w" type="number" inputmode="decimal" min="30" max="250" value="${draft.bodyweight}"/></label></div>
    <div class="eyebrow mt">Activité hors séances</div>
    <div class="t-acts">${Object.entries(ACTIVITY).map(([k, a]) => `<button class="chip t-act" data-a="${k}"><b>${a.name}</b><small>${a.hint}</small></button>`).join("")}</div>
    <div class="eyebrow mt">Objectif</div>
    <div class="chips" id="t-goal">${Object.entries(GOALS).map(([k, g]) => `<button class="chip" data-g="${k}">${g.name}</button>`).join("")}</div>
    <div class="card t-res mt" id="t-res"></div>
    <label class="toggle set-row mt"><div class="grow"><b>Objectifs personnalisés</b><span class="xs muted">Fixe toi-même calories et macros (avis d'un diététicien…)</span></div><input type="checkbox" id="t-custom" ${draft.nutri.custom ? "checked" : ""}/></label>
    <div class="grid2" id="t-man"></div>
    <button class="btn btn-primary btn-block mt" id="t-ok">${I.check} Enregistrer</button>`);
  const el = sh.el;
  const read = () => {
    draft.age = +$("#t-age", el).value || ""; draft.height = +$("#t-h", el).value || ""; draft.bodyweight = +$("#t-w", el).value || draft.bodyweight;
    if (draft.nutri.custom) for (const k of ["kcal", "p", "c", "f"]) { const v = +$(`#tm-${k}`, el)?.value; if (v > 0) draft.nutri[k] = v; }
  };
  const draw = () => {
    $$("#t-sex button", el).forEach(b => b.classList.toggle("on", b.dataset.v === draft.sex));
    $$(".t-act", el).forEach(b => b.classList.toggle("on", b.dataset.a === draft.activity));
    $$("#t-goal .chip", el).forEach(b => b.classList.toggle("on", b.dataset.g === draft.goal));
    const t = targets({ ...p, ...draft });
    $("#t-res", el).innerHTML = `<div class="t-big"><b class="tnum">${fmtNum(t.kcal)}</b> kcal / jour</div>
      <div class="t-mac tnum"><span><b>${t.p} g</b>protéines</span><span><b>${t.c} g</b>glucides</span><span><b>${t.f} g</b>lipides</span><span><b>${nice(t.water / 1000)} L</b>d'eau</span></div>
      <div class="xs muted">Métabolisme de base ${fmtNum(t.bmr)} kcal · dépense estimée ${fmtNum(t.tdee)} kcal${t.custom ? " · objectifs personnalisés" : ""}</div>`;
    $("#t-man", el).innerHTML = draft.nutri.custom ? [["kcal", "Calories", t.kcal], ["p", "Protéines (g)", t.p], ["c", "Glucides (g)", t.c], ["f", "Lipides (g)", t.f]]
      .map(([k, l, v]) => `<label class="field"><span>${l}</span><input class="input" id="tm-${k}" type="number" inputmode="numeric" min="0" value="${draft.nutri[k] || v}"/></label>`).join("") : "";
    $$("#t-man input", el).forEach(i => i.onchange = () => { read(); draw(); });
  };
  $$("#t-sex button", el).forEach(b => b.onclick = () => { draft.sex = b.dataset.v; read(); draw(); });
  $$(".t-act", el).forEach(b => b.onclick = () => { draft.activity = b.dataset.a; read(); draw(); });
  $$("#t-goal .chip", el).forEach(b => b.onclick = () => { draft.goal = b.dataset.g; read(); draw(); });
  ["#t-age", "#t-h", "#t-w"].forEach(id => $(id, el).oninput = () => { read(); draw(); });
  $("#t-custom", el).onchange = e => { read(); draft.nutri.custom = e.target.checked; draw(); };
  $("#t-ok", el).onclick = () => {
    read();
    const goalChanged = draft.goal !== p.goal;
    Object.assign(p, { sex: draft.sex, age: draft.age, height: draft.height, bodyweight: draft.bodyweight, activity: draft.activity, goal: draft.goal, nutri: draft.nutri.custom ? draft.nutri : null });
    save(); sh.close(); refresh();
    toast(goalChanged ? `Objectif : ${GOALS[p.goal].name}. Séances et nutrition adaptées.` : "Objectifs enregistrés ✓");
  };
  draw();
}
