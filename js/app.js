import { EXERCISES, GOALS, QUOTES } from "./data.js";
import { state, save, resetAll, currentUser, rankInfo, streak, weekStats, exerciseHistory, allPrograms, getProgram, e1rm, exName, sessionsOn, tombstone } from "./store.js";
import { generateWeekPlan, ensureWeekPlan, todaysMission, weekStrip, estimateMinutes, adaptToGoal, cycleInfo } from "./planner.js";
import { idleTip } from "./brain.js";
import { testKey, resetClient } from "./ai.js";
import { thwip, webSvg, speak } from "./fx.js";
import { spidey } from "./spidey.js";
import { renderTrain, openProgram } from "./train.js";
import { startLive, startWithWarmup, isLive, resumeLive, savedSession, discardSaved } from "./live.js";
import { BADGES, checkBadges } from "./badges.js";
import { renderFriends, renderImport, syncSocial, onSocial, unreadCount, FEED_ICON } from "./social.js";
import { showAuth, emblem } from "./auth.js";
import { logout, isOnlineMode, syncStatus, onSyncStatus, onRemoteUpdate, changePin, push, forget, resumeSession, touchSession, SESSION_MS } from "./cloud.js";
import * as llm from "./llm.js";
import { renderCoach } from "./coach.js";
import { renderCreate } from "./create.js";
import { applyAppearance, ACCENTS, MODES, ZOOMS } from "./actions.js";
import { mountAnims } from "./anim.js";
import { chart } from "./chart.js";
import { liftRecords, recordsWallHtml, curvesHtml, bindCurves, strengthLevel } from "./records.js";
import { photosSection, mountPhotos } from "./photos.js";
import { demoBtn, wireDemos } from "./demo.js";
import { pushBlocker, pushEnabled, enablePush, disablePush, refreshPush } from "./push.js";
import { $, $$, esc, I, spider, fmtNum, fmtTime, toast, sheet, confirmSheet, ring, animateRings } from "./ui.js";
import { coachName } from "./chars/index.js";
import { coachCard, coachGallery } from "./coach-picker.js";
import { renderFood, foodHomeCard, bindFoodCard } from "./food.js";
import { pruneFood } from "./nutrition.js";
import { reviewCard, bindReviewCard, reviewsHtml, bindReviews, openReview } from "./review.js";
import { addMemory, removeMemory } from "./memory.js";
import { openTargets } from "./food.js";

const view = $("#view");
wireDemos();
let current = "home";

/* =========================================================
   Router
   ========================================================= */
let params = {};
const routes = { "": home, train: () => renderTrain(view, launch), create: () => renderCreate(view, launch, params), import: () => renderImport(view, params.s), coach: () => renderCoach(view), food: () => renderFood(view), progress, profile };
// Position de chaque écran : sert au sens du glissement entre onglets (et entre Stats / Amis / Réglages).
const TAB_POS = { home: 0, train: 1, create: 2, food: 3, coach: 4, progress: 5, profile: 5, import: 5 };
let shown = null; // écran affiché : { key, tab, sub }
function route() {
  const [key, qs] = location.hash.replace(/^#\/?/, "").split("?");
  params = Object.fromEntries(new URLSearchParams(qs || ""));
  current = key || "home";
  applyAppearance(state.profile);
  if (!currentUser && resumeSession()) { setTimeout(offerResume, 600); }
  if (!currentUser) { shown = null; return showAuth(view, () => { if (!isOnlineMode()) llm.autoload(); route(); offerResume(); }); }
  if (!state.profile.onboarded) { shown = null; return onboarding(); }
  if (state.meta.prunedOn !== new Date().toDateString()) { pruneFood(state); state.meta.prunedOn = new Date().toDateString(); save({ silent: true }); }
  document.body.classList.remove("hide-tabs");
  $$(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === current || (a.dataset.tab === "me" && ["progress", "profile"].includes(current))));
  const next = { key: current, tab: TAB_POS[current] ?? 0, sub: current === "profile" ? 2 : current === "progress" && progressTab === "friends" ? 1 : 0 };
  const prev = shown;
  shown = next;
  const same = prev && prev.key === next.key && prev.sub === next.sub; // simple rafraîchissement du même écran
  const subSwitch = prev && !same && prev.tab === next.tab;            // Stats ↔ Amis ↔ Réglages
  const y = window.scrollY;
  // pastille du contrôle segmenté : on retient sa position pour la faire glisser après le rendu
  const oldSeg = subSwitch ? view.querySelector(".seg[id]") : null;
  const segFrom = oldSeg ? [...oldSeg.children].findIndex(b => b.classList.contains("on")) : -1;
  view.className = "view";
  view.innerHTML = "";
  try { (routes[key] || home)(); }
  catch (err) {
    // un écran qui plante ne doit jamais laisser une page vide : on propose de recharger
    console.error(err);
    view.innerHTML = `<div class="empty" style="margin-top:30vh"><b>Oups, cet écran a eu un souci.</b><p class="small muted">Tes données sont en sécurité.</p><button class="btn btn-primary mt" onclick="location.reload()">Recharger</button></div>`;
  }
  if (same) {
    window.scrollTo(0, y); // pas d'animation ni de saut en haut : le contenu se met à jour sur place
  } else {
    const dir = prev ? Math.sign(subSwitch ? next.sub - prev.sub : next.tab - prev.tab) : 0;
    view.style.setProperty("--pg-x", `${dir * 20}px`);
    view.style.setProperty("--pg-y", dir ? "0px" : "10px");
    const seg = oldSeg && view.querySelector(`#${oldSeg.id}`);
    if (seg) {
      // l'en-tête reste en place, seule la suite glisse ; la pastille part de l'ancien onglet
      for (const c of view.children) { c.classList.add("pg-keep"); if (c === seg || c.contains(seg)) break; }
      if (segFrom >= 0) {
        seg.style.setProperty("--i", segFrom);
        getComputedStyle(seg, "::before").transform; // fige le point de départ
        seg.style.removeProperty("--i");
      }
    }
    view.classList.add(prev ? "pg-in" : "stagger");
    window.scrollTo(0, 0);
  }
  setTimeout(() => spidey.settle(), 400);
  setSocialBadge();
  setTimeout(socialTick, 2500);
  const fresh = checkBadges();
  if (fresh.length) setTimeout(() => { toast(`${fresh[0].icon} Succès débloqué : ${fresh[0].name}`, 3500); spidey.react("party"); }, 600);
}
addEventListener("hashchange", route);

const launch = (program, readiness) => startLive(program, readiness, route);
launch.warmup = (id, program, readiness) => startWithWarmup(id, program, readiness, route);
// Visite guidée : le coach choisi présente chaque onglet.
const TOUR = () => [
  ["home", `Salut, c'est ${coachName()} ! Ici, l'Accueil : ta mission du jour, ta semaine et tes stats. Touche un jour pour changer sa séance.`],
  ["train", "Séances : 40 programmes prêts, de la mobilité, des étirements et des séances anti-douleur, plus la séance libre où tu choisis tes exercices au fur et à mesure."],
  ["create", "Créer : compose tes propres séances, génère-en une en 2 touches, fais des superséries."],
  ["food", "Repas : note ce que tu manges en scannant le code-barres, en cherchant l'aliment, ou en décrivant ton assiette (ou en la prenant en photo) : je calcule calories et protéines face à ton objectif."],
  ["coach", `Coach, c'est moi, ${coachName()} ! Pose-moi n'importe quelle question, ou demande-moi de modifier l'app pour toi.`],
  ["me", "Moi : tes progrès, tes amis et tes réglages. C'est aussi là que tu peux changer de coach. Allez, à toi de jouer !"],
];
export function startTour(i = 0) {
  const T = TOUR();
  $$(".tabbar a").forEach(a => a.classList.remove("tour-focus"));
  spidey.quiet = i < T.length;
  if (i >= T.length || !state.profile.mascot) {
    spidey.quiet = false;
    state.profile.toured = true; save();
    return;
  }
  const [tab, text] = T[i];
  $(`.tabbar a[data-tab="${tab}"]`)?.classList.add("tour-focus");
  spidey.say(`${text}`, { ms: 60000, action: { label: i < T.length - 1 ? `Suivant (${i + 1}/${T.length})` : "C'est parti !", fn: () => startTour(i + 1) } });
}

// Séance interrompue (app fermée) : on propose de la reprendre dès le déverrouillage.
function offerResume() {
  const saved = savedSession();
  if (!saved || isLive()) return;
  const done = saved.plan.reduce((a, e) => a + e.done.length, 0);
  const sh = sheet(`<div class="banner" style="padding:0"><div class="bi">${I.play}</div><div><h2 class="h2">Reprendre ta séance ?</h2>
    <p class="small muted" style="margin:2px 0 0">${esc(saved.program.name)} · ${done} série${done > 1 ? "s" : ""} déjà faite${done > 1 ? "s" : ""}. Tout a été sauvegardé.</p></div></div>
    <div class="grid2 mt"><button class="btn btn-soft" id="rs-drop">Abandonner</button><button class="btn btn-primary" id="rs-go">${I.play} Reprendre</button></div>`, { z: 80 });
  $("#rs-go", sh.el).onclick = () => { sh.close(); resumeLive(saved, route); };
  $("#rs-drop", sh.el).onclick = () => { sh.close(); discardSaved(); route(); };
}

export const startFree = () => launch({ id: "free", name: "Séance libre", tag: "Exercices au choix", free: true, exercises: [] }, { sleep: 4, energy: 3, soreness: 2 });

