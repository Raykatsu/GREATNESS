// Onglet Créer : l'atelier pour composer, générer, modifier et enregistrer ses séances,
// et créer ses propres exercices.
import { EXERCISES, EQUIP, MUSCLES, GOALS } from "./data.js";
import { state, save, syncCustomExercises, tombstone } from "./store.js";
import { generateSession, GROUPS, estimateMinutes } from "./planner.js";
import { pickExercises, openProgram } from "./train.js";
import { spidey } from "./spidey.js";
import { shareProgram } from "./social.js";
import { animSvg, mountAnims } from "./anim.js";
import { $, $$, esc, I, sheet, toast, confirmSheet, spider } from "./ui.js";

let tab = "new", draft = null, open = -1, genOpen = true;
const gen = { groups: new Set(["pecs"]), minutes: 45, equipment: null };
const blank = () => ({ id: null, name: "", exercises: [] });
const unit = e => (EXERCISES[e.id]?.type === "time" ? "s" : "");
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EQ_LABEL = { gym: "Salle", db: "Haltères", home: "Sans matériel" };
// Petites icônes propres à l'atelier (le jeu I n'a ni chaîne ni copie).
const IC = {
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>`,
  unlink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7.5l1.4-1.4a3.2 3.2 0 0 1 4.5 4.5L19.5 12"/><path d="M9 16.5l-1.4 1.4a3.2 3.2 0 0 1-4.5-4.5L4.5 12"/><path d="M8 3v3M3 8h3M16 21v-3M21 16h-3"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  loop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>`,
};
// Petit rebond de la valeur d'un stepper (transform seulement).
const bump = el => { if (!calm()) el?.animate?.([{ transform: "scale(1.22)" }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.3,1.5,.5,1)" }); };
const enter = el => { if (!calm()) el?.animate?.([{ opacity: 0, transform: "translate3d(0,8px,0)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }); };

export function renderCreate(view, launch, params = {}) {
  if (params.tab) { tab = params.tab; history.replaceState(null, "", "#/create"); }
  if (params.edit) {
    const p = state.customPrograms.find(x => x.id === params.edit);
    if (p) { draft = structuredClone({ id: p.id, name: p.name, accent: p.accent, exercises: p.exercises }); tab = "new"; open = -1; }
    history.replaceState(null, "", "#/create");
  }
  draft ||= blank();
  gen.equipment ||= state.profile.equipment;
  const nMine = state.customPrograms.length, nEx = Object.keys(state.customExercises || {}).length;
  const n = k => (k ? ` <span class="seg-n tnum">${k}</span>` : "");
  view.innerHTML = `
    <header class="cr-head"><div class="eyebrow">Atelier</div><h1 class="h1">Créer</h1></header>
    <div class="seg cr-tabs" id="tabs" role="tablist">
      <button data-t="new" role="tab" class="${tab === "new" ? "on" : ""}">${draft.id ? "Modifier" : "Nouvelle"}</button>
      <button data-t="mine" role="tab" class="${tab === "mine" ? "on" : ""}">Mes séances${n(nMine)}</button>
      <button data-t="ex" role="tab" class="${tab === "ex" ? "on" : ""}">Exercices${n(nEx)}</button>
    </div>
    <div id="pane" class="cr-pane"></div>`;
  const pane = $("#pane", view);
  const draw = () => ({ new: paneNew, mine: paneMine, ex: paneEx })[tab](pane, view, launch);
  // Changement d'onglet sans tout reconstruire : la pastille du .seg glisse, le contenu apparaît en fondu.
  $$("#tabs button", view).forEach(b => b.onclick = () => {
    if (tab === b.dataset.t) return;
    tab = b.dataset.t;
    $$("#tabs button", view).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    draw(); enter(pane);
  });
  draw();
}

/* ---------- Nouvelle séance / modification ---------- */
function genCard() {
  const groups = [...Object.entries(GROUPS).map(([k, g]) => [k, g.name]), ["full", "Full body"]];
  const sum = `${gen.minutes} min · ${EQ_LABEL[gen.equipment] || "Salle"}`;
  if (draft.exercises.length && !genOpen) {
    const names = [...gen.groups].map(k => (k === "full" ? "Full body" : GROUPS[k]?.name)).filter(Boolean).join(", ");
    return `<button class="card gen-mini mt" id="g-open"><span class="gen-ic">${I.sparkle}</span>
      <span class="grow"><b>Générer une autre séance</b><span class="ellipsis">${esc(names || "Choisis tes muscles")} · ${sum}</span></span>
      <span class="gen-chev">${I.down}</span></button>`;
  }
  return `<section class="card card-hero gen mt" id="gen">
    <div class="gen-top"><span class="gen-ic">${I.sparkle}</span>
      <div class="grow"><div class="eyebrow">En 2 touches</div><h2 class="h3">Générer pour moi</h2></div>
      ${draft.exercises.length ? `<button class="icon-btn plain gen-x" id="g-close" aria-label="Replier">${I.up}</button>` : ""}</div>
    <div class="gen-lab"><span class="gen-n">1</span>Choisis tes muscles</div>
    <div class="gen-groups" id="g-groups">${groups.map(([k, nm]) => `<button class="chip ${gen.groups.has(k) ? "on" : ""}" data-g="${k}" aria-pressed="${gen.groups.has(k)}">${nm}</button>`).join("")}</div>
    <div class="gen-opts">
      <div><div class="gen-sub">Durée (min)</div>
        <div class="seg gen-seg" id="g-min">${[20, 30, 45, 60, 75, 90].map(m => `<button data-v="${m}" class="${gen.minutes === m ? "on" : ""}">${m}</button>`).join("")}</div></div>
      <div><div class="gen-sub">Matériel</div>
        <div class="seg gen-seg" id="g-eq">${[["gym", "Salle"], ["db", "Haltères"], ["home", "Rien"]].map(([v, l]) => `<button data-v="${v}" class="${gen.equipment === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
    </div>
    <div class="gen-lab"><span class="gen-n">2</span>C'est parti</div>
    <button class="btn btn-primary btn-block gen-go" id="g-go">${I.sparkle} Générer la séance <span class="gen-go-sum" id="g-sum">· ${sum}</span></button>
  </section>`;
}

// Regroupe les exercices liés (superset / circuit) pour les afficher ensemble.
function builder() {
  const L = draft.exercises, out = [];
  for (let i = 0; i < L.length;) {
    const ss = L[i].ss;
    let j = i + 1;
    if (ss) while (j < L.length && L[j].ss === ss) j++;
    if (j - i > 1) {
      const circ = ss === "C";
      out.push(`<div class="ss-group ${circ ? "circ" : ""}">
        <div class="ss-label">${circ ? IC.loop : IC.link}<b>${circ ? "Circuit" : `Superset ${ss}`}</b><span>${circ ? "repos à la fin du tour" : "enchaîne sans repos"}</span></div>
        ${L.slice(i, j).map((e, k) => row(e, i + k)).join("")}</div>`);
    } else out.push(row(L[i], i));
    i = j;
  }
  return out.join("");
}

function paneNew(pane, view, launch) {
  const total = Object.keys(EXERCISES).length, L = draft.exercises;
  const allC = L.length > 1 && L.every(e => e.ss === "C");
  const sets = L.reduce((a, e) => a + e.sets, 0);
  pane.innerHTML = `
    ${draft.id ? "" : genCard()}
    <div class="section cr-sec"><h2>${draft.id ? "Modifier la séance" : "Ta séance"}</h2>
      <span class="cr-acts">${L.length > 1 ? `<button class="chip ${allC ? "blue" : ""}" id="circuit" aria-pressed="${allC}">${IC.loop} Circuit</button>` : ""}${L.length || draft.id ? `<button class="chip" id="reset">${draft.id ? `${I.x} Annuler` : `${I.trash} Vider`}</button>` : ""}</span></div>
    <label class="cr-name"><span class="sr-only">Nom de la séance</span>${I.edit}<input class="input" id="name" placeholder="Nomme ta séance (ex. Pecs du jeudi)" value="${esc(draft.name)}" maxlength="40" autocomplete="off" enterkeyhint="done"/></label>
    ${L.length ? `<div class="cr-meta"><span>${IC.dumbbell}<b class="tnum">${L.length}</b> exercice${L.length > 1 ? "s" : ""}</span><span>${I.clock}<b class="tnum">~${estimateMinutes(draft)}</b> min</span><span><b class="tnum">${sets}</b> séries</span></div>`
      : `<div class="card empty cr-empty">${spider()}<b>Ta séance est vide</b>${draft.id ? "Ajoute des exercices pour la compléter." : "Génère-la au-dessus, ou ajoute tes exercices un par un."}</div>`}
    <div class="builder">${builder()}</div>
    <button class="add-big" id="add">${I.plus}<span>Ajouter des exercices</span><span class="add-n tnum">${total}</span></button>
    ${L.length || draft.id ? `<div class="create-foot"><div class="cf-in">
        <button class="btn btn-soft" id="save">${I.check} Enregistrer</button>
        <button class="btn btn-primary" id="save-go">${I.play} Commencer</button></div></div>` : ""}`;

  const redraw = () => paneNew(pane, view, launch);
  // générateur
  $("#g-open", pane)?.addEventListener("click", () => { genOpen = true; redraw(); enter($("#gen", pane)); });
  $("#g-close", pane)?.addEventListener("click", () => { genOpen = false; redraw(); });
  const sumEl = () => { const el = $("#g-sum", pane); if (el) el.textContent = `· ${gen.minutes} min · ${EQ_LABEL[gen.equipment] || "Salle"}`; };
  $$("[data-g]", pane).forEach(b => b.onclick = () => {
    const k = b.dataset.g;
    if (k === "full") gen.groups = new Set(gen.groups.has("full") ? [] : ["full"]);
    else { gen.groups.delete("full"); gen.groups.has(k) ? gen.groups.delete(k) : gen.groups.add(k); }
    $$("[data-g]", pane).forEach(x => { const on = gen.groups.has(x.dataset.g); x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    navigator.vibrate?.(4);
  });
  $$("#g-min button", pane).forEach(b => b.onclick = () => { gen.minutes = +b.dataset.v; $$("#g-min button", pane).forEach(x => x.classList.toggle("on", x === b)); sumEl(); });
  $$("#g-eq button", pane).forEach(b => b.onclick = () => { gen.equipment = b.dataset.v; $$("#g-eq button", pane).forEach(x => x.classList.toggle("on", x === b)); sumEl(); });
  $("#g-go", pane)?.addEventListener("click", async () => {
    if (!gen.groups.size) return toast("Choisis au moins un groupe musculaire.");
    if (draft.exercises.length && !(await confirmSheet("Remplacer ta séance ?", "Les exercices déjà ajoutés seront remplacés.", "Remplacer"))) return;
    const s = generateSession({ groups: [...gen.groups], minutes: gen.minutes, equipment: gen.equipment });
    draft = { ...draft, name: draft.name || s.name, tag: s.tag, exercises: s.exercises };
    open = -1; genOpen = false; redraw();
    enter($(".builder", pane));
    spidey.say(`Voilà ${s.exercises.length} exercices. Touche-en un pour régler séries, reps et poids.`, { mood: "happy" });
  });
  // nom
  $("#name", pane).oninput = e => (draft.name = e.target.value);
  $("#name", pane).onkeydown = e => { if (e.key === "Enter") e.target.blur(); };
  // lignes : ouverture sur place (le chevron pivote, le détail glisse), sans tout reconstruire
  const setOpen = (k, scroll) => {
    const el = pane.querySelector(`.bex[data-row="${k}"]`);
    if (!el) return;
    const on = open === k;
    el.classList.toggle("open", on);
    $(".bex-head", el).setAttribute("aria-expanded", on);
    $(".bex-body", el)?.remove();
    if (on) {
      el.insertAdjacentHTML("beforeend", body(draft.exercises[k], k));
      mountAnims(el); bindBody(el);
      if (scroll) requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" }));
    }
  };
  $$(".bex-head", pane).forEach(h => h.onclick = () => {
    const i = +h.dataset.i, prev = open;
    open = open === i ? -1 : i;
    if (prev >= 0) setOpen(prev);
    if (open >= 0) setOpen(open, true);
  });
  const bindBody = scope => {
    $$("[data-st]", scope).forEach(b => b.onclick = () => {
      const i = +b.dataset.i, e = draft.exercises[i], k = b.dataset.st, d = +b.dataset.d;
      const ex = EXERCISES[e.id] || {};
      if (k === "sets") e.sets = Math.max(1, Math.min(10, e.sets + d));
      if (k === "min") { e.reps = [Math.max(1, e.reps[0] + d), e.reps[1]]; if (e.reps[0] > e.reps[1]) e.reps[1] = e.reps[0]; }
      if (k === "max") { e.reps = [e.reps[0], Math.max(e.reps[0], e.reps[1] + d)]; }
      if (k === "weight") e.weight = Math.max(0, +(e.weight + d * (ex.step || 2.5)).toFixed(2));
      if (k === "rest") e.rest = Math.max(10, Math.min(600, e.rest + d));
      navigator.vibrate?.(5);
      const box = b.closest(".bex"), v = box.querySelector(`[data-v="${k}"]`);
      v.textContent = k === "min" || k === "max" ? (k === "min" ? e.reps[0] : e.reps[1]) : e[k];
      bump(v);
      if (k === "min") box.querySelector('[data-v="max"]').textContent = e.reps[1];
      box.querySelector(".bex-sum").textContent = summary(e);
      if (k === "sets" || k === "rest" || k === "min" || k === "max") updMeta();
    });
    $$("[data-act]", scope).forEach(b => b.onclick = () => {
      const i = +b.dataset.i, a = b.dataset.act, list = draft.exercises;
      if (a === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; open = i - 1; }
      if (a === "down" && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; open = i + 1; }
      if (a === "del") { list.splice(i, 1); open = -1; }
      if (a === "link") toggleLink(i);
      if (a === "swap") return pickExercises(ids => { if (ids[0]) { list[i] = { ...defaultItem(ids[0]), sets: list[i].sets, ss: list[i].ss }; redraw(); } }, { single: true, title: "Remplacer par…" });
      redraw();
    });
  };
  const updMeta = () => {
    const m = $(".cr-meta", pane); if (!m) return;
    const b = $$("b", m);
    b[1].textContent = `~${estimateMinutes(draft)}`;
    b[2].textContent = draft.exercises.reduce((a, e) => a + e.sets, 0);
  };
  bindBody(pane);
  mountAnims(pane);
  $("#add", pane).onclick = () => pickExercises(ids => { ids.forEach(id => draft.exercises.push(defaultItem(id))); open = -1; redraw(); });
  $("#save", pane)?.addEventListener("click", () => { const p = persist(); if (p) { toast(`« ${p.name} » enregistrée ✓`); draft = blank(); genOpen = true; tab = "mine"; renderCreate(view, launch); } });
  $("#save-go", pane)?.addEventListener("click", () => { const p = persist(); if (p) { draft = blank(); genOpen = true; tab = "mine"; renderCreate(view, launch); openProgram({ ...p, cat: "custom" }, launch); } });
  $("#circuit", pane)?.addEventListener("click", () => {
    const all = draft.exercises.every(e => e.ss === "C");
    draft.exercises.forEach(e => (e.ss = all ? null : "C"));
    if (!all) toast("Circuit : tous les exercices s'enchaînent, repos à la fin de chaque tour.");
    redraw();
  });
  $("#reset", pane)?.addEventListener("click", async () => {
    if (!draft.id && draft.exercises.length > 2 && !(await confirmSheet("Vider ta séance ?", "Tous les exercices ajoutés seront retirés.", "Vider", true))) return;
    draft = blank(); open = -1; genOpen = true; renderCreate(view, launch);
  });
}

const linked = i => draft.exercises[i]?.ss && draft.exercises[i + 1]?.ss === draft.exercises[i].ss;
// Superset : deux exercices (ou plus) enchaînés sans repos, repos à la fin du tour.
function toggleLink(i) {
  const list = draft.exercises;
  if (linked(i)) {
    const letter = list[i].ss;
    list[i + 1].ss = list[i + 2]?.ss === letter ? list[i + 1].ss : null;
    if (!list[i - 1] || list[i - 1].ss !== letter) list[i].ss = list[i + 1].ss === letter ? letter : null;
  } else {
    const used = new Set(list.map(e => e.ss).filter(Boolean));
    const letter = list[i].ss || list[i + 1].ss || "ABCDEFGH".split("").find(l => !used.has(l));
    list[i].ss = list[i + 1].ss = letter;
  }
}

function summary(e) {
  const ex = EXERCISES[e.id];
  return `${e.sets} × ${e.reps[0]}–${e.reps[1]}${unit(e) ? " s" : ""}${ex?.type === "load" ? ` · ${e.weight} kg` : ""} · repos ${e.rest} s`;
}

function row(e, i) {
  const ex = EXERCISES[e.id] || { name: e.id };
  const grouped = e.ss && (draft.exercises[i - 1]?.ss === e.ss || draft.exercises[i + 1]?.ss === e.ss);
  return `<div class="bex ${open === i ? "open" : ""}" data-row="${i}">
    <button class="bex-head" data-i="${i}" aria-expanded="${open === i}"><span class="k tnum ${grouped ? "ss" : ""}">${i + 1}</span>
      <span class="grow"><b class="ellipsis">${esc(ex.name)}</b><span class="bex-sum ellipsis">${summary(e)}</span></span><span class="bex-chev">${I.down}</span></button>
    ${open === i ? body(e, i) : ""}
  </div>`;
}

function body(e, i) {
  const ex = EXERCISES[e.id] || { name: e.id, muscle: "?", equip: "bw", type: "bw" };
  const t = ex.type === "time";
  const st = (k, label, val, d = 1) => `<div class="mstep"><span>${label}</span><div>
    <button data-st="${k}" data-i="${i}" data-d="${-d}" aria-label="${label} : moins">${I.minus}</button><b class="tnum" data-v="${k}">${val}</b>
    <button data-st="${k}" data-i="${i}" data-d="${d}" aria-label="${label} : plus">${I.plus}</button></div></div>`;
  const last = i >= draft.exercises.length - 1;
  return `<div class="bex-body">
      <div class="bex-info">${ex.custom ? `<span class="bex-ph">${IC.dumbbell}</span>` : animSvg(e.id, "bex-anim")}
        <div class="grow"><b>${esc(ex.muscle)}</b><span>${EQUIP[ex.equip] || ""}${ex.custom ? " · exercice perso" : ""}</span></div></div>
      <div class="msteps">
        ${st("sets", "Séries", e.sets)}
        ${st("min", t ? "Sec. min" : "Reps min", e.reps[0], t ? 5 : 1)}
        ${st("max", t ? "Sec. max" : "Reps max", e.reps[1], t ? 5 : 1)}
        ${ex.type === "load" ? st("weight", "Poids (kg)", e.weight) : ""}
        ${st("rest", "Repos (s)", e.rest, 15)}
      </div>
      <div class="bex-tools">
        <button class="btn btn-soft btn-sm" data-act="swap" data-i="${i}">${I.swap} Remplacer</button>
        ${last ? "" : `<button class="btn btn-sm ${linked(i) ? "btn-blue" : "btn-soft"}" data-act="link" data-i="${i}" aria-pressed="${!!linked(i)}">${linked(i) ? `${IC.unlink} Délier` : `${IC.link} Superset`}</button>`}
      </div>
      <div class="bex-tools2">
        <button class="icon-btn" data-act="up" data-i="${i}" aria-label="Monter" ${i ? "" : "disabled"}>${I.up}</button>
        <button class="icon-btn" data-act="down" data-i="${i}" aria-label="Descendre" ${last ? "disabled" : ""}>${I.down}</button>
        <button class="btn btn-sm bex-del" data-act="del" data-i="${i}">${I.trash} Retirer</button>
      </div></div>`;
}

export function defaultItem(id) {
  const g = GOALS[state.profile.goal] || GOALS.muscle;
  const ex = EXERCISES[id];
  if (ex.type === "time") {
    const mob = ex.muscle === "Mobilité", machine = ex.equip === "machine" && ex.muscle === "Cardio";
    return { id, sets: machine ? 1 : 3, reps: machine ? [300, 600] : mob ? [40, 60] : [30, 45], weight: 0, rest: mob ? 10 : 45, rpe: mob ? 5 : 7 };
  }
  const defW = { machine: 20, cable: 10, bar: 20, smith: 20, db: 10, kb: 12 }[ex.equip] || 0;
  return { id, sets: 3, reps: g.accReps, weight: ex.type === "load" ? state.lifts[id]?.weight || defW : 0, rest: g.accRest + 15, rpe: g.rpe };
}

function persist() {
  const name = (draft.name || "").trim();
  if (!draft.exercises.length) { toast("Ajoute au moins un exercice."); return null; }
  if (!name) { toast("Donne un nom à ta séance."); $("#name")?.focus(); return null; }
  const muscles = [...new Set(draft.exercises.map(e => EXERCISES[e.id]?.muscle).filter(Boolean))].slice(0, 3).join(" · ");
  const data = { name: name.slice(0, 40), tag: muscles, exercises: structuredClone(draft.exercises) };
  let p = draft.id && state.customPrograms.find(x => x.id === draft.id);
  if (p) Object.assign(p, data);
  else { p = { id: "c" + Date.now(), accent: Math.random() < 0.5 ? "red" : "blue", ...data }; state.customPrograms.push(p); }
  save();
  spidey.react("party");
  return p;
}

/* ---------- Mes séances ---------- */
function paneMine(pane, view, launch) {
  const list = state.customPrograms;
  const exName = id => EXERCISES[id]?.name || id;
  pane.innerHTML = list.length ? `<div class="mine-list stagger mt">${list.map(p => {
    const shown = p.exercises.slice(0, 3), more = p.exercises.length - shown.length;
    return `<article class="card mine-card ${p.accent === "blue" ? "blue" : ""}">
      <div class="mine-top">
        <span class="mine-ic">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>
        <div class="grow"><h3 class="ellipsis">${esc(p.name)}</h3>
          <div class="mine-meta"><span class="tnum">${p.exercises.length} exo${p.exercises.length > 1 ? "s" : ""}</span><span class="tnum">~${estimateMinutes(p)} min</span>${p.tag ? `<span class="ellipsis">${esc(p.tag)}</span>` : ""}</div></div>
      </div>
      ${shown.length ? `<div class="mine-ex">${shown.map(e => `<span class="ellipsis">${esc(exName(e.id))}</span>`).join("")}${more > 0 ? `<span class="more tnum">+${more}</span>` : ""}</div>` : ""}
      <div class="mine-acts">
        <button class="btn btn-primary btn-sm" data-go="${p.id}">${I.play} Commencer</button>
        <button class="icon-btn" data-edit="${p.id}" aria-label="Modifier">${I.edit}</button>
        <button class="icon-btn" data-more="${p.id}" aria-label="Plus d'actions">${I.more}</button>
      </div>
    </article>`;
  }).join("")}
    <button class="add-big" id="first">${I.plus}<span>Nouvelle séance</span></button></div>`
    : `<div class="card empty cr-empty mt">${spider()}<b>Aucune séance perso</b>Compose ta séance idéale, ou génère-la en 2 touches. Elle t'attendra ici.
        <button class="btn btn-primary btn-sm mt" id="first">${I.plus} Créer ma première séance</button></div>`;
  $("#first", pane)?.addEventListener("click", () => { tab = "new"; renderCreate(view, launch); });
  $$("[data-go]", pane).forEach(b => b.onclick = () => openProgram({ ...state.customPrograms.find(x => x.id === b.dataset.go), cat: "custom" }, launch));
  $$("[data-edit]", pane).forEach(b => b.onclick = () => renderCreate(view, launch, { edit: b.dataset.edit }));
  $$("[data-more]", pane).forEach(b => b.onclick = () => progMenu(state.customPrograms.find(x => x.id === b.dataset.more), view, launch));
}

// Actions secondaires d'une séance perso (feuille).
function progMenu(p, view, launch) {
  if (!p) return;
  const sh = sheet(`<div class="eyebrow">Ma séance</div><h2 class="h2 ellipsis">${esc(p.name)}</h2>
    <div class="card card-list cr-menu mt">
      <button data-dup="${p.id}"><span class="mi">${IC.copy}</span><span class="grow"><b>Dupliquer</b><span>Pour créer une variante</span></span></button>
      <button data-share="${p.id}"><span class="mi">${I.send}</span><span class="grow"><b>Partager</b><span>Envoie-la à un ami</span></span></button>
      <button data-del="${p.id}" class="danger"><span class="mi">${I.trash}</span><span class="grow"><b>Supprimer</b><span>Ton historique est conservé</span></span></button>
    </div>`);
  $("[data-share]", sh.el).onclick = () => { sh.close(); shareProgram(p); };
  $("[data-dup]", sh.el).onclick = () => {
    state.customPrograms.push({ ...structuredClone(p), id: "c" + Date.now(), name: `${p.name} (copie)`.slice(0, 40) });
    save(); sh.close(); renderCreate(view, launch); toast("Séance dupliquée");
  };
  $("[data-del]", sh.el).onclick = async () => {
    sh.close();
    if (!(await confirmSheet(`Supprimer « ${p.name} » ?`, "Ton historique de séances est conservé.", "Supprimer", true))) return;
    state.customPrograms = state.customPrograms.filter(x => x.id !== p.id);
    tombstone("programs", p.id);
    Object.keys(state.weekPlan || {}).forEach(k => { if (state.weekPlan[k] === p.id) delete state.weekPlan[k]; });
    if (draft?.id === p.id) draft = blank();
    save(); renderCreate(view, launch);
  };
}

/* ---------- Mes exercices ---------- */
const TYPE = { load: ["charge", IC.dumbbell], bw: ["répétitions", I.bolt], time: ["chrono", I.clock] };
function paneEx(pane, view, launch) {
  const mine = Object.entries(state.customExercises || {});
  const total = Object.keys(EXERCISES).length;
  const byMuscle = MUSCLES.map(m => [m, Object.values(EXERCISES).filter(e => e.muscle === m).length]).filter(([, n]) => n);
  pane.innerHTML = `
    <section class="card card-hero lib-hero mt">
      <div class="lib-num"><b class="tnum">${total}</b><span>exercices<br>dans ta bibliothèque</span></div>
      <p class="small muted">Barres, haltères, machines, poulies, Smith, kettlebell, élastiques et poids du corps. Il en manque un ? Crée-le.</p>
      <button class="btn btn-primary btn-block" id="new-ex">${I.plus} Créer un exercice</button>
    </section>
    <div class="section"><h2>Mes exercices</h2>${mine.length ? `<span class="chip tnum">${mine.length}</span>` : ""}</div>
    ${mine.length ? `<div class="card card-list">${mine.map(([id, e]) => `<div class="my-ex"><span class="mi">${(TYPE[e.type] || TYPE.load)[1]}</span>
        <span class="grow"><b class="ellipsis">${esc(e.name)}</b><span class="ellipsis">${esc(e.muscle)} · ${esc(EQUIP[e.equip] || "")} · ${(TYPE[e.type] || TYPE.load)[0]}</span></span>
        <button class="icon-btn plain" data-delex="${id}" aria-label="Supprimer ${esc(e.name)}">${I.trash}</button></div>`).join("")}</div>`
      : `<div class="card empty">${IC.dumbbell}<b>Aucun exercice perso</b>Une machine de ta salle manque ? Ajoute-la : elle apparaîtra dans le choix des exercices.</div>`}
    <div class="section"><h2>Bibliothèque</h2></div>
    <div class="lib-grid">${byMuscle.map(([m, n]) => `<div class="lib-tile"><b class="tnum">${n}</b><span class="ellipsis">${esc(m)}</span></div>`).join("")}</div>`;
  $("#new-ex", pane).onclick = () => exerciseForm(() => renderCreate(view, launch));
  $$("[data-delex]", pane).forEach(b => b.onclick = async () => {
    const e = state.customExercises[b.dataset.delex];
    if (!(await confirmSheet(`Supprimer « ${e.name} » ?`, "Il sera aussi retiré de tes séances perso.", "Supprimer", true))) return;
    delete state.customExercises[b.dataset.delex];
    tombstone("exercises", b.dataset.delex);
    state.customPrograms.forEach(p => (p.exercises = p.exercises.filter(x => x.id !== b.dataset.delex)));
    syncCustomExercises(); save(); renderCreate(view, launch);
  });
}

// Formulaire de création d'exercice (aussi utilisé depuis le sélecteur).
export function exerciseForm(onDone) {
  const f = { type: "load", equip: "machine", muscle: "Pectoraux" };
  const sh = sheet(`<h2 class="h2">Nouvel exercice</h2><p class="small muted cr-form-sub">Il rejoint ta bibliothèque et se retrouve dans le choix des exercices.</p>
    <label class="field"><span>Nom</span><input class="input" id="ex-name" placeholder="Ex. Presse Hammer Strength" maxlength="40"/></label>
    <label class="field"><span>Muscle principal</span><select class="input" id="ex-muscle">${MUSCLES.map(m => `<option ${m === f.muscle ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
    <label class="field"><span>Matériel</span><select class="input" id="ex-equip">${Object.entries(EQUIP).map(([k, l]) => `<option value="${k}" ${k === f.equip ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <div class="field"><span>Ce que tu notes</span><div class="seg" id="ex-type">${[["load", "Poids × reps"], ["bw", "Reps"], ["time", "Temps"]].map(([k, l]) => `<button data-v="${k}" class="${k === f.type ? "on" : ""}">${l}</button>`).join("")}</div></div>
    <label class="field"><span>Conseil technique (facultatif)</span><input class="input" id="ex-cue" placeholder="Ex. Dos collé au dossier" maxlength="100"/></label>
    <div class="sheet-foot"><button class="btn btn-primary btn-block" id="ex-save">Créer l'exercice</button></div>`, { z: 70 });
  $$("#ex-type button", sh.el).forEach(b => b.onclick = () => { f.type = b.dataset.v; $$("#ex-type button", sh.el).forEach(x => x.classList.toggle("on", x === b)); });
  $("#ex-save", sh.el).onclick = () => {
    const name = $("#ex-name", sh.el).value.trim();
    if (!name) return toast("Donne un nom à l'exercice.");
    const id = "x" + Date.now().toString(36);
    const equip = $("#ex-equip", sh.el).value;
    const cue = $("#ex-cue", sh.el).value.trim();
    state.customExercises ||= {};
    state.customExercises[id] = {
      name, muscle: $("#ex-muscle", sh.el).value, type: f.type, equip,
      step: f.type === "time" ? 5 : f.type === "bw" ? 1 : equip === "machine" ? 5 : equip === "db" ? 2 : 2.5,
      cues: cue ? [cue] : ["Mouvement contrôlé, amplitude complète."], alts: [],
    };
    syncCustomExercises(); save(); sh.close();
    toast(`« ${name} » ajouté à la bibliothèque`);
    onDone?.(id);
  };
  setTimeout(() => $("#ex-name", sh.el)?.focus(), 350);
}
