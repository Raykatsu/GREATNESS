// Onglet Séances : liste des programmes, aperçu modifiable, check-in, création de séances.
import { EXERCISES, CATEGORIES, GOALS, EQUIP } from "./data.js";
import { demoBtn } from "./demo.js";
import { defaultItem, exerciseForm } from "./create.js";
import { shareProgram } from "./social.js";
import { state, save, allPrograms, tombstone, getProgram } from "./store.js";
import { adaptToGoal, estimateMinutes, todaysMission, isWorkout, warmupFor } from "./planner.js";
import { readinessScore, readinessVerdict } from "./engine.js";
import { strainNote } from "./recovery-ui.js";
import { intervalCard, openIntervals } from "./intervals-ui.js";
import { goalCard, bindGoalCard } from "./goals-ui.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

let filter = "all";
const fmtReps = e => {
  const u = EXERCISES[e.id].type === "time" ? "s" : "reps";
  if (e.ramp) { const t = e.ramp.find(r => r.attempt); return t.weight ? `montée en charge puis tentative à ${String(t.weight).replace(".", ",")} kg` : `échauffement puis le maximum (objectif ${t.reps} ${u})`; }
  return e.reps[0] === e.reps[1] ? `${e.reps[0]} ${u}` : `${e.reps[0]}–${e.reps[1]} ${u}`;
};
const fold = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

/* Identité de chaque catégorie : une couleur (classe .cat-*) et une icône. */
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CAT_ICON = {
  gym: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  home: svg('<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 9.8V19h11V9.8"/><path d="M10.5 19v-4.5h3V19"/>'),
  cardio: svg('<path d="M3 12h4l2.2-5 4.6 10 2.2-5h5"/>'),
  mobility: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v3.8h-3.8"/>'),
  stretch: svg('<path d="M12 21c-3.6 0-6-2.5-6-5.6 0-3.6 3.1-5.4 3.6-9.4 2.6 1.6 4 4 4.2 6.3.9-.6 1.5-1.7 1.6-3 1.6 1.5 2.6 3.6 2.6 6 0 3.2-2.4 5.7-6 5.7z"/>'),
  care: svg('<path d="M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14z"/><path d="M5 19l7.5-7.5"/>'),
  custom: svg('<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4-3.9 5.5-.8z"/>'),
};
const catOf = p => (p.cat && CAT_ICON[p.cat] ? p.cat : "custom");
const catName = id => CATEGORIES.find(c => c.id === id)?.name || "";
const catLabel = id => (id === "stretch" ? "Échauffement" : catName(id));
const listIc = svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>');

