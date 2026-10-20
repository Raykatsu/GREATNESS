// Écrans « Importer depuis une autre app » et « Exporter mes données » (la logique est dans importer.js).
import { state, save, currentUser, setUser, syncCustomExercises } from "./store.js";
import { mergeData } from "./merge.js";
import { parseCSV, detectFormat, importWorkouts, importFood, importWeights, applyImport, sessionsCSV, foodCSV, backupJSON } from "./importer.js";
import { $, $$, esc, I, sheet, toast } from "./ui.js";
import { LOC } from "./i18n.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9.5 14.5 12 12l2.5 2.5"/>'),
  save: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  table: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>'),
  food: svg('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11"/>'),
};
const APPS = { strong: "Strong", hevy: "Hevy", fitbod: "Fitbod", mfp: "MyFitnessPal (repas)", weight: "pesées", greatness: "sauvegarde GREATNESS" };
// date (ms) ou jour « 2026-10-13 » (lu en heure locale)
const fmtD = t => { const [y, m, d] = typeof t === "string" ? t.split("-").map(Number) : []; return (y ? new Date(y, m - 1, d) : new Date(t)).toLocaleDateString(LOC(), { day: "numeric", month: "short", year: "numeric" }); };
const plural = (n, one, many = one + "s") => `${n.toLocaleString(LOC())} ${n > 1 ? many : one}`;
// Au-delà, la synchro en ligne refuse les données (5 Mo) : on garde les séances les plus récentes
const MAX_BYTES = 4.2e6;

/* ---------- Import ---------- */
const HELP = `<ul class="imp-help">
  <li><b>Strong</b> : Profil → Réglages (roue dentée) → <i>Export Strong Data</i>.</li>
  <li><b>Hevy</b> : Profil → Réglages → <i>Export &amp; Import Data</i> → <i>Export Workouts</i>.</li>
  <li><b>Fitbod</b> : onglet Journal → Réglages → <i>Export workout data</i>.</li>
  <li><b>MyFitnessPal</b> : sur le site, Paramètres → <i>Export Data</i> : fichiers « Meal-Level Nutrition » (repas) et « Measurement » (poids).</li>
  <li>Le fichier arrive par mail ou dans l'app Fichiers : touche « Choisir un fichier » ci-dessous et sélectionne-le.</li>
</ul>`;

export function openImport(onDone) {
  const sh = sheet(`<div class="eyebrow">${IC.file} Importer</div><h2 class="h2">Ton historique d'une autre app</h2>
    <p class="muted small">Strong, Hevy, Fitbod, MyFitnessPal ou une sauvegarde GREATNESS : tes séances, tes records et tes exercices arrivent ici. Rien n'est effacé, et réimporter le même fichier ne crée pas de doublon.</p>
    <details class="card adv mt-s"><summary>Où trouver le fichier ?</summary>${HELP}</details>
    <label class="btn btn-primary btn-block mt imp-pick">${IC.file} Choisir un fichier<input type="file" id="imp-file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" hidden/></label>
    <div id="imp-out" class="mt" aria-live="polite"></div>`, { z: 60 });
  const out = $("#imp-out", sh.el);
  $("#imp-file", sh.el).onchange = async e => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    out.innerHTML = `<p class="muted small"><i class="spinner"></i> Lecture de ${esc(f.name)}…</p>`;
    let text = "";
    try { text = await f.text(); } catch { out.innerHTML = errBox("Fichier illisible."); return; }
    try { preview(sh, out, f.name, text, onDone); }
    catch (err) { console.warn(err); out.innerHTML = errBox("Ce fichier n'a pas pu être lu. Vérifie que c'est bien l'export CSV de ton app."); }
  };
}
const errBox = msg => `<div class="card imp-err">${I.alert}<span>${esc(msg)}</span></div>`;

