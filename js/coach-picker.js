// Choix du coach : carte « Ton coach » (en tête des Réglages), galerie par univers dans une feuille,
// et la même galerie, compacte, dans l'accueil des nouveaux comptes.
import { GROUPS, TRAVELS, all, byIdGet, loadGroup, current, setCoach, figure, fxRgb, groupStatus, onCoachChange, coachLine } from "./chars/index.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, sheet, toast, I } from "./ui.js";

const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const TRAVEL_ICON = {
  web: ic('<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><path d="M12 7.6 15.1 8.9 16.4 12 15.1 15.1 12 16.4 8.9 15.1 7.6 12 8.9 8.9Z"/>'),
  fly: ic('<path d="M21 4C14 5 9.5 8.5 7 14l-4 1 3 2 1 4 2-3.5C14 16 18.5 11 21 4Z"/><path d="M7 14c2-.5 4-1.6 6-3.5"/>'),
  hop: ic('<path d="M3 20h18"/><path d="M4.5 20C6 12.5 8 9 10 9s3.5 4 4 11"/><path d="M14 20c.8-3.8 2-5.6 3.2-5.6S19.3 16.4 20 20" opacity=".6"/><circle cx="10" cy="4.6" r="1.9"/>'),
  dash: ic('<path d="M13 3 6 13h5l-1 8 7-10h-5z"/><path d="M2.5 9h3M2 13.5h2.5M3 18h3" opacity=".7"/>'),
  walk: ic('<path d="M8.2 3.5c1.5 0 2.4 1.7 2.4 3.8s-1 3.3-2.4 3.3-2.4-1.2-2.4-3.3.9-3.8 2.4-3.8Z"/><path d="M6.3 13.4h4l-.3 1.7a2 2 0 0 1-3.4 0Z"/><path d="M15.8 8.5c1.5 0 2.4 1.7 2.4 3.8s-1 3.3-2.4 3.3-2.4-1.2-2.4-3.3.9-3.8 2.4-3.8Z"/><path d="M13.9 18.4h4l-.3 1.7a2 2 0 0 1-3.4 0Z"/>'),
};
const look = c => `--fx:${c.fx.color};--fx-rgb:${fxRgb(c)}`;
const travelLabel = c => `${TRAVELS[c.travel]}${c.climb && c.travel !== "web" ? " · grimpe" : ""}`;

/* ---------- Carte « Ton coach » ---------- */
export function coachCard(el, { open = false } = {}) {
  if (!el) return;
  const draw = () => {
    const c = current();
    el.innerHTML = `<div class="coach-card" style="${look(c)}">
      <button class="cc-stage" aria-label="Dire bonjour à ${esc(c.name)}">${figure(c, { pose: "idle" })}</button>
      <div class="cc-info">
        <div class="eyebrow">Ton coach</div>
        <div class="cc-name">${esc(c.name)}</div>
        <div class="cc-tags"><span class="cc-tag uni">${esc(c.group)}</span><span class="cc-tag">${TRAVEL_ICON[c.travel]}${travelLabel(c)}</span></div>
        ${c.bio ? `<p class="cc-bio">${esc(c.bio)}</p>` : ""}
        <button class="btn btn-soft btn-sm cc-change" id="coach-change">${I.swap}Changer</button>
      </div>
    </div>`;
    const stage = $(".cc-stage", el);
    stage.onclick = () => {
      const svg = $("svg", stage);
      svg.setAttribute("class", svg.getAttribute("class").replace(/pose-\S+/, "pose-wave") + " mood-happy");
      clearTimeout(stage._t);
      stage._t = setTimeout(() => svg.setAttribute("class", svg.getAttribute("class").replace(/pose-\S+/, "pose-idle").replace(" mood-happy", "")), 1500);
      const l = coachLine("tap") || coachLine("hello");
      if (l) spidey.say(l, { mood: "happy" });
    };
    $("#coach-change", el).onclick = openCoachGallery;
  };
  draw();
  const off = onCoachChange(() => (el.isConnected ? draw() : off()));
  // l'interrupteur des préférences parle du coach, pas seulement de Spider-Man
  const lbl = document.querySelector("#p-mascot")?.closest("label")?.querySelector("b");
  if (lbl && /Spider-Man/.test(lbl.textContent)) lbl.textContent = "Coach animé";
  if (open) setTimeout(openCoachGallery, 260);
}

