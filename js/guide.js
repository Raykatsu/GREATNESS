// Guide « Découvrir GREATNESS » : toutes les fonctions de l'app expliquées simplement (données : js/guide-data.js).
// - openGuide(partie) : la feuille du guide, partie par partie (un onglet de l'app chacune), avec une recherche ;
//   chaque fonction s'ouvre en deux phrases, avec un bouton pour l'essayer ou pour montrer où elle se trouve
//   (l'écran s'ouvre et l'élément brille quelques secondes)
// - guideCard() / bindGuideCard() : la carte « Bien démarrer » de l'Accueil (cinq premières étapes) des comptes récents
// - les boutons « ? » des en-têtes (helpBtn dans js/ui.js) ouvrent le guide sur leur onglet : un seul écouteur ici
// - « greatness:guide » ouvre le guide (bouton du coach), « greatness:used » note une fonction vraiment utilisée (démo vue…)
import { state, save } from "./store.js";
import { EXERCISES } from "./data.js";
import { todaysMission } from "./planner.js";
import { tr } from "./i18n.js";
import { mascot } from "./mascot.js";
import { pushEnabled } from "./push.js";
import { $, $$, esc, I, sheet, toast } from "./ui.js";
import { openManual } from "./manual.js";
import { openIntervals } from "./intervals-ui.js";
import { openGoalCreate } from "./goals-ui.js";
import { openRecovery } from "./recovery-ui.js";
import { openStory } from "./story-ui.js";
import { openHealth } from "./health-ui.js";
import { openTargets } from "./food.js";
import { openCoachGallery } from "./coach-picker.js";
import { openFeedback } from "./feedback.js";
import { openDemo } from "./demo.js";
import { openCam } from "./cam.js";
import { SECTIONS, ITEMS, STARTER, seenSet, isFound, starter, found, showStarter, search } from "./guide-data.js";

const wait = ms => new Promise(r => setTimeout(r, ms));
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const secOf = id => SECTIONS.find(s => s.id === id);
// textes lus par le lecteur d'écran (constantes : traduites comme le reste)
const FOUND = "Déjà découverte", DONE = "Étape faite";
// typographie française : espaces insécables avant ? ! : ; » et après « (pas de signe seul en début de ligne)
const fr = x => esc(x).replace(/ ([?!:;»])/g, "\u202f$1").replace(/« /g, "«\u202f");

// Fonction découverte (lue dans le guide ou utilisée) : gardée sur le compte, réunie entre appareils (merge.js)
let dirty = false;
export function markSeen(id) {
  if (!id || typeof id !== "string") return false;
  const g = (state.guide ||= {}), list = (g.seen ||= []);
  if (list.includes(id)) return false;
  list.push(id);
  if (list.length > 200) list.splice(0, list.length - 200);
  dirty = true;
  save({ silent: true }); // synchronisé à la fermeture du guide (ou avec la prochaine sauvegarde)
  return true;
}

/* ---------- Ce que le guide sait ouvrir ---------- */
// démo : le premier exercice de la séance du jour (sinon le squat), pour tomber sur un mouvement utile
const demoId = () => todaysMission().program?.exercises?.find(e => EXERCISES[e.id])?.id || "squat";
const squat = () => ({ ...EXERCISES.squat, id: "squat" });
const FN = {
  manual: () => openManual(),
  body3d: () => import("./body3d.js").then(m => m.openBody3D()),
  intervals: () => openIntervals(),
  goal: () => openGoalCreate(),
  recovery: () => openRecovery(),
  story: () => openStory(),
  health: () => openHealth(),
  targets: () => openTargets(),
  coaches: () => openCoachGallery(),
  feedback: () => openFeedback(),
  demo: () => openDemo(demoId()),
  cam: () => openCam(squat(), { practice: true }),
  video: () => import("./videocoach.js").then(m => m.openVideoCoach(squat())),
};
// ces fonctions prennent tout l'écran : le guide se ferme ; les autres s'ouvrent par-dessus (on y revient en fermant)
const CLOSE = new Set(["intervals", "cam"]);
const goLabel = go => (go.start ? `${I.play} Lancer` : go.fn ? `${I.play} Essayer` : `${I.eye} Me montrer où`);