function preview(sh, out, name, text, onDone) {
  const t = text.trim();
  if (t.startsWith("{")) return previewBackup(sh, out, t, onDone);
  const { headers, rows } = parseCSV(text);
  const format = detectFormat(headers);
  if (!format) {
    out.innerHTML = errBox(`Format non reconnu (${headers.slice(0, 4).join(", ") || "fichier vide"}…). Fichiers acceptés : exports CSV de Strong, Hevy, Fitbod, MyFitnessPal, ou une sauvegarde GREATNESS (.json).`);
    return;
  }
  // unité : explicite chez Hevy, Fitbod et dans les colonnes « Weight Unit » / « Weight (lbs) » ; sinon on demande
  const explicit = format === "hevy" || format === "fitbod" || format === "mfp" || headers.some(h => /unit|lb|kg/i.test(h));
  let unit = headers.some(h => /lb/i.test(h)) ? "lb" : "kg";
  const draw = () => {
    let res, lines = [];
    if (format === "mfp") {
      res = importFood(rows);
      const days = Object.keys(res.days).sort(), meals = days.reduce((a, d) => a + res.days[d].length, 0);
      if (!meals) { out.innerHTML = errBox("Aucun repas trouvé dans ce fichier."); return; }
      lines = [[IC.food, plural(meals, "repas", "repas"), days.length > 1 ? `${plural(days.length, "jour")} du ${fmtD(days[0])} au ${fmtD(days.at(-1))}` : `le ${fmtD(days[0])}`]];
      res = { days: res.days };
    } else if (format === "weight") {
      const weights = importWeights(rows, { unit });
      if (!weights.length) { out.innerHTML = errBox("Aucune pesée trouvée dans ce fichier."); return; }
      const ws = weights.slice().sort((a, b) => a.date - b.date);
      lines = [[I.check, plural(weights.length, "pesée"), `du ${fmtD(ws[0].date)} au ${fmtD(ws.at(-1).date)} · dernière : ${String(ws.at(-1).weight).replace(".", ",")} kg`]];
      res = { weights };
    } else {
      const w = importWorkouts(rows, format, { unit });
      if (!w.sessions.length) { out.innerHTML = errBox("Aucune séance trouvée dans ce fichier."); return; }
      const sets = w.sessions.reduce((a, s) => a + s.sets.length, 0), exos = new Set(w.sessions.flatMap(s => s.sets.map(x => x.exId))).size;
      lines = [[I.flame, plural(w.sessions.length, "séance"), `du ${fmtD(w.sessions[0].date)} au ${fmtD(w.sessions.at(-1).date)} · ${plural(sets, "série")}`],
        [I.check, plural(exos - w.unknown.length, "exercice reconnu", "exercices reconnus"), w.unknown.length ? `${plural(w.unknown.length, "nouveau", "nouveaux")} créé${w.unknown.length > 1 ? "s" : ""} comme exercice${w.unknown.length > 1 ? "s" : ""} perso` : "tous reconnus"]];
      res = w;
    }
    out.innerHTML = `<div class="card imp-sum"><div class="imp-app"><b>${esc(APPS[format])}</b><span class="xs muted ellipsis">${esc(name)}</span></div>
        ${lines.map(([ic, a, b]) => `<div class="imp-line"><span class="imp-ic">${ic}</span><div class="grow"><b>${esc(a)}</b><span class="xs muted">${esc(b)}</span></div></div>`).join("")}
        ${res.unknown?.length ? `<details class="imp-unk"><summary class="xs muted">Voir les nouveaux exercices</summary><div class="imp-chips mt-s">${res.unknown.slice(0, 40).map(u => `<span class="chip">${esc(u)}</span>`).join("")}${res.unknown.length > 40 ? `<span class="chip">+${res.unknown.length - 40}</span>` : ""}</div></details>` : ""}
      </div>
      ${!explicit ? `<div class="set-row stack imp-unit mt-s"><div class="small"><b>Unité des charges dans ce fichier</b></div>
        <div class="seg" id="imp-unit">${[["kg", "Kilos (kg)"], ["lb", "Livres (lb)"]].map(([v, l]) => `<button data-v="${v}" class="${unit === v ? "on" : ""}" aria-pressed="${unit === v}">${l}</button>`).join("")}</div></div>` : ""}
      ${res.sessions ? `<p class="xs muted mt-s">Les séances importées comptent dans ton historique, tes records et ton rang, mais pas dans la ligue ni les défis entre amis.</p>` : ""}
      <button class="btn btn-primary btn-lg btn-block mt" id="imp-go">${I.check} Importer</button>`;
    $$("#imp-unit button", out).forEach(b => b.onclick = () => { unit = b.dataset.v; draw(); });
    $("#imp-go", out).onclick = () => commit(sh, out, res, onDone);
  };
  draw();
}