// Actions déclenchées par le coach
addEventListener("greatness:start", e => {
  if (e.detail === "free") return startFree();
  const p = e.detail === "today" ? todaysMission().program : getProgram(e.detail);
  if (p) openProgram(p, launch);
});
addEventListener("greatness:mascot", e => spidey.setEnabled(e.detail));

/* =========================================================
   Accueil
   ========================================================= */
const DAYS_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
// Salutation selon l'heure, petite phrase selon l'état de la journée
function greeting(hour) {
  return hour < 5 ? "Patrouille de nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : hour < 22 ? "Bonsoir" : "Patrouille de nuit";
}
function homeSubline(m, hasSessions) {
  if (m.doneToday) return "Mission accomplie. Ton corps te dit merci.";
  if (m.rest) return "Jour de récup : c'est là que tes muscles grandissent.";
  if (!hasSessions) return "Ta toute première mission t'attend. On y va ?";
  return "Ta mission du jour est prête. On s'y met ?";
}
const fmtSetReps = e => {
  const [lo, hi] = e.reps || [];
  const r = lo == null ? "" : lo === hi ? `${lo}` : `${lo}–${hi}`;
  return `${e.sets} × ${r}${EXERCISES[e.id]?.type === "time" ? " s" : ""}`;
};
const fmtDec = (v, d) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

// Chiffres qui défilent jusqu'à leur valeur, une seule fois, seulement quand ils sont visibles.
function countUp(root) {
  const els = $$("[data-count]", root);
  if (!els.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = el => {
    const to = +el.dataset.count, dec = +(el.dataset.dec || 0);
    if (reduce || !to) { el.textContent = fmtDec(to, dec); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      if (!el.isConnected) return;
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtDec(to * e, dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!("IntersectionObserver" in window)) return els.forEach(run);
  const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } }), { threshold: .4 });
  els.forEach(el => io.observe(el));
}

