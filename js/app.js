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
import { renderFriends, renderImport } from "./social.js";
import { showAuth } from "./auth.js";
import { logout, isOnlineMode, syncStatus, onSyncStatus, onRemoteUpdate, changePin, push, forget } from "./cloud.js";
import * as llm from "./llm.js";
import { renderCoach } from "./coach.js";
import { renderCreate } from "./create.js";
import { applyAppearance, ACCENTS, MODES, ZOOMS } from "./actions.js";
import { animSvg, mountAnims } from "./anim.js";
import { pushBlocker, pushEnabled, enablePush, disablePush } from "./push.js";
import { $, $$, esc, I, spider, fmtNum, fmtTime, toast, sheet, confirmSheet, ring, animateRings } from "./ui.js";

const view = $("#view");
let current = "home";

/* =========================================================
   Router
   ========================================================= */
let params = {};
const routes = { "": home, train: () => renderTrain(view, launch), create: () => renderCreate(view, launch, params), import: () => renderImport(view, params.s), coach: () => renderCoach(view), progress, profile };
// Position de chaque écran : sert au sens du glissement entre onglets (et entre Stats / Amis / Réglages).
const TAB_POS = { home: 0, train: 1, create: 2, coach: 3, progress: 4, profile: 4, import: 4 };
let shown = null; // écran affiché : { key, tab, sub }
function route() {
  const [key, qs] = location.hash.replace(/^#\/?/, "").split("?");
  params = Object.fromEntries(new URLSearchParams(qs || ""));
  current = key || "home";
  applyAppearance(state.profile);
  if (!currentUser) { shown = null; return showAuth(view, () => { llm.autoload(); route(); offerResume(); }); }
  if (!state.profile.onboarded) { shown = null; return onboarding(); }
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
  (routes[key] || home)();
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
  const fresh = checkBadges();
  if (fresh.length) setTimeout(() => { toast(`${fresh[0].icon} Succès débloqué : ${fresh[0].name}`, 3500); spidey.react("party"); }, 600);
}
addEventListener("hashchange", route);

const launch = (program, readiness) => startLive(program, readiness, route);
launch.warmup = (id, program, readiness) => startWithWarmup(id, program, readiness, route);
// Visite guidée : Spider-Man présente chaque onglet.
const TOUR = [
  ["home", "Ici, l'Accueil : ta mission du jour, ta semaine et tes stats. Touche un jour pour changer sa séance."],
  ["train", "Séances : 40 programmes prêts, de la mobilité, des étirements et des séances anti-douleur, plus la séance libre où tu choisis tes exercices au fur et à mesure."],
  ["create", "Créer : compose tes propres séances, génère-en une en 2 touches, fais des superséries."],
  ["coach", "Coach, c'est moi ! Pose-moi n'importe quelle question, ou demande-moi de modifier l'app pour toi."],
  ["me", "Moi : tes progrès, tes amis et tes réglages. Allez, à toi de jouer !"],
];
export function startTour(i = 0) {
  $$(".tabbar a").forEach(a => a.classList.remove("tour-focus"));
  spidey.quiet = i < TOUR.length;
  if (i >= TOUR.length || !state.profile.mascot) {
    spidey.quiet = false;
    state.profile.toured = true; save();
    return;
  }
  const [tab, text] = TOUR[i];
  $(`.tabbar a[data-tab="${tab}"]`)?.classList.add("tour-focus");
  spidey.say(`${text}`, { ms: 60000, action: { label: i < TOUR.length - 1 ? `Suivant (${i + 1}/${TOUR.length})` : "C'est parti !", fn: () => startTour(i + 1) } });
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
function home() {
  const p = state.profile;
  const r = rankInfo();
  const m = todaysMission();
  const week = weekStrip();
  const ws = weekStats();
  const doneName = m.doneToday ? sessionsOn(new Date()).pop().name : null;
  const prog = adaptToGoal(m.doneToday ? getProgram("mobility") : m.program);
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Patrouille de nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : "Bonsoir";
  const planned = Object.values(ensureWeekPlan()).filter(id => id !== "mobility").length;
  const saved = savedSession();
  const cyc = cycleInfo();
  const recentPRs = state.sessions.slice().reverse().flatMap(s => s.prs.map(id => ({ id, set: s.sets.filter(x => x.exId === id).sort((a, b) => e1rm(b.weight, b.reps) - e1rm(a.weight, a.reps) || b.reps - a.reps)[0] }))).slice(0, 3);

  view.innerHTML = `
    <div class="home-head"><div class="logo">${spider()}GREATNESS</div><a href="#/progress" class="chip">${I.trophy} Niv. ${r.level}</a></div>
    <div class="hello"><div class="muted">${hello},</div><h1 class="h1"><span>${esc(p.name)}</span></h1></div>
    ${saved ? `<section class="card banner resume mt"><div class="bi">${I.play}</div><div class="grow"><b>Séance en cours</b><div class="small muted">${esc(saved.program.name)} · ${saved.plan.reduce((a, e) => a + e.done.length, 0)} série(s) faite(s)</div></div>
      <div class="row" style="gap:6px"><button class="btn btn-ghost btn-sm" id="drop">Abandonner</button><button class="btn btn-primary btn-sm" id="resume">Reprendre</button></div></section>` : ""}
    ${cyc.deload ? `<section class="card banner mt"><div class="bi">${I.moon}</div><div><b>Semaine allégée</b><div class="small muted">Après 6 semaines d'efforts : charges et volume réduits cette semaine pour que ton corps récupère et reparte plus fort.</div></div></section>`
      : cyc.next === 1 ? `<section class="card banner mt"><div class="bi">${I.info}</div><div><b>Semaine allégée la semaine prochaine</b><div class="small muted">Donne tout cette semaine !</div></div></section>` : ""}

    <section class="card card-hero mission mt">
      ${webSvg("orn")}
      <div class="eyebrow">${m.doneToday ? "Séance du jour terminée ✓" : m.rest ? "Jour de récupération" : "Mission du jour"}</div>
      <h2>${esc(doneName || m.program.name)}</h2>
      <div class="muted small">${m.doneToday ? "Bravo ! Pour bien récupérer : Mobilité, 15 min." : esc(m.program.tag || "")}</div>
      <div class="meta"><span class="chip">${I.clock} ~${estimateMinutes(prog)} min</span><span class="chip">${prog.exercises.length} exercices</span>
        ${m.rest || m.program.cat === "cardio" ? "" : `<span class="chip blue">${GOALS[p.goal].name}</span>`}</div>
      <div class="ex-preview">${prog.exercises.slice(0, 5).map(e => `<span>${esc(EXERCISES[e.id].name)}</span>`).join("")}${prog.exercises.length > 5 ? `<span>+${prog.exercises.length - 5}</span>` : ""}</div>
      <div class="row mt" style="gap:8px">
        <button class="btn ${m.doneToday ? "btn-soft" : "btn-primary"} btn-lg grow" id="go">${I.play} ${m.doneToday ? "Mobilité" : "Commencer"}</button>
        <a href="#/train" class="btn btn-soft btn-lg" aria-label="Changer de séance">${I.swap}</a>
      </div>
    </section>
    <div class="grid2 mt-s"><button class="btn btn-soft" id="free">${I.bolt} Séance libre</button><a class="btn btn-soft" href="#/create">${I.plus} Créer une séance</a></div>

    <div class="section"><h2>${spider("emb")}Ta semaine</h2><button id="edit-week">Modifier</button></div>
    <div class="week">${week.map(d => `
      <div class="day ${d.today ? "today" : ""} ${d.done ? "done" : d.program && d.program.id !== "mobility" ? "planned" : ""}" data-d="${d.i}" title="${esc(d.program?.name || "Repos")}">
        <span class="d">${d.label}</span><span class="n">${d.num}</span>
        <span class="dot">${d.done ? I.check : d.program ? esc(shortName(d.program)) : "–"}</span></div>`).join("")}</div>

    <div class="grid3 mt">
      <div class="card stat"><div class="v">${streak()}</div><div class="l">Jours d'affilée</div></div>
      <div class="card stat"><div class="v">${ws.count}<small>/${planned}</small></div><div class="l">Séances</div></div>
      <div class="card stat"><div class="v">${ws.volume >= 10000 ? (ws.volume / 1000).toFixed(1) + "<small>t</small>" : fmtNum(ws.volume) + "<small>kg</small>"}</div><div class="l">Volume</div></div>
    </div>

    <a href="#/progress" class="card tap rank mt">
      ${ring(r.pct, r.level)}
      <div class="grow"><div class="eyebrow">Rang</div><div class="h3" style="margin-top:2px">${r.rank.name}</div>
        <div class="bar mt-s"><i style="width:${r.pct * 100}%"></i></div>
        <div class="xs muted mt-s">${r.xp} XP${r.next ? ` · ${r.next.xp - r.xp} XP avant « ${r.next.name} »` : " · rang maximum"}</div></div>
    </a>

    ${recentPRs.length ? `<div class="section"><h2>Derniers records</h2><a href="#/progress">Tout voir</a></div>
    <div class="card" style="padding:4px 16px">${recentPRs.map(x => `<div class="cmp"><span>${esc(exName(x.id))}</span><span class="small muted">${x.set ? (x.set.weight ? x.set.weight + " kg × " : "") + x.set.reps : ""}</span><span class="delta p">PR</span></div>`).join("")}</div>` : ""}

    <p class="quote mt-l">${QUOTES[new Date().getDate() % QUOTES.length]}</p>`;

  $("#go").onclick = () => openProgram(m.doneToday ? getProgram("mobility") : m.program, launch);
  $("#free").onclick = () => startFree();
  $("#resume")?.addEventListener("click", () => resumeLive(saved, route));
  $("#drop")?.addEventListener("click", async () => { if (await confirmSheet("Abandonner la séance en cours ?", "Les séries faites ne seront pas enregistrées.", "Abandonner", true)) { discardSaved(); route(); } });
  const daysOff = state.sessions.length ? (Date.now() - state.sessions[state.sessions.length - 1].date) / 864e5 : 0;
  if (daysOff >= 3) setTimeout(() => spidey.sleep?.(`Zzz… ${Math.floor(daysOff)} jours sans séance. Réveille-moi avec une mission !`), 1500);
  $$(".day").forEach(d => d.onclick = () => editDay(+d.dataset.d));
  $("#edit-week").onclick = () => editDay((new Date().getDay() + 6) % 7);
  animateRings(view);
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

    <div class="section"><h2>Volume par semaine</h2></div>
    <div class="card vol-card">
      <div class="row between"><div><div class="vol-big num">${fmtNum(cur.volume)}<small> kg</small></div><div class="xs muted">cette semaine</div></div>
        ${vsAvg != null ? `<span class="chip ${vsAvg >= 0 ? "green" : "amber"}">${vsAvg >= 0 ? "+" : ""}${vsAvg} % vs moyenne</span>` : `<span class="xs dim">${cur.volume ? "" : "Pas encore de séance"}</span>`}</div>
      <div class="vbars">${avg ? `<i class="avg" style="--y:${(avg / maxW).toFixed(3)}"><span>moy.</span></i>` : ""}${weeks.map((w, k) => `<div class="b ${w.i === 7 ? "cur" : ""}"><div class="col"><div class="f" style="height:${Math.max(3, (w.volume / maxW) * 100)}%;animation-delay:${k * 45}ms" title="${fmtNum(w.volume)} kg"></div></div>
        <span>${w.i === 7 ? "Auj." : "S-" + (7 - w.i)}</span></div>`).join("")}</div>
    </div>

    <div class="section"><h2>Records</h2>${lifts.length ? `<span class="xs muted">1RM estimé</span>` : ""}</div>
    ${lifts.length ? `<div class="card card-list">${lifts.map(([id, l]) => recRow(id, l)).join("")}</div>`
      : `<div class="card empty">${I.trophy}<b>Aucun record pour l'instant</b>Ils apparaîtront après ta première séance.</div>`}

    <div class="section"><h2>Corps</h2><button class="me-add" id="body-add">${I.plus}Mesurer</button></div>
    ${bodyCard()}

    <div class="section"><h2>Succès</h2><span class="xs muted"><b class="tnum" style="color:var(--text)">${got.length}</b> / ${BADGES.length}</span></div>
    <div class="badges few" id="badges">${badges.map((b, i) => `<div class="badge-card ${state.badges?.[b.id] ? "on" : ""}" style="--i:${i}" title="${esc(b.desc)}"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}</div>
    <button class="btn btn-ghost btn-sm btn-block mt-s more-btn" id="badges-more">Voir les ${BADGES.length} succès</button>

    <div class="section"><h2>Historique</h2>${all.length ? `<span class="xs muted">${all.length} séance${all.length > 1 ? "s" : ""}</span>` : ""}</div>
    ${hist.length ? `<div class="card card-list hist few" id="hist">${hist.map(sessRow).join("")}</div>
      ${hist.length > 8 ? `<button class="btn btn-ghost btn-sm btn-block mt-s more-btn" id="hist-more">Voir plus de séances</button>` : ""}`
      : `<div class="card empty">${I.clock}<b>Aucune séance pour l'instant</b>Ta première mission t'attend dans l'onglet Séances.</div>`}`;

  animateRings(view);
  bindProgressSeg();
  $("#body-add").onclick = bodySheet;
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
  return `<button class="rec" data-ex="${id}"><div class="grow"><b class="ellipsis">${esc(ex.name)}</b><span class="ellipsis">${esc(ex.muscle || "")}</span></div>
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
  <button data-t="me" class="${on === "me" ? "on" : ""}">Stats</button><button data-t="friends" class="${on === "friends" ? "on" : ""}">Amis & défis</button><button data-t="settings" class="${on === "settings" ? "on" : ""}">Réglages</button></div>`;
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
  const sh = sheet(`<div class="eyebrow">${esc(ex.muscle)}</div><h2 class="h2" style="margin-top:4px">${esc(ex.name)}</h2>
    <div class="grid2 mt">
      <div class="card stat"><div class="v">${load ? Math.round(state.lifts[id]?.best || 0) + "<small>kg</small>" : (state.lifts[id]?.bestReps || 0) + `<small>${unit}</small>`}</div><div class="l">${load ? "Meilleur 1RM estimé" : "Record"}</div></div>
      <div class="card stat"><div class="v">${hist.length}</div><div class="l">Séance${hist.length > 1 ? "s" : ""}</div></div>
    </div>
    <div class="card mt"><div class="eyebrow" style="margin-bottom:10px">${load ? "1RM estimé" : ex.type === "time" ? "Meilleure série (s)" : "Meilleure série (reps)"}</div>${chart(pts, { unit })}</div>
    <div class="section"><h2>Technique</h2></div>
    <div class="cues" style="margin-top:0">${animSvg(id, "cues-anim")}<div class="grow">${ex.cues.map(c => `<div>${esc(c)}</div>`).join("")}</div></div>
    <div class="section"><h2>Dernières séances</h2></div>
    <div class="card card-list">${hist.slice().reverse().slice(0, 8).map(h => `<div class="ex-h"><span class="small">${new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
      <div class="sets-p">${h.sets.map(s => `<span>${s.weight ? s.weight + "×" : ""}${s.reps}</span>`).join("")}</div></div>`).join("") || `<div class="empty">Pas encore d'historique.</div>`}</div>`);
  mountAnims(sh.el);
}

// Courbe nette : grille légère, aire en dégradé de l'accent, dernier point mis en avant.
let chartN = 0;
function chart(pts, { unit = "", dec = 0 } = {}) {
  if (pts.length < 2) return `<div class="empty" style="padding:20px">La courbe apparaîtra après 2 séances.</div>`;
  const W = 320, H = 150, L = 30, R = 14, T = 22, B = 22;
  const ys = pts.map(p => p.y);
  const dMin = Math.min(...ys), dMax = Math.max(...ys);
  let min = dMin, max = dMax;
  const padY = (max - min) * 0.12 || Math.max(1, max * 0.05);
  min -= padY; max += padY;
  const span = max - min;
  const X = i => L + (i / (pts.length - 1)) * (W - L - R);
  const Y = v => T + (1 - (v - min) / span) * (H - T - B);
  const xy = pts.map((p, i) => [X(i), Y(p.y)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fmtD = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const fmtV = v => (dec ? v.toFixed(dec).replace(".0", "").replace(".", ",") : Math.round(v));
  const grid = dMax - dMin > 0 ? [dMin, (dMin + dMax) / 2, dMax] : [dMin];
  const id = "cg" + ++chartN;
  const [lx, ly] = xy[xy.length - 1], last = pts[pts.length - 1].y;
  const lbl = `${fmtV(last)}${unit ? " " + unit : ""}`, lw = lbl.length * 6.4 + 14;
  const bx = Math.min(W - lw, Math.max(L, lx - lw / 2)), by = ly - 30 < 0 ? ly + 10 : ly - 30;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution : de ${fmtV(pts[0].y)} à ${fmtV(last)} ${unit}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>
    ${grid.map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 8}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtV(v)}</text>`).join("")}
    <g class="plot"><path class="ar" fill="url(#${id})" d="${d} L${lx.toFixed(1)},${H - B} L${L},${H - B} Z"/>
    <path class="ln" d="${d}"/>
    ${pts.length <= 24 ? xy.slice(0, -1).map(([x, y]) => `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`).join("") : ""}</g>
    <g class="last"><circle class="halo" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="9"/><circle class="pt now" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5"/>
      <rect class="tag" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${lw.toFixed(1)}" height="20" rx="10"/><text class="tag-t" x="${(bx + lw / 2).toFixed(1)}" y="${(by + 13.8).toFixed(1)}" text-anchor="middle">${lbl}</text></g>
    <text x="${L}" y="${H - 5}">${fmtD(pts[0].x)}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">${fmtD(pts[pts.length - 1].x)}</text>
  </svg>`;
}

/* =========================================================
   Profil
   ========================================================= */
function profile() {
  const p = state.profile;
  const r = rankInfo();
  view.innerHTML = `
    <div class="eyebrow">Moi</div><h1 class="h1">${esc(p.name)}</h1>
    ${progressSeg("settings")}
    <div class="card rank mt">${ring(r.pct, r.level, 58)}<div><div class="eyebrow">Rang</div><div class="h3">${r.rank.name}</div><div class="xs muted">${r.xp} XP</div></div></div>

    <div class="section"><h2>Objectif</h2></div>
    <div class="opts">${Object.entries(GOALS).map(([k, g]) => `<button class="opt ${p.goal === k ? "on" : ""}" data-goal="${k}"><b>${g.name}</b><span>${g.mainReps[0]}–${g.mainReps[1]} reps · repos ${g.mainRest >= 120 ? Math.round(g.mainRest / 60) + " min" : g.mainRest + " s"}</span></button>`).join("")}</div>

    <div class="section"><h2>Mon programme</h2></div>
    <div class="card">
      <div class="small muted" style="margin-bottom:8px">Séances par semaine</div>
      <div class="seg" id="days">${[2, 3, 4, 5, 6].map(d => `<button data-v="${d}" class="${p.days === d ? "on" : ""}">${d}</button>`).join("")}</div>
      <div class="small muted" style="margin:14px 0 8px">Matériel</div>
      <div class="seg" id="equip">${[["gym", "Salle"], ["db", "Haltères"], ["home", "Rien"]].map(([v, l]) => `<button data-v="${v}" class="${p.equipment === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <button class="btn btn-soft btn-block mt" id="regen">${I.refresh} Régénérer mon programme</button>
    </div>

    <div class="section"><h2>Toi</h2></div>
    <div class="card">
      <div class="grid2">
        <label class="field" style="margin:0"><span>Prénom</span><input class="input" id="p-name" value="${esc(p.name)}" maxlength="30"/></label>
        <label class="field" style="margin:0"><span>Poids (kg)</span><input class="input" id="p-bw" type="number" inputmode="decimal" value="${p.bodyweight}"/></label>
      </div>
    </div>

    <div class="section"><h2>Préférences</h2></div>
    <div class="card" style="padding:4px 16px">
      <label class="toggle"><div><b>Spider-Man animé</b><span class="xs muted">Ton coach se balade à l'écran</span></div><input type="checkbox" id="p-mascot" ${p.mascot ? "checked" : ""}/></label>
      <label class="toggle"><div><b>Consignes vocales</b><span class="xs muted">Le coach te parle pendant la séance</span></div><input type="checkbox" id="p-voice" ${p.voice ? "checked" : ""}/></label>
      <label class="toggle"><div><b>Sons</b><span class="xs muted">Bips de repos, toile</span></div><input type="checkbox" id="p-sound" ${p.sound ? "checked" : ""}/></label>
    </div>

    <div class="section"><h2>Apparence</h2></div>
    <div class="card">
      <div class="small muted" style="margin-bottom:10px">Couleur</div>
      <div class="swatches">${Object.entries(ACCENTS).map(([k, [c]]) => `<button class="swatch ${(p.accent || "rouge") === k ? "on" : ""}" data-accent="${k}" style="--c:${c}" aria-label="${k}"></button>`).join("")}</div>
      <div class="small muted" style="margin:14px 0 8px">Fond</div>
      <div class="seg" id="mode">${Object.entries(MODES).map(([k, l]) => `<button data-v="${k}" class="${(p.mode || "dark") === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="small muted" style="margin:14px 0 8px">Taille du texte</div>
      <div class="seg" id="zoom">${ZOOMS.map((z, i) => `<button data-v="${z}" class="${(p.zoom || 1) === z ? "on" : ""}">${["Normal", "Grand", "Très grand"][i]}</button>`).join("")}</div>
      <p class="xs dim mt-s">Astuce : tu peux aussi demander au coach « passe l'app en vert » ou « mode clair ».</p>
    </div>

    <div class="section"><h2>Rappels</h2></div>
    <div class="card">
      <p class="small muted" style="margin:0 0 12px">Reçois une notification avant chaque séance prévue (même app fermée), ou ajoute-les à ton calendrier.</p>
      <div class="row" style="gap:10px"><label class="field grow" style="margin:0"><span>Heure de la séance</span><input class="input" id="rem-time" type="time" value="${p.remindAt || "18:00"}"/></label>
        <label class="field" style="margin:0;width:120px"><span>Alerte</span><select class="input" id="rem-before">${[[0, "À l'heure"], [15, "15 min avant"], [30, "30 min avant"], [60, "1 h avant"]].map(([v, l]) => `<option value="${v}" ${(p.remindBefore ?? 15) == v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <label class="toggle"><div><b>Notifications de rappel</b><span class="xs muted" id="push-why">${esc(pushBlocker() || "Les jours de séance, sauf si elle est déjà faite")}</span></div><input type="checkbox" id="p-push" ${pushBlocker() ? "disabled" : ""}/></label>
      <button class="btn btn-soft btn-block mt-s" id="rem-ics">${I.clock} Ajouter à mon calendrier</button>
      <label class="toggle" style="padding-bottom:0"><div><b>Semaine allégée automatique</b><span class="xs muted">Toutes les 7 semaines, charges et volume réduits</span></div><input type="checkbox" id="p-deload" ${p.deload !== false ? "checked" : ""}/></label>
    </div>

    <div class="section"><h2>Données</h2></div>
    <div class="card">
      <div class="grid2"><button class="btn btn-soft btn-sm" id="exp">Exporter</button><label class="btn btn-soft btn-sm">Importer<input type="file" id="imp" accept="application/json" hidden/></label></div>
      <p class="xs muted mt-s">Tes données restent sur ce téléphone. Exporte-les de temps en temps pour garder une sauvegarde.</p>
    </div>

    <div class="section"><h2>Compte</h2><span class="chip ${isOnlineMode() ? "green" : ""}" id="sync">${syncLabel()}</span></div>
    <div class="card" style="padding:4px 16px">
      <div class="toggle"><div><b>@${esc(currentUser)}</b><span class="xs muted">${isOnlineMode() ? "Compte en ligne : retrouve-le sur n'importe quel téléphone" : "Compte enregistré sur cet appareil"}</span></div></div>
      <button class="toggle" id="acc-pin" style="width:100%;text-align:left"><div><b>Changer mon code</b></div>${I.chev}</button>
      <button class="toggle" id="acc-lock" style="width:100%;text-align:left"><div><b>Verrouiller / changer de compte</b></div>${I.chev}</button>
      <button class="toggle" id="acc-forget" style="width:100%;text-align:left;color:#ff7b88"><div><b>Retirer ce compte de cet appareil</b><span class="xs muted">${isOnlineMode() ? "Le compte reste en ligne" : "Supprime le compte et ses données"}</span></div>${I.chev}</button>
    </div>

    <div class="section"><h2>IA intelligente</h2><span class="chip" id="llm-chip"></span></div>
    <div class="card" id="llm-box"></div>

    <details class="card adv mt"><summary>IA Claude (facultatif, payant)</summary>
      <p class="small muted">Sans clé, ton coach fonctionne gratuitement et hors ligne. Avec une clé API Anthropic (payante à l'usage), Claude affine chaque série, fait le briefing, le débrief et répond librement.</p>
      <label class="toggle"><div><b>Activer Claude</b></div><input type="checkbox" id="p-ai" ${p.aiEnabled ? "checked" : ""}/></label>
      <label class="field"><span>Clé API</span><input class="input" id="p-key" type="password" placeholder="sk-ant-…" value="${esc(p.aiKey)}" autocomplete="off"/></label>
      <button class="btn btn-blue btn-sm mt" id="p-test">Tester la connexion</button>
    </details>

    <button class="btn btn-soft btn-block mt-l" id="tour-again">${spider()} Revoir la visite guidée</button>
    <button class="btn btn-ghost btn-block mt-s" id="reset" style="color:#ff7b88">Effacer mes séances et réglages</button>
    <p class="center xs dim">GREATNESS · ton sympathique coach de quartier</p>`;
  animateRings(view);
  bindProgressSeg();
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
      if (c.checked) { saveRem(); await enablePush(); toast(`Rappels activés : ${p.remindBefore ? p.remindBefore + " min avant" : "à"} ${p.remindAt}, les jours de séance.`, 4000); }
      else { await disablePush(); toast("Rappels désactivés."); }
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
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`;
  view.className = "view";
  void view.offsetWidth;
  view.className = "view enter";
  if (step === 1) {
    view.innerHTML = `<div class="onb">${steps}
      <div class="logo" style="justify-content:center">${spider()}GREATNESS</div>
      <h1 class="h1 center mt">Ton coach t'attend.</h1>
      <p class="muted center">Spider-Man pilote tes séances : il ajuste tes charges à chaque série, gère tes repos et te donne les consignes. Gratuit et hors ligne.</p>
      <label class="field mt-l"><span>Comment je t'appelle ?</span><input class="input" id="name" placeholder="Ton prénom" value="${esc(draft.name)}" maxlength="30" autocomplete="given-name"/></label>
      <button class="btn btn-primary btn-lg btn-block mt" id="next">Continuer</button></div>`;
    setTimeout(() => spidey.say("Salut ! Je suis ton nouveau coach. On fait connaissance ?", { mood: "happy" }), 1200);
    $("#next").onclick = () => { const n = $("#name").value.trim(); if (!n) return toast("Il me faut ton prénom !"); draft.name = n; onboarding(2); };
    $("#name").onkeydown = e => { if (e.key === "Enter") $("#next").click(); };
  } else if (step === 2) {
    view.innerHTML = `<div class="onb">${steps}
      <h1 class="h1">Ton objectif, ${esc(draft.name)} ?</h1>
      <p class="muted">J'adapte les répétitions, les repos et le programme.</p>
      <div class="opts mt">${Object.entries(GOALS).map(([k, g]) => `<button class="opt ${draft.goal === k ? "on" : ""}" data-goal="${k}"><b>${g.name}</b><span>${{ force: "Soulever plus lourd", muscle: "Prendre du volume", seche: "Perdre du gras", forme: "Être en forme" }[k]}</span></button>`).join("")}</div>
      <label class="field"><span>Poids de corps (kg)</span><input class="input" id="bw" type="number" inputmode="decimal" value="${draft.bodyweight}"/></label>
      <div class="grid2 mt"><button class="btn btn-soft btn-lg" id="prev">Retour</button><button class="btn btn-primary btn-lg" id="next">Continuer</button></div></div>`;
    $$("[data-goal]").forEach(b => b.onclick = () => { draft.goal = b.dataset.goal; $$("[data-goal]").forEach(x => x.classList.toggle("on", x === b)); });
    $("#prev").onclick = () => onboarding(1);
    $("#next").onclick = () => { draft.bodyweight = +$("#bw").value || 75; onboarding(3); };
  } else {
    view.innerHTML = `<div class="onb">${steps}
      <h1 class="h1">Ton rythme</h1>
      <p class="muted">Je construis ton programme de la semaine. Tu pourras tout modifier.</p>
      <div class="small muted mt" style="margin-bottom:8px">Séances par semaine</div>
      <div class="seg" id="days">${[2, 3, 4, 5, 6].map(d => `<button data-v="${d}" class="${draft.days === d ? "on" : ""}">${d}</button>`).join("")}</div>
      <div class="small muted" style="margin:16px 0 8px">Où t'entraînes-tu ?</div>
      <div class="opts" id="equip">${[["gym", "En salle", "Barres, machines"], ["db", "Haltères", "À la maison"], ["home", "Sans matériel", "Poids du corps"]].map(([v, l, s]) => `<button class="opt ${draft.equipment === v ? "on" : ""}" data-v="${v}"><b>${l}</b><span>${s}</span></button>`).join("")}</div>
      <div class="grid2 mt-l"><button class="btn btn-soft btn-lg" id="prev">Retour</button><button class="btn btn-primary btn-lg" id="done">C'est parti</button></div></div>`;
    $$("#days button").forEach(b => b.onclick = () => { draft.days = +b.dataset.v; $$("#days button").forEach(x => x.classList.toggle("on", x === b)); });
    $$("#equip .opt").forEach(b => b.onclick = () => { draft.equipment = b.dataset.v; $$("#equip .opt").forEach(x => x.classList.toggle("on", x === b)); });
    $("#prev").onclick = () => onboarding(2);
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
  if (document.hidden) hiddenAt = Date.now();
  else if (currentUser && hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000 && !isLive()) { logout(); document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()); route(); }
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