function commit(sh, out, res, onDone) {
  let sessions = res.sessions || [], cut = 0;
  // taille : on garde les séances les plus récentes si l'historique dépasse ce que la synchro accepte
  const base = JSON.stringify(state).length;
  let size = sessions.reduce((a, s) => a + JSON.stringify(s).length + 1, 0);
  while (sessions.length && base + size > MAX_BYTES) { size -= JSON.stringify(sessions[0]).length + 1; sessions = sessions.slice(1); cut++; }
  const r = applyImport(state, { ...res, sessions });
  syncCustomExercises();
  save();
  const parts = [r.sessions && plural(r.sessions, "séance"), r.meals && plural(r.meals, "repas", "repas"), r.weights && plural(r.weights, "pesée"), r.custom && plural(r.custom, "exercice perso", "exercices perso")].filter(Boolean);
  const msg = parts.length ? `Importé : ${parts.join(", ")}` : "Déjà importé : rien de nouveau";
  out.innerHTML = `<div class="card imp-done">${I.check}<div class="grow"><b>${esc(msg)}</b>
    ${r.dup ? `<span class="xs muted">${plural(r.dup, "séance déjà présente", "séances déjà présentes")}, ignorée${r.dup > 1 ? "s" : ""}.</span>` : ""}
    ${cut ? `<span class="xs muted">${plural(cut, "séance ancienne", "séances anciennes")} non importée${cut > 1 ? "s" : ""} (limite de stockage).</span>` : ""}</div></div>
    <button class="btn btn-soft btn-block mt-s" id="imp-close">Terminé</button>`;
  $("#imp-close", out).onclick = () => sh.close();
  toast(msg);
  onDone?.();
}

// Sauvegarde GREATNESS : fusionnée avec les données actuelles (comme la synchro entre deux téléphones)
function previewBackup(sh, out, text, onDone) {
  let data;
  try { data = JSON.parse(text); } catch { out.innerHTML = errBox("Sauvegarde abîmée : impossible de la lire."); return; }
  if (!Array.isArray(data?.sessions)) { out.innerHTML = errBox("Ce fichier JSON n'est pas une sauvegarde GREATNESS."); return; }
  const known = new Set(state.sessions.map(s => s.id)), add = data.sessions.filter(s => s?.id && !known.has(s.id)).length;
  const days = Object.keys(data.food || {}).length;
  const fresh = !state.sessions.length;
  out.innerHTML = `<div class="card imp-sum"><div class="imp-app"><b>${esc(APPS.greatness)}</b>${data.exportedAt ? `<span class="xs muted">du ${esc(fmtD(data.exportedAt))}</span>` : ""}</div>
      <div class="imp-line"><span class="imp-ic">${I.flame}</span><div class="grow"><b>${plural(data.sessions.length, "séance")}</b><span class="xs muted">${add ? `${plural(add, "nouvelle")} pour ce compte` : "toutes déjà présentes"}</span></div></div>
      ${days ? `<div class="imp-line"><span class="imp-ic">${IC.food}</span><div class="grow"><b>${plural(days, "jour")} de journal alimentaire</b><span class="xs muted">fusionnés avec le tien</span></div></div>` : ""}
    </div>
    <p class="xs muted mt-s">${fresh ? "Ce compte est vide : tes réglages (objectif, programme, nutrition) seront aussi repris." : "Tes réglages actuels sont gardés ; seules les données s'ajoutent."}</p>
    <button class="btn btn-primary btn-lg btn-block mt" id="imp-go">${I.check} Fusionner avec mes données</button>`;
  $("#imp-go", out).onclick = () => {
    const backup = { ...data, meta: { updatedAt: 0 } };
    delete backup.exportedAt; delete backup.app;
    const merged = mergeData(backup, state);
    if (fresh) {
      merged.profile = { ...state.profile, ...data.profile, name: state.profile.name || data.profile?.name || "", aiKey: state.profile.aiKey };
      merged.weekPlan = data.weekPlan || merged.weekPlan;
    }
    setUser(currentUser, merged);
    save();
    out.innerHTML = `<div class="card imp-done">${I.check}<div class="grow"><b>Sauvegarde fusionnée</b><span class="xs muted">${add ? `${plural(add, "séance ajoutée", "séances ajoutées")}.` : "Rien de nouveau côté séances."}</span></div></div>
      <button class="btn btn-soft btn-block mt-s" id="imp-close">Terminé</button>`;
    $("#imp-close", out).onclick = () => sh.close();
    toast("Sauvegarde fusionnée ✓");
    onDone?.();
  };
}