function home() {
  const p = state.profile;
  const r = rankInfo();
  const m = todaysMission();
  const week = weekStrip();
  const ws = weekStats(), prev = weekStats(1);
  const doneName = m.doneToday ? sessionsOn(new Date()).pop().name : null;
  const prog = adaptToGoal(m.doneToday ? getProgram("mobility") : m.program);
  const now = new Date();
  const planned = Math.max(1, Object.values(ensureWeekPlan()).filter(id => id !== "mobility").length);
  const saved = savedSession();
  const cyc = cycleInfo();
  const st = streak();
  const has = state.sessions.length > 0;
  const recentPRs = state.sessions.slice().reverse().flatMap(s => s.prs.map(id => ({ id, set: s.sets.filter(x => x.exId === id).sort((a, b) => e1rm(b.weight, b.reps) - e1rm(a.weight, a.reps) || b.reps - a.reps)[0] }))).slice(0, 3);
  const dateLabel = `${DAYS_FULL[now.getDay()]} ${now.getDate()} ${now.toLocaleDateString("fr-FR", { month: "long" })}`;
  const kind = m.doneToday ? "done" : m.rest ? "rest" : "go";
  const shown = prog.exercises.length > 5 ? 4 : prog.exercises.length;
  const left = Math.max(0, planned - ws.count);
  const tons = ws.volume >= 10000;
  const volPct = prev.volume ? Math.min(1, ws.volume / prev.volume) : ws.volume ? 1 : 0;

  view.innerHTML = `
    <header class="home-head">
      <div class="logo">${spider()}GREATNESS</div>
      <div class="hh-chips">
        ${st ? `<a href="#/progress" class="chip hh-streak" aria-label="${st} jour${st > 1 ? "s" : ""} d'affilée">${I.flame}<b class="tnum">${st}</b></a>` : ""}
        <a href="#/progress" class="chip hh-lvl">${I.trophy}<span>Niv. <b class="tnum">${r.level}</b></span></a>
      </div>
    </header>
    <div class="hello">
      <div class="eyebrow hello-date">${dateLabel}</div>
      <h1 class="h1">${greeting(now.getHours())}, <span class="hello-name">${esc(p.name)}</span></h1>
      <p class="hello-sub">${homeSubline(m, has)}</p>
    </div>

    ${saved ? `<section class="card banner resume mt"><div class="bi">${I.play}</div><div class="grow"><b>Séance en cours</b><div class="small muted ellipsis">${esc(saved.program.name)} · ${saved.plan.reduce((a, e) => a + e.done.length, 0)} série(s) faite(s)</div></div>
      <div class="banner-actions"><button class="btn btn-ghost btn-sm" id="drop">Abandonner</button><button class="btn btn-primary btn-sm" id="resume">${I.play} Reprendre</button></div></section>` : ""}
    ${cyc.deload ? `<section class="card banner b-blue mt"><div class="bi">${I.moon}</div><div class="grow"><b>Semaine allégée</b><div class="small muted">Charges allégées après 6 semaines d'efforts : récupère pour repartir plus fort.</div></div></section>`
      : cyc.next === 1 ? `<section class="card banner b-amber mt"><div class="bi">${I.bolt}</div><div class="grow"><b>Dernière semaine du cycle</b><div class="small muted">Semaine allégée la semaine prochaine : donne tout !</div></div></section>` : ""}

    <section class="card mission m-${kind} mt">
      ${webSvg("orn")}
      <div class="m-top">
        <span class="m-tag">${kind === "done" ? `${I.check} Séance du jour terminée` : kind === "rest" ? `${I.moon} Jour de récupération` : `<i class="m-pulse" aria-hidden="true"></i> Mission du jour`}</span>
        ${m.rest || m.doneToday || m.program.cat === "cardio" ? "" : `<span class="m-goal">${GOALS[p.goal].name}</span>`}
      </div>
      <h2 class="m-title">${esc(doneName || m.program.name)}</h2>
      <p class="m-sub">${m.doneToday ? "Bravo ! Un peu de mobilité t'aidera à bien récupérer." : esc(m.program.tag || "")}</p>
      ${m.doneToday ? "" : `
      <div class="m-meta">
        <span>${I.clock}~${estimateMinutes(prog)} min</span>
        <span>${prog.exercises.length} exercice${prog.exercises.length > 1 ? "s" : ""}</span>
      </div>
      <ol class="m-list">${prog.exercises.slice(0, shown).map((e, k) => `<li><span class="m-n">${k + 1}</span><span class="m-ex">${esc(EXERCISES[e.id].name)}</span><span class="m-sets tnum">${fmtSetReps(e)}</span></li>`).join("")}
        ${prog.exercises.length > shown ? `<li class="m-more"><span class="m-n">+${prog.exercises.length - shown}</span><span class="m-ex">autre${prog.exercises.length - shown > 1 ? "s" : ""} exercice${prog.exercises.length - shown > 1 ? "s" : ""}</span></li>` : ""}</ol>
      `}
      <div class="m-cta">
        <button class="btn ${m.doneToday ? "btn-soft" : "btn-primary"} btn-lg grow" id="go">${I.play} ${m.doneToday ? "Mobilité · 15 min" : m.rest ? "Lancer la récup" : "Commencer"}</button>
        <a href="#/train" class="btn btn-soft btn-lg m-swap" aria-label="Changer de séance" title="Changer de séance">${I.swap}</a>
      </div>
    </section>

    ${reviewCard(now)}
    ${socialCard()}
    <div class="quick mt-s">
      <button class="card quick-tile" id="free"><span class="qi">${I.bolt}</span><span class="qt"><b>Séance libre</b><small>Au feeling</small></span></button>
      <a class="card quick-tile" href="#/create"><span class="qi qi-blue">${I.plus}</span><span class="qt"><b>Créer</b><small>Sur mesure</small></span></a>
    </div>
    ${foodHomeCard()}

    <div class="section"><h2>${spider("emb")}Ta semaine</h2><button id="edit-week">Modifier</button></div>
    <div class="card week-card">
      <div class="week">${week.map(d => {
        const real = d.program && d.program.id !== "mobility";
        const cls = d.done ? "done" : real ? (d.past ? "missed" : "planned") : d.program ? "mob" : "off";
        return `<button class="day ${cls} ${d.today ? "today" : ""}" data-d="${d.i}" aria-label="${d.label} ${d.num} : ${esc(d.done ? "fait" : d.program?.name || "repos")}" title="${esc(d.program?.name || "Repos")}">
          <span class="d">${d.today ? "Auj." : d.label}</span><span class="n tnum">${d.num}</span>
          <span class="dot">${d.done ? I.check : real ? esc(shortName(d.program)) : d.program ? "M" : I.moon}</span></button>`;
      }).join("")}</div>
      <div class="week-foot"><span class="small muted">${ws.count >= planned ? `<b class="ok">Semaine bouclée !</b> ${ws.count} séance${ws.count > 1 ? "s" : ""} au compteur.` : `<b>${ws.count}/${planned}</b> séance${planned > 1 ? "s" : ""} · plus que ${left} !`}</span>
        <span class="week-bar" aria-hidden="true"><i style="transform:scaleX(${Math.min(1, ws.count / planned)})"></i></span></div>
    </div>

    ${has ? `<div class="section"><h2>Cette semaine</h2><a href="#/progress">Stats</a></div>
    <div class="hstats">
      <div class="card hs hs-red">${ring(Math.min(1, ws.count / planned), I.play, 52)}<div class="hs-v"><span data-count="${ws.count}">0</span><small>/${planned}</small></div><div class="hs-l">Séances</div></div>
      <div class="card hs hs-amber">${ring(Math.min(1, st / 7), I.flame, 52)}<div class="hs-v"><span data-count="${st}">0</span><small>j</small></div><div class="hs-l">D'affilée</div></div>
      <div class="card hs hs-green">${ring(volPct, I.bolt, 52)}<div class="hs-v"><span data-count="${tons ? ws.volume / 1000 : ws.volume}" ${tons ? 'data-dec="1"' : ""}>0</span><small>${tons ? "t" : "kg"}</small></div><div class="hs-l">Volume</div></div>
    </div>` : `<div class="card home-empty mt">
      <span class="he-ic">${I.flame}</span>
      <div class="grow"><b>Allume ta première flamme</b><p>Termine ta première mission : ta série démarre et tes stats prennent vie ici.</p></div>
    </div>`}

    <a href="#/progress" class="card tap rank mt">
      ${ring(r.pct, r.level, 60)}
      <div class="grow"><div class="eyebrow">Rang · Niveau ${r.level}</div><div class="h3 rank-name">${r.rank.name}</div>
        <div class="bar mt-s"><i style="width:${Math.max(2, r.pct * 100)}%"></i></div>
        <div class="xs muted mt-s tnum">${fmtNum(r.xp)} XP${r.next ? ` · ${fmtNum(r.next.xp - r.xp)} avant « ${r.next.name} »` : " · rang maximum"}</div></div>
    </a>

    ${recentPRs.length ? `<div class="section"><h2>Derniers records</h2><a href="#/progress">Tout voir</a></div>
    <div class="card card-list prs">${recentPRs.map(x => `<div class="pr-row"><span class="pr-ic">${I.trophy}</span><span class="pr-name ellipsis">${esc(exName(x.id))}</span><span class="pr-val tnum">${x.set ? (x.set.weight ? x.set.weight + " kg × " : "") + x.set.reps : ""}</span><span class="delta p">PR</span></div>`).join("")}</div>` : ""}

    <figure class="quote"><span class="q-mark" aria-hidden="true">“</span><blockquote>${QUOTES[now.getDate() % QUOTES.length]}</blockquote></figure>`;

  $("#go").onclick = () => openProgram(m.doneToday ? getProgram("mobility") : m.program, launch);
  $("#free").onclick = () => startFree();
  bindFoodCard(view);
  $("#soc-open")?.addEventListener("click", () => { progressTab = "friends"; location.hash = "#/progress"; });
  const wk = bindReviewCard(view);
  if (wk && !state.reviews?.[wk]?.hinted) {
    (state.reviews ||= {})[wk] = { ...state.reviews[wk], hinted: Date.now() }; save({ silent: true });
    setTimeout(() => { if (!document.querySelector(".sheet-wrap") && location.hash.replace(/^#\/?/, "") === "") spidey.say("Ton bilan de la semaine est prêt : ta note, tes points forts et quoi ajuster.", { action: { label: "Voir mon bilan", fn: () => openReview(wk) } }); }, 1800);
  }
  $("#resume")?.addEventListener("click", () => resumeLive(saved, route));
  $("#drop")?.addEventListener("click", async () => { if (await confirmSheet("Abandonner la séance en cours ?", "Les séries faites ne seront pas enregistrées.", "Abandonner", true)) { discardSaved(); route(); } });
  const daysOff = has ? (Date.now() - state.sessions[state.sessions.length - 1].date) / 864e5 : 0;
  if (daysOff >= 3) setTimeout(() => spidey.sleep?.(`Zzz… ${Math.floor(daysOff)} jours sans séance. Réveille-moi avec une mission !`), 1500);
  $$(".day").forEach(d => d.onclick = () => editDay(+d.dataset.d));
  $("#edit-week").onclick = () => editDay((now.getDay() + 6) % 7);
  animateRings(view);
  countUp(view);
}

// Actus des amis non lues (dépassé au classement, duel, record…) : carte sur l'accueil
function socialCard() {
  const feed = (state.social?.feed || []).filter(e => !e.read);
  if (!feed.length) return "";
  const e = feed[0];
  return `<button class="card banner soc-card mt-s" id="soc-open"><span class="soc-ic" aria-hidden="true">${FEED_ICON[e.kind] || "⚔️"}</span>
    <div class="grow"><b>${feed.length > 1 ? `${feed.length} actus de tes amis` : "Du nouveau chez tes amis"}</b><div class="small muted soc-t">${esc(e.text)}</div></div>${I.chev}</button>`;
}
// Pastille du nombre d'actus non lues sur l'onglet « Moi »
function setSocialBadge(n = unreadCount()) {
  const a = $('.tabbar a[data-tab="me"]');
  if (!a) return;
  let b = a.querySelector(".tab-badge");
  if (!n) return void b?.remove();
  if (!b) { b = document.createElement("i"); b.className = "tab-badge"; a.appendChild(b); }
  b.textContent = n > 9 ? "9+" : n;
}
onSocial(n => setSocialBadge(n));
// Actus des amis : mises à jour à l'ouverture et au retour sur l'app (au plus toutes les 10 min)
let socialAt = 0;
async function socialTick() {
  if (!currentUser || !isOnlineMode() || Date.now() - socialAt < 10 * 60e3) return;
  socialAt = Date.now();
  refreshPush();
  const ev = await syncSocial();
  if (!ev.length || isLive()) return;
  const top = ev.find(e => e.kind === "inv" || e.kind === "over" || e.kind === "duel") || ev[0];
  toast(`${FEED_ICON[top.kind] || ""} ${top.text}`, 5000);
  if (current === "home" && !document.querySelector(".sheet-wrap")) route();
}

function shortName(p) {
  const map = { push: "P", pull: "T", legs: "J", push_b: "P", pull_b: "T", legs_b: "J", upper: "H", upper_b: "H", lower: "B", lower_b: "B", full_a: "F", full_b: "F", hiit: "C", cardio_rope: "C", mobility: "M", core: "A", arms: "Br", glutes: "Fe" };
  return map[p.id] || p.name[0].toUpperCase();
}

function editDay(i) {
  const plan = ensureWeekPlan();
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const sh = sheet(`<div class="eyebrow">Programme de la semaine</div><h2 class="h2" style="margin-top:4px">${days[i]}</h2>
    <div class="chips mt">${days.map((d, k) => `<button class="chip ${k === i ? "on" : ""}" data-k="${k}">${d.slice(0, 3)}</button>`).join("")}</div>
    <div class="mt">
      <div class="pick-item ${!plan[i] ? "sel" : ""}" data-p=""><div><div style="font-weight:600">Repos</div><div class="xs muted">Récupération complète</div></div><div class="add">${!plan[i] ? I.check : I.moon}</div></div>
      ${allPrograms().map(p => `<div class="pick-item ${plan[i] === p.id ? "sel" : ""}" data-p="${p.id}"><div><div style="font-weight:600">${esc(p.name)}</div><div class="xs muted">${esc(p.tag || "")}</div></div>
        <div class="add">${plan[i] === p.id ? I.check : I.plus}</div></div>`).join("")}
    </div>`);
  $$("[data-k]", sh.el).forEach(b => b.onclick = () => { sh.close(); setTimeout(() => editDay(+b.dataset.k), 230); });
  $$("[data-p]", sh.el).forEach(b => b.onclick = () => {
    if (b.dataset.p) plan[i] = b.dataset.p; else delete plan[i];
    save(); sh.close(); route();
    toast(`${days[i]} : ${b.dataset.p ? getProgram(b.dataset.p).name : "repos"}`);
  });
}

/* =========================================================
   Progrès
   ========================================================= */
let monthOffset = 0, progressTab = "me";
function progress() {
  // lien d'une notification « amis » : #/progress?t=friends
  if (params.t === "friends" || params.t === "me") { progressTab = params.t; params = {}; history.replaceState(null, "", "#/progress"); }
  const p = state.profile;
  const head = `<header class="me-head"><div class="grow"><div class="eyebrow">Moi</div><h1 class="h1 ellipsis">${esc(p.name)}</h1></div>${meAvatar(p.name)}</header>`;
  if (progressTab === "friends") {
    view.innerHTML = `${head}${progressSeg()}<div id="friends"></div>`;
    bindProgressSeg();
    return renderFriends($("#friends"));
  }
  const all = state.sessions;
  const totalVol = all.reduce((a, s) => a + s.volume, 0);
  const totalMin = Math.round(all.reduce((a, s) => a + s.durationSec, 0) / 60);
  const r = rankInfo(), st = streak();
  const weeks = Array.from({ length: 8 }, (_, i) => ({ ...weekStats(7 - i), i }));
  const maxW = Math.max(1, ...weeks.map(w => w.volume));
  const past = weeks.slice(0, 7).filter(w => w.volume);
  const avg = past.length ? past.reduce((a, w) => a + w.volume, 0) / past.length : 0;
  const cur = weeks[7];
  const lifts = Object.entries(state.lifts).filter(([id]) => EXERCISES[id]).sort((a, b) => (b[1].date || 0) - (a[1].date || 0));
  const got = BADGES.filter(b => state.badges?.[b.id]);
  const badges = [...got, ...BADGES.filter(b => !state.badges?.[b.id])];
  const hist = all.slice().reverse().slice(0, 60);
  const dec = n => n.toFixed(1).replace(".", ",").replace(",0", "");
  const vsAvg = avg && cur.volume ? Math.round((cur.volume / avg - 1) * 100) : null;

  view.innerHTML = `${head}
    ${progressSeg()}
    <section class="card me-hero mt">
      <div class="me-rank">${ring(r.pct, r.level, 64)}
        <div class="grow"><div class="eyebrow">Niveau ${r.level}</div><div class="h3 ellipsis">${esc(r.rank.name)}</div>
          <div class="bar"><i style="width:${Math.max(2, r.pct * 100)}%"></i></div>
          <div class="xs muted">${r.next ? `${fmtNum(r.next.xp - r.xp)} XP avant « ${esc(r.next.name)} »` : "Rang maximum atteint, respect."}</div></div></div>
      <div class="me-kpis">
        <div><b class="num">${all.length}</b><span>Séances</span></div>
        <div><b class="num">${totalVol >= 10000 ? dec(totalVol / 1000) + "<small>t</small>" : fmtNum(totalVol) + "<small>kg</small>"}</b><span>Volume</span></div>
        <div><b class="num">${totalMin >= 120 ? dec(totalMin / 60) + "<small>h</small>" : totalMin + "<small>min</small>"}</b><span>Temps</span></div>
        <div class="${st ? "hot" : ""}"><b class="num">${st}<small>j</small></b><span>Série</span></div>
      </div>
    </section>

    <div class="section"><h2>${spider("emb")}Activité</h2></div>
    <div class="card cal-card">${calendar()}</div>
    ${reviewsHtml()}

    <div class="section"><h2>Volume par semaine</h2></div>
    <div class="card vol-card">
      <div class="row between"><div><div class="vol-big num">${fmtNum(cur.volume)}<small> kg</small></div><div class="xs muted">cette semaine</div></div>
        ${vsAvg != null ? `<span class="chip ${vsAvg >= 0 ? "green" : "amber"}">${vsAvg >= 0 ? "+" : ""}${vsAvg} % vs moyenne</span>` : `<span class="xs dim">${cur.volume ? "" : "Pas encore de séance"}</span>`}</div>
      <div class="vbars">${avg ? `<i class="avg" style="--y:${(avg / maxW).toFixed(3)}"><span>moy.</span></i>` : ""}${weeks.map((w, k) => `<div class="b ${w.i === 7 ? "cur" : ""}"><div class="col"><div class="f" style="height:${Math.max(3, (w.volume / maxW) * 100)}%;animation-delay:${k * 45}ms" title="${fmtNum(w.volume)} kg"></div></div>
        <span>${w.i === 7 ? "Auj." : "S-" + (7 - w.i)}</span></div>`).join("")}</div>
    </div>

    ${curvesHtml()}

    <div class="section"><h2>Mur des records</h2>${lifts.length ? `<button class="me-add" id="rec-all">Tout voir</button>` : ""}</div>
    ${lifts.length ? recordsWallHtml(liftRecords())
      : `<div class="card empty">${I.trophy}<b>Aucun record pour l'instant</b>Ils apparaîtront après ta première séance.</div>`}

    <div class="section"><h2>Corps</h2><button class="me-add" id="body-add">${I.plus}Mesurer</button></div>
    ${bodyCard()}
    ${photosSection()}

    <div class="section"><h2>Succès</h2><span class="xs muted"><b class="tnum" style="color:var(--text)">${got.length}</b> / ${BADGES.length}</span></div>
    <div class="badges few" id="badges">${badges.map((b, i) => `<div class="badge-card ${state.badges?.[b.id] ? "on" : ""}" style="--i:${i}" title="${esc(b.desc)}"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}</div>
    <button class="btn btn-ghost btn-sm btn-block mt-s more-btn" id="badges-more">Voir les ${BADGES.length} succès</button>

    <div class="section"><h2>Historique</h2>${all.length ? `<span class="xs muted">${all.length} séance${all.length > 1 ? "s" : ""}</span>` : ""}</div>
    ${hist.length ? `<div class="card card-list hist few" id="hist">${hist.map(sessRow).join("")}</div>
      ${hist.length > 8 ? `<button class="btn btn-ghost btn-sm btn-block mt-s more-btn" id="hist-more">Voir plus de séances</button>` : ""}`
      : `<div class="card empty">${I.clock}<b>Aucune séance pour l'instant</b>Ta première mission t'attend dans l'onglet Séances.</div>`}`;

  bindReviews(view);
  bindCurves(view);
  mountAnims(view);
  mountPhotos(view);
  animateRings(view);
  bindProgressSeg();
  $("#body-add").onclick = bodySheet;
  $("#rec-all")?.addEventListener("click", () => {
    const sh = sheet(`<h2 class="h2">Tous mes records</h2><p class="small muted" style="margin:6px 0 0">1RM estimé pour les charges, meilleure série sinon.</p>
      <div class="card card-list mt">${lifts.map(([id, l]) => recRow(id, l)).join("")}</div>`);
    $$("[data-ex]", sh.el).forEach(el => el.onclick = () => exerciseSheet(el.dataset.ex));
  });
  $("#mp").onclick = () => { monthOffset--; route(); };
  $("#mn").onclick = () => { if (monthOffset < 0) { monthOffset++; route(); } };
  $$("[data-ex]").forEach(el => el.onclick = () => exerciseSheet(el.dataset.ex));
  const more = (btn, box, on, off) => btn && (btn.onclick = () => { const few = box.classList.toggle("few"); btn.textContent = few ? off : on; });
  more($("#badges-more"), $("#badges"), "Réduire", `Voir les ${BADGES.length} succès`);
  more($("#hist-more"), $("#hist"), "Réduire", "Voir plus de séances");
  $$(".sess").forEach(el => el.onclick = e => { if (!e.target.closest("[data-del]")) el.classList.toggle("open"); });
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (!(await confirmSheet("Supprimer cette séance ?", "Elle sera retirée de ton historique.", "Supprimer", true))) return;
    state.sessions = state.sessions.filter(s => s.id !== b.dataset.del); tombstone("sessions", b.dataset.del); save(); route();
  });
}

