import { EXERCISES, GOALS, QUOTES } from "./data.js";
import { state, save, resetAll, rankInfo, streak, weekStats, exerciseHistory, allPrograms, getProgram, e1rm, exName, sessionsOn } from "./store.js";
import { generateWeekPlan, ensureWeekPlan, todaysMission, weekStrip, estimateMinutes, adaptToGoal } from "./planner.js";
import { idleTip } from "./brain.js";
import { testKey, resetClient } from "./ai.js";
import { thwip, webSvg, speak } from "./fx.js";
import { spidey } from "./spidey.js";
import { renderTrain, openProgram } from "./train.js";
import { startLive } from "./live.js";
import { renderCoach } from "./coach.js";
import { $, $$, esc, I, spider, fmtNum, fmtTime, toast, sheet, confirmSheet, ring, animateRings } from "./ui.js";

const view = $("#view");
let current = "home";

/* =========================================================
   Router
   ========================================================= */
const routes = { "": home, train: () => renderTrain(view, launch), coach: () => renderCoach(view), progress, profile };
function route() {
  const key = location.hash.replace(/^#\/?/, "");
  current = key || "home";
  if (!state.profile.name) return onboarding();
  document.body.classList.remove("hide-tabs");
  $$(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === current));
  view.className = "view";
  view.innerHTML = "";
  (routes[key] || home)();
  void view.offsetWidth;
  view.classList.add("enter");
  window.scrollTo({ top: 0 });
  setTimeout(() => spidey.settle(), 400);
}
addEventListener("hashchange", route);

const launch = (program, readiness) => startLive(program, readiness, route);

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
  const recentPRs = state.sessions.slice().reverse().flatMap(s => s.prs.map(id => ({ id, set: s.sets.filter(x => x.exId === id).sort((a, b) => e1rm(b.weight, b.reps) - e1rm(a.weight, a.reps) || b.reps - a.reps)[0] }))).slice(0, 3);

  view.innerHTML = `
    <div class="home-head"><div class="logo">${spider()}GREATNESS</div><a href="#/progress" class="chip">${I.trophy} Niv. ${r.level}</a></div>
    <div class="hello"><div class="muted">${hello},</div><h1 class="h1"><span>${esc(p.name)}</span></h1></div>

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
let monthOffset = 0;
function progress() {
  const all = state.sessions;
  const totalVol = all.reduce((a, s) => a + s.volume, 0);
  const totalMin = Math.round(all.reduce((a, s) => a + s.durationSec, 0) / 60);
  const weeks = Array.from({ length: 8 }, (_, i) => ({ ...weekStats(7 - i), i }));
  const maxW = Math.max(1, ...weeks.map(w => w.volume));
  const lifts = Object.entries(state.lifts).filter(([id]) => EXERCISES[id]).sort((a, b) => (b[1].date || 0) - (a[1].date || 0));

  view.innerHTML = `
    <div class="eyebrow">Statistiques</div><h1 class="h1">Progrès</h1>
    <div class="grid3 mt">
      <div class="card stat"><div class="v">${all.length}</div><div class="l">Séances</div></div>
      <div class="card stat"><div class="v">${totalVol >= 10000 ? (totalVol / 1000).toFixed(1) + "<small>t</small>" : fmtNum(totalVol) + "<small>kg</small>"}</div><div class="l">Volume total</div></div>
      <div class="card stat"><div class="v">${totalMin >= 120 ? (totalMin / 60).toFixed(1) + "<small>h</small>" : totalMin + "<small>min</small>"}</div><div class="l">Temps</div></div>
    </div>

    <div class="section"><h2>${spider("emb")}Calendrier</h2>
      <div class="row" style="gap:4px"><button class="icon-btn plain" id="mp" aria-label="Mois précédent">${I.back}</button><button class="icon-btn plain" id="mn" aria-label="Mois suivant" ${monthOffset >= 0 ? "disabled style='opacity:.3'" : ""}>${I.chev}</button></div></div>
    <div class="card">${calendar()}</div>

    <div class="section"><h2>Volume par semaine</h2></div>
    <div class="card"><div class="vbars">${weeks.map((w, k) => `<div class="b ${w.i === 7 ? "cur" : ""}"><div class="f" style="height:${Math.max(3, (w.volume / maxW) * 100)}%;animation-delay:${k * 50}ms" title="${fmtNum(w.volume)} kg"></div>
      <span>${w.i === 7 ? "Cette" : "S-" + (7 - w.i)}</span></div>`).join("")}</div></div>

    <div class="section"><h2>Exercices & records</h2></div>
    ${lifts.length ? `<div class="card" style="padding:4px 16px">${lifts.map(([id, l]) => `<div class="rec" data-ex="${id}"><span class="ellipsis">${esc(EXERCISES[id].name)}</span>
      <span class="v">${EXERCISES[id].type === "load" ? `${Math.round(l.best)} kg <span class="xs dim">1RM est.</span>` : `${l.bestReps}${EXERCISES[id].type === "time" ? " s" : " reps"}`}</span>${I.chev}</div>`).join("")}</div>`
      : `<div class="card empty">${I.trophy}Tes records apparaîtront après ta première séance.</div>`}

    <div class="section"><h2>Historique</h2></div>
    ${all.length ? all.slice().reverse().slice(0, 30).map(s => `
      <article class="card sess tap mt-s" data-id="${s.id}">
        <div class="row between"><div><b class="h3">${esc(s.name)}</b><div class="xs muted" style="text-transform:capitalize">${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div></div>
          <span class="chip green">+${s.xp} XP</span></div>
        <div class="row xs muted mt-s" style="gap:14px"><span>${fmtTime(s.durationSec)}</span><span>${fmtNum(s.volume)} kg</span><span>${s.sets.length} séries</span>${s.prs.length ? `<span style="color:var(--amber)">${s.prs.length} PR</span>` : ""}</div>
        <div class="det">${groupSets(s.sets)}<button class="btn btn-danger btn-sm mt" data-del="${s.id}">${I.trash} Supprimer</button></div>
      </article>`).join("") : `<div class="card empty">${I.clock}Aucune séance pour l'instant.</div>`}`;

  $("#mp").onclick = () => { monthOffset--; route(); };
  $("#mn").onclick = () => { if (monthOffset < 0) { monthOffset++; route(); } };
  $$("[data-ex]").forEach(el => el.onclick = () => exerciseSheet(el.dataset.ex));
  $$(".sess").forEach(el => el.onclick = e => { if (!e.target.closest("[data-del]")) el.classList.toggle("open"); });
  $$("[data-del]").forEach(b => b.onclick = async () => {
    if (!(await confirmSheet("Supprimer cette séance ?", "Elle sera retirée de ton historique.", "Supprimer", true))) return;
    state.sessions = state.sessions.filter(s => s.id !== b.dataset.del); save(); route();
  });
}

function calendar() {
  const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth() + monthOffset);
  const y = ref.getFullYear(), mo = ref.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7;
  const n = new Date(y, mo + 1, 0).getDate();
  const done = new Set(state.sessions.filter(s => { const d = new Date(s.date); return d.getFullYear() === y && d.getMonth() === mo; }).map(s => new Date(s.date).getDate()));
  const today = new Date();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<div class="c out"></div>`);
  for (let d = 1; d <= n; d++) {
    const isToday = today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;
    cells.push(`<div class="c ${done.has(d) ? "on" : ""} ${isToday ? "today" : ""}">${d}</div>`);
  }
  return `<div class="row between" style="margin-bottom:10px"><b class="h3" style="text-transform:capitalize">${ref.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b>
    <span class="xs muted">${done.size} jour${done.size > 1 ? "s" : ""} d'entraînement</span></div>
    <div class="cal">${["L", "M", "M", "J", "V", "S", "D"].map(d => `<div class="h">${d}</div>`).join("")}${cells.join("")}</div>`;
}