/* ---------- Export ---------- */
const stamp = () => new Date().toISOString().slice(0, 10);
// Partage (iPhone : « Enregistrer dans Fichiers », mail, AirDrop…) ou téléchargement
async function deliver(name, text, type) {
  const file = new File([text], name, { type });
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e?.name === "AbortError") return false; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

export function openExport() {
  const n = state.sessions.length, days = Object.values(state.food || {}).filter(d => d.items?.length).length;
  const sh = sheet(`<div class="eyebrow">${IC.save} Exporter</div><h2 class="h2">Tes données t'appartiennent</h2>
    <p class="muted small">Garde une copie, ou emporte ton historique dans une autre app ou un tableur.</p>
    <div class="card card-list set-list mt">
      <button class="set-row set-act" data-x="json"><span class="set-ic" style="--c:#22c55e">${IC.save}</span><div class="grow"><b>Sauvegarde complète</b><span class="xs muted">Fichier .json : tout, à réimporter dans GREATNESS</span></div>${I.chev}</button>
      <button class="set-row set-act" data-x="csv" ${n ? "" : "disabled"}><span class="set-ic" style="--c:#3b82f6">${IC.table}</span><div class="grow"><b>Mes séances (CSV)</b><span class="xs muted">${n ? `${plural(n, "séance")} · format Strong, lisible par Hevy, Strong, Excel, Numbers` : "Aucune séance pour l'instant"}</span></div>${I.chev}</button>
      <button class="set-row set-act" data-x="food" ${days ? "" : "disabled"}><span class="set-ic" style="--c:#f59e0b">${IC.food}</span><div class="grow"><b>Mon journal alimentaire (CSV)</b><span class="xs muted">${days ? `${plural(days, "jour")} · aliments, calories, protéines, glucides, lipides` : "Journal vide pour l'instant"}</span></div>${I.chev}</button>
    </div>
    <p class="xs muted mt-s">La clé API Claude éventuelle n'est jamais incluse.</p>`, { z: 60 });
  $$("[data-x]", sh.el).forEach(b => b.onclick = async () => {
    const k = b.dataset.x;
    const ok = k === "json" ? await deliver(`greatness-${stamp()}.json`, backupJSON(state), "application/json")
      : k === "csv" ? await deliver(`greatness-seances-${stamp()}.csv`, "﻿" + sessionsCSV(state.sessions), "text/csv")
      : await deliver(`greatness-nutrition-${stamp()}.csv`, "﻿" + foodCSV(state.food), "text/csv");
    if (ok) toast("Fichier prêt ✓");
  });
}