// Pastille avec l'initiale (en-tête de l'onglet Moi)
const meAvatar = name => `<div class="avatar me-av" aria-hidden="true">${esc((name || "?").charAt(0).toUpperCase())}</div>`;
const durTxt = sec => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };

function recRow(id, l) {
  const ex = EXERCISES[id], load = ex.type === "load";
  const h = load ? exerciseHistory(id) : [];
  const gain = h.length >= 2 ? Math.round(Math.max(...h.map(x => x.e1rm)) - h[0].e1rm) : 0;
  return `<button class="rec" data-ex="${id}"><div class="grow"><b class="rec-n">${esc(ex.name)}</b><span class="ellipsis">${esc(ex.muscle || "")}</span></div>
    <div class="rec-v"><b class="num">${load ? `${Math.round(l.best)}<small> kg</small>` : `${l.bestReps}<small>${ex.type === "time" ? " s" : " reps"}</small>`}</b>${gain > 0 ? `<span class="up">+${gain} kg</span>` : ""}</div>${I.chev}</button>`;
}

function sessRow(s) {
  const d = new Date(s.date);
  return `<article class="sess" data-id="${s.id}">
    <div class="sess-top"><span class="sess-ic">${esc((s.name || "?").charAt(0).toUpperCase())}</span>
      <div class="grow"><b class="ellipsis">${esc(s.name)}</b><span class="ellipsis">${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span></div>
      <span class="chip green">+${s.xp} XP</span></div>
    <div class="sess-meta"><span>${I.clock}${durTxt(s.durationSec)}</span><span>${fmtNum(s.volume)} kg</span><span>${s.sets.length} séries</span>${s.prs.length ? `<span class="pr">${I.trophy}${s.prs.length} PR</span>` : ""}</div>
    <div class="det">${s.note ? `<div class="note-line">${I.edit}<span>${esc(s.note)}</span></div>` : ""}${groupSets(s.sets)}<button class="btn btn-danger btn-sm mt" data-del="${s.id}">${I.trash} Supprimer</button></div>
  </article>`;
}

// Onglet « Moi » : Stats, Amis & défis, Réglages
const progressSeg = (on = current === "profile" ? "settings" : progressTab) => `<div class="seg mt" id="ptabs">
  <button data-t="me" class="${on === "me" ? "on" : ""}">Stats</button><button data-t="friends" class="${on === "friends" ? "on" : ""}">Amis<span class="seg-x"> & défis</span>${unreadCount() && on !== "friends" ? `<i class="seg-dot" aria-label="Nouvelles actus"></i>` : ""}</button><button data-t="settings" class="${on === "settings" ? "on" : ""}">Réglages</button></div>`;
function bindProgressSeg() {
  $$("#ptabs button").forEach(b => b.onclick = () => {
    if (b.dataset.t === "settings") return void (location.hash = "#/profile");
    progressTab = b.dataset.t;
    if (current === "progress") route(); else location.hash = "#/progress";
  });
}