/* ---------- Galerie ---------- */
export function openCoachGallery() {
  const sh = sheet(`<div class="cg-head"><h2 class="h2">Choisis ton coach</h2>
    <p class="small muted">Touche un personnage pour l'adopter. Il se déplace à sa façon et t'encourage avec sa voix.</p></div><div></div>`, { z: 75 }); // au-dessus de la mascotte
  coachGallery(sh.el.lastElementChild, {
    onPick: c => {
      sh.close();
      if (c.id === current().id) return;
      setTimeout(async () => { const ok = await setCoach(c.id); if (ok) toast(`${ok.name} est ton nouveau coach !`); }, 240);
    },
  });
}

// Grille des coachs avec filtres par univers. Sans onPick : le coach touché est adopté tout de suite.
export function coachGallery(el, { compact = false, onPick } = {}) {
  if (!el) return;
  let filter = "Tous", first = true;
  const pinned = current().id; // le coach actuel en tête, une fois pour toutes (pas de saut quand on choisit)
  el.className = `cg${compact ? " compact" : ""}`;
  el.innerHTML = `<div class="cg-filters" role="tablist" aria-label="Univers"></div><div class="cg-grid"></div>${compact ? `<p class="cg-pick" aria-live="polite"></p>` : ""}`;
  const fl = $(".cg-filters", el), grid = $(".cg-grid", el), note = $(".cg-pick", el);
  const waiting = g => ["idle", "loading"].includes(groupStatus(g));

  const drawFilters = () => {
    const list = all();
    const groups = GROUPS.filter(g => waiting(g) || list.some(c => c.group === g));
    if (filter !== "Tous" && !groups.includes(filter)) filter = "Tous";
    fl.innerHTML = ["Tous", ...groups].map(g => {
      const n = g === "Tous" ? list.length : list.filter(c => c.group === g).length;
      return `<button class="chip${g === filter ? " on" : ""}" data-uni="${g}" role="tab" aria-selected="${g === filter}">${esc(g)}${waiting(g) && !n ? "" : `<span class="cg-n">${n}</span>`}</button>`;
    }).join("");
    $$("[data-uni]", fl).forEach(b => b.onclick = () => { if (filter === b.dataset.uni) return; filter = b.dataset.uni; drawFilters(); drawGrid(true); });
  };

  const tile = (c, i, on) => `<button class="cg-tile${on ? " on" : ""}" data-coach="${c.id}" style="${look(c)};--i:${Math.min(i, 14)}" aria-pressed="${on}" aria-label="${esc(c.name)} · ${esc(c.group)} · ${esc(travelLabel(c))}">
      <span class="cg-fig">${figure(c, { pose: "idle" })}</span>
      <b class="cg-name">${esc(c.name)}</b>
      <span class="cg-meta">${compact ? "" : `<span>${esc(c.group)}</span>`}<span class="cg-tr" title="${esc(travelLabel(c))}">${TRAVEL_ICON[c.travel]}</span></span>
      <i class="cg-check" aria-hidden="true">${I.check}</i></button>`;
  const skel = () => `<div class="cg-tile cg-sk" aria-hidden="true"><span class="cg-fig"></span><b class="cg-name"></b><span class="cg-meta"></span></div>`;

  const drawGrid = animate => {
    const cur = current().id;
    const list = all().filter(c => filter === "Tous" || c.group === filter).sort((a, b) => (b.id === pinned) - (a.id === pinned));
    const pending = (filter === "Tous" ? GROUPS : [filter]).filter(waiting);
    grid.classList.toggle("still", !animate);
    grid.innerHTML = list.map((c, i) => tile(c, i, c.id === cur)).join("") + pending.flatMap(() => [skel(), skel(), skel()]).join("");
    if (animate && !first) grid.scrollTop = 0;
    first = false;
    drawNote();
  };
  const drawNote = () => {
    if (!note) return;
    const c = current();
    note.innerHTML = `<b style="color:${c.fx.color}">${esc(c.name)}</b>${c.bio ? ` · ${esc(c.bio)}` : ""}`;
  };

  grid.onclick = e => {
    const t = e.target.closest("[data-coach]");
    const c = t && byIdGet(t.dataset.coach);
    if (!c) return;
    $$(".cg-tile", grid).forEach(x => { const on = x === t; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    if (onPick) return onPick(c);
    setCoach(c.id).then(drawNote);
  };

  drawFilters();
  drawGrid(true);
  // univers chargés à la demande : les squelettes laissent place aux coachs
  GROUPS.filter(waiting).forEach(g => loadGroup(g).then(() => { if (el.isConnected) { drawFilters(); drawGrid(false); } }));
}
