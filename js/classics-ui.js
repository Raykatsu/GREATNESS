// Écrans des programmes célèbres : la liste (onglet Séances), la fiche de chaque programme, le réglage des maximums
// au départ, la carte de suivi sur l'accueil et le détail (prochaine séance, maximums, arrêter).
import { CLASSICS, MAIN, startClassic, classicSession, classicStatus, schemeText } from "./classics.js";
import { currentLevel } from "./goals.js";
import { generateWeekPlan } from "./planner.js";
import { EXERCISES } from "./data.js";
import { state, save } from "./store.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

const SHORT = { squat: "Squat", bench: "Couché", deadlift: "Terre", ohp: "Militaire", row: "Rowing" };
const kgs = w => String(w).replace(".", ",");
const LIFTS_OF = { wendler: MAIN, gzclp: MAIN, nsuns: MAIN, ss: MAIN };

// Charges de référence affichées : max d'entraînement (5/3/1, nSuns), charge T1 (GZCLP), charge de travail (SS)
export function refWeights(c) {
  if (c.id === "wendler" || c.id === "nsuns") return { label: "Max d'entraînement", w: MAIN.map(l => [l, c.tm[l]]) };
  if (c.id === "gzclp") return { label: "Charge T1", w: MAIN.map(l => [l, c.w[`t1_${l}`]]) };
  return { label: "Charge de travail", w: [...MAIN, "row"].map(l => [l, c.w[l]]) };
}

/* ---------- Onglet Séances ---------- */
export function classicsSection() {
  const on = state.classic?.id;
  return `<section class="classics"><div class="section"><h2>Programmes célèbres</h2><span class="xs dim">avec leurs vraies règles</span></div>
    <div class="cl-row">${Object.entries(CLASSICS).map(([id, P]) => `<button class="card tap cl-card ${on === id ? "on" : ""}" data-classic="${id}">
      <b>${esc(P.name)}</b><span class="xs muted">${P.days} séances / semaine</span><span class="xs muted">${esc(P.level)}</span>
      ${on === id ? `<span class="chip green">En cours</span>` : ""}</button>`).join("")}</div></section>`;
}
export function bindClassics(root, refresh) {
  $$("[data-classic]", root).forEach(b => b.onclick = () => openClassic(b.dataset.classic, refresh));
}

export function openClassic(id, refresh) {
  const P = CLASSICS[id], cur = state.classic;
  const sh = sheet(`<div class="eyebrow">${I.flame} Programme célèbre · ${esc(P.by)}</div><h2 class="h2">${esc(P.name)}</h2>
    <p class="muted small">${esc(P.pitch)}</p>
    <div class="cl-facts mt-s"><span>${I.calendar || I.clock} ${P.days} séances / semaine</span><span>${I.bolt} ${esc(P.level)}</span></div>
    <h3 class="demo-h">Comment ça marche</h3><ul class="demo-list">${P.how.map(t => `<li>${I.check}${esc(t)}</li>`).join("")}</ul>
    <p class="xs muted">L'app calcule chaque série (charge et reps), annonce la série « au max », et fait avancer le programme après chaque séance. Les jours d'entraînement de ta semaine suivent le programme.</p>
    ${cur?.id === id ? `<button class="btn btn-soft btn-lg btn-block mt" id="cl-see">${I.chev} Voir où j'en suis</button>`
      : `<button class="btn btn-primary btn-lg btn-block mt" id="cl-go">${I.play} ${cur ? `Remplacer ${esc(CLASSICS[cur.id].short)} par ce programme` : "Commencer ce programme"}</button>`}`, { z: 70 });
  $("#cl-see", sh.el)?.addEventListener("click", () => { sh.close(); openClassicDetails(refresh); });
  $("#cl-go", sh.el)?.addEventListener("click", () => { sh.close(); setupClassic(id, refresh); });
}

// Les maximums de départ, estimés d'après tes séances (ou ton poids de corps), modifiables
export function guessMax(lift, st = state) {
  const lvl = currentLevel(lift, st);
  if (lvl > 0) return lvl;
  const bw = st.profile?.bodyweight || 75, k = { squat: 1, bench: 0.75, deadlift: 1.25, ohp: 0.5 }[lift] || 0.6;
  return Math.max(20, Math.round((bw * k) / 2.5) * 2.5);
}
function setupClassic(id, refresh) {
  const P = CLASSICS[id];
  const sh = sheet(`<div class="eyebrow">${I.flame} ${esc(P.name)}</div><h2 class="h2">Tes maximums</h2>
    <p class="muted small">La charge que tu soulèves <b>une fois</b>, proprement, sur chaque mouvement. Estimée d'après tes séances : corrige si besoin. Pas sûr ? Reste prudent, le programme s'ajuste.</p>
    <div class="cl-max mt">${LIFTS_OF[id].map(l => `<label class="field"><span>${esc(EXERCISES[l].name)}</span>
      <div class="cl-in"><input class="input" type="number" inputmode="decimal" min="10" max="400" step="2.5" id="mx-${l}" value="${guessMax(l)}"/><span>kg</span></div></label>`).join("")}</div>
    <p class="err" id="cl-err"></p>
    <button class="btn btn-primary btn-lg btn-block" id="cl-start">${I.play} C'est parti</button>`, { z: 75 });
  $("#cl-start", sh.el).onclick = () => {
    const maxes = {};
    for (const l of LIFTS_OF[id]) {
      const v = parseFloat(String($(`#mx-${l}`, sh.el).value).replace(",", "."));
      if (!(v >= 10 && v <= 400)) return ($("#cl-err", sh.el).textContent = `${EXERCISES[l].name} : entre 10 et 400 kg.`);
      maxes[l] = v;
    }
    state.classic = startClassic(id, maxes);
    state.weekPlan = generateWeekPlan();
    save();
    sh.close();
    toast(`${P.name} : c'est parti ! Ta semaine suit le programme.`, 3500);
    refresh?.();
    setTimeout(() => openClassicDetails(refresh), 350);
  };
}