const BODY = [["weight", "Poids", "kg"], ["waist", "Tour de taille", "cm"], ["chest", "Poitrine", "cm"], ["arm", "Bras", "cm"], ["thigh", "Cuisse", "cm"]];
function bodyCard() {
  const b = state.body || [];
  if (!b.length) return `<div class="card empty">${I.edit}<b>Suis ta transformation</b>Note ton poids et tes mensurations : tu verras ton corps changer, pas seulement tes charges.</div>`;
  const last = b[b.length - 1], first = b[0];
  const diff = (k, u) => {
    if (last[k] == null || first[k] == null || b.length < 2) return "";
    const d = last[k] - first[k], txt = `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1).replace(".0", "").replace(".", ",")} ${u}`;
    return `<span class="delta ${d <= 0 ? "n" : "p"}">${txt}</span>`;
  };
  const pts = b.filter(x => x.weight).map(x => ({ x: x.date, y: x.weight }));
  return `<div class="card body-card">
    <div class="body-kpis">${BODY.filter(([k]) => last[k] != null).slice(0, 3).map(([k, l, u]) => `<div><div class="num">${String(last[k]).replace(".", ",")}<small> ${u}</small></div><div class="xs muted ellipsis">${l}</div>${diff(k, u)}</div>`).join("")}</div>
    ${pts.length >= 2 ? `<div class="mt">${chart(pts, { unit: "kg", dec: 1 })}</div>` : ""}
    <div class="xs dim mt-s">Dernière mesure le ${new Date(last.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · ${b.length} mesure${b.length > 1 ? "s" : ""}</div></div>`;
}
function bodySheet() {
  const last = (state.body || []).slice(-1)[0] || { weight: state.profile.bodyweight };
  const sh = sheet(`<h2 class="h2">Mes mesures du jour</h2><p class="small muted" style="margin:6px 0 0">Remplis seulement ce que tu veux suivre.</p>
    <div class="grid2 body-form">${BODY.map(([k, l, u]) => `<label class="field"><span>${l} <i class="dim">(${u})</i></span><input class="input" id="b-${k}" type="number" inputmode="decimal" step="0.1" placeholder="${last[k] ?? ""}"/></label>`).join("")}</div>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="b-save">Enregistrer</button></div>`);
  $("#b-save", sh.el).onclick = () => {
    const e = { date: Date.now() };
    BODY.forEach(([k]) => { const v = parseFloat($(`#b-${k}`, sh.el).value.replace(",", ".")); if (v > 0) e[k] = v; });
    if (Object.keys(e).length < 2) return toast("Entre au moins une mesure.");
    state.body ||= []; state.body.push(e);
    if (e.weight) state.profile.bodyweight = e.weight;
    save(); sh.close(); route(); toast("Mesures enregistrées ✓");
  };
}

// Fichier calendrier (.ics) : un événement répété chaque semaine pour chaque jour prévu.
function downloadIcs() {
  const plan = ensureWeekPlan(), p = state.profile;
  const [hh, mm] = (p.remindAt || "18:00").split(":").map(Number);
  const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const today = new Date();
  const events = Object.entries(plan).filter(([, id]) => id !== "mobility").map(([d, id]) => {
    const prog = getProgram(id);
    const start = new Date(today); start.setHours(hh, mm, 0, 0);
    start.setDate(start.getDate() + ((+d - ((today.getDay() + 6) % 7) + 7) % 7));
    const end = new Date(start.getTime() + estimateMinutes(prog) * 60000);
    return ["BEGIN:VEVENT", `UID:greatness-${d}-${id}@raykatsu.github.io`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d]}`, `SUMMARY:🕷️ GREATNESS · ${prog?.name || "Séance"}`, "DESCRIPTION:Ta mission t'attend : https://raykatsu.github.io/GREATNESS/",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Ta séance commence bientôt !", `TRIGGER:-PT${p.remindBefore ?? 15}M`, "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  if (!events.length) return 0;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GREATNESS//FR", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "greatness-seances.ics";
  a.click();
  return events.length;
}

function calendar() {
  const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth() + monthOffset);
  const y = ref.getFullYear(), mo = ref.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7;
  const n = new Date(y, mo + 1, 0).getDate();
  const done = new Set(state.sessions.filter(s => { const d = new Date(s.date); return d.getFullYear() === y && d.getMonth() === mo; }).map(s => new Date(s.date).getDate()));
  const today = new Date(), plan = state.weekPlan || {};
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<div class="c out"></div>`);
  for (let d = 1; d <= n; d++) {
    const date = new Date(y, mo, d);
    const isToday = date.toDateString() === today.toDateString();
    const planned = !done.has(d) && date > today && plan[(date.getDay() + 6) % 7] != null;
    cells.push(`<div class="c${done.has(d) ? " on" : ""}${isToday ? " today" : ""}${planned ? " plan" : ""}"><span>${d}</span></div>`);
  }
  const st = streak();
  return `<div class="cal-head"><b class="h3">${ref.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b>
      <div class="row" style="gap:2px"><button class="icon-btn plain" id="mp" aria-label="Mois précédent">${I.back}</button><button class="icon-btn plain" id="mn" aria-label="Mois suivant" ${monthOffset >= 0 ? "disabled" : ""}>${I.chev}</button></div></div>
    <div class="cal">${["L", "M", "M", "J", "V", "S", "D"].map(d => `<div class="h">${d}</div>`).join("")}${cells.join("")}</div>
    <div class="cal-foot"><span><i class="lg on"></i>${done.size} jour${done.size > 1 ? "s" : ""} d'entraînement</span>${monthOffset === 0 ? `<span><i class="lg plan"></i>Prévu</span>` : ""}${monthOffset === 0 && st ? `<span class="hot">${I.flame}${st} j d'affilée</span>` : ""}</div>`;
}

function groupSets(sets) {
  const g = {};
  sets.forEach(s => (g[s.name] ||= []).push(s));
  return `<div class="sets-g">${Object.entries(g).map(([n, arr]) => `<div><b>${esc(exName(arr[0].exId) || n)}</b><div class="sets-p">${arr.map(s => `<span>${s.weight ? s.weight + "×" : ""}${s.reps}${s.rpe ? `<i>@${s.rpe}</i>` : ""}</span>`).join("")}</div></div>`).join("")}</div>`;
}

function exerciseSheet(id) {
  const ex = EXERCISES[id];
  const hist = exerciseHistory(id);
  const load = ex.type === "load";
  const pts = hist.map(h => ({ x: h.date, y: load ? h.e1rm : h.top.reps }));
  const unit = load ? "kg" : ex.type === "time" ? "s" : "reps";
  const marks = [];
  pts.reduce((m, p, i) => { if (p.y > m && i) marks.push(i); return Math.max(m, p.y); }, pts[0]?.y ?? 0);
  const best = load ? state.lifts[id]?.best : state.lifts[id]?.bestReps;
  const lvl = strengthLevel(id, best, { bw: +state.profile.bodyweight || 75, sex: state.profile.sex });
  const sh = sheet(`<div class="eyebrow">${esc(ex.muscle)}</div><h2 class="h2" style="margin-top:4px">${esc(ex.name)}</h2>
    <div class="grid2 mt">
      <div class="card stat"><div class="v">${load ? Math.round(state.lifts[id]?.best || 0) + "<small>kg</small>" : (state.lifts[id]?.bestReps || 0) + `<small>${unit}</small>`}</div><div class="l">${load ? "Meilleur 1RM estimé" : "Record"}</div></div>
      <div class="card stat"><div class="v">${hist.length}</div><div class="l">Séance${hist.length > 1 ? "s" : ""}</div></div>
    </div>
    ${lvl ? `<div class="card mt lvl-card"><div class="row between"><div><div class="eyebrow">Niveau de force</div><b class="h3">${esc(lvl.name)}</b></div>${lvl.ratio ? `<span class="chip">${lvl.ratio.toFixed(2).replace(".", ",")}× ton poids</span>` : ""}</div>
      <div class="lvl-steps">${["Débutant", "Novice", "Inter.", "Avancé", "Élite"].map((n, i) => `<span class="${i < lvl.level ? "done" : i === lvl.level ? "cur" : ""}">${n}</span>`).join("")}</div>
      <div class="xs muted">${lvl.next ? `${lvl.nextName} : ${lvl.reps ? `${lvl.next} reps` : `${lvl.next.toLocaleString("fr-FR")} kg au 1RM estimé`}. Repères indicatifs selon ton poids de corps.` : "Niveau élite : chapeau."}</div></div>` : ""}
    <div class="card mt"><div class="eyebrow" style="margin-bottom:10px">${load ? "1RM estimé" : ex.type === "time" ? "Meilleure série (s)" : "Meilleure série (reps)"}</div>${chart(pts, { unit, time: true, marks, trend: true })}</div>
    <div class="section"><h2>Technique</h2></div>
    <div class="cues" style="margin-top:0"><div class="grow">${ex.cues.map(c => `<div>${esc(c)}</div>`).join("")}</div>${demoBtn(id, "demo-tile")}</div>
    <div class="section"><h2>Dernières séances</h2></div>
    <div class="card card-list">${hist.slice().reverse().slice(0, 8).map(h => `<div class="ex-h"><span class="small">${new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
      <div class="sets-p">${h.sets.map(s => `<span>${s.weight ? s.weight + "×" : ""}${s.reps}</span>`).join("")}</div></div>`).join("") || `<div class="empty">Pas encore d'historique.</div>`}</div>`);
  mountAnims(sh.el);
}

// Pastilles d'icônes des Réglages (façon iOS)
const GOAL_ICON = { force: "🏋️", muscle: "💪", seche: "🔥", forme: "⚡" };
const SIC = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8.5 9.5a5 5 0 0 1 7 0L13 12"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  calplus: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4zM17 9a4 4 0 0 1 0 6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.2" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  half: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
  text: '<path d="M4 18 8.5 6h1L14 18M5.5 14h6.5M16 18l2.5-7h1L22 18M16.8 15.6h4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>',
  notif: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M10.5 17.5h3"/><circle cx="17.5" cy="5.5" r="2.5" fill="currentColor"/>',
  at: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 8.5v5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
  down: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  up: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
};
const sic = (k, c) => `<span class="set-ic" style="--c:${c}">${k === "spider" ? spider() : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SIC[k]}</svg>`}</span>`;

/* =========================================================
   Profil
   ========================================================= */
// Ce que le coach sait de toi : visible, modifiable, effaçable
function memorySheet() {
  const sh = sheet(`<h2 class="h2">Ce que le coach sait de toi</h2>
    <p class="muted small">Il s'en sert dans toutes ses réponses et ses séances. Dans le Coach, dis-lui simplement « retiens que… ».</p>
    <div id="mem-list" class="mem-list mt-s"></div>
    <label class="field"><span>Ajouter une info</span><input class="input" id="mem-in" maxlength="200" placeholder="Ex : épaule gauche fragile, pas de développé militaire"/></label>
    <button class="btn btn-primary btn-block mt-s" id="mem-add">${I.plus} Ajouter</button>`);
  const draw = () => {
    const list = state.memory || [];
    $("#mem-list", sh.el).innerHTML = list.length ? list.slice().reverse().map(m => `<div class="mem-row"><span class="grow">${esc(m.text)}<small class="xs muted">${m.src === "ai" ? "retenu par le coach" : "ajouté par toi"} · ${new Date(m.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small></span>
      <button class="icon-btn plain" data-del="${m.id}" aria-label="Oublier">${I.trash}</button></div>`).join("") : `<div class="a-empty">${I.info}<b>Rien pour l'instant</b><span>Blessures, matériel, préférences, horaires : tout ce qui aide le coach à te connaître.</span></div>`;
    $$("[data-del]", sh.el).forEach(b => b.onclick = () => { removeMemory(state, b.dataset.del); save(); draw(); toast("Oublié"); });
  };
  $("#mem-add", sh.el).onclick = () => {
    const input = $("#mem-in", sh.el);
    if (addMemory(state, input.value, "user")) { input.value = ""; save(); draw(); toast("Retenu ✓"); } else input.focus();
  };
  draw();
}

