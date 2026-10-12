// Onglet Créer : l'atelier pour composer, générer, modifier et enregistrer ses séances,
// et créer ses propres exercices.
import { EXERCISES, EQUIP, MUSCLES, GOALS } from "./data.js";
import { state, save, syncCustomExercises } from "./store.js";
import { generateSession, GROUPS, estimateMinutes } from "./planner.js";
import { pickExercises, openProgram } from "./train.js";
import { spidey } from "./spidey.js";
import { shareProgram } from "./social.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

let tab = "new", draft = null, open = -1;
const gen = { groups: new Set(["pecs"]), minutes: 45, equipment: null };
const blank = () => ({ id: null, name: "", exercises: [] });
const unit = e => (EXERCISES[e.id]?.type === "time" ? "s" : "");

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
  view.innerHTML = `
    <div class="eyebrow">Atelier</div><h1 class="h1">Créer</h1>
    <div class="seg mt" id="tabs">
      <button data-t="new" class="${tab === "new" ? "on" : ""}">${draft.id ? "Modifier" : "Nouvelle"}</button>
      <button data-t="mine" class="${tab === "mine" ? "on" : ""}">Mes séances${nMine ? ` · ${nMine}` : ""}</button>
      <button data-t="ex" class="${tab === "ex" ? "on" : ""}">Exercices${nEx ? ` · ${nEx}` : ""}</button>
    </div>
    <div id="pane"></div>`;
  $$("#tabs button", view).forEach(b => b.onclick = () => { tab = b.dataset.t; renderCreate(view, launch); });
  const pane = $("#pane", view);
  ({ new: paneNew, mine: paneMine, ex: paneEx })[tab](pane, view, launch);
}

