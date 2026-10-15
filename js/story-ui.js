// Mode histoire à l'écran : carte sur l'accueil, chapitre en cours (récit, objectif, récompense), chapitres passés,
// garde-robe du coach, et fête quand un chapitre est réussi. La logique est dans story.js.
import { state, save } from "./store.js";
import { CHAPTERS, storyStatus, advanceStory, chapterText, wornCostume } from "./story.js";
import { COSTUMES } from "./costumes.js";
import { current, figure, coachFace, coachName, refreshLook } from "./chars/index.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, I, sheet, toast } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const BOOK = svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/>');
const LOCK = svg('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const SHIRT = svg('<path d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>');
const names = ids => ids.map(id => COSTUMES[id]?.name).filter(Boolean).join(" et ");
const coach = () => coachName();

/* ---------- Accueil ---------- */
export function storyCard() {
  const s = storyStatus(state);
  if (s.finished) return "";
  return `<button class="card tap story-card mt-s" id="story-open"><span class="story-face">${coachFace("story-av")}</span>
    <span class="grow"><span class="eyebrow">${BOOK} Mode histoire · ${s.index + 1}/${s.total}</span><b>${esc(s.chapter.title)}</b>
      <span class="story-bar" aria-hidden="true"><i style="transform:scaleX(${s.pct.toFixed(3)})"></i></span>
      <span class="xs muted">${esc(s.label)} · ${s.progress}</span></span><span class="chev">${I.chev}</span></button>`;
}
export function bindStoryCard(root) { $("#story-open", root)?.addEventListener("click", () => openStory()); }

// Vérifie les chapitres après une séance (ou à l'ouverture) : fête et nouveau costume
export function checkStory() {
  const won = advanceStory(state);
  if (!won.length) return false;
  save();
  const last = won.at(-1);
  setTimeout(() => celebrate(last.chapter, won.flatMap(w => w.rewards)), 700);
  return true;
}

function celebrate(ch, rewards) {
  spidey.react?.("party");
  const s = storyStatus(state), first = rewards[0];
  const sh = sheet(`<div class="story-win"><div class="eyebrow">${BOOK} Chapitre réussi</div>
    <h2 class="h2">${esc(ch.title)}</h2>
    <div class="story-stage">${figure(current(), { pose: "wave", costume: first })}</div>
    <p class="small">Tu débloques : <b>${esc(names(rewards))}</b>.</p>
    ${s.finished ? `<p class="small muted">C'était le dernier chapitre : la Flemme est chassée de la ville. Légende !</p>`
      : `<p class="small muted">Chapitre suivant : <b>${esc(s.chapter.title)}</b>. ${esc(s.label)}.</p>`}
    <div class="grid2 mt"><button class="btn btn-primary" id="sw-wear">${SHIRT} Le porter</button><button class="btn btn-soft" id="sw-next">${BOOK} La suite</button></div></div>`, { z: 70 });
  $("#sw-wear", sh.el).onclick = () => { wear(first); sh.close(); toast(`${COSTUMES[first].name} : porté ✓`); };
  $("#sw-next", sh.el).onclick = () => { sh.close(); setTimeout(openStory, 250); };
}

function wear(id) {
  state.profile.costume = id || null;
  save();
  refreshLook();
}

/* ---------- Le livre ---------- */
export function openStory() {
  advanceStory(state);
  const sh = sheet(`<div id="story-body"></div>`, { z: 60 });
  const draw = () => {
    const s = storyStatus(state), done = state.story?.done || {}, worn = wornCostume(state);
    $("#story-body", sh.el).innerHTML = `<div class="eyebrow">${BOOK} Mode histoire</div>
      ${s.finished ? `<h2 class="h2">La ville est sauvée</h2><div class="story-stage">${figure(current(), { pose: "wave" })}</div>
        <p class="small muted">Tu as terminé les ${s.total} chapitres. ${esc(coach())} te salue, légende !</p>`
      : `<h2 class="h2">Chapitre ${s.index + 1} · ${esc(s.chapter.title)}</h2>
        <div class="story-stage">${figure(current(), { pose: "idle" })}</div>
        <p class="story-text">${esc(chapterText(s.chapter, coach()))}</p>
        <div class="card story-goal"><div class="row between"><b>Objectif</b><span class="tnum small">${s.progress}</span></div>
          <p class="small muted">${esc(s.label)}, à partir du début du chapitre.</p>
          <span class="story-bar big" aria-hidden="true"><i style="transform:scaleX(${s.pct.toFixed(3)})"></i></span>
          <div class="story-reward">${s.rewards.map(id => `<span class="story-prev">${figure(current(), { pose: "idle", costume: id })}</span>`).join("")}
            <span class="small"><b>Récompense</b><span class="muted">${esc(names(s.rewards))}</span></span></div></div>`}
      <h3 class="demo-h">Chapitres</h3>
      <ol class="story-list">${CHAPTERS.map((c, i) => {
        const ok = !!done[c.id], cur = !s.finished && i === s.index;
        return `<li class="${ok ? "ok" : cur ? "cur" : "lock"}"><span class="story-n">${ok ? I.check : cur ? i + 1 : LOCK}</span>
          <span class="grow"><b>${ok || cur ? esc(c.title) : "Chapitre verrouillé"}</b><span class="xs muted">${ok ? `Réussi le ${new Date(done[c.id]).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : cur ? "En cours" : "Réussis le chapitre précédent"}</span></span></li>`;
      }).join("")}</ol>
      <h3 class="demo-h">Garde-robe de ${esc(coach())}</h3>
      ${s.unlocked.length ? `<div class="story-wardrobe">
        <button class="story-cos ${!worn ? "on" : ""}" data-cos="" aria-pressed="${!worn}"><span class="story-prev">${figure(current(), { pose: "idle", costume: null })}</span><small>Sans costume</small></button>
        ${s.unlocked.map(id => `<button class="story-cos ${worn === id ? "on" : ""}" data-cos="${id}" aria-pressed="${worn === id}"><span class="story-prev">${figure(current(), { pose: "idle", costume: id })}</span><small>${esc(COSTUMES[id].name)}</small></button>`).join("")}</div>`
        : `<p class="small muted">Chaque chapitre réussi débloque un costume pour ton coach.</p>`}
      ${state.profile.mascot === false ? `<p class="xs muted mt-s">Les personnages sont masqués : active-les (Moi → Réglages → Personnages) pour voir ton coach en costume.</p>` : ""}`;
    $$("[data-cos]", sh.el).forEach(b => b.onclick = () => { wear(b.dataset.cos); draw(); toast(b.dataset.cos ? `${COSTUMES[b.dataset.cos].name} : porté ✓` : "Costume retiré"); });
  };
  draw();
}