function profile() {
  const p = state.profile;
  const r = rankInfo();
  view.innerHTML = `
    <header class="me-head"><div class="grow"><div class="eyebrow">Moi</div><h1 class="h1 ellipsis">${esc(p.name)}</h1></div>${meAvatar(p.name)}</header>
    ${progressSeg("settings")}
    <div id="coach-card" class="mt"></div>
    <div class="card rank me-id mt">${ring(r.pct, r.level, 56)}<div class="grow"><div class="eyebrow">Rang · niveau ${r.level}</div><div class="h3 ellipsis">${esc(r.rank.name)}</div><div class="xs muted">${fmtNum(r.xp)} XP · @${esc(currentUser)}</div></div></div>

    <h2 class="set-title">Toi</h2>
    <div class="card card-list set-list">
      <label class="set-row">${sic("user", "#3b82f6")}<b class="grow">Prénom</b><input class="set-in" id="p-name" value="${esc(p.name)}" maxlength="30" autocomplete="given-name"/></label>
      <label class="set-row">${sic("scale", "#14b8a6")}<b class="grow">Poids de corps</b><span class="set-unit"><input class="set-in" id="p-bw" type="number" inputmode="decimal" value="${p.bodyweight}"/>kg</span></label>
    </div>

    <h2 class="set-title">Objectif</h2>
    <div class="opts set-goals">${Object.entries(GOALS).map(([k, g]) => `<button class="opt ${p.goal === k ? "on" : ""}" data-goal="${k}"><i>${GOAL_ICON[k] || "🎯"}</i><b>${g.name}</b><span>${g.mainReps[0]}–${g.mainReps[1]} reps · repos ${g.mainRest >= 120 ? Math.round(g.mainRest / 60) + " min" : g.mainRest + " s"}</span></button>`).join("")}</div>

    <h2 class="set-title">Mon programme</h2>
    <div class="card card-list set-list">
      <div class="set-row stack"><div class="set-lbl">${sic("cal", "#ef4444")}<b>Séances par semaine</b></div>
        <div class="seg" id="days">${[2, 3, 4, 5, 6].map(d => `<button data-v="${d}" class="${p.days === d ? "on" : ""}">${d}</button>`).join("")}</div></div>
      <div class="set-row stack"><div class="set-lbl">${sic("dumbbell", "#f59e0b")}<b>Matériel</b></div>
        <div class="seg" id="equip">${[["gym", "Salle"], ["db", "Haltères"], ["home", "Rien"]].map(([v, l]) => `<button data-v="${v}" class="${p.equipment === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <label class="toggle set-row">${sic("moon", "#6366f1")}<div class="grow"><b>Semaine allégée auto</b><span class="xs muted">Toutes les 7 semaines, charges et volume réduits</span></div><input type="checkbox" id="p-deload" ${p.deload !== false ? "checked" : ""}/></label>
      <button class="set-row set-act" id="regen">${sic("refresh", "var(--red)")}<b class="grow">Régénérer mon programme</b>${I.chev}</button>
    </div>

    <h2 class="set-title">Coach & sons</h2>
    <div class="card card-list set-list">
      <label class="toggle set-row">${sic("spider", "var(--red)")}<div class="grow"><b>Coach animé</b><span class="xs muted">Ton coach se balade à l'écran</span></div><input type="checkbox" id="p-mascot" ${p.mascot ? "checked" : ""}/></label>
      <label class="toggle set-row">${sic("mic", "#8b5cf6")}<div class="grow"><b>Consignes vocales</b><span class="xs muted">Le coach te parle pendant la séance</span></div><input type="checkbox" id="p-voice" ${p.voice ? "checked" : ""}/></label>
      <label class="toggle set-row">${sic("sound", "#ec4899")}<div class="grow"><b>Sons</b><span class="xs muted">Bips de repos, toile</span></div><input type="checkbox" id="p-sound" ${p.sound ? "checked" : ""}/></label>
      <button class="set-row set-act" id="p-memory">${sic("user", "#0ea5e9")}<div class="grow"><b>Ce que le coach sait de toi</b><span class="xs muted">${(state.memory || []).length ? `${state.memory.length} info${state.memory.length > 1 ? "s" : ""} retenue${state.memory.length > 1 ? "s" : ""}` : "Blessures, matériel, préférences…"}</span></div>${I.chev}</button>
      <button class="set-row set-act" id="p-nutri">${sic("scale", "#22c55e")}<div class="grow"><b>Objectifs nutrition</b><span class="xs muted">Calories, protéines, eau</span></div>${I.chev}</button>
    </div>

    <h2 class="set-title">Apparence</h2>
    <div class="card card-list set-list">
      <div class="set-row stack"><div class="set-lbl">${sic("palette", "#f97316")}<b>Couleur</b></div>
        <div class="swatches">${Object.entries(ACCENTS).map(([k, [c]]) => `<button class="swatch ${(p.accent || "rouge") === k ? "on" : ""}" data-accent="${k}" style="--c:${c}" aria-label="${k}"></button>`).join("")}</div></div>
      <div class="set-row stack"><div class="set-lbl">${sic("half", "#64748b")}<b>Fond</b></div>
        <div class="seg" id="mode">${Object.entries(MODES).map(([k, l]) => `<button data-v="${k}" class="${(p.mode || "dark") === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="set-row stack"><div class="set-lbl">${sic("text", "#0ea5e9")}<b>Taille du texte</b></div>
        <div class="seg" id="zoom">${ZOOMS.map((z, i) => `<button data-v="${z}" class="${(p.zoom || 1) === z ? "on" : ""}">${["Normal", "Grand", "Très grand"][i]}</button>`).join("")}</div></div>
    </div>
    <p class="set-note">Astuce : demande au coach « passe l'app en vert » ou « mode clair ».</p>

    <h2 class="set-title">Rappels</h2>
    <div class="card card-list set-list">
      <label class="set-row">${sic("clock", "#3b82f6")}<b class="grow">Heure de la séance</b><input class="set-in" id="rem-time" type="time" value="${p.remindAt || "18:00"}"/></label>
      <label class="set-row">${sic("bell", "#f59e0b")}<b class="grow">Alerte</b><select class="set-in" id="rem-before">${[[0, "À l'heure"], [15, "15 min avant"], [30, "30 min avant"], [60, "1 h avant"]].map(([v, l]) => `<option value="${v}" ${(p.remindBefore ?? 15) == v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="toggle set-row">${sic("notif", "#ef4444")}<div class="grow"><b>Notifications</b><span class="xs muted" id="push-why">${esc(pushBlocker() || "Rappels les jours de séance, et défis de tes amis (duel, dépassé au classement)")}</span></div><input type="checkbox" id="p-push" ${pushBlocker() ? "disabled" : ""}/></label>
      <button class="set-row set-act" id="rem-ics">${sic("calplus", "#22c55e")}<b class="grow">Ajouter à mon calendrier</b>${I.chev}</button>
    </div>
    <p class="set-note">Une notification avant chaque séance prévue, même app fermée. Ou ajoute-les à ton calendrier.</p>

    <div class="set-title row between"><h2>Compte</h2><span class="chip ${isOnlineMode() ? "green" : ""}" id="sync">${syncLabel()}</span></div>
    <div class="card card-list set-list">
      <div class="set-row">${sic("at", "#64748b")}<div class="grow"><b>@${esc(currentUser)}</b><span class="xs muted">${isOnlineMode() ? "Compte en ligne : retrouve-le sur n'importe quel téléphone" : "Compte enregistré sur cet appareil"}</span></div></div>
      <label class="toggle set-row">${sic("lock", "#64748b")}<div class="grow"><b>Code à chaque ouverture</b><span class="xs muted">Sinon l'app reste ouverte 12 h après ta dernière utilisation</span></div><input type="checkbox" id="p-pinlock" ${p.pinLock ? "checked" : ""}/></label>
      <button class="set-row set-act" id="acc-pin">${sic("key", "#f59e0b")}<b class="grow">Changer mon code</b>${I.chev}</button>
      <button class="set-row set-act" id="acc-lock">${sic("lock", "#3b82f6")}<b class="grow">Verrouiller / changer de compte</b>${I.chev}</button>
      <button class="set-row set-act danger" id="acc-forget">${sic("out", "var(--danger)")}<div class="grow"><b>Retirer ce compte de cet appareil</b><span class="xs muted">${isOnlineMode() ? "Le compte reste en ligne" : "Supprime le compte et ses données"}</span></div>${I.chev}</button>
    </div>

    <h2 class="set-title">Données</h2>
    <div class="card card-list set-list">
      <button class="set-row set-act" id="exp">${sic("down", "#22c55e")}<b class="grow">Exporter une sauvegarde</b>${I.chev}</button>
      <label class="set-row set-act">${sic("up", "#3b82f6")}<b class="grow">Importer une sauvegarde</b>${I.chev}<input type="file" id="imp" accept="application/json" hidden/></label>
    </div>
    <p class="set-note">Tes données restent sur ce téléphone. Exporte-les de temps en temps pour garder une copie.</p>

    <div class="set-title row between"><h2>IA intelligente</h2><span class="chip" id="llm-chip"></span></div>
    <div class="card" id="llm-box"></div>

    <details class="card adv mt"><summary>IA Claude (facultatif, payant)</summary>
      <p class="small muted">Sans clé, ton coach fonctionne gratuitement et hors ligne. Avec une clé API Anthropic (payante à l'usage), Claude affine chaque série, fait le briefing, le débrief et répond librement.</p>
      <label class="toggle"><div><b>Activer Claude</b></div><input type="checkbox" id="p-ai" ${p.aiEnabled ? "checked" : ""}/></label>
      <label class="field"><span>Clé API</span><input class="input" id="p-key" type="password" placeholder="sk-ant-…" value="${esc(p.aiKey)}" autocomplete="off"/></label>
      <button class="btn btn-blue btn-sm mt" id="p-test">Tester la connexion</button>
    </details>

    <div class="card card-list set-list mt-l">
      <button class="set-row set-act" id="tour-again"><span class="set-ic" style="--c:var(--red)">${spider()}</span><b class="grow">Revoir la visite guidée</b>${I.chev}</button>
      <button class="set-row set-act danger" id="reset">${sic("trash", "var(--danger)")}<b class="grow">Effacer mes séances et réglages</b>${I.chev}</button>
    </div>
    <p class="set-foot">${spider()}GREATNESS · ton sympathique coach de quartier</p>`;
  animateRings(view);
  bindProgressSeg();
  coachCard($("#coach-card"), { open: params.coach === "1" });
  $("#tour-again")?.addEventListener("click", () => { location.hash = "#/"; setTimeout(startTour, 500); });

  $$("[data-goal]").forEach(b => b.onclick = () => { p.goal = b.dataset.goal; save(); route(); toast(`Objectif : ${GOALS[p.goal].name}. Reps et repos adaptés.`); spidey.react("happy"); });
  $$("#days button").forEach(b => b.onclick = () => { p.days = +b.dataset.v; save(); $$("#days button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("#equip button").forEach(b => b.onclick = () => { p.equipment = b.dataset.v; save(); $$("#equip button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("[data-accent]").forEach(b => b.onclick = () => { p.accent = b.dataset.accent; save(); applyAppearance(); $$("[data-accent]").forEach(x => x.classList.toggle("on", x === b)); });
  $$("#mode button").forEach(b => b.onclick = () => { p.mode = b.dataset.v; save(); applyAppearance(); $$("#mode button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("#zoom button").forEach(b => b.onclick = () => { p.zoom = +b.dataset.v; save(); applyAppearance(); $$("#zoom button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#p-deload").onchange = e => { p.deload = e.target.checked; save(); };
  const saveRem = () => { p.remindAt = $("#rem-time").value || "18:00"; p.remindBefore = +$("#rem-before").value; save(); };
  $("#rem-time").onchange = $("#rem-before").onchange = saveRem;
  pushEnabled().then(on => { const c = $("#p-push"); if (c) c.checked = on; });
  $("#p-push").onchange = async e => {
    const c = e.target; c.disabled = true;
    try {
      if (c.checked) { saveRem(); await enablePush(); toast(`Notifications activées : rappel ${p.remindBefore ? p.remindBefore + " min avant" : "à"} ${p.remindAt} les jours de séance, et défis de tes amis.`, 4500); }
      else { await disablePush(); toast("Notifications désactivées."); }
    } catch (err) { c.checked = false; toast(err.message || "Impossible d'activer les notifications.", 5000); }
    c.disabled = false;
  };
  $("#rem-ics").onclick = () => {
    p.remindAt = $("#rem-time").value || "18:00"; p.remindBefore = +$("#rem-before").value; save();
    const n = downloadIcs();
    toast(n ? `${n} séance(s) par semaine ajoutée(s) : ouvre le fichier pour les mettre dans ton calendrier.` : "Aucune séance prévue dans ton programme.", 4500);
  };
  $("#regen").onclick = () => { state.weekPlan = generateWeekPlan(); save(); toast("Nouveau programme prêt"); spidey.say(`Programme de ${p.days} séances créé. Regarde l'accueil !`, { mood: "happy" }); };
  const bind = (id, fn) => $(id).addEventListener("change", e => { fn(e.target); save(); });
  bind("#p-name", t => (p.name = t.value.trim().slice(0, 30) || p.name));
  bind("#p-bw", t => (p.bodyweight = +t.value || 75));
  bind("#p-mascot", t => { p.mascot = t.checked; spidey.setEnabled(t.checked); });
  bind("#p-voice", t => { p.voice = t.checked; if (t.checked) speak("Consignes vocales activées."); });
  bind("#p-sound", t => (p.sound = t.checked));
  $("#p-memory").onclick = () => memorySheet();
  $("#p-nutri").onclick = () => openTargets();
  bind("#p-pinlock", t => (p.pinLock = t.checked));
  bind("#p-ai", t => { p.aiEnabled = t.checked; });
  bind("#p-key", t => { p.aiKey = t.value.trim(); resetClient(); });
  $("#p-test").onclick = async () => {
    p.aiKey = $("#p-key").value.trim(); p.aiEnabled = true; $("#p-ai").checked = true; save(); resetClient();
    if (!p.aiKey) return toast("Ajoute d'abord ta clé.");
    toast("Connexion…");
    try { const t = await testKey(); toast("✓ " + t, 5000); } catch (err) { toast("Échec : " + (err.message || err), 5000); }
  };
  $("#exp").onclick = () => {
    const data = { ...state, profile: { ...state.profile, aiKey: "" } };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `greatness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $("#imp").onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.sessions)) throw new Error("format");
      Object.assign(state, { sessions: data.sessions, lifts: data.lifts || {}, customPrograms: data.customPrograms || [], weekPlan: data.weekPlan || null });
      state.profile = { ...state.profile, ...data.profile, aiKey: state.profile.aiKey };
      save(); toast("Données importées"); route();
    } catch { toast("Fichier invalide"); }
  };

  // Compte
  $("#acc-lock").onclick = () => { logout(); route(); };
  $("#acc-pin").onclick = () => pinSheet();
  $("#acc-forget").onclick = async () => {
    const online = isOnlineMode();
    if (!(await confirmSheet("Retirer ce compte ?", online ? "Il disparaîtra de ce téléphone mais restera en ligne : tu pourras te reconnecter avec ton pseudo et ton code." : "Le compte, ses séances et ses stats seront supprimés de ce téléphone. Irréversible.", "Retirer", true))) return;
    const u = currentUser;
    if (online) await push();
    logout(); forget(u); route();
  };
  // IA locale
  const drawLlm = () => {
    const box = $("#llm-box"), chip = $("#llm-chip");
    if (!box) return;
    const i = llm.info(), pr = llm.prefs();
    chip.textContent = !llm.supported() ? "Indisponible" : i.ready ? "Active" : i.status === "loading" ? `${Math.round(i.progress * 100)} %` : pr.enabled ? "Activée" : "Désactivée";
    chip.className = `chip ${i.ready ? "green" : ""}`;
    if (!llm.supported()) { box.innerHTML = `<p class="small muted" style="margin:0">Ce navigateur ne gère pas WebGPU, nécessaire pour faire tourner l'IA sur le téléphone. Essaie Chrome (Android, ordinateur) ou Safari à jour (iPhone).</p>`; return; }
    box.innerHTML = `<p class="small muted" style="margin:0 0 12px">Un modèle d'IA qui tourne sur ton téléphone : gratuit, privé, il marche même sans internet. Choisis sa taille :</p>
      <div class="models">${llm.MODELS.filter(llm.modelAllowed).map(m => `<button class="opt ${m.id === pr.model ? "on" : ""}" data-model="${m.id}"><b>${m.name}</b><span>${m.size} · ${m.note}</span></button>`).join("")}</div>
      ${i.status === "loading" ? `<div class="bar mt"><i style="width:${i.progress * 100}%"></i></div><p class="xs muted mt-s">${esc(i.progressText)}</p>` : ""}
      ${i.status === "error" ? `<p class="small mt-s" style="color:#ff7b88">${esc(i.error)}</p>` : ""}
      <div class="grid2 mt">${pr.enabled || i.ready ? `<button class="btn btn-soft btn-sm" id="llm-off">Désactiver</button><button class="btn btn-danger btn-sm" id="llm-del">Supprimer les fichiers</button>` : `<button class="btn btn-primary btn-sm" id="llm-on" style="grid-column:span 2">${I.sparkle} Activer l'IA</button>`}</div>`;
    $$("[data-model]", box).forEach(b => b.onclick = async () => {
      const was = llm.prefs().enabled;
      await llm.disable();
      if (was) llm.enable(b.dataset.model); else { localStorage.setItem("greatness.llm", JSON.stringify({ ...llm.prefs(), model: b.dataset.model })); drawLlm(); }
    });
    $("#llm-on", box)?.addEventListener("click", () => llm.enable(llm.prefs().model));
    $("#llm-off", box)?.addEventListener("click", () => llm.disable());
    $("#llm-del", box)?.addEventListener("click", async () => { await llm.disable({ removeFiles: true }); toast("Fichiers de l'IA supprimés"); });
  };
  const off = llm.onChange(() => (document.body.contains($("#llm-box")) ? drawLlm() : off()));
  drawLlm();
  $("#reset").onclick = async () => { if (await confirmSheet("Effacer mes données ?", "Les séances, records et réglages de ce compte seront effacés. Irréversible.", "Tout effacer", true)) resetAll(); };
}

/* =========================================================
   Première ouverture
   ========================================================= */
const draft = { name: "", goal: "muscle", bodyweight: 75, days: 3, equipment: "gym" };
function onboarding(step = 1) {
  if (step === 1 && !draft.name) draft.name = state.profile.name || "";
  document.body.classList.add("hide-tabs");
  const p = state.profile;
  const total = 4;
  const steps = `<div class="onb-top"><div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${step}">${Array.from({ length: total }, (_, k) => `<i class="${k + 1 < step ? "on" : k + 1 === step ? "on cur" : ""}"></i>`).join("")}</div><span class="onb-count">Étape ${step} sur ${total}</span></div>`;
  view.className = "view";
  void view.offsetWidth;
  view.className = "view enter";
  if (step === 1) {
    view.innerHTML = `<div class="onb onb-flow">${steps}
      <div class="onb-hero">${emblem(true)}
        <h1 class="h1 center">Ton coach t'attend.</h1>
        <p class="muted center onb-lead">Ton coach pilote tes séances : il ajuste tes charges à chaque série, gère tes repos et te donne les consignes. Gratuit et hors ligne.</p></div>
      <label class="field onb-name"><span>Comment je t'appelle ?</span><input class="input" id="name" placeholder="Ton prénom" value="${esc(draft.name)}" maxlength="30" autocomplete="given-name"/></label>
      <div class="onb-foot"><button class="btn btn-primary btn-lg btn-block" id="next">Continuer</button></div></div>`;
    setTimeout(() => spidey.say("Salut ! Je suis ton nouveau coach. On fait connaissance ?", { mood: "happy" }), 1200);
    $("#next").onclick = () => { const n = $("#name").value.trim(); if (!n) return toast("Il me faut ton prénom !"); draft.name = n; onboarding(2); };
    $("#name").onkeydown = e => { if (e.key === "Enter") $("#next").click(); };
  } else if (step === 2) {
    view.innerHTML = `<div class="onb onb-flow">${steps}
      <h1 class="h1 onb-h">Choisis ton coach</h1>
      <p class="muted onb-lead">Il t'accompagne à chaque séance et se déplace à sa façon. Tu pourras en changer quand tu veux dans Réglages.</p>
      <div id="onb-coach" class="onb-coach"></div>
      <div class="onb-foot grid2"><button class="btn btn-soft btn-lg" id="prev">Retour</button><button class="btn btn-primary btn-lg" id="next">Continuer</button></div></div>`;
    spidey.hideBubble(); // le bonjour de l'étape 1 ne doit pas masquer la galerie
    coachGallery($("#onb-coach"), { compact: true });
    $("#prev").onclick = () => onboarding(1);
    $("#next").onclick = () => onboarding(3);
  } else if (step === 3) {
    view.innerHTML = `<div class="onb onb-flow">${steps}
      <h1 class="h1 onb-h">Ton objectif, ${esc(draft.name)} ?</h1>
      <p class="muted onb-lead">J'adapte les répétitions, les repos et le programme.</p>
      <div class="opts onb-goals">${Object.entries(GOALS).map(([k, g]) => `<button class="opt ${draft.goal === k ? "on" : ""}" data-goal="${k}"><i>${GOAL_ICON[k] || "🎯"}</i><b>${g.name}</b><span>${{ force: "Soulever plus lourd", muscle: "Prendre du volume", seche: "Perdre du gras", forme: "Être en forme" }[k]}</span></button>`).join("")}</div>
      <label class="field onb-bw"><span>Poids de corps</span><span class="onb-unit"><input class="input" id="bw" type="number" inputmode="decimal" value="${draft.bodyweight}"/><i>kg</i></span></label>
      <div class="onb-foot grid2"><button class="btn btn-soft btn-lg" id="prev">Retour</button><button class="btn btn-primary btn-lg" id="next">Continuer</button></div></div>`;
    $$("[data-goal]").forEach(b => b.onclick = () => { draft.goal = b.dataset.goal; $$("[data-goal]").forEach(x => x.classList.toggle("on", x === b)); });
    $("#prev").onclick = () => onboarding(2);
    $("#next").onclick = () => { draft.bodyweight = +$("#bw").value || 75; onboarding(4); };
  } else {
    view.innerHTML = `<div class="onb onb-flow">${steps}
      <h1 class="h1 onb-h">Ton rythme</h1>
      <p class="muted onb-lead">Je construis ton programme de la semaine. Tu pourras tout modifier.</p>
      <div class="onb-lbl">Séances par semaine</div>
      <div class="seg" id="days">${[2, 3, 4, 5, 6].map(d => `<button data-v="${d}" class="${draft.days === d ? "on" : ""}">${d}</button>`).join("")}</div>
      <div class="onb-lbl">Où t'entraînes-tu ?</div>
      <div class="opts onb-list" id="equip">${[["gym", "En salle", "Barres, machines, poulies", "🏋️"], ["db", "Haltères", "À la maison, avec des haltères", "🏠"], ["home", "Sans matériel", "Au poids du corps, partout", "🤸"]].map(([v, l, s, e]) => `<button class="opt ${draft.equipment === v ? "on" : ""}" data-v="${v}"><i>${e}</i><div><b>${l}</b><span>${s}</span></div></button>`).join("")}</div>
      <div class="onb-foot grid2"><button class="btn btn-soft btn-lg" id="prev">Retour</button><button class="btn btn-primary btn-lg" id="done">C'est parti</button></div></div>`;
    $$("#days button").forEach(b => b.onclick = () => { draft.days = +b.dataset.v; $$("#days button").forEach(x => x.classList.toggle("on", x === b)); });
    $$("#equip .opt").forEach(b => b.onclick = () => { draft.equipment = b.dataset.v; $$("#equip .opt").forEach(x => x.classList.toggle("on", x === b)); });
    $("#prev").onclick = () => onboarding(3);
    $("#done").onclick = () => {
      Object.assign(p, draft, { onboarded: true });
      state.weekPlan = generateWeekPlan();
      save();
      thwip(0.3);
      if (location.hash && location.hash !== "#/") location.hash = "#/"; else route();
      setTimeout(() => { spidey.react("party"); if (!p.toured) startTour(); else spidey.say(`Programme prêt, ${p.name} ! Ta mission du jour t'attend.`, { mood: "party" }); }, 900);
    };
  }
}


const syncLabel = (st = syncStatus()) => ({ local: "Sur l'appareil", syncing: "Synchronisation…", synced: "Synchronisé ✓", offline: "Hors ligne", error: "Reconnexion nécessaire" }[st] || st);
onSyncStatus(st => { const c = $("#sync"); if (c) c.textContent = syncLabel(st); });
onRemoteUpdate(() => { if (!isLive() && !document.querySelector(".sheet-wrap")) route(); });

function pinSheet() {
  const sh = sheet(`<h2 class="h2">Changer mon code</h2>
    <label class="field"><span>Code actuel</span><input class="input" id="old" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password"/></label>
    <label class="field"><span>Nouveau code (4 à 6 chiffres)</span><input class="input" id="new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password"/></label>
    <label class="field"><span>Confirme le nouveau code</span><input class="input" id="new2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6"/></label>
    <p class="err" id="err"></p><button class="btn btn-primary btn-block mt" id="ok">Enregistrer</button>`);
  $("#ok", sh.el).onclick = async () => {
    const o = $("#old", sh.el).value, n = $("#new", sh.el).value, n2 = $("#new2", sh.el).value;
    if (n !== n2) return ($("#err", sh.el).textContent = "Les deux nouveaux codes ne sont pas identiques.");
    try { await changePin(o, n); sh.close(); toast("Code modifié ✓"); } catch (e) { $("#err", sh.el).textContent = e.message; }
  };
}

// Verrouille l'app si elle est restée en arrière-plan plus de 10 minutes.
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); touchSession(); return; }
  if (!currentUser || !hiddenAt || isLive()) return;
  // « Code à chaque ouverture » : verrou après 1 min ; sinon seulement après 12 h sans utiliser l'app
  const limit = state.profile.pinLock ? 60e3 : SESSION_MS;
  if (Date.now() - hiddenAt > limit) { logout(); document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()); route(); }
  else { touchSession(); setTimeout(socialTick, 1500); }
});

/* =========================================================
   Démarrage
   ========================================================= */
$("#corner-web").outerHTML = webSvg("corner-web");
spidey.tip = () => idleTip(current);
spidey.onWeb = () => thwip(0.12);
spidey.onTap = () => {
  const live = document.querySelector(".live .live-head");
  spidey.react(Math.random() < 0.5 ? "party" : "happy");
  if (live) return spidey.say("Concentre-toi, je surveille tes séries !");
  spidey.say(idleTip(current), current === "coach" ? {} : { action: { label: "Pose-moi une question", fn: () => (location.hash = "#/coach") } });
};
spidey.init();
route();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