function groupSets(sets) {
  const g = {};
  sets.forEach(s => (g[s.name] ||= []).push(s));
  return Object.entries(g).map(([n, arr]) => `<div style="margin-top:6px"><b style="color:var(--text)">${esc(n)}</b> — ${arr.map(s => `${s.weight ? s.weight + "×" : ""}${s.reps} <span class="dim">@${s.rpe}</span>`).join(" · ")}</div>`).join("");
}

function exerciseSheet(id) {
  const ex = EXERCISES[id];
  const hist = exerciseHistory(id);
  const load = ex.type === "load";
  const pts = hist.map(h => ({ x: h.date, y: load ? h.e1rm : h.top.reps }));
  sheet(`<div class="eyebrow">${esc(ex.muscle)}</div><h2 class="h2" style="margin-top:4px">${esc(ex.name)}</h2>
    <div class="grid2 mt">
      <div class="card stat"><div class="v">${load ? Math.round(state.lifts[id]?.best || 0) + "<small>kg</small>" : (state.lifts[id]?.bestReps || 0) + `<small>${ex.type === "time" ? "s" : "reps"}</small>`}</div><div class="l">${load ? "Meilleur 1RM estimé" : "Record"}</div></div>
      <div class="card stat"><div class="v">${hist.length}</div><div class="l">Séances</div></div>
    </div>
    <div class="card mt"><div class="eyebrow" style="margin-bottom:10px">${load ? "1RM estimé (kg)" : ex.type === "time" ? "Meilleure série (s)" : "Meilleure série (reps)"}</div>${chart(pts)}</div>
    <div class="section"><h2>Technique</h2></div>
    <div class="cues" style="margin-top:0">${ex.cues.map(c => `<div>${esc(c)}</div>`).join("")}</div>
    <div class="section"><h2>Dernières séances</h2></div>
    <div class="card" style="padding:4px 16px">${hist.slice().reverse().slice(0, 8).map(h => `<div class="cmp"><span class="small">${new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
      <span class="small muted">${h.sets.map(s => (s.weight ? s.weight + "×" : "") + s.reps).join(" · ")}</span><span></span></div>`).join("") || `<div class="empty">Pas encore d'historique.</div>`}</div>`);
}

function chart(pts) {
  if (pts.length < 2) return `<div class="empty" style="padding:20px">La courbe apparaîtra après 2 séances.</div>`;
  const W = 320, H = 150, pad = 26;
  const ys = pts.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const X = i => pad + (i / (pts.length - 1)) * (W - pad - 8);
  const Y = v => H - 20 - ((v - min) / span) * (H - 40);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const fmtD = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8283b" stop-opacity=".35"/><stop offset="1" stop-color="#e8283b" stop-opacity="0"/></linearGradient></defs>
    <line class="gl" x1="${pad}" x2="${W}" y1="${Y(max)}" y2="${Y(max)}"/><line class="gl" x1="${pad}" x2="${W}" y1="${Y(min)}" y2="${Y(min)}"/>
    <text x="0" y="${Y(max) + 3}">${Math.round(max)}</text><text x="0" y="${Y(min) + 3}">${Math.round(min)}</text>
    <path class="ar" d="${d} L${X(pts.length - 1)},${H - 20} L${X(0)},${H - 20} Z"/>
    <path class="ln" d="${d}"/>
    ${pts.map((p, i) => `<circle class="pt" cx="${X(i)}" cy="${Y(p.y)}" r="3.5"/>`).join("")}
    <text x="${pad}" y="${H - 4}">${fmtD(pts[0].x)}</text><text x="${W}" y="${H - 4}" text-anchor="end">${fmtD(pts[pts.length - 1].x)}</text>
  </svg>`;
}

/* =========================================================
   Profil
   ========================================================= */
function profile() {
  const p = state.profile;
  const r = rankInfo();
  view.innerHTML = `
    <div class="row" style="gap:14px">${ring(r.pct, r.level, 58)}<div><div class="eyebrow">${r.rank.name}</div><h1 class="h1" style="font-size:28px">${esc(p.name)}</h1></div></div>

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

    <div class="section"><h2>Données</h2></div>
    <div class="card">
      <div class="grid2"><button class="btn btn-soft btn-sm" id="exp">Exporter</button><label class="btn btn-soft btn-sm">Importer<input type="file" id="imp" accept="application/json" hidden/></label></div>
      <p class="xs muted mt-s">Tes données restent sur ce téléphone. Exporte-les de temps en temps pour garder une sauvegarde.</p>
    </div>

    <details class="card adv mt"><summary>IA Claude (facultatif, payant)</summary>
      <p class="small muted">Sans clé, ton coach fonctionne gratuitement et hors ligne. Avec une clé API Anthropic (payante à l'usage), Claude affine chaque série, fait le briefing, le débrief et répond librement.</p>
      <label class="toggle"><div><b>Activer Claude</b></div><input type="checkbox" id="p-ai" ${p.aiEnabled ? "checked" : ""}/></label>
      <label class="field"><span>Clé API</span><input class="input" id="p-key" type="password" placeholder="sk-ant-…" value="${esc(p.aiKey)}" autocomplete="off"/></label>
      <button class="btn btn-blue btn-sm mt" id="p-test">Tester la connexion</button>
    </details>

    <button class="btn btn-ghost btn-block mt-l" id="reset" style="color:#ff7b88">Tout réinitialiser</button>
    <p class="center xs dim">GREATNESS · ton sympathique coach de quartier</p>`;
  animateRings(view);

  $$("[data-goal]").forEach(b => b.onclick = () => { p.goal = b.dataset.goal; save(); route(); toast(`Objectif : ${GOALS[p.goal].name}. Reps et repos adaptés.`); spidey.react("happy"); });
  $$("#days button").forEach(b => b.onclick = () => { p.days = +b.dataset.v; save(); $$("#days button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("#equip button").forEach(b => b.onclick = () => { p.equipment = b.dataset.v; save(); $$("#equip button").forEach(x => x.classList.toggle("on", x === b)); });
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
  $("#reset").onclick = async () => { if (await confirmSheet("Tout réinitialiser ?", "Séances, records et réglages seront effacés. Irréversible.", "Tout effacer", true)) resetAll(); };
}

/* =========================================================
   Première ouverture
   ========================================================= */
const draft = { name: "", goal: "muscle", bodyweight: 75, days: 3, equipment: "gym" };
function onboarding(step = 1) {
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
      Object.assign(p, draft);
      state.weekPlan = generateWeekPlan();
      save();
      thwip(0.3);
      if (location.hash && location.hash !== "#/") location.hash = "#/"; else route();
      setTimeout(() => { spidey.react("party"); spidey.say(`Programme prêt, ${p.name} ! Ta mission du jour t'attend.`, { mood: "party" }); }, 700);
    };
  }
}

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