// Fait briller un élément de l'écran (l'endroit où se trouve la fonction)
function glow(el) {
  const t = el.closest(".set-row") || el;
  document.querySelectorAll(".g-spot").forEach(n => n !== t && n.classList.remove("g-spot")); // un seul à la fois
  t.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" });
  t.classList.remove("g-spot");
  void t.offsetWidth; // relance l'animation
  t.classList.add("g-spot");
  setTimeout(() => t.classList.remove("g-spot"), 3600);
}
// Ouvre l'écran de la fonction puis montre l'élément (go.click : le touche aussi, comme un filtre ou un onglet)
let showing = 0; // une nouvelle demande remplace celle en cours
async function show({ to, spot, click, miss }) {
  const me = ++showing;
  const path = h => h.replace(/^#\/?/, "").split("?")[0];
  if (to.includes("?") || path(location.hash) !== path(to)) location.hash = to;
  await wait(320); // la feuille du guide se ferme, l'écran entre
  let el = null;
  for (let i = 0; i < 25 && me === showing && !(el = document.querySelector(spot)); i++) await wait(60);
  if (me !== showing) return;
  if (!el) {
    if (miss) toast(miss, 4500);
    else (window.__guideMiss ||= []).push(spot); // élément introuvable : vérifié par les tests
    return;
  }
  if (click) el.click();
  glow(el);
}
// Lance l'action d'une fonction ou d'une étape
function run(x, sh) {
  const go = x.go;
  if (!go) return;
  if (go.fn) {
    if (CLOSE.has(go.fn)) sh.close();
    return FN[go.fn]?.();
  }
  sh.close();
  if (go.start) return void setTimeout(() => dispatchEvent(new CustomEvent("greatness:start", { detail: go.start })), 250);
  return show(go);
}

// Rappels déjà actifs (notifications) : l'étape « Active tes rappels » se coche toute seule
function checkRemind(then) {
  if (seenSet(state).has("used:remind")) return;
  pushEnabled().then(on => { if (on && markSeen("used:remind")) then?.(); }).catch(() => {});
}

/* ---------- Le guide ---------- */
let current = null; // le guide ouvert : { sh, show(partie) }
export function openGuide(sec) {
  dispatchEvent(new CustomEvent("greatness:guide-open")); // la visite guidée laisse la place au guide (app.js)
  if (current?.sh.el.isConnected) return current.show(sec);
  current = null; // feuille retirée sans être fermée (verrouillage de l'app) : on repart d'une nouvelle
  const startSt = starter(state);
  let cur = secOf(sec) ? sec : startSt.all ? "home" : "start", q = "";
  const sh = sheet(`<div class="gd">
      <div class="eyebrow gd-eye">${I.compass} Guide</div>
      <h2 class="h2">Découvrir GREATNESS</h2>
      <p class="small muted gd-lead">Tout ce que l'app sait faire, expliqué simplement. Touche une fonction pour la comprendre, puis essaie-la.</p>
      <div class="gd-prog" id="gd-prog"></div>
      <label class="mnl-search gd-search">${I.search}<input type="search" id="gd-q" placeholder="Chercher une fonction…" autocomplete="off" enterkeyhint="search" aria-label="Chercher une fonction"></label>
      <div class="chips gd-tabs" id="gd-tabs" role="tablist" aria-label="Parties du guide">${SECTIONS.map(s => `<button type="button" class="chip" role="tab" data-sec="${s.id}" aria-selected="false" aria-controls="gd-body"><i aria-hidden="true">${s.ic}</i><span>${esc(s.name)}</span></button>`).join("")}</div>
      <div class="gd-body" id="gd-body" role="tabpanel" aria-live="polite"></div>
    </div>`, { onClose: () => { current = null; if (dirty) { dirty = false; save(); } } });
  const body = $("#gd-body", sh.el), input = $("#gd-q", sh.el), tabs = $("#gd-tabs", sh.el);

  const drawProg = () => {
    const f = found(state);
    $("#gd-prog", sh.el).innerHTML = `<div class="gd-prog-t"><span class="xs muted">Fonctions découvertes</span><b class="tnum small">${f.n}/${f.total}</b></div>
      <div class="bar" role="progressbar" aria-label="Fonctions découvertes" aria-valuenow="${f.n}" aria-valuemin="0" aria-valuemax="${f.total}"><i style="width:${Math.max(2, (f.n / f.total) * 100).toFixed(1)}%"></i></div>`;
  };
  // une fonction : titre et emplacement, l'explication et le bouton s'ouvrent au toucher
  const itemHtml = (it, seen, withSec) => {
    const ok = isFound(it, state, seen);
    return `<div class="gd-it ${ok ? "ok" : ""}" data-id="${it.id}">
      <button type="button" class="gd-row" aria-expanded="false" aria-controls="gd-d-${it.id}">
        <span class="gd-ic" aria-hidden="true">${it.ic}</span>
        <span class="grow gd-tt"><b>${fr(it.t)}</b><span class="xs muted gd-w">${withSec ? `<span>${fr(secOf(it.sec).name)}</span> · ` : ""}<span>${fr(it.w)}</span></span></span>
        <span class="gd-st" ${ok ? `role="img" aria-label="${FOUND}"` : `aria-hidden="true"`}>${ok ? I.check : I.down}</span>
      </button>
      <div class="gd-d" id="gd-d-${it.id}" hidden>
        <p class="small">${fr(it.d)}</p>
        ${it.tag || it.go ? `<div class="gd-acts">${it.tag ? `<span class="chip gd-tag">${fr(it.tag)}</span>` : ""}${it.go ? `<button type="button" class="btn btn-primary btn-sm" data-go="${it.id}">${goLabel(it.go)}</button>` : ""}</div>` : ""}
      </div></div>`;
  };
  // Bien démarrer : cinq étapes cochées d'après ce que l'utilisateur a vraiment fait
  const startHtml = () => {
    const st = starter(state);
    return `<ol class="gd-steps">${st.steps.map((x, i) => `<li class="gd-step ${x.ok ? "ok" : ""}">
        <span class="gd-num" ${x.ok ? `role="img" aria-label="${DONE}"` : `aria-hidden="true"`}>${x.ok ? I.check : i + 1}</span>
        <div class="grow"><b>${fr(x.t)}</b><p class="xs muted">${fr(x.d)}</p>
          ${x.ok ? "" : `<button type="button" class="btn btn-soft btn-sm mt-s" data-step="${x.id}">${goLabel(x.go)}</button>`}</div></li>`).join("")}</ol>
      ${st.all ? `<div class="card banner b-green gd-bravo"><div class="bi">${I.trophy}</div><div class="grow"><b>Les bases sont acquises !</b><div class="small muted">Explore les autres parties du guide pour tout connaître.</div></div></div>`
        : `<p class="gd-count"><span class="xs muted">Étapes faites</span> <b class="tnum small">${st.n}/${st.total}</b></p>`}`;
  };
  const draw = () => {
    const seen = seenSet(state);
    $$("[data-sec]", tabs).forEach(b => { const on = !q && b.dataset.sec === cur; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    if (q) {
      const hits = search(q, tr);
      body.innerHTML = hits.length ? `<div class="gd-list">${hits.map(it => itemHtml(it, seen, true)).join("")}</div>`
        : `<div class="card empty gd-empty">${I.search}<b>Aucune fonction trouvée</b>Essaie un autre mot : scanner, record, rappel, 3D…</div>`;
    } else {
      const s = secOf(cur);
      body.innerHTML = `<div class="gd-sec-h"><h3 class="h3">${fr(s.name)}</h3><p class="xs muted">${fr(s.sub)}</p></div>
        ${cur === "start" ? startHtml() : `<div class="gd-list">${ITEMS.filter(it => it.sec === cur).map(it => itemHtml(it, seen, false)).join("")}</div>`}`;
    }
    drawProg();
  };
  const select = id => {
    cur = id; q = ""; input.value = "";
    draw();
    // la partie choisie reste visible dans la rangée, et le haut de la partie sous les yeux
    const b = $(`[data-sec="${id}"]`, tabs);
    b?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce() ? "auto" : "smooth" });
    if (sh.el.scrollTop > tabs.offsetTop) sh.el.scrollTop = tabs.offsetTop - 8;
  };

  sh.el.addEventListener("click", e => {
    const tab = e.target.closest("[data-sec]");
    if (tab) return select(tab.dataset.sec);
    const row = e.target.closest(".gd-row");
    if (row) {
      const it = row.closest(".gd-it"), d = $(".gd-d", it), open = row.getAttribute("aria-expanded") !== "true";
      row.setAttribute("aria-expanded", String(open));
      d.hidden = !open;
      it.classList.toggle("open", open);
      if (open && markSeen(it.dataset.id)) {
        it.classList.add("ok");
        const st = $(".gd-st", row);
        st.innerHTML = I.check; st.removeAttribute("aria-hidden"); st.setAttribute("role", "img"); st.setAttribute("aria-label", FOUND);
        drawProg();
      }
      return;
    }
    const go = e.target.closest("[data-go]");
    if (go) { const it = ITEMS.find(x => x.id === go.dataset.go); markSeen(it.id); return run(it, sh); }
    const step = e.target.closest("[data-step]");
    if (step) return run(STARTER.find(x => x.id === step.dataset.step), sh);
  });
  input.addEventListener("input", () => { q = input.value.trim(); draw(); });
  draw();
  requestAnimationFrame(() => $(`[data-sec="${cur}"]`, tabs)?.scrollIntoView({ block: "nearest", inline: "center" }));
  checkRemind(() => { if (current?.sh === sh) draw(); });
  current = { sh, show: id => { if (secOf(id)) select(id); }, draw };
}

/* ---------- Carte « Bien démarrer » (Accueil) ---------- */
export function guideCard() {
  const st = starter(state);
  if (!showStarter(state, st)) return "";
  return `<section class="card gd-card mt-s" id="gd-card">
    <button type="button" class="gd-card-main" id="gd-open">
      <span class="gd-card-ic" aria-hidden="true">🚀</span>
      <span class="grow gd-card-t"><b>Bien démarrer</b><span class="xs muted gd-card-next"><span>Prochaine étape :</span> <span>${fr(st.next.t)}</span></span>
        <span class="gd-card-bar" aria-hidden="true"><i style="transform:scaleX(${Math.max(0.04, st.n / st.total).toFixed(2)})"></i></span></span>
      <b class="gd-card-n tnum">${st.n}/${st.total}</b>
    </button>
    <button type="button" class="icon-btn plain gd-card-x" id="gd-hide" aria-label="Masquer">${I.x}</button>
  </section>`;
}
export function bindGuideCard(root) {
  const card = $("#gd-card", root);
  const bind = () => {
    $("#gd-open", root)?.addEventListener("click", () => openGuide("start"));
    $("#gd-hide", root)?.addEventListener("click", () => {
      (state.guide ||= {}).hide = true; save();
      $("#gd-card", root)?.remove();
      toast("Le guide reste dans Moi → Réglages → Découvrir GREATNESS, et derrière le bouton « ? » de chaque écran.", 5000);
    });
  };
  bind();
  // rappels déjà actifs : la carte se met à jour sur place
  if (card) checkRemind(() => { const c = $("#gd-card", root); if (!c) return; const html = guideCard(); if (html) { c.outerHTML = html; bind(); } else c.remove(); });
  // les cinq étapes faites : on le fête une fois
  const st = starter(state);
  if (st.all && !state.guide?.done && !state.guide?.hide && (state.sessions || []).length < 20) {
    (state.guide ||= {}).done = Date.now(); save();
    setTimeout(() => { toast("Bien joué, tu maîtrises les bases ! Tout le reste est dans le guide : touche « ? » en haut d'un écran.", 5000); mascot.react("party"); }, 900);
  }
}

/* ---------- Écouteurs de toute l'app ---------- */
if (typeof document !== "undefined" && document.addEventListener) {
  // boutons « ? » des en-têtes, et tout bouton [data-guide]
  document.addEventListener("click", e => { const b = e.target.closest?.("[data-guide]"); if (b) openGuide(b.dataset.guide); });
  addEventListener("greatness:guide", e => openGuide(e.detail));
  addEventListener("greatness:used", e => { if (typeof e.detail === "string" && markSeen(`used:${e.detail}`)) current?.draw(); });
}