/* ---------- Nouvelle séance / modification ---------- */
function paneNew(pane, view, launch) {
  const total = Object.keys(EXERCISES).length;
  pane.innerHTML = `
    ${draft.id ? "" : `<section class="card card-hero mt">
      <div class="row between"><div><div class="eyebrow">Gagne du temps</div><h2 class="h3" style="margin-top:2px">Générer pour moi</h2></div><span class="gen-ic">${I.sparkle}</span></div>
      <div class="chips mt-s" id="g-groups" style="flex-wrap:wrap;margin:10px 0 0;padding:0">${[...Object.entries(GROUPS).map(([k, g]) => [k, g.name]), ["full", "Full body"]].map(([k, n]) => `<button class="chip ${gen.groups.has(k) ? "on" : ""}" data-g="${k}">${n}</button>`).join("")}</div>
      <div class="small muted mt">Durée</div>
      <div class="seg mt-s" id="g-min">${[20, 30, 45, 60, 75, 90].map(m => `<button data-v="${m}" class="${gen.minutes === m ? "on" : ""}">${m}</button>`).join("")}</div>
      <div class="small muted mt">Matériel</div>
      <div class="seg mt-s" id="g-eq">${[["gym", "Salle"], ["db", "Haltères"], ["home", "Rien"]].map(([v, l]) => `<button data-v="${v}" class="${gen.equipment === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <button class="btn btn-primary btn-block mt" id="g-go">${I.sparkle} Générer la séance</button>
    </section>`}

    <div class="section"><h2>${draft.id ? "Modifier la séance" : "Ta séance"}</h2><span class="row" style="gap:14px">${draft.exercises.length > 1 ? `<button id="circuit">${draft.exercises.every(e => e.ss === "C") ? "Mode normal" : "Tout en circuit"}</button>` : ""}${draft.exercises.length || draft.id ? `<button id="reset">${draft.id ? "Annuler" : "Vider"}</button>` : ""}</span></div>
    ${draft.exercises.length ? `<div class="xs muted" style="margin:-6px 2px 10px">${draft.exercises.length} exercices · ~${estimateMinutes(draft)} min</div>` : ""}
    <label class="field" style="margin-top:0"><input class="input" id="name" placeholder="Nom de la séance (ex. Pecs du jeudi)" value="${esc(draft.name)}" maxlength="40"/></label>
    <div class="builder mt">${draft.exercises.map(row).join("")}</div>
    <button class="add-big mt" id="add">${I.plus} Ajouter des exercices <span class="dim">· ${total} disponibles</span></button>

    <div class="create-foot">
      ${draft.exercises.length || draft.id ? `<div class="grid2">
        <button class="btn btn-soft" id="save">${draft.id ? "Enregistrer" : "Enregistrer"}</button>
        <button class="btn btn-primary" id="save-go">${I.play} Commencer</button></div>` : ""}
    </div>`;

  const redraw = () => paneNew(pane, view, launch);
  // générateur
  $$("[data-g]", pane).forEach(b => b.onclick = () => {
    const k = b.dataset.g;
    if (k === "full") gen.groups = new Set(gen.groups.has("full") ? [] : ["full"]);
    else { gen.groups.delete("full"); gen.groups.has(k) ? gen.groups.delete(k) : gen.groups.add(k); }
    $$("[data-g]", pane).forEach(x => x.classList.toggle("on", gen.groups.has(x.dataset.g)));
  });
  $$("#g-min button", pane).forEach(b => b.onclick = () => { gen.minutes = +b.dataset.v; $$("#g-min button", pane).forEach(x => x.classList.toggle("on", x === b)); });
  $$("#g-eq button", pane).forEach(b => b.onclick = () => { gen.equipment = b.dataset.v; $$("#g-eq button", pane).forEach(x => x.classList.toggle("on", x === b)); });
  $("#g-go", pane)?.addEventListener("click", async () => {
    if (!gen.groups.size) return toast("Choisis au moins un groupe musculaire.");
    if (draft.exercises.length && !(await confirmSheet("Remplacer ta séance ?", "Les exercices déjà ajoutés seront remplacés.", "Remplacer"))) return;
    const s = generateSession({ groups: [...gen.groups], minutes: gen.minutes, equipment: gen.equipment });
    draft = { ...draft, name: draft.name || s.name, tag: s.tag, exercises: s.exercises };
    open = -1; redraw();
    spidey.say(`Voilà ${s.exercises.length} exercices. Touche-en un pour régler séries, reps et poids.`, { mood: "happy" });
  });
  // nom
  $("#name", pane).oninput = e => (draft.name = e.target.value);
  // lignes
  $$(".bex-head", pane).forEach(h => h.onclick = () => { const i = +h.dataset.i; open = open === i ? -1 : i; redraw(); });
  $$("[data-st]", pane).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, e = draft.exercises[i], k = b.dataset.st, d = +b.dataset.d;
    const ex = EXERCISES[e.id];
    if (k === "sets") e.sets = Math.max(1, Math.min(10, e.sets + d));
    if (k === "min") { e.reps = [Math.max(1, e.reps[0] + d), e.reps[1]]; if (e.reps[0] > e.reps[1]) e.reps[1] = e.reps[0]; }
    if (k === "max") { e.reps = [e.reps[0], Math.max(e.reps[0], e.reps[1] + d)]; }
    if (k === "weight") e.weight = Math.max(0, +(e.weight + d * (ex.step || 2.5)).toFixed(2));
    if (k === "rest") e.rest = Math.max(10, Math.min(600, e.rest + d));
    navigator.vibrate?.(5);
    const box = b.closest(".bex");
    box.querySelector(`[data-v="${k}"]`).textContent = k === "min" || k === "max" ? (k === "min" ? e.reps[0] : e.reps[1]) : e[k];
    if (k === "min") box.querySelector('[data-v="max"]').textContent = e.reps[1];
    box.querySelector(".bex-sum").textContent = summary(e);
  });
  $$("[data-act]", pane).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, a = b.dataset.act, list = draft.exercises;
    if (a === "up" && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; open = i - 1; }
    if (a === "down" && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; open = i + 1; }
    if (a === "del") { list.splice(i, 1); open = -1; }
    if (a === "link") toggleLink(i);
    if (a === "swap") return pickExercises(ids => { if (ids[0]) { list[i] = { ...defaultItem(ids[0]), sets: list[i].sets }; redraw(); } }, { single: true, title: "Remplacer par…" });
    redraw();
  });
  $("#add", pane).onclick = () => pickExercises(ids => { ids.forEach(id => draft.exercises.push(defaultItem(id))); open = -1; redraw(); });
  $("#save", pane)?.addEventListener("click", () => { const p = persist(); if (p) { toast(`« ${p.name} » enregistrée ✓`); draft = blank(); tab = "mine"; renderCreate(view, launch); } });
  $("#save-go", pane)?.addEventListener("click", () => { const p = persist(); if (p) { draft = blank(); tab = "mine"; renderCreate(view, launch); openProgram({ ...p, cat: "custom" }, launch); } });
  $("#circuit", pane)?.addEventListener("click", () => {
    const all = draft.exercises.every(e => e.ss === "C");
    draft.exercises.forEach(e => (e.ss = all ? null : "C"));
    if (!all) toast("Circuit : tous les exercices s'enchaînent, repos à la fin de chaque tour.");
    redraw();
  });
  $("#reset", pane)?.addEventListener("click", () => { draft = blank(); open = -1; renderCreate(view, launch); });
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
  const ex = EXERCISES[e.id] || { name: e.id, muscle: "?", equip: "bw", type: "bw" };
  const st = (k, label, val) => `<div class="mstep"><span>${label}</span><div><button data-st="${k}" data-i="${i}" data-d="-1">−</button><b data-v="${k}">${val}</b><button data-st="${k}" data-i="${i}" data-d="1">+</button></div></div>`;
  const stR = (k, label, val) => `<div class="mstep"><span>${label}</span><div><button data-st="${k}" data-i="${i}" data-d="${ex.type === "time" ? -5 : -1}">−</button><b data-v="${k}">${val}</b><button data-st="${k}" data-i="${i}" data-d="${ex.type === "time" ? 5 : 1}">+</button></div></div>`;
  return `<div class="bex ${open === i ? "open" : ""}">
    <button class="bex-head" data-i="${i}"><span class="k ${e.ss ? "ss" : ""}">${e.ss || i + 1}</span>
      <div class="grow"><b class="ellipsis">${esc(ex.name)}</b><span class="bex-sum">${summary(e)}</span></div>${open === i ? I.up : I.down}</button>
    ${open === i ? `<div class="bex-body">
      <div class="xs muted">${esc(ex.muscle)} · ${EQUIP[ex.equip] || ""}${ex.custom ? " · perso" : ""}</div>
      <div class="msteps">
        ${st("sets", "Séries", e.sets)}
        ${stR("min", ex.type === "time" ? "Sec. min" : "Reps min", e.reps[0])}
        ${stR("max", ex.type === "time" ? "Sec. max" : "Reps max", e.reps[1])}
        ${ex.type === "load" ? st("weight", "Poids (kg)", e.weight) : ""}
        <div class="mstep"><span>Repos (s)</span><div><button data-st="rest" data-i="${i}" data-d="-15">−</button><b data-v="rest">${e.rest}</b><button data-st="rest" data-i="${i}" data-d="15">+</button></div></div>
      </div>
      <div class="row mt-s" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-soft btn-sm" data-act="up" data-i="${i}">${I.up}</button>
        <button class="btn btn-soft btn-sm" data-act="down" data-i="${i}">${I.down}</button>
        <button class="btn btn-soft btn-sm" data-act="swap" data-i="${i}">${I.swap} Remplacer</button>
        ${i < draft.exercises.length - 1 ? `<button class="btn btn-soft btn-sm" data-act="link" data-i="${i}">${linked(i) ? "Délier" : "Superset avec le suivant"}</button>` : ""}
        <button class="btn btn-danger btn-sm" data-act="del" data-i="${i}">${I.trash} Retirer</button>
      </div></div>` : ""}
  </div>`;
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
  pane.innerHTML = list.length ? `<div class="prog-list mt">${list.map(p => `
    <article class="card prog ${p.accent === "blue" ? "blue" : ""}" style="grid-template-columns:1fr">
      <div><h3>${esc(p.name)}</h3><div class="muted small">${esc(p.tag || "")}</div>
        <div class="dim xs mt-s">${p.exercises.length} exercices · ~${estimateMinutes(p)} min</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-go="${p.id}">${I.play} Commencer</button>
        <button class="btn btn-soft btn-sm" data-edit="${p.id}">${I.edit} Modifier</button>
        <button class="btn btn-soft btn-sm" data-dup="${p.id}">Dupliquer</button>
        <button class="btn btn-soft btn-sm" data-share="${p.id}">${I.send} Partager</button>
        <button class="icon-btn" data-del="${p.id}" aria-label="Supprimer" style="width:38px;height:38px">${I.trash}</button>
      </div>
    </article>`).join("")}</div>`
    : `<div class="card empty mt">${I.plus}Aucune séance perso pour l'instant.<br><button class="btn btn-primary btn-sm mt" id="first">Créer ma première séance</button></div>`;
  $("#first", pane)?.addEventListener("click", () => { tab = "new"; renderCreate(view, launch); });
  $$("[data-go]", pane).forEach(b => b.onclick = () => openProgram({ ...state.customPrograms.find(x => x.id === b.dataset.go), cat: "custom" }, launch));
  $$("[data-edit]", pane).forEach(b => b.onclick = () => renderCreate(view, launch, { edit: b.dataset.edit }));
  $$("[data-share]", pane).forEach(b => b.onclick = () => shareProgram(state.customPrograms.find(x => x.id === b.dataset.share)));
  $$("[data-dup]", pane).forEach(b => b.onclick = () => {
    const p = state.customPrograms.find(x => x.id === b.dataset.dup);
    state.customPrograms.push({ ...structuredClone(p), id: "c" + Date.now(), name: `${p.name} (copie)`.slice(0, 40) });
    save(); renderCreate(view, launch); toast("Séance dupliquée");
  });
  $$("[data-del]", pane).forEach(b => b.onclick = async () => {
    const p = state.customPrograms.find(x => x.id === b.dataset.del);
    if (!(await confirmSheet(`Supprimer « ${p.name} » ?`, "Ton historique de séances est conservé.", "Supprimer", true))) return;
    state.customPrograms = state.customPrograms.filter(x => x.id !== p.id);
    Object.keys(state.weekPlan || {}).forEach(k => { if (state.weekPlan[k] === p.id) delete state.weekPlan[k]; });
    if (draft?.id === p.id) draft = blank();
    save(); renderCreate(view, launch);
  });
}

/* ---------- Mes exercices ---------- */
function paneEx(pane, view, launch) {
  const mine = Object.entries(state.customExercises || {});
  const byMuscle = MUSCLES.map(m => [m, Object.values(EXERCISES).filter(e => e.muscle === m).length]).filter(([, n]) => n);
  pane.innerHTML = `
    <p class="small muted mt">La bibliothèque contient <b style="color:var(--text)">${Object.keys(EXERCISES).length} exercices</b> : barres, haltères, machines, poulies, Smith, kettlebell, élastiques et poids du corps. Il en manque un ? Crée-le.</p>
    <button class="btn btn-primary btn-block" id="new-ex">${I.plus} Créer un exercice</button>
    <div class="section"><h2>Mes exercices</h2></div>
    ${mine.length ? `<div class="card" style="padding:4px 16px">${mine.map(([id, e]) => `<div class="cmp"><span><b>${esc(e.name)}</b><br><span class="xs muted">${esc(e.muscle)} · ${EQUIP[e.equip]} · ${{ load: "charge", bw: "répétitions", time: "chrono" }[e.type]}</span></span><span></span>
      <button class="icon-btn" data-delex="${id}" aria-label="Supprimer" style="width:36px;height:36px">${I.trash}</button></div>`).join("")}</div>`
      : `<div class="card empty">Aucun exercice perso.</div>`}
    <div class="section"><h2>Bibliothèque</h2></div>
    <div class="card" style="padding:4px 16px">${byMuscle.map(([m, n]) => `<div class="cmp"><span>${esc(m)}</span><span class="small muted">${n} exercices</span><span></span></div>`).join("")}</div>`;
  $("#new-ex", pane).onclick = () => exerciseForm(() => renderCreate(view, launch));
  $$("[data-delex]", pane).forEach(b => b.onclick = async () => {
    const e = state.customExercises[b.dataset.delex];
    if (!(await confirmSheet(`Supprimer « ${e.name} » ?`, "Il sera aussi retiré de tes séances perso.", "Supprimer", true))) return;
    delete state.customExercises[b.dataset.delex];
    state.customPrograms.forEach(p => (p.exercises = p.exercises.filter(x => x.id !== b.dataset.delex)));
    syncCustomExercises(); save(); renderCreate(view, launch);
  });
}

// Formulaire de création d'exercice (aussi utilisé depuis le sélecteur).
export function exerciseForm(onDone) {
  const f = { type: "load", equip: "machine", muscle: "Pectoraux" };
  const sh = sheet(`<h2 class="h2">Nouvel exercice</h2>
    <label class="field"><span>Nom</span><input class="input" id="ex-name" placeholder="Ex. Presse Hammer Strength" maxlength="40"/></label>
    <label class="field"><span>Muscle principal</span><select class="input" id="ex-muscle">${MUSCLES.map(m => `<option ${m === f.muscle ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
    <label class="field"><span>Matériel</span><select class="input" id="ex-equip">${Object.entries(EQUIP).map(([k, l]) => `<option value="${k}" ${k === f.equip ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <div class="field"><span>On mesure</span><div class="seg" id="ex-type">${[["load", "Poids × reps"], ["bw", "Reps"], ["time", "Temps"]].map(([k, l]) => `<button data-v="${k}" class="${k === f.type ? "on" : ""}">${l}</button>`).join("")}</div></div>
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
