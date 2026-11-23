// Plan de repas et liste de courses : carte de l'onglet Repas, plan jour par jour, liste à cocher et à partager.
import { tr } from "./i18n.js";
import { state, save } from "./store.js";
import { MEALS, targets, addItem, dayKey, sumItems } from "./nutrition.js";
import { DIETS, UNIT, localPlan, fromAiPlan, shoppingList, shoppingText, totalsOf, aisleOf, planOk, prepOf } from "./mealplan.js";
import { keepMeal } from "./mymeals.js";
import { dailyAdjust, planDayIndex, adaptPlanDay } from "./nutriadapt.js";
import { mealPlanAI } from "./online.js";
import { isOnlineMode, authToken } from "./cloud.js";
import { $, $$, esc, I, sheet, toast, fmtNum } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  plan: svg('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6"/>'),
  cart: svg('<path d="M3 4h2l2.4 11h10.2L20 8H6.3"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'),
};
const mealName = id => MEALS.find(m => m.id === id)?.name || "Repas";
// « 2 œufs · 110 g », « 250 ml »
const qty = x => {
  const w = /lait|boisson|jus/i.test(x.name) ? "ml" : "g", n = x.unit?.g && UNIT.test(x.unit.label) ? Math.round(x.g / x.unit.g) : 0;
  return n ? `${n} ${x.unit.label}${n > 1 ? "s" : ""} · ${Math.round(x.g)} ${w}` : `${Math.round(x.g)} ${w}`;
};
const aiAvailable = () => isOnlineMode() && !!authToken() && navigator.onLine !== false;
let onChange = () => {}, onLearn = () => {};
// typographie française : espace fine insécable avant « : ; ! ? » (la traduction l'ignore, i18n.js)
const nb = s => s.replace(/ ([?!:;»])/g, "\u202f$1");

export function planCard() {
  const p = state.mealPlan, n = p?.shopping?.length || 0, done = p?.shopping?.filter(x => x.done).length || 0;
  return `<section class="card plan-card tap" id="plan-open" role="button" tabindex="0">
    <span class="plan-ic">${IC.plan}</span>
    <div class="grow"><b>Plan de repas et courses</b><div class="small muted">${p ? `${p.days.length} jour${p.days.length > 1 ? "s" : ""} · ${n ? `courses : ${done}/${n} cochées` : "liste de courses"}` : "Des repas pour tes objectifs, et la liste de courses qui va avec"}</div></div>
    <span class="chev">${I.chev}</span></section>`;
}
export function bindPlanCard(root, refresh, learn) {
  onChange = refresh || (() => {});
  onLearn = learn || (() => {});
  const el = $("#plan-open", root);
  if (!el) return;
  el.onclick = () => (planOk(state.mealPlan) ? openPlan() : newPlan());
  el.onkeydown = e => { if (e.key === "Enter") el.onclick(); };
}