function progCard(p, today, i) {
  const c = catOf(p);
  return `<article class="card tap prog pc cat-${c}" data-id="${p.id}" style="--i:${Math.min(i, 8)}">
      <span class="pc-ic">${CAT_ICON[c]}</span>
      <div class="pc-body">
        <div class="pc-title"><h3>${esc(p.name)}</h3>${p.id === today ? `<span class="pc-today">Aujourd'hui</span>` : ""}</div>
        ${p.tag ? `<div class="pc-tag">${esc(p.tag)}</div>` : ""}
        <div class="pc-meta tnum"><span>${I.clock}~${estimateMinutes(p)} min</span><span>${listIc}${plural(p.exercises.length, "exercice")}</span></div>
      </div>
      <span class="chev">${I.chev}</span>
    </article>`;
}

export function renderTrain(view, startLive) {
  const all = allPrograms();
  const today = todaysMission().program?.id;
  const count = id => (id === "all" ? all.length : all.filter(p => p.cat === id).length);
  view.innerHTML = `
    <header class="tr-head">
      <div class="eyebrow">Bibliothèque</div>
      <h1 class="h1">Séances</h1>
      <p class="muted small">${all.length} programmes prêts à lancer, ajustables en un geste.</p>
    </header>
    <div class="chips tr-filters" role="tablist" aria-label="Catégories">${CATEGORIES.map(c => `
      <button class="chip tr-f ${c.id === "all" ? "" : "cat-" + c.id} ${filter === c.id ? "on" : ""}" data-f="${c.id}" role="tab" aria-selected="${filter === c.id}">
        ${c.id === "all" ? "" : `<i class="dot"></i>`}${c.name}<span class="n tnum">${count(c.id)}</span></button>`).join("")}</div>
    <button class="card tap free-card" id="free-start">
      <span class="bi">${I.bolt}</span>
      <span class="grow"><b>Séance libre</b><span class="xs muted">Choisis tes exercices au fur et à mesure</span></span>
      <span class="chev">${I.chev}</span>
    </button>
    ${intervalCard()}
    ${goalCard({ invite: true })}
    <div class="tr-list" id="tr-list"></div>
    <button class="fab" aria-label="Créer une séance">${I.plus}</button>`;
  const host = $("#tr-list", view);
  const open = el => openProgram(allPrograms().find(p => p.id === el.dataset.id), startLive, () => renderTrain(view, startLive));
  const drawList = (animate = false) => {
    const progs = allPrograms();
    const shown = filter === "all" ? progs : progs.filter(p => p.cat === filter);
    const groups = filter === "all"
      ? CATEGORIES.filter(c => c.id !== "all").map(c => [c.id, progs.filter(p => p.cat === c.id)]).filter(([, l]) => l.length)
      : [[filter, shown]];
    let n = 0;
    host.innerHTML = shown.length ? groups.map(([id, l]) => `
      ${filter === "all" ? `<div class="tr-group cat-${id}"><i class="dot"></i><h2>${catName(id)}</h2><span class="tnum">${l.length}</span></div>` : ""}
      <div class="prog-list">${l.map(p => progCard(p, today, n++)).join("")}</div>`).join("")
      : `<div class="card empty tr-empty">${CAT_ICON.custom}<b>Aucune séance perso pour l'instant</b>Compose la tienne : tes exercices, tes séries, ton rythme.
          <button class="btn btn-primary btn-sm" id="tr-create">${I.plus} Créer ma séance</button></div>`;
    host.classList.toggle("stagger", animate);
    $$(".prog", host).forEach(el => el.onclick = () => open(el));
    $("#tr-create", host)?.addEventListener("click", () => (location.hash = "#/create"));
  };
  $$("[data-f]", view).forEach(b => b.onclick = () => {
    if (filter === b.dataset.f) return;
    filter = b.dataset.f;
    $$("[data-f]", view).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
    b.scrollIntoView({ block: "nearest", inline: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    drawList(true);
  });
  drawList();
  requestAnimationFrame(() => $(".tr-f.on", view)?.scrollIntoView({ block: "nearest", inline: "center" }));
  $(".fab", view).onclick = () => (location.hash = "#/create");
  $("#free-start", view).onclick = () => window.dispatchEvent(new CustomEvent("greatness:start", { detail: "free" }));
  $("#iv-start", view).onclick = () => openIntervals();
  bindGoalCard(view, () => { if (location.hash.startsWith("#/train")) renderTrain(view, startLive); });
}

/* ---------- Liste d'exercices modifiable (aperçu & création) ---------- */
function exList(list, host, onChange) {
  host.innerHTML = list.length ? `<ol class="pv-list">${list.map((e, i) => `
    <li class="ex-row pv-ex">
      <span class="pv-n tnum">${i + 1}</span>
      <div class="pv-main">
        <div class="pv-name">${esc(EXERCISES[e.id].name)}${demoBtn(e.id, "demo-sm")}</div>
        <div class="pv-sub tnum">${fmtReps(e)} · repos ${e.rest} s${e.weight && !e.ramp ? ` · ${String(e.weight).replace(".", ",")} kg` : ""}</div>
      </div>
      <div class="tools">
        <button class="icon-btn plain" data-a="up" data-i="${i}" aria-label="Monter" ${i === 0 ? "disabled" : ""}>${I.up}</button>
        <button class="icon-btn plain" data-a="del" data-i="${i}" aria-label="Retirer">${I.trash}</button>
      </div>
      <div class="pv-step" role="group" aria-label="Séries">
        <button data-a="minus" data-i="${i}" aria-label="Moins de séries" ${e.sets <= 1 ? "disabled" : ""}>${I.minus}</button>
        <span class="tnum"><b>${e.sets}</b> série${e.sets > 1 ? "s" : ""}</span>
        <button data-a="plus" data-i="${i}" aria-label="Plus de séries" ${e.sets >= 8 ? "disabled" : ""}>${I.plus}</button>
      </div>
    </li>`).join("")}</ol>` : `<div class="empty">${I.plus}<b>Séance vide</b>Ajoute des exercices pour composer ta séance.</div>`;
  $$("[data-a]", host).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, a = b.dataset.a;
    if (a === "minus") list[i].sets = Math.max(1, list[i].sets - 1);
    if (a === "plus") list[i].sets = Math.min(8, list[i].sets + 1);
    if (a === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (a === "del") list.splice(i, 1);
    exList(list, host, onChange);
    if (a === "up") host.querySelectorAll(".pv-ex")[i - 1]?.classList.add("moved");
    if (a === "minus" || a === "plus") host.querySelectorAll(".pv-step b")[i]?.classList.add("bump");
    navigator.vibrate?.(6);
    onChange?.();
  });
}

/* ---------- Aperçu d'un programme ---------- */
export function openProgram(program, startLive, refresh) {
  const base = adaptToGoal(program);
  const work = structuredClone(base.exercises);
  let edited = false;
  const custom = program.cat === "custom";
  const c = custom ? "custom" : catOf(program);
  const sh = sheet(`
    <header class="pv-head cat-${c}">
      <span class="pv-ic">${CAT_ICON[c]}</span>
      <div class="eyebrow">${custom ? "Ma séance" : catName(program.cat)}</div>
      <h2 class="pv-title">${esc(program.name)}</h2>
      ${program.tag ? `<div class="muted">${esc(program.tag)}</div>` : ""}
    </header>
    <div class="pv-stats tnum" id="meta"></div>
    ${program.cat === "care" ? `<div class="pv-note">${I.info}<span>Tout en douceur : arrête un mouvement s'il fait mal. Douleur vive, qui dure ou après un choc → kiné ou médecin.</span></div>` : ""}
    ${strainNote(base) ? `<div class="pv-note pv-rec">${I.info}<span>${esc(strainNote(base))}</span></div>` : ""}
    <div class="section pv-section"><h2>Exercices</h2><button id="add" class="pv-add">${I.plus} Ajouter</button></div>
    <div id="list"></div>
    <div class="sheet-foot">
      <button class="btn btn-primary btn-lg btn-block" id="start">${I.play} Commencer</button>
      <div class="grid2 mt-s" id="extra"></div>
    </div>`);
  const meta = () => {
    const p = { ...base, exercises: work };
    const sets = work.reduce((a, e) => a + e.sets, 0);
    const goal = program.simple || program.cat === "cardio" || custom || program.goalId ? "" : GOALS[state.profile.goal].name;
    $("#meta", sh.el).innerHTML = `
      <div><b>~${estimateMinutes(p)}</b><em>min</em><small>Durée</small></div>
      <div><b>${work.length}</b><small>exercice${work.length > 1 ? "s" : ""}</small></div>
      <div><b>${sets}</b><small>série${sets > 1 ? "s" : ""}</small></div>
      ${goal ? `<p class="pv-goal">${I.sparkle}<span>Adapté à ton objectif : <b>${esc(goal)}</b></span></p>` : ""}`;
    $("#extra", sh.el).innerHTML = custom
      ? `<button class="btn btn-soft btn-sm" id="edit-c">${I.edit} Modifier</button><button class="btn btn-soft btn-sm" id="share-c">${I.send} Partager</button>`
      : edited && !program.goalId ? `<button class="btn btn-soft btn-sm" id="save-new" style="grid-column:span 2">Enregistrer comme ma séance</button>` : "";
    $("#extra", sh.el).hidden = !$("#extra", sh.el).children.length;
    $("#share-c", sh.el)?.addEventListener("click", () => shareProgram(program));
    $("#edit-c", sh.el)?.addEventListener("click", () => { sh.close(); location.hash = `#/create?edit=${program.id}`; });
    $("#del-c", sh.el)?.addEventListener("click", async () => {
      if (!(await confirmSheet("Supprimer cette séance ?", "Ton historique est conservé.", "Supprimer", true))) return;
      state.customPrograms = state.customPrograms.filter(x => x.id !== program.id); tombstone("programs", program.id); save(); sh.close(); refresh?.(); toast("Séance supprimée");
    });
    $("#save-new", sh.el)?.addEventListener("click", () => {
      state.customPrograms.push({ id: "c" + Date.now(), name: program.name + " (perso)", tag: "Version modifiée", accent: program.accent, exercises: structuredClone(work) });
      save(); toast("Ajoutée à « Mes séances »"); edited = false; meta();
    });
  };
  const change = () => { edited = true; meta(); };
  exList(work, $("#list", sh.el), change);
  meta();
  $("#add", sh.el).onclick = () => pickExercises(ids => { ids.forEach(id => work.push(defaultItem(id))); exList(work, $("#list", sh.el), change); change(); });
  $("#start", sh.el).onclick = () => {
    if (!work.length) return toast("Ajoute au moins un exercice.");
    checkIn(sh, { ...base, exercises: work }, startLive);
  };
}