/* ---------- Accueil : suivi ---------- */
export function classicCard() {
  const c = state.classic;
  if (!c || !CLASSICS[c.id]) return "";
  const P = CLASSICS[c.id], ref = refWeights(c);
  return `<section class="card classic-card"><div class="row between"><div class="grow"><div class="eyebrow">${I.flame} Programme célèbre</div>
      <b>${esc(P.name)}</b><span class="xs muted">${esc(classicStatus(c).label)}</span></div>
      <button class="btn btn-soft btn-sm" id="cl-open">Voir</button></div>
    <div class="cl-maxes" aria-label="${esc(ref.label)}">${ref.w.map(([l, w]) => `<span>${SHORT[l]}<b>${kgs(w)}</b></span>`).join("")}</div></section>`;
}
export function bindClassicCard(root, refresh) { $("#cl-open", root)?.addEventListener("click", () => openClassicDetails(refresh)); }

export function openClassicDetails(refresh) {
  const c = state.classic;
  if (!c) return;
  const P = CLASSICS[c.id], next = classicSession(c, state), ref = refWeights(c);
  const sh = sheet(`<div class="eyebrow">${I.flame} ${esc(P.name)}</div><h2 class="h2">${esc(classicStatus(c).label)}</h2>
    <p class="muted small">${c.n} séance${c.n > 1 ? "s" : ""} faite${c.n > 1 ? "s" : ""} depuis le ${new Date(c.start).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</p>
    <h3 class="demo-h">Prochaine séance</h3>
    <div class="card cl-next"><b>${esc(next.name)}</b><ol>${next.exercises.map(e => `<li><span>${esc(EXERCISES[e.id].name)}</span><span class="xs muted">${esc(e.scheme ? schemeText(e) : `${e.sets} × ${e.reps[0]}–${e.reps[1]}`)}</span></li>`).join("")}</ol></div>
    <h3 class="demo-h">${esc(ref.label)}</h3>
    <div class="cl-maxes big">${ref.w.map(([l, w]) => `<span>${SHORT[l]}<b>${kgs(w)} kg</b></span>`).join("")}</div>
    <button class="btn btn-ghost btn-sm danger btn-block mt" id="cl-stop">${I.x} Arrêter le programme</button>`, { z: 70 });
  $("#cl-stop", sh.el).onclick = async () => {
    if (!(await confirmSheet("Arrêter le programme ?", "Ton historique reste. Ta semaine reprend le programme habituel de l'app.", "Arrêter", true))) return;
    state.classic = null; // null (pas supprimé) : l'arrêt se synchronise sur tes autres appareils
    state.weekPlan = generateWeekPlan();
    save(); sh.close(); toast("Programme arrêté."); refresh?.();
  };
}