/* ---------- Composer un plan ---------- */
export function newPlan() {
  const t = targets(state.profile), prev = state.mealPlan;
  const pick = { days: prev?.days.length || 3, diet: [...(state.profile.diet || prev?.diet || [])], prefs: prev?.prefs || "" };
  const ai = aiAvailable();
  const sh = sheet(`<h2 class="h2">Nouveau plan de repas</h2>
    <p class="muted small">Pour ${fmtNum(t.kcal)} kcal et ${t.p} g de protéines par jour (tes objectifs). ${ai ? "L'IA compose des repas variés selon tes goûts." : "Hors ligne : l'app assemble des repas simples à ta mesure."}</p>
    <div class="eyebrow mt">Durée</div>
    <div class="seg" id="np-days" style="--n:4">${[1, 3, 5, 7].map(d => `<button data-d="${d}">${d} jour${d > 1 ? "s" : ""}</button>`).join("")}</div>
    <div class="eyebrow mt">Régime</div>
    <div class="chips np-diet" id="np-diet">${DIETS.map(d => `<button class="chip" data-v="${d.id}">${d.name}</button>`).join("")}</div>
    <label class="field mt"><span>Goûts, allergies, contraintes <i class="dim">(facultatif)</i></span>
      <textarea class="input" id="np-prefs" rows="3" maxlength="400" placeholder="Ex. : pas de poisson, j'adore les pâtes, allergie aux noix, je mange à la cantine le midi">${esc(pick.prefs)}</textarea></label>
    <button class="btn btn-primary btn-block mt" id="np-go">${I.sparkle} ${ai ? "Composer avec l'IA" : "Composer mon plan"}</button>
    ${ai ? `<button class="btn btn-ghost btn-block mt-s" id="np-local">Sans l'IA, tout de suite</button>` : ""}`, { z: 90 });
  const draw = () => {
    $$("#np-days button", sh.el).forEach(b => b.classList.toggle("on", +b.dataset.d === pick.days));
    $$("#np-diet .chip", sh.el).forEach(b => b.classList.toggle("on", pick.diet.includes(b.dataset.v)));
  };
  $$("#np-days button", sh.el).forEach(b => b.onclick = () => { pick.days = +b.dataset.d; draw(); });
  $$("#np-diet .chip", sh.el).forEach(b => b.onclick = () => { const v = b.dataset.v; pick.diet = pick.diet.includes(v) ? pick.diet.filter(x => x !== v) : [...pick.diet, v]; draw(); });
  let run = 0;
  // le plan composé par l'app, tout de suite, à l'échelle des objectifs et du régime
  const local = () => { const days = localPlan({ kcal: t.kcal, p: t.p }, { days: pick.days, diet: pick.diet, start: Math.floor(Math.random() * 7) }); return { days, shopping: shoppingList(days), tips: "" }; };
  // enregistre le plan ; la feuille encore ouverte : on montre le plan, sinon un message (le plan est prêt quand même)
  const done = (plan, source) => {
    state.mealPlan = { id: Date.now().toString(36), at: Date.now(), source, diet: pick.diet, prefs: pick.prefs, kcal: t.kcal, p: t.p, ...plan };
    save(); onChange();
    if (sh.el.isConnected) { sh.close(); openPlan(); } else toast("Ton plan de repas est prêt ✓ (Repas → Plan de repas)", 4000);
  };
  const compose = async useAi => {
    const my = ++run;
    pick.prefs = $("#np-prefs", sh.el).value.trim();
    state.profile.diet = pick.diet;
    const go = $("#np-go", sh.el);
    try {
      if (!useAi) return done(local(), "local");
      go.disabled = true;
      const t0 = Date.now(), tick = setInterval(() => { if (go.isConnected) go.innerHTML = `<i class="spinner"></i> L'IA compose ton plan… <span class="tnum">${Math.round((Date.now() - t0) / 1000)} s</span>`; }, 1000);
      go.innerHTML = `<i class="spinner"></i> L'IA compose ton plan…`;
      // ce que le coach sait de toi (allergies, aliments refusés…) accompagne tes préférences
      const mem = (state.memory || []).map(m => m.text).filter(Boolean).join(" ; ").slice(0, 300);
      let plan = null;
      try {
        const ask = mealPlanAI({ days: pick.days, kcal: t.kcal, protein: t.p, diet: pick.diet.map(id => DIETS.find(d => d.id === id)?.name || id), prefs: [pick.prefs, mem].filter(Boolean).join(" ; ") });
        const late = new Promise((_, no) => setTimeout(() => no(new Error("l'IA met trop de temps")), 45000));
        const r = fromAiPlan(await Promise.race([ask, late]));
        if (r.days.length) plan = r;
      } catch (e) { if (my === run) toast(`IA indisponible (${e.message || e}) : plan composé par l'app`, 3500); }
      finally { clearInterval(tick); }
      if (my !== run) return; // « sans l'IA » touché entre-temps : ce plan-là est déjà là
      done(plan || local(), plan ? "ai" : "local");
    } catch (e) {
      console.error(e);
      if (go.isConnected) { go.disabled = false; go.innerHTML = `${I.sparkle} Réessayer`; }
      toast(`Le plan n'a pas pu être composé : ${e.message || e}`, 4000);
    }
  };
  $("#np-go", sh.el).onclick = () => compose(ai);
  $("#np-local", sh.el)?.addEventListener("click", () => compose(false));
  draw();
}

/* ---------- Le plan, jour par jour ---------- */
export function openPlan(day = null) {
  const p = state.mealPlan;
  if (!planOk(p)) { if (p) toast("Ton ancien plan était incomplet : on en compose un nouveau", 3500); return newPlan(); }
  if (!Array.isArray(p.shopping)) p.shopping = shoppingList(p.days);
  try { return showPlan(p, day); } catch (e) { console.error(e); toast(`Le plan n'a pas pu s'afficher (${e.message || e}) : on en compose un nouveau`, 4000); return newPlan(); }
}
function showPlan(p, day) {
  // le jour du plan qui tombe aujourd'hui suit l'objectif du jour, corrigé des écarts des jours d'avant (nutriadapt.js)
  const today = planDayIndex(p), adj = dailyAdjust(state);
  day ??= Math.max(0, today);
  const sh = sheet(`<div class="eyebrow">${p.source === "ai" ? `${I.sparkle} Composé par l'IA` : "Composé par l'app"}</div>
    <h2 class="h2">Ton plan de repas</h2>
    <p class="muted small">${p.days.length} jour${p.days.length > 1 ? "s" : ""} · environ ${fmtNum(p.kcal)} kcal et ${p.p} g de protéines par jour</p>
    ${p.days.length > 1 ? `<div class="seg mt" id="pl-days" style="--n:${Math.min(p.days.length, 7)}">${p.days.map((d, i) => `<button data-i="${i}" ${i === today ? `aria-label="J${i + 1} · Aujourd'hui"` : ""}>J${i + 1}${i === today ? `<i class="pl-dot"></i>` : ""}</button>`).join("")}</div>` : ""}
    <div id="pl-day"></div>
    ${p.tips ? `<p class="pl-tips small">${I.sparkle}<span>${esc(p.tips)}</span></p>` : ""}
    <div class="grid2 mt"><button class="btn btn-soft" id="pl-new">${I.refresh} Nouveau plan</button><button class="btn btn-primary" id="pl-shop">${IC.cart} Courses (${p.shopping.length})</button></div>`, { z: 90 });
  const drawDay = i => {
    day = i;
    $$("#pl-days button", sh.el).forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    // aujourd'hui : féculents, fruits et matières grasses à l'échelle de l'écart du jour (protéines et légumes inchangés)
    const raw = p.days[i], d = i === today && adj.delta ? adaptPlanDay(raw, totalsOf(raw.meals.flatMap(m => m.items)).k + adj.delta) : raw;
    const tot = totalsOf(d.meals.flatMap(m => m.items)), moved = i === today && adj.delta && d.scale !== 1;
    $("#pl-day", sh.el).innerHTML = `${moved ? `<div class="pl-adj ${adj.delta > 0 ? "up" : "down"}"><b>${nb("Adapté aujourd'hui :")}</b> <b class="tnum">${adj.delta > 0 ? "+" : "−"}${fmtNum(Math.abs(adj.delta))} kcal</b>
        <span>${nb(adj.delta > 0 ? "Portions de féculents, fruits et matières grasses augmentées pour rattraper les jours d'avant. Protéines et légumes inchangés." : "Portions de féculents, fruits et matières grasses réduites pour compenser les jours d'avant. Protéines et légumes inchangés.")}</span>
        <button class="link" id="pl-why">Pourquoi ces quantités ?</button></div>` : ""}
      <div class="pl-tot tnum">${fmtNum(tot.k)} kcal · P ${Math.round(tot.p)} g · G ${Math.round(tot.c)} g · L ${Math.round(tot.f)} g</div>
      ${d.meals.map((m, k) => { const mt = totalsOf(m.items); return `<section class="pl-meal">
        <div class="pl-mh"><span class="eyebrow">${mealName(m.meal)}</span><span class="tnum muted small">${fmtNum(mt.k)} kcal</span></div>
        <b class="pl-name">${esc(m.name)}</b>
        <ul class="pl-items">${m.items.map(x => `<li><span class="grow">${esc(x.name)}</span><span class="tnum muted">${qty(x)}</span></li>`).join("")}</ul>
        ${prepHtml(m, p.source === "ai")}
        <div class="pl-acts"><button class="btn btn-ghost btn-sm" data-add="${k}">${I.plus} Ajouter au journal</button><button class="btn btn-ghost btn-sm" data-keep="${k}">${I.check} Garder dans mes repas</button></div></section>`; }).join("")}`;
    $("#pl-why", sh.el)?.addEventListener("click", () => { sh.close(); onLearn("adapt"); });
    $$("[data-add]", sh.el).forEach(b => b.onclick = () => {
      try {
        const m = d.meals[+b.dataset.add], key = dayKey();
        m.items.forEach(x => addItem(state, key, { name: x.name, per: x.per, unit: x.unit, src: p.source === "ai" ? "ai" : "db" }, { g: x.g, meal: m.meal }));
        save(); onChange();
        toast(`« ${m.name} » ajouté à ton ${mealName(m.meal).toLowerCase()} · ${fmtNum(sumItems(m.items).k)} kcal`);
      } catch (e) { console.error(e); toast(`Pas ajouté : ${e.message || e}`, 3500); }
    });
    $$("[data-keep]", sh.el).forEach(b => b.onclick = () => {
      const m = d.meals[+b.dataset.keep], r = prepOf(m);
      keepMeal({ name: m.name, items: m.items, prep: r?.steps || [], time: r?.time || 0 });
      b.disabled = true; b.innerHTML = `${I.check} Dans mes repas`;
      toast(`« ${m.name} » gardé dans tes repas ✓`);
    });
  };
  $$("#pl-days button", sh.el).forEach(b => b.onclick = () => drawDay(+b.dataset.i));
  $("#pl-new", sh.el).onclick = () => { sh.close(); newPlan(); };
  $("#pl-shop", sh.el).onclick = () => openShopping();
  drawDay(Math.min(day, p.days.length - 1));
}

// La recette d'un repas du plan : les étapes (celles de l'IA restent dans sa langue) et le temps
function prepHtml(m, ai) {
  const r = prepOf(m);
  if (!r?.steps?.length) return "";
  return `<details class="pl-prep"><summary><span>Préparation</span>${r.time ? ` <span class="muted">· <span class="tnum">${r.time}</span> min</span>` : ""}</summary>
    <ol ${ai ? 'translate="no"' : ""}>${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    ${m.adapted ? `<p class="xs muted">Recette adaptée à ton régime : fie-toi à la liste d'ingrédients.</p>` : ""}</details>`;
}

/* ---------- Liste de courses ---------- */
export function openShopping() {
  const p = state.mealPlan;
  if (!p) return;
  const sh = sheet(`<h2 class="h2">Liste de courses</h2><p class="muted small">Quantités à acheter pour tout le plan (crues), rangées par rayon.</p>
    <div id="sh-list"></div>
    <form class="sh-add mt" id="sh-form"><input class="input" id="sh-new" maxlength="60" placeholder="Ajouter un article…" aria-label="Ajouter un article"/><button class="btn btn-soft" aria-label="Ajouter">${I.plus}</button></form>
    <div class="grid2 mt"><button class="btn btn-soft" id="sh-reset">${I.undo} Tout décocher</button><button class="btn btn-primary" id="sh-share">${I.send} Partager</button></div>`, { z: 95 });
  const draw = () => {
    const by = {};
    for (const x of p.shopping) (by[x.aisle] ||= []).push(x);
    $("#sh-list", sh.el).innerHTML = Object.entries(by).map(([a, list]) => `<div class="a-sec">${esc(a)}</div>
      ${list.map(x => `<label class="sh-row ${x.done ? "done" : ""}"><input type="checkbox" data-id="${x.id}" ${x.done ? "checked" : ""}/><span class="grow">${esc(x.name)}</span><span class="tnum muted small">${esc(x.qty)}</span></label>`).join("")}`).join("")
      || `<p class="muted small">Liste vide.</p>`;
    $$("[data-id]", sh.el).forEach(c => c.onchange = () => { const it = p.shopping.find(x => x.id === c.dataset.id); if (it) { it.done = c.checked; save(); draw(); onChange(); } });
  };
  $("#sh-form", sh.el).onsubmit = e => {
    e.preventDefault();
    const v = $("#sh-new", sh.el).value.trim();
    if (!v) return;
    p.shopping.push({ id: Date.now().toString(36), name: v, qty: "", aisle: aisleOf(v), done: false });
    $("#sh-new", sh.el).value = ""; save(); draw(); onChange();
  };
  $("#sh-reset", sh.el).onclick = () => { p.shopping.forEach(x => (x.done = false)); save(); draw(); onChange(); };
  $("#sh-share", sh.el).onclick = async () => {
    const text = tr(`Liste de courses GREATNESS\n\n${shoppingText(p.shopping.filter(x => !x.done))}`);
    try {
      if (navigator.share) await navigator.share({ title: tr("Liste de courses"), text });
      else { await navigator.clipboard.writeText(text); toast("Liste copiée ✓"); }
    } catch { /* partage annulé */ }
  };
  draw();
}