/* ---------- Check-in de forme ---------- */
const CI_IC = { sleep: I.moon, energy: I.bolt, soreness: I.flame };
function checkIn(sh, program, startLive) {
  const vals = { sleep: 4, energy: 3, soreness: 2 };
  const rows = [
    ["sleep", "Sommeil", ["Très mauvais", "Mauvais", "Correct", "Bon", "Excellent"], false],
    ["energy", "Énergie", ["À plat", "Faible", "Moyenne", "Bonne", "Au top"], false],
    ["soreness", "Courbatures", ["Aucune", "Légères", "Moyennes", "Fortes", "Partout"], true],
  ];
  const warm = isWorkout(program) && startLive.warmup ? getProgram(warmupFor(program)) : null;
  sh.el.innerHTML = `<div class="grab"></div>
    <div class="ci stagger">
      <div class="ci-top"><button class="icon-btn plain" id="back" aria-label="Retour">${I.back}</button><span class="eyebrow ellipsis">Check-in · ${esc(program.name)}</span></div>
      <h2 class="h2">Comment tu te sens ?</h2>
      <p class="muted small ci-lead">Ton coach adapte les charges et le volume à ta forme du jour.</p>
      ${rows.map(([k, lab]) => `<div class="check-row" data-row="${k}">
        <div class="lab"><span class="ci-ic">${CI_IC[k]}</span><span class="grow">${lab}</span><em id="l-${k}"></em></div>
        <div class="seg ci-seg" data-k="${k}">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}" aria-label="${lab} ${v} sur 5">${v}</button>`).join("")}</div></div>`).join("")}
      <div class="verdict" id="verdict" aria-live="polite"></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="ci-go">${I.play} C'est parti</button>
      ${warm ? `<button class="card tap ci-warm mt-s" id="ci-warm"><span class="bi">${I.flame}</span>
        <span class="grow"><b>Échauffement d'abord</b><span class="xs muted">${esc(warm.name.replace("Échauffement ", "").replace(/^./, ch => ch.toUpperCase()))} · ~${estimateMinutes(warm)} min, puis ta séance</span></span>
        <span class="chev">${I.chev}</span></button>` : ""}</div>`;
  let lastTone = "";
  const upd = (changed) => {
    rows.forEach(([k, , words, inverse]) => {
      const lab = $(`#l-${k}`, sh.el), v = vals[k], good = inverse ? 6 - v : v;
      lab.textContent = words[v - 1];
      lab.className = good >= 4 ? "good" : good <= 2 ? "low" : "";
      if (k === changed) { lab.classList.remove("pop"); void lab.offsetWidth; lab.classList.add("pop"); }
      $$(`[data-k=${k}] button`, sh.el).forEach(b => { const on = +b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    });
    const score = readinessScore(vals), v = readinessVerdict(score);
    const pct = Math.round(((score - 0.2) / 0.8) * 100);
    const icon = { up: I.bolt, info: I.check, warn: I.moon, down: I.heart }[v.tone];
    const el = $("#verdict", sh.el);
    if (v.tone !== lastTone) {
      el.className = `verdict ${v.tone}`;
      el.innerHTML = `<div class="ic">${icon}</div><div class="grow"><div class="vd-top"><b>${v.label}</b><span class="tnum" id="vd-pct"></span></div>
        <div class="small muted">${v.text}</div><div class="vd-bar"><i></i></div></div>`;
      if (lastTone) { el.classList.add("swap"); }
      lastTone = v.tone;
    }
    $("#vd-pct", el).textContent = `${pct} %`;
    $(".vd-bar i", el).style.transform = `scaleX(${Math.max(0.04, pct / 100)})`;
  };
  $$(".seg", sh.el).forEach(seg => $$("button", seg).forEach(b => b.onclick = () => {
    if (vals[seg.dataset.k] === +b.dataset.v) return;
    vals[seg.dataset.k] = +b.dataset.v; upd(seg.dataset.k); navigator.vibrate?.(8);
  }));
  upd();
  sh.el.scrollTop = 0;
  $("#back", sh.el).onclick = () => { sh.close(); openProgram(program, startLive); };
  $("#ci-go", sh.el).onclick = () => { sh.close(); startLive(program, { ...vals }); };
  // l'échauffement enchaîne ensuite sur la séance (on garde la sortie habituelle de startLive)
  $("#ci-warm", sh.el)?.addEventListener("click", () => { sh.close(); startLive.warmup(warmupFor(program), program, { ...vals }); });
}

