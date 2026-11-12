// Manuel des exercices : la bibliothèque complète des mouvements, à parcourir par muscle. On touche un muscle sur la
// silhouette, on voit les exercices qui le travaillent, et chacun ouvre sa démo animée (js/demo.js). Tout est dessiné
// (carte des muscles de js/body.js), hors ligne, sans image sous licence. Une recherche cherche dans tous les exercices.
import { EXERCISES, EQUIP } from "./data.js";
import { MUSCLES, bodyMap } from "./body.js";
import { musclesOf } from "./recovery.js";
import { $, $$, esc, I, sheet } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BOOK = svg('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a1.5 1.5 0 0 1 1.5 1.5v13"/><path d="M4 5.5v13A1.5 1.5 0 0 0 5.5 20H18"/><path d="M8 8.5h7M8 12h7"/>');
const fold = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Muscles du haut vers le bas du corps, avec un petit libellé de zone
const ORDER = [
  ["pecs", "Buste"], ["delts", "Épaules"], ["traps", "Haut du dos"], ["lats", "Dos"], ["biceps", "Bras"],
  ["triceps", "Bras"], ["forearms", "Avant-bras"], ["abs", "Sangle"], ["obliques", "Sangle"], ["lowerback", "Dos"],
  ["glutes", "Fessiers"], ["quads", "Cuisses"], ["hams", "Cuisses"], ["adductors", "Cuisses"],
  ["abductors", "Hanches"], ["calves", "Mollets"], ["hipflex", "Hanches"],
];

// Pour chaque muscle, les exercices qui le travaillent en premier (p : principal) ou en soutien (s : secondaire)
export function muscleIndex() {
  const idx = Object.fromEntries(ORDER.map(([m]) => [m, { p: [], s: [] }]));
  for (const id of Object.keys(EXERCISES)) {
    if (EXERCISES[id].custom) continue;
    const { p, s } = musclesOf(id);
    for (const m of p) idx[m]?.p.push(id);
    for (const m of s) idx[m]?.s.push(id);
  }
  return idx;
}
const COUNT = Object.keys(EXERCISES).filter(id => !EXERCISES[id].custom).length;
const only = m => (x => (x === m ? "mus p" : "mz")); // silhouette : un seul muscle en couleur
const tag = ex => esc([ex.muscle, EQUIP[ex.equip]].filter(Boolean).join(" · "));

// Carte d'entrée, posée dans l'onglet Séances
export function manualCard() {
  return `<button class="card tap free-card manual-card" id="manual-start">
    <span class="bi">${BOOK}</span>
    <span class="grow"><b>Manuel des exercices</b><span class="xs muted">${COUNT} mouvements, muscle par muscle, avec la démo animée</span></span>
    <span class="chev">${I.chev}</span>
  </button>`;
}

// Une ligne d'exercice (toute la ligne ouvre la démo : js/demo.js écoute les [data-demo])
const row = id => {
  const ex = EXERCISES[id];
  return `<button type="button" class="mnl-ex" data-demo="${esc(id)}" aria-label="Voir la démo : ${esc(ex.name)}">
    <span class="grow"><b>${esc(ex.name)}</b><span class="xs muted">${tag(ex)}</span></span>${I.play}</button>`;
};

export function openManual() {
  const idx = muscleIndex();
  const sh = sheet(`<div class="manual">
    <div class="eyebrow">${BOOK} Manuel</div>
    <h2 class="h2">Exercices</h2>
    <label class="mnl-search">${I.search}<input type="search" id="mnl-q" placeholder="Chercher un exercice ou un muscle…" autocomplete="off" aria-label="Chercher un exercice ou un muscle"></label>
    <div class="mnl-body" id="mnl-body"></div>
  </div>`, { z: 70 });
  const body = $("#mnl-body", sh.el), q = $("#mnl-q", sh.el);

  // Grille des muscles : chaque carte éclaire son muscle sur la silhouette
  const grid = () => {
    body.innerHTML = `<div class="mnl-grid">${ORDER.filter(([m]) => idx[m].p.length).map(([m, zone]) => `
      <button type="button" class="mnl-mus" data-m="${m}">
        <span class="mnl-fig">${bodyMap({}, { cls: only(m), label: MUSCLES[m] })}</span>
        <b>${esc(MUSCLES[m])}</b><span class="xs muted">${esc(zone)} · ${idx[m].p.length} exercices</span>
      </button>`).join("")}</div>`;
    $$(".mnl-mus", body).forEach(b => b.onclick = () => muscle(b.dataset.m));
  };

  // Détail d'un muscle : silhouette en grand + exercices principaux puis de soutien
  const muscle = m => {
    const { p, s } = idx[m];
    body.scrollTop = 0;
    body.innerHTML = `<button type="button" class="mnl-back" id="mnl-back">${I.back} Tous les muscles</button>
      <div class="mnl-head"><span class="mnl-fig big">${bodyMap({}, { cls: only(m), label: MUSCLES[m] })}</span>
        <div><h3 class="h3">${esc(MUSCLES[m])}</h3><span class="xs muted">${p.length} exercices principaux${s.length ? ` · ${s.length} en soutien` : ""}</span></div></div>
      <div class="mnl-list">${p.map(row).join("")}</div>
      ${s.length ? `<h4 class="demo-h">Le fait aussi travailler</h4><div class="mnl-list">${s.map(row).join("")}</div>` : ""}`;
    $("#mnl-back", body).onclick = grid;
  };

  // Recherche : à plat, dans le nom, le muscle et le matériel
  const search = raw => {
    const needle = fold(raw.trim());
    const hits = Object.keys(EXERCISES).filter(id => !EXERCISES[id].custom).filter(id => {
      const ex = EXERCISES[id];
      return fold(`${ex.name} ${ex.muscle} ${EQUIP[ex.equip] || ""}`).includes(needle);
    }).sort((a, b) => EXERCISES[a].name.localeCompare(EXERCISES[b].name, "fr"));
    body.innerHTML = hits.length
      ? `<div class="mnl-list">${hits.map(row).join("")}</div>`
      : `<div class="card empty">${I.search}<b>Aucun exercice trouvé</b>Essaie un autre mot : un muscle, un matériel, le nom du mouvement.</div>`;
  };

  q.addEventListener("input", () => (q.value.trim() ? search(q.value) : grid()));
  grid();
}
