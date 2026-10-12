// Onglet Séances : liste des programmes, aperçu modifiable, check-in, création de séances.
import { EXERCISES, CATEGORIES, GOALS, EQUIP } from "./data.js";
import { defaultItem, exerciseForm } from "./create.js";
import { shareProgram } from "./social.js";
import { state, save, allPrograms } from "./store.js";
import { adaptToGoal, estimateMinutes, todaysMission } from "./planner.js";
import { readinessScore, readinessVerdict } from "./engine.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

let filter = "all";
const fmtReps = e => (EXERCISES[e.id].type === "time" ? `${e.reps[0]}–${e.reps[1]} s` : `${e.reps[0]}–${e.reps[1]}`);

export function renderTrain(view, startLive) {
  const progs = allPrograms().filter(p => filter === "all" || p.cat === filter);
  const today = todaysMission().program?.id;
  view.innerHTML = `
    <div class="row between"><div><div class="eyebrow">Bibliothèque</div><h1 class="h1">Séances</h1></div>
      <span class="chip">${allPrograms().length} programmes</span></div>
    <div class="chips mt">${CATEGORIES.map(c => `<button class="chip ${filter === c.id ? "on" : ""}" data-f="${c.id}">${c.name}</button>`).join("")}</div>
    <button class="card tap free-card mt" id="free-start"><span class="bi">${I.bolt}</span><div class="grow" style="text-align:left"><b>Séance libre</b><div class="xs muted">Choisis tes exercices au fur et à mesure</div></div><span class="chev">${I.chev}</span></button>
    <div class="prog-list mt">
      ${progs.length ? progs.map(p => `
        <article class="card tap prog ${p.accent === "blue" ? "blue" : ""}" data-id="${p.id}">
          <div class="grow">
            <div class="row" style="gap:8px"><h3>${esc(p.name)}</h3>${p.id === today ? `<span class="chip red" style="height:22px;font-size:11px">Aujourd'hui</span>` : ""}</div>
            <div class="muted small">${esc(p.tag || "")}</div>
            <div class="dim xs mt-s">${p.exercises.length} exercices · ~${estimateMinutes(p)} min</div>
          </div>
          <div class="chev">${I.chev}</div>
        </article>`).join("") : `<div class="card empty">${I.plus}Aucune séance perso pour l'instant.<br>Crée la tienne avec le bouton +.</div>`}
    </div>
    <button class="fab" aria-label="Créer une séance">${I.plus}</button>`;
  $$("[data-f]", view).forEach(b => b.onclick = () => { filter = b.dataset.f; renderTrain(view, startLive); });
  $$(".prog", view).forEach(el => el.onclick = () => openProgram(allPrograms().find(p => p.id === el.dataset.id), startLive, () => renderTrain(view, startLive)));
  $(".fab", view).onclick = () => (location.hash = "#/create");
  $("#free-start", view).onclick = () => window.dispatchEvent(new CustomEvent("greatness:start", { detail: "free" }));
}

/* ---------- Liste d'exercices modifiable (aperçu & création) ---------- */
function exList(list, host, onChange) {
  host.innerHTML = list.length ? list.map((e, i) => `
    <div class="ex-row">
      <div class="grow"><div style="font-weight:600" class="ellipsis">${esc(EXERCISES[e.id].name)}</div>
        <div class="xs muted">${e.sets} × ${fmtReps(e)} · repos ${e.rest} s${e.weight ? ` · ${e.weight} kg` : ""}</div></div>
      <div class="tools">
        <button class="icon-btn" data-a="minus" data-i="${i}" aria-label="Moins de séries">${I.minus}</button>
        <button class="icon-btn" data-a="plus" data-i="${i}" aria-label="Plus de séries">${I.plus}</button>
        <button class="icon-btn" data-a="up" data-i="${i}" aria-label="Monter" ${i === 0 ? "disabled style='opacity:.3'" : ""}>${I.up}</button>
        <button class="icon-btn" data-a="del" data-i="${i}" aria-label="Retirer">${I.trash}</button>
      </div>
    </div>`).join("") : `<div class="empty">Ajoute des exercices pour composer ta séance.</div>`;
  $$("[data-a]", host).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, a = b.dataset.a;
    if (a === "minus") list[i].sets = Math.max(1, list[i].sets - 1);
    if (a === "plus") list[i].sets = Math.min(8, list[i].sets + 1);
    if (a === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (a === "del") list.splice(i, 1);
    exList(list, host, onChange);
    onChange?.();
  });
}

/* ---------- Aperçu d'un programme ---------- */
export function openProgram(program, startLive, refresh) {
  const base = adaptToGoal(program);
  const work = structuredClone(base.exercises);
  let edited = false;
  const custom = program.cat === "custom";
  const sh = sheet(`
    <div class="eyebrow">${custom ? "Ma séance" : CATEGORIES.find(c => c.id === program.cat)?.name || ""}</div>
    <h2 class="h1" style="font-size:28px;margin-top:4px">${esc(program.name)}</h2>
    <div class="muted small">${esc(program.tag || "")}</div>
    <div class="row mt" style="gap:6px;flex-wrap:wrap" id="meta"></div>
    <div class="section" style="margin-top:20px"><h2>Exercices</h2><button id="add">+ Ajouter</button></div>
    <div id="list"></div>
    <div class="sheet-foot">
      <button class="btn btn-primary btn-lg btn-block" id="start">${I.play} Commencer</button>
      <div class="grid2 mt-s" id="extra"></div>
    </div>`);
  const meta = () => {
    const p = { ...base, exercises: work };
    $("#meta", sh.el).innerHTML = `<span class="chip">${I.clock} ~${estimateMinutes(p)} min</span><span class="chip">${work.length} exercices</span>
      ${program.simple || program.cat === "cardio" || custom ? "" : `<span class="chip blue">${GOALS[state.profile.goal].name}</span>`}`;
    $("#extra", sh.el).innerHTML = custom
      ? `<button class="btn btn-soft btn-sm" id="edit-c">${I.edit} Modifier</button><button class="btn btn-soft btn-sm" id="share-c">${I.send} Partager</button>`
      : edited ? `<button class="btn btn-soft btn-sm" id="save-new" style="grid-column:span 2">Enregistrer comme ma séance</button>` : "";
    $("#share-c", sh.el)?.addEventListener("click", () => shareProgram(program));
    $("#edit-c", sh.el)?.addEventListener("click", () => { sh.close(); location.hash = `#/create?edit=${program.id}`; });
    $("#del-c", sh.el)?.addEventListener("click", async () => {
      if (!(await confirmSheet("Supprimer cette séance ?", "Ton historique est conservé.", "Supprimer", true))) return;
      state.customPrograms = state.customPrograms.filter(x => x.id !== program.id); save(); sh.close(); refresh?.(); toast("Séance supprimée");
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
function checkIn(sh, program, startLive) {
  const vals = { sleep: 4, energy: 3, soreness: 2 };
  const rows = [
    ["sleep", "Sommeil", ["Très mauvais", "Mauvais", "Correct", "Bon", "Excellent"]],
    ["energy", "Énergie", ["À plat", "Faible", "Moyenne", "Bonne", "Au top"]],
    ["soreness", "Courbatures", ["Aucune", "Légères", "Moyennes", "Fortes", "Partout"]],
  ];
  sh.el.innerHTML = `<div class="grab"></div>
    <button class="btn btn-ghost btn-sm" id="back" style="margin-left:-10px">${I.back} Retour</button>
    <h2 class="h2 mt-s">Comment tu te sens ?</h2>
    <p class="muted small">Ton coach adapte les charges et le volume à ta forme du jour.</p>
    ${rows.map(([k, lab]) => `<div class="check-row"><div class="lab">${lab}<span id="l-${k}"></span></div>
      <div class="seg" data-k="${k}">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div></div>`).join("")}
    <div class="verdict" id="verdict"></div>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="ci-go">${I.play} C'est parti</button></div>`;
  const upd = () => {
    rows.forEach(([k, , words]) => {
      $(`#l-${k}`, sh.el).textContent = words[vals[k] - 1];
      $$(`[data-k=${k}] button`, sh.el).forEach(b => b.classList.toggle("on", +b.dataset.v === vals[k]));
    });
    const v = readinessVerdict(readinessScore(vals));
    const icon = { up: I.bolt, info: I.check, warn: I.moon, down: I.heart }[v.tone];
    $("#verdict", sh.el).className = `verdict ${v.tone}`;
    $("#verdict", sh.el).innerHTML = `<div class="ic">${icon}</div><div><b>${v.label}</b><div class="small muted">${v.text}</div></div>`;
  };
  $$(".seg", sh.el).forEach(seg => $$("button", seg).forEach(b => b.onclick = () => { vals[seg.dataset.k] = +b.dataset.v; upd(); navigator.vibrate?.(8); }));
  upd();
  $("#back", sh.el).onclick = () => { sh.close(); openProgram(program, startLive); };
  $("#ci-go", sh.el).onclick = () => { sh.close(); startLive(program, { ...vals }); };
}

/* ---------- Choix d'exercices ---------- */
export function pickExercises(onDone, { single = false, title = "Ajouter des exercices" } = {}) {
  const sel = new Set();
  let q = "", muscle = "Tout", equip = "Tout";
  const sh = sheet(`
    <div class="row between"><h2 class="h2">${esc(title)}</h2><button class="btn btn-soft btn-sm" id="new-ex">${I.plus} Créer</button></div>
    <div class="search mt">${I.search}<input id="q" placeholder="Rechercher (ex. presse, poulie, curl…)" autocomplete="off"/></div>
    <div class="chips mt-s" id="mus"></div>
    <div class="chips mt-s" id="eqp"></div>
    <div class="xs dim mt-s" id="count"></div>
    <div id="items"></div>
    ${single ? "" : `<div class="sheet-foot"><button class="btn btn-primary btn-block" id="ok" disabled>Ajouter</button></div>`}`, { z: 60 });
  const draw = () => {
    const muscles = ["Tout", ...new Set(Object.values(EXERCISES).map(e => e.muscle))];
    $("#mus", sh.el).innerHTML = muscles.map(m => `<button class="chip ${m === muscle ? "on" : ""}" data-m="${esc(m)}">${esc(m)}</button>`).join("");
    $("#eqp", sh.el).innerHTML = ["Tout", ...Object.keys(EQUIP)].map(k => `<button class="chip ${k === equip ? "on" : ""}" data-e="${k}">${k === "Tout" ? "Tout matériel" : EQUIP[k]}</button>`).join("");
    $$("[data-m]", sh.el).forEach(b => b.onclick = () => { muscle = b.dataset.m; draw(); });
    $$("[data-e]", sh.el).forEach(b => b.onclick = () => { equip = b.dataset.e; draw(); });
    const nq = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const items = Object.entries(EXERCISES).filter(([, e]) => (muscle === "Tout" || e.muscle === muscle) && (equip === "Tout" || e.equip === equip)
      && (!nq || `${e.name} ${e.muscle} ${EQUIP[e.equip]}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(nq)));
    $("#count", sh.el).textContent = `${items.length} exercice${items.length > 1 ? "s" : ""}`;
    $("#items", sh.el).innerHTML = items.map(([id, e]) => `
      <div class="pick-item ${sel.has(id) ? "sel" : ""}" data-id="${id}"><div class="grow"><div style="font-weight:600">${esc(e.name)}${e.custom ? ` <span class="chip" style="height:20px;font-size:10.5px;padding:0 7px">perso</span>` : ""}</div>
        <div class="xs muted">${esc(e.muscle)} · ${EQUIP[e.equip] || ""}${e.type === "time" ? " · chrono" : ""}</div></div>
        <div class="add">${sel.has(id) ? I.check : single ? I.swap : I.plus}</div></div>`).join("") || `<div class="empty">Aucun résultat. Tu peux le créer avec « Créer ».</div>`;
    $$(".pick-item", sh.el).forEach(el => el.onclick = () => {
      if (single) { onDone([el.dataset.id]); return sh.close(); }
      sel.has(el.dataset.id) ? sel.delete(el.dataset.id) : sel.add(el.dataset.id); draw();
    });
    const ok = $("#ok", sh.el);
    if (ok) { ok.disabled = !sel.size; ok.textContent = sel.size ? `Ajouter ${sel.size} exercice${sel.size > 1 ? "s" : ""}` : "Ajouter"; }
  };
  $("#q", sh.el).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  $("#ok", sh.el)?.addEventListener("click", () => { onDone([...sel]); sh.close(); });
  $("#new-ex", sh.el).onclick = () => exerciseForm(id => { if (single) { onDone([id]); sh.close(); } else { sel.add(id); muscle = "Tout"; equip = "Tout"; draw(); } });
  draw();
}