/* ---------- Choix d'exercices ----------
   Les 183 lignes sont construites une seule fois ; recherche, filtres et sélection
   ne font que basculer des attributs (pas de reconstruction du DOM à chaque frappe). */
export function pickExercises(onDone, { single = false, title = "Ajouter des exercices" } = {}) {
  const sel = new Set();
  let q = "", muscle = "Tout", equip = "Tout", rows = [], groups = [];
  const sh = sheet(`
    <div class="pk-head">
      <h2 class="h2">${esc(title)}</h2>
      <button class="btn btn-soft btn-sm" id="new-ex">${I.plus} Créer</button>
    </div>
    <div class="pk-top">
      <label class="search">${I.search}<input id="q" type="search" enterkeyhint="search" placeholder="Rechercher un exercice" autocomplete="off" aria-label="Rechercher un exercice"/>
        <button class="pk-clear" id="q-x" aria-label="Effacer la recherche" hidden>${I.x}</button></label>
      <div class="chips pk-chips" id="mus" aria-label="Muscle"></div>
      <div class="chips pk-chips pk-eq" id="eqp" aria-label="Matériel"></div>
      <div class="pk-count"><span class="tnum" id="count"></span>${single ? "" : `<button id="pk-reset" hidden>Tout désélectionner</button>`}</div>
    </div>
    <div id="items" class="pk-items"></div>
    <div class="empty pk-empty" id="pk-none" hidden>${I.search}<b>Aucun résultat</b>Essaie un autre mot, ou crée-le avec « Créer ».</div>
    ${single ? "" : `<div class="sheet-foot"><button class="btn btn-primary btn-block" id="ok" disabled>Ajouter</button></div>`}`, { z: 60 });
  const itemsEl = $("#items", sh.el), qEl = $("#q", sh.el);
  const chipsHtml = (list, cur, attr, label) => list.map(k => `<button class="chip ${k === cur ? "on" : ""}" data-${attr}="${esc(k)}">${esc(label(k))}</button>`).join("");
  const build = () => {
    const entries = Object.entries(EXERCISES);
    const muscles = [...new Set(entries.map(([, e]) => e.muscle))];
    const equips = Object.keys(EQUIP).filter(k => entries.some(([, e]) => e.equip === k));
    $("#mus", sh.el).innerHTML = chipsHtml(["Tout", ...muscles], muscle, "m", m => m);
    $("#eqp", sh.el).innerHTML = chipsHtml(["Tout", ...equips], equip, "e", k => (k === "Tout" ? "Tout matériel" : EQUIP[k]));
    itemsEl.innerHTML = muscles.map(m => `<section class="pk-group" data-grp="${esc(m)}"><h3 class="pk-gh">${esc(m)}</h3>${entries.filter(([, e]) => e.muscle === m).map(([id, e]) => `
      <button class="pick-item ${sel.has(id) ? "sel" : ""}" data-id="${id}" aria-pressed="${sel.has(id)}"><span class="grow"><span class="pk-name">${esc(e.name)}${e.custom ? ` <span class="pk-tag">perso</span>` : ""}</span>
        <span class="xs muted">${EQUIP[e.equip] || ""}${e.type === "time" ? " · chrono" : ""}</span></span>
        ${e.custom ? "" : `<span class="pk-demo" data-demo="${id}" aria-hidden="true">${I.play}</span>`}<span class="add">${single ? I.swap : `${I.plus}${I.check}`}</span></button>`).join("")}</section>`).join("");
    groups = $$(".pk-group", itemsEl);
    rows = $$(".pick-item", itemsEl).map(el => { const e = EXERCISES[el.dataset.id]; return { el, e, hay: fold(`${e.name} ${e.muscle} ${EQUIP[e.equip] || ""}`) }; });
  };
  const filter = () => {
    const nq = fold(q).split(/\s+/).filter(Boolean);
    let n = 0;
    for (const r of rows) {
      const show = (muscle === "Tout" || r.e.muscle === muscle) && (equip === "Tout" || r.e.equip === equip) && nq.every(w => r.hay.includes(w));
      if (r.el.hidden === show) r.el.hidden = !show;
      if (show) n++;
    }
    for (const g of groups) g.hidden = !g.querySelector(".pick-item:not([hidden])");
    $("#count", sh.el).textContent = plural(n, "exercice");
    $("#pk-none", sh.el).hidden = n > 0;
    $("#q-x", sh.el).hidden = !q;
  };
  const syncSel = () => {
    const ok = $("#ok", sh.el);
    if (ok) {
      ok.disabled = !sel.size;
      ok.innerHTML = sel.size ? `${I.plus} Ajouter ${plural(sel.size, "exercice")}` : "Sélectionne des exercices";
    }
    const reset = $("#pk-reset", sh.el); if (reset) reset.hidden = !sel.size;
  };
  const setChip = (host, attr, val) => $$(`[data-${attr}]`, host).forEach(b => b.classList.toggle("on", b.dataset[attr] === val));
  $("#mus", sh.el).addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (!b) return; muscle = b.dataset.m; setChip(e.currentTarget, "m", muscle); filter(); });
  $("#eqp", sh.el).addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (!b) return; equip = b.dataset.e; setChip(e.currentTarget, "e", equip); filter(); });
  itemsEl.addEventListener("click", e => {
    const el = e.target.closest(".pick-item"); if (!el) return;
    const id = el.dataset.id;
    if (single) { onDone([id]); return sh.close(); }
    const on = !sel.has(id);
    on ? sel.add(id) : sel.delete(id);
    el.classList.toggle("sel", on); el.setAttribute("aria-pressed", on);
    navigator.vibrate?.(6);
    syncSel();
  });
  let raf = 0;
  qEl.oninput = () => { q = qEl.value.trim(); cancelAnimationFrame(raf); raf = requestAnimationFrame(filter); };
  $("#q-x", sh.el).onclick = e => { e.preventDefault(); qEl.value = q = ""; filter(); qEl.focus(); };
  $("#pk-reset", sh.el)?.addEventListener("click", () => { sel.clear(); rows.forEach(r => { r.el.classList.remove("sel"); r.el.setAttribute("aria-pressed", false); }); syncSel(); });
  $("#ok", sh.el)?.addEventListener("click", () => { onDone([...sel]); sh.close(); });
  $("#new-ex", sh.el).onclick = () => exerciseForm(id => {
    if (single) { onDone([id]); sh.close(); return; }
    sel.add(id); muscle = "Tout"; equip = "Tout"; q = qEl.value = ""; build(); filter(); syncSel();
    $(`.pick-item[data-id="${id}"]`, itemsEl)?.scrollIntoView({ block: "center" });
  });
  build(); filter(); syncSel();
}
