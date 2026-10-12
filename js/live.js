// Séance en direct : tableau des séries, ajustements temps réel, repos, fin de séance.
import { EXERCISES } from "./data.js";
import { getProgram } from "./store.js";
import { coachName } from "./chars/index.js";
import { state, save, rankInfo, recordLift, e1rm, currentUser } from "./store.js";
import { Session, fmtTarget, plates } from "./engine.js";
import { cycleInfo, isWorkout } from "./planner.js";
import { pickExercises } from "./train.js";
import { defaultItem } from "./create.js";
import { checkBadges } from "./badges.js";
import { aiReady, aiAdjust, aiBrief, aiDebrief } from "./ai.js";
import { debrief, athleteContext } from "./brain.js";
import * as llm from "./llm.js";
import { speak, stopSpeaking, beep, success, vibrate, webPop, speechHooks } from "./fx.js";
import { Listener, voiceSupported } from "./voice.js";
import { openCam, camSupported, camTrackable } from "./cam.js";
import { animSvg, mountAnims } from "./anim.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, I, spider, fmtTime, fmtNum, sheet, toast, confirmSheet } from "./ui.js";

let S = null, ui = null, tick = null, wakeLock = null, rest = null, showCues = false, onExit = null, justDone = -1;
const overlay = () => $("#overlay");

/* ---------- Mains libres ---------- */
let listener = null;
function toggleVoice() {
  if (listener?.active) { listener.stop(); listener = null; return render(); }
  if (!voiceSupported()) return toast("La reconnaissance vocale n'est pas disponible sur ce navigateur.", 3500);
  listener = new Listener({
    onHeard: text => toast(`🎙️ « ${text} »`, 2200),
    onState: st => { if (st === "denied") toast("Autorise le micro pour le mode mains libres.", 3500); $("#mic")?.classList.toggle("on", st === "on"); },
    onCommand: cmd => {
      if (!S) return;
      if (cmd.action === "stop") { listener?.stop(); listener = null; render(); return; }
      if (cmd.action === "go") return endRest(true);
      if (cmd.action === "undo") return $("#undo")?.click();
      if (cmd.action === "skip") return $("#skip")?.click();
      if (cmd.action === "log" && S.current) {
        if (rest) endRest(false);
        if (cmd.reps != null) ui.reps = cmd.reps;
        if (cmd.weight != null && S.current.type === "load") ui.weight = cmd.weight;
        if (cmd.rpe != null) ui.rpe = cmd.rpe;
        logSet(null);
      }
    },
  });
  speechHooks.start = () => listener?.pause();
  speechHooks.end = () => listener?.resume();
  listener.start();
  render();
  speak("Mode mains libres activé. Dis par exemple : huit reps, difficile.");
}
const stopVoice = () => { listener?.stop(); listener = null; speechHooks.start = speechHooks.end = null; };

const LIVE_KEY = () => `greatness.live.${currentUser}`;
// Sauvegarde continue : si le téléphone ferme l'app, la séance reprend où elle en était.
function persist() { try { if (S && currentUser) localStorage.setItem(LIVE_KEY(), JSON.stringify(S)); } catch { /* plein */ } }
function clearSaved() { try { localStorage.removeItem(LIVE_KEY()); } catch { /* rien */ } }
export function savedSession() {
  try {
    const d = JSON.parse(localStorage.getItem(LIVE_KEY()) || "null");
    return d && Date.now() - d.savedAt < 12 * 3600 * 1000 ? d : null;
  } catch { return null; }
}
export const discardSaved = clearSaved;

// Échauffement puis séance : la séance à enchaîner une fois l'échauffement fini.
let chain = null;
export function startWithWarmup(warmupId, program, readiness, exit) {
  startLive(getProgram(warmupId), readiness, exit);
  chain = { program, readiness };
}

export function startLive(program, readiness, exit) {
  chain = null;
  S = new Session(program, readiness, { deload: !program.free && cycleInfo().deload });
  begin(exit);
  const intro = S.intro();
  if (S.current) setTimeout(() => spidey.say(`${S.verdict.label} ! ${S.current.name} pour commencer.`, { mood: "happy" }), 900);
  else setTimeout(() => spidey.say("Séance libre : ajoute ton premier exercice !", { mood: "happy" }), 900);
  speak(`${S.verdict.text} ${intro?.say || ""}`, { interrupt: true });
  if (aiReady() && S.current) {
    aiBrief(S).then(txt => {
      if (!txt || !S) return;
      S.push({ kind: "ai", title: "Briefing du coach", text: txt });
      render(); spidey.say(txt); speak(txt);
    }).catch(err => console.warn("brief", err));
  }
}

export function resumeLive(data, exit) {
  S = Session.restore(data);
  begin(exit);
  S.push({ kind: "info", title: "Séance reprise", text: "On reprend exactement où tu t'étais arrêté." });
  render();
  setTimeout(() => spidey.say("Te revoilà ! On reprend la séance.", { mood: "happy" }), 700);
}

function begin(exit) {
  onExit = exit;
  showCues = false;
  mounted = false; prevProg = 0; lastMsgKey = ""; lastIdx = -1;
  document.body.classList.add("hide-tabs");
  navigator.wakeLock?.request("screen").then(l => (wakeLock = l)).catch(() => {});
  if (!S.log.length || S.log[0].title !== S.verdict.label) S.push({ kind: S.verdict.tone, title: S.verdict.label, text: S.verdict.text });
  resetInputs();
  render();
  spidey.setContext("live");
  clearInterval(tick);
  tick = setInterval(() => { const t = $("#elapsed"); if (t && S) t.textContent = fmtTime(S.elapsed); }, 1000);
}

function resetInputs() {
  const ex = S?.current;
  if (!ex) return;
  ui = { weight: ex.weight, reps: ex.goal, rpe: Math.round(ex.rpe), pain: false };
}

const unit = ex => (ex.type === "time" ? "s" : "");
const fmtSet = (s, ex) => (ex.type === "load" ? `${s.weight}×${s.reps}` : `${s.reps}${unit(ex)}`);
const fmtKg = w => String(w).replace(".", ",");
const target = ex => fmtTarget(ex).replace(/(\d)\.(\d)/g, "$1,$2");
// coche qui se dessine (pathLength = 1 : le tracé s'anime en CSS)
const TICK = `<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
const RPE = [[6, "Facile", "4 reps ou plus en réserve"], [7, "Modéré", "Encore 3 reps en réserve"], [8, "Dur", "Encore 2 reps en réserve"], [9, "Très dur", "Une seule rep en réserve"], [10, "Échec", "Plus aucune rep possible"]];
const rpeHint = v => RPE.find(r => r[0] === v)?.[2] || "6 facile → 10 échec";

let mounted = false, prevProg = 0, lastMsgKey = "", lastIdx = -1;

function render() {
  if (!S) return;
  const ex = S.current;
  persist();
  if (!ex) return S.program.free ? renderFreeEmpty() : finish();
  const simple = S.program.simple;
  const note = state.exNotes?.[ex.id];
  const last = ex.last;
  const load = ex.type === "load";
  const total = Math.max(ex.sets, ex.done.length);
  const rows = Array.from({ length: total }, (_, i) => {
    const d = ex.done[i];
    const prev = last?.[i] ? fmtSet(last[i], ex) : "—";
    if (d) return `<div class="set done ${i === justDone ? "just" : ""}"><span class="i">${i + 1}</span><span class="prev">${prev}</span>
      ${load ? `<span class="val">${fmtKg(d.weight)}</span>` : ""}<span class="val">${d.reps}<small>${unit(ex)}</small>${simple ? "" : `<span class="rpe-b">@${d.rpe}</span>`}</span><span class="ok" aria-label="Série faite">${TICK}</span></div>`;
    const cur = i === ex.done.length;
    return `<div class="set ${cur ? "cur" : "todo"}"><span class="i">${i + 1}</span><span class="prev">${prev}</span>
      ${load ? `<span class="val" ${cur ? 'id="v-weight"' : ""}>${fmtKg(cur ? ui.weight : ex.weight)}</span>` : ""}
      <span class="val" ${cur ? 'id="v-reps"' : ""}>${cur ? ui.reps : ex.goal}<small>${unit(ex)}</small></span>
      ${cur ? `<button class="ok" id="row-log" aria-label="Valider la série ${i + 1}"></button>` : `<span class="ok"></span>`}</div>
      ${cur ? editor(ex, simple) : ""}`;
  }).join("");
  const msg = S.log[0];
  const msgKey = msg ? msg.title + msg.text : "";
  const freshMsg = msgKey !== lastMsgKey;
  lastMsgKey = msgKey;
  const scroller = $(".live", overlay());
  // même exercice : on garde la position de défilement ; nouvel exercice : retour en haut
  const keepScroll = scroller && !scroller.classList.contains("fin") && lastIdx === S.idx ? scroller.scrollTop : 0;
  lastIdx = S.idx;
  const tools = [
    `<button class="tool" id="add-set">${I.plus}<span>Série</span></button>`,
    `<button class="tool" id="swap">${I.swap}<span>Remplacer</span></button>`,
    `<button class="tool" id="skip">${I.skip}<span>Passer</span></button>`,
    camSupported() && ex.type !== "time" && camTrackable(ex.id) ? `<button class="tool" id="cam">${I.camera}<span>Compter</span></button>` : "",
    `<button class="tool" id="note">${I.edit}<span>Note</span></button>`,
    S.history.length ? `<button class="tool" id="undo">${I.undo}<span>Annuler</span></button>` : "",
  ].join("");
  overlay().innerHTML = `
  <div class="live ${mounted ? "" : "first"} ${rest ? "resting" : ""}"><div class="live-wrap">
    <header class="live-head">
      <div class="lh-row">
        <div class="lh-side"><button class="icon-btn plain" id="quit" aria-label="Terminer la séance">${I.x}</button></div>
        <div class="lh-mid"><div class="title ellipsis">${esc(S.program.name)}</div>
          <div class="lh-meta"><i class="lh-dot" aria-hidden="true"></i><span class="tnum" id="elapsed">${fmtTime(S.elapsed)}</span><span class="sep">·</span><span>${S.idx + 1}/${S.plan.length}</span></div></div>
        <div class="lh-side end"><button class="icon-btn plain ${listener?.active ? "on" : ""}" id="mic" aria-label="Mains libres">${I.mic}</button>
        <button class="icon-btn plain" id="menu" aria-label="Options">${I.more}</button></div>
      </div>
      <div class="thread" role="progressbar" aria-label="Progression de la séance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(S.progress * 100)}"><i id="thread" style="--p:${prevProg}"></i></div>
      <nav class="ex-tabs" id="tabs">${S.plan.map((e, i) => `<button class="ex-tab ${i === S.idx ? "cur" : e.status}" data-i="${i}" ${i === S.idx ? 'aria-current="step"' : ""}>
        <span class="k">${e.status === "done" ? I.check : i + 1}</span><span class="nm">${esc(e.name)}</span>${e.ss ? `<span class="ss">${esc(e.ss)}</span>` : ""}</button>`).join("")}
        <button class="ex-tab add" id="add-ex" aria-label="Ajouter un exercice">${I.plus}</button></nav>
    </header>

    <div class="ex-head">
      <div class="grow"><div class="eyebrow">${esc(ex.muscle)}${ex.ss ? ` · Superset ${esc(ex.ss)}` : ""}</div><h2>${esc(ex.name)}</h2></div>
      <button class="icon-btn cues-toggle ${showCues ? "sel" : ""}" id="cues-btn" aria-label="Technique" aria-expanded="${showCues}">${I.info}</button>
    </div>
    <div class="ex-chips"><span class="chip red">${I.flame}Objectif ${target(ex)}</span>${simple ? "" : `<span class="chip">Ressenti ${ex.rpe}</span>`}${ex.plateau ? `<span class="chip amber">Relance plateau</span>` : ""}</div>
    ${showCues ? `<div class="cues">${animSvg(ex.id, "cues-anim")}<ul class="grow">${ex.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
    <p class="ex-last">${I.clock}<span>${last ? `Dernière fois : <b>${last.map(s => fmtSet(s, ex)).join(" · ")}</b>` : "Première fois : je calibre dès la première série."}</span></p>
    ${note ? `<button class="note-line" id="note-show">${I.edit}<span>${esc(note)}</span></button>` : ""}

    <div class="sets ${load ? "" : "noload"}">
      <div class="sets-h"><span>Série</span><span>Avant</span>${load ? "<span>Kg</span>" : ""}<span>${ex.type === "time" ? "Sec" : "Reps"}</span><span></span></div>
      ${rows}
    </div>

    <div class="tools scroll-x">${tools}</div>

    ${msg ? `<div class="coach-line ${msg.kind} ${freshMsg ? "new" : ""}"><div class="av">${spider()}</div><div class="grow"><b>${esc(msg.title)}</b><p>${esc(msg.text)}</p>
      ${msg.swap && EXERCISES[msg.swap] ? `<button class="btn btn-soft btn-sm mt-s" id="add-alt">${I.plus} Ajouter ${esc(EXERCISES[msg.swap].name)}</button>` : ""}</div></div>` : ""}
  </div></div>
  <div class="dock"><div class="dock-in" id="dock"></div></div>`;
  mounted = true;
  justDone = -1;
  const sc = $(".live", overlay());
  if (keepScroll) sc.scrollTop = keepScroll;
  // la barre de progression glisse de l'ancienne valeur à la nouvelle
  const th = $("#thread"), p = S.progress;
  if (th && p !== prevProg) requestAnimationFrame(() => th.style.setProperty("--p", p));
  prevProg = p;
  renderDock();
  bind(ex);
  const tabs = $("#tabs"), cur = $(`.ex-tab[data-i="${S.idx}"]`);
  if (tabs && cur) tabs.scrollLeft = cur.offsetLeft - (tabs.clientWidth - cur.offsetWidth) / 2;
}

function editor(ex, simple) {
  const stepper = (key, val, label, step) => `<div class="stepper"><button class="st-btn" data-s="${key}" data-d="${-step}" aria-label="Moins ${step}">${I.minus}</button>
    <div class="mid" id="m-${key}"><input id="in-${key}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmtKg(val)}" aria-label="${label}"/><small>${label}</small></div>
    <button class="st-btn" data-s="${key}" data-d="${step}" aria-label="Plus ${step}">${I.plus}</button></div>`;
  const repStep = ex.type === "time" ? 5 : 1;
  return `<div class="editor">
    <div class="steppers ${ex.type === "load" ? "" : "one"}">
      ${ex.type === "load" ? stepper("weight", ui.weight, "Kg", ex.step) : ""}
      ${stepper("reps", ui.reps, ex.type === "time" ? "Secondes" : "Répétitions", repStep)}
    </div>
    ${EXERCISES[ex.id]?.equip === "bar" && ex.type === "load" ? `<button class="plates" id="plates">${platesText(ui.weight)}</button>` : ""}
    ${simple ? "" : `<div class="rpe-lab"><span>Ressenti</span><span class="dim" id="rpe-hint">${rpeHint(ui.rpe)}</span></div>
    <div class="rpe" role="radiogroup" aria-label="Ressenti">${RPE.map(([v, l]) => `<button data-rpe="${v}" role="radio" aria-checked="${ui.rpe === v}" class="${ui.rpe === v ? "on" : ""}">${v}<small>${l}</small></button>`).join("")}</div>
    <label class="toggle pain"><div><b>Douleur articulaire</b><span class="xs dim">Le coach adapte la suite</span></div><input type="checkbox" id="pain" ${ui.pain ? "checked" : ""}/></label>`}
  </div>`;
}

function platesText(w) {
  const p = plates(w);
  if (w < 20) return "Moins lourd qu'une barre olympique (20 kg)";
  return `<b>Par côté</b> ${p.side.length ? p.side.map(x => String(x).replace(".", ",")).join(" + ") : "rien"}${p.rest > 0 ? ` <span class="dim">(+${String(p.rest).replace(".", ",")} kg à arrondir)</span>` : ""} <span class="dim">· barre 20&nbsp;kg</span>`;
}

function renderFreeEmpty() {
  overlay().innerHTML = `
  <div class="live ${mounted ? "" : "first"}"><div class="live-wrap">
    <header class="live-head"><div class="lh-row">
      <div class="lh-side"><button class="icon-btn plain" id="quit" aria-label="Terminer la séance">${I.x}</button></div>
      <div class="lh-mid"><div class="title ellipsis">${esc(S.program.name)}</div><div class="lh-meta"><i class="lh-dot" aria-hidden="true"></i><span class="tnum" id="elapsed">${fmtTime(S.elapsed)}</span></div></div>
      <div class="lh-side end"><button class="icon-btn plain" id="menu" aria-label="Options">${I.more}</button></div></div></header>
    <div class="free-empty stagger">
      <div class="empty">${spider()}<b>${S.plan.length ? "Et maintenant ?" : "Séance libre"}</b><span>Ajoute les exercices au fur et à mesure, le coach ajuste tout en direct.</span></div>
      <button class="btn btn-primary btn-lg btn-block" id="free-add">${I.plus} Ajouter un exercice</button>
      ${S.plan.length ? `<div class="eyebrow free-done-h">Déjà fait</div><div class="card card-list">${S.plan.map(e => `<div class="cmp"><span class="ellipsis">${esc(e.name)}</span><span class="small muted">${e.done.length} série${e.done.length > 1 ? "s" : ""}</span><span class="delta p">${I.check}</span></div>`).join("")}</div>` : ""}
    </div>
  </div></div>
  <div class="dock"><div class="dock-in">${S.totalDone ? `<button class="btn btn-soft btn-lg btn-block" id="free-end">${I.check} Terminer la séance</button>` : ""}</div></div>`;
  mounted = true;
  $("#quit").onclick = quit; $("#menu").onclick = menu;
  $("#free-add").onclick = addExercise;
  $("#free-end")?.addEventListener("click", finish);
}

function addExercise() {
  pickExercises(ids => {
    if (!ids.length) return;
    ids.forEach(id => S.addExercise(defaultItem(id)));
    S.idx = S.plan.length - ids.length;
    resetInputs(); render();
    const intro = S.intro(); speak(intro.say, { interrupt: true });
  });
}

function renderDock() {
  const dock = $("#dock");
  if (!dock || !S || !S.current) return;
  const ex = S.current;
  $(".live", overlay())?.classList.toggle("resting", !!rest);
  if (rest) {
    const nx = S.current;
    dock.innerHTML = `<div class="rest" id="rest" role="timer" aria-label="Repos">
      <div class="rest-bar"><i id="rest-fill"></i></div>
      <div class="rest-top">
        <div class="rest-time"><small>Repos</small><span class="t tnum" id="rest-t">${fmtTime(Math.max(0, Math.ceil((rest.end - Date.now()) / 1000)))}</span></div>
        <div class="nx"><small>Ensuite</small><b class="ellipsis">${esc(nx.name)}</b><span class="ellipsis">Série ${nx.done.length + 1} · ${target(nx)}</span></div>
      </div>
      <div class="ctr"><button data-r="-15" aria-label="Moins 15 secondes">−15 s</button><button data-r="15" aria-label="Plus 15 secondes">+15 s</button>
        <button class="go" id="rest-skip">${I.play}<span>Go</span></button></div></div>`;
    $$("[data-r]", dock).forEach(b => b.onclick = () => {
      const d = +b.dataset.r;
      rest.end = Math.max(Date.now() + 1000, rest.end + d * 1000); rest.total = Math.max(rest.total + d, 10);
      vibrate(6); paintRest(true);
    });
    $("#rest-skip", dock).onclick = () => endRest(true);
    paintRest(true);
  } else {
    dock.innerHTML = `<button class="btn btn-primary btn-lg btn-block log-btn" id="log">${I.check}<span>Valider la série ${ex.done.length + 1}/${Math.max(ex.sets, ex.done.length + 1)}</span></button>`;
    $("#log", dock).onclick = logSet;
  }
}

// Appui long sur un bouton : l'action se répète de plus en plus vite.
function holdRepeat(btn, fn) {
  let t = null, n = 0;
  const stop = () => { clearTimeout(t); t = null; btn.classList.remove("held"); };
  btn.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    e.preventDefault();
    n = 0; fn(false); btn.classList.add("held");
    const rep = () => { n++; fn(true); t = setTimeout(rep, n < 5 ? 120 : n < 15 ? 70 : 40); };
    clearTimeout(t); t = setTimeout(rep, 420);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, stop));
  btn.addEventListener("contextmenu", e => e.preventDefault());
  btn.addEventListener("click", e => { if (e.detail === 0) fn(false); }); // clavier
}

const bump = (el, up) => el?.animate?.([{ transform: `scale(${up ? 1.1 : 0.92})` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.9,.3,1.2)" });

function bind(ex) {
  $("#quit").onclick = quit;
  $("#menu").onclick = menu;
  $("#mic").onclick = toggleVoice;
  $("#cues-btn").onclick = () => { showCues = !showCues; render(); };
  mountAnims(overlay());
  $("#cam")?.addEventListener("click", () => openCam(ex, { onDone: n => {
    ui.reps = n; const inp = $("#in-reps"); if (inp) inp.value = n; const c = $("#v-reps"); if (c) c.firstChild.nodeValue = n;
    toast(`${n} reps comptées : ajuste le ressenti puis valide.`);
  } }));
  $$(".ex-tab").forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (i === S.idx) return;
    if (!S.jump(i)) return toast("Exercice déjà terminé.");
    resetInputs(); render();
    const intro = S.intro(); speak(intro.say, { interrupt: true });
  });
  const setVal = (k, v) => {
    ui[k] = v;
    const inp = $(`#in-${k}`); if (inp) inp.value = fmtKg(v);
    const cell = $(`#v-${k}`); if (cell) cell.firstChild.nodeValue = k === "weight" ? fmtKg(v) : v;
    if (k === "weight" && $("#plates")) $("#plates").innerHTML = platesText(v);
  };
  $$("[data-s]").forEach(b => holdRepeat(b, repeat => {
    const k = b.dataset.s, d = +b.dataset.d;
    const v = Math.max(0, +(ui[k] + d).toFixed(2));
    if (v === ui[k]) return;
    setVal(k, v);
    bump($(`#in-${k}`), d > 0);
    if (!repeat) vibrate(6);
  }));
  $$(".stepper input").forEach(inp => {
    inp.onfocus = () => inp.select();
    inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); };
    inp.onchange = () => setVal(inp.id.slice(3), Math.max(0, +String(inp.value).replace(",", ".") || 0));
  });
  $("#row-log")?.addEventListener("click", logSet);
  $$("[data-rpe]").forEach(b => b.onclick = () => {
    ui.rpe = +b.dataset.rpe;
    $$("[data-rpe]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    const h = $("#rpe-hint"); if (h) h.textContent = rpeHint(ui.rpe);
    vibrate(8);
  });
  $("#pain")?.addEventListener("change", e => (ui.pain = e.target.checked));
  $("#add-set").onclick = () => { S.addSet(); render(); toast("Série ajoutée"); };
  $("#add-ex").onclick = addExercise;
  const noteSheet = () => {
    const sh = sheet(`<h2 class="h2">Note · ${esc(ex.name)}</h2><p class="small muted">Réglage de la machine, prise, sensations… Elle s'affichera à chaque fois.</p>
      <textarea class="input" id="note-txt" rows="4" maxlength="300" style="height:auto;padding:12px">${esc(state.exNotes?.[ex.id] || "")}</textarea>
      <button class="btn btn-primary btn-block mt" id="note-save">Enregistrer</button>`, { z: 60 });
    $("#note-save", sh.el).onclick = () => { state.exNotes ||= {}; const v = $("#note-txt", sh.el).value.trim(); if (v) state.exNotes[ex.id] = v; else delete state.exNotes[ex.id]; save(); sh.close(); render(); };
  };
  $("#note").onclick = noteSheet;
  $("#note-show")?.addEventListener("click", noteSheet);
  $("#plates")?.addEventListener("click", () => toast("Disques calculés pour une barre de 20 kg."));
  $("#skip").onclick = () => { endRest(false); const ev = S.skip(); if (S.finished) return finish(); resetInputs(); render(); announce(ev); };
  $("#swap").onclick = openSwap;
  $("#undo")?.addEventListener("click", () => { endRest(false); if (S.undo()) { resetInputs(); const ex2 = S.current; const d = ex2.done.length; render(); toast(`Série ${d + 1} annulée`); } });
  $("#add-alt")?.addEventListener("click", () => { const id = S.log[0].swap; S.log[0].swap = null; S.insertAlt(id); resetInputs(); render(); const intro = S.intro(); speak(intro.say, { interrupt: true }); });
}

function announce(events) {
  const say = events.map(e => e.say).filter(Boolean).slice(0, 3).join(" ");
  speak(say, { interrupt: true });
  const main = events.find(e => e.kind === "pr") || events.find(e => ["warn", "down", "up"].includes(e.kind)) || events[0];
  if (main) spidey.say(main.text, { mood: main.mood || (main.kind === "warn" || main.kind === "down" ? "alert" : main.kind === "up" ? "happy" : undefined) });
}

function logSet(e) {
  if (!S || S.finished || !S.current) return;
  const ex = S.current;
  const btn = (e?.currentTarget || $("#log"))?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight - 80, width: 0, height: 0 };
  const doneIdx = ex.done.length;
  const lastSet = { exercice: ex.name, charge_kg: ex.type === "load" ? ui.weight : 0, reps: ui.reps, rpe: ui.rpe, douleur: ui.pain };
  const prevW = ex.weight;
  const { events, rest: restSec } = S.logSet({ reps: ui.reps, rpe: S.program.simple ? 6 : ui.rpe, pain: ui.pain, weight: ui.weight });
  const pr = events.some(ev => ev.kind === "pr" && ev.title.startsWith("Nouveau"));

  success(); vibrate(pr ? [30, 40, 80] : 25);
  webPop(btn.left + btn.width / 2, btn.top + btn.height / 2, pr ? "#f5b83d" : "#ff3b4e");
  announce(events);
  if (pr) spidey.react("pr");

  if (S.finished) { rest = null; return setTimeout(finish, 600); }
  justDone = S.current === ex ? doneIdx : -1;
  resetInputs();
  if (restSec > 0 && S.current) startRest(restSec);
  render();
  // anime la charge qui change
  if (S.current === ex && ex.type === "load" && ex.weight !== prevW) $("#m-weight")?.classList.add(ex.weight > prevW ? "up" : "down");

  if (aiReady()) {
    const local = { repos_s: restSec, prochaine_charge_kg: S.current.weight, prochain_objectif: S.current.goal };
    aiAdjust(S, lastSet, local).then(rec => {
      if (!rec || !S || S.finished) return;
      const changed = S.applyAi(rec);
      if (rest && Number.isFinite(rec.rest_seconds)) { const s = Math.min(300, Math.max(20, rec.rest_seconds)); rest.end = Date.now() + s * 1000; rest.total = s; }
      S.push({ kind: "ai", title: changed ? "Ajustement du coach (IA)" : "Conseil du coach (IA)", text: rec.message });
      resetInputs(); render();
      spidey.say(rec.message); speak(rec.message);
    }).catch(err => console.warn("adjust", err));
  }
}

/* ---------- Repos ---------- */
function startRest(sec) {
  clearInterval(rest?.timer);
  rest = { end: Date.now() + sec * 1000, total: sec, said10: false, beeped: new Set() };
  rest.timer = setInterval(paintRest, 250);
  spidey.hang(true);
}

// La barre se vide toute seule (animation CSS sur transform) ; on ne la relance que si la durée change.
function paintRest(restart = false) {
  if (!rest) return;
  const ms = rest.end - Date.now();
  const left = Math.ceil(ms / 1000);
  const t = $("#rest-t"), f = $("#rest-fill"), box = $("#rest");
  const txt = fmtTime(Math.max(0, left));
  if (t && t.textContent !== txt) t.textContent = txt;
  if (f && restart === true) {
    f.style.animation = "none";
    f.style.setProperty("--from", Math.max(0, Math.min(1, ms / (rest.total * 1000))).toFixed(4));
    void f.offsetWidth;
    f.style.animation = `restBar ${Math.max(0, ms)}ms linear forwards`;
  }
  box?.classList.toggle("ending", left <= 5);
  if (left === 10 && !rest.said10) { rest.said10 = true; speak("Dix secondes."); }
  if (left <= 3 && left > 0 && !rest.beeped.has(left)) { rest.beeped.add(left); beep(880, 0.1); }
  if (left <= 0) endRest(true);
}

function endRest(announceNext) {
  if (!rest) return;
  clearInterval(rest.timer);
  rest = null;
  spidey.hang(false);
  renderDock();
  if (announceNext && S?.current) {
    beep(1320, 0.22, "square", 0.08); vibrate([60, 40, 60]);
    setTimeout(() => spidey.lift(), 900);
    const n = S.current;
    if (!n.introduced) { const intro = S.intro(); render(); speak(intro.say, { interrupt: true }); return; }
    speak(`C'est reparti. Série ${n.done.length + 1}. ${n.type === "load" ? n.weight + " kilos, " : ""}${n.goal} ${n.type === "time" ? "secondes" : "répétitions"}.`, { interrupt: true });
  }
}

/* ---------- Menus ---------- */
function openSwap() {
  const ex = S.current;
  const alts = [...new Set([...(EXERCISES[ex.id].alts || []), ...Object.keys(EXERCISES).filter(k => EXERCISES[k].muscle === ex.muscle && k !== ex.id)])];
  if (!alts.length) return toast("Pas d'alternative pour cet exercice.");
  const sh = sheet(`<h2 class="h2">Remplacer ${esc(ex.name)}</h2><p class="muted small">Machine prise, pas le matériel, gêne ? Choisis une alternative.</p>
    ${alts.map(a => `<div class="pick-item" data-a="${a}"><div><div style="font-weight:600">${esc(EXERCISES[a].name)}</div><div class="xs muted">${esc(EXERCISES[a].muscle)}</div></div><div class="add">${I.swap}</div></div>`).join("")}`, { z: 60 });
  $$("[data-a]", sh.el).forEach(b => b.onclick = () => { sh.close(); S.swap(b.dataset.a); resetInputs(); render(); const intro = S.intro(); speak(intro.say, { interrupt: true }); });
}

function menu() {
  const p = state.profile;
  const sh = sheet(`<h2 class="h2">Options</h2>
    <div class="card mt" style="padding:4px 16px">
      <label class="toggle"><div><b>Consignes vocales</b></div><input type="checkbox" id="o-voice" ${p.voice ? "checked" : ""}/></label>
      <label class="toggle"><div><b>Sons</b></div><input type="checkbox" id="o-sound" ${p.sound ? "checked" : ""}/></label>
    </div>
    <button class="btn btn-soft btn-block mt" id="o-finish">${I.check} Terminer et enregistrer</button>
    <button class="btn btn-danger btn-block mt-s" id="o-abort">${I.trash} Abandonner sans enregistrer</button>`, { z: 60 });
  $("#o-voice", sh.el).onchange = e => { p.voice = e.target.checked; if (!p.voice) stopSpeaking(); save(); };
  $("#o-sound", sh.el).onchange = e => { p.sound = e.target.checked; save(); };
  $("#o-finish", sh.el).onclick = () => { sh.close(); S.totalDone ? finish() : close(); };
  $("#o-abort", sh.el).onclick = async () => { sh.close(); if (await confirmSheet("Abandonner la séance ?", "Les séries faites ne seront pas enregistrées.", "Abandonner", true)) close(); };
}

async function quit() {
  if (!S.totalDone) return close();
  if (await confirmSheet("Terminer la séance ?", "Les séries déjà faites seront enregistrées.", "Terminer")) finish();
}

/* ---------- Fin ---------- */
function finish() {
  if (!S) return;
  stopVoice();
  clearInterval(tick); clearInterval(rest?.timer); rest = null;
  spidey.hang(false);
  const before = rankInfo();
  const sum = S.summary();
  const done = { program: S.program, readiness: S.readiness }, next = chain;
  chain = null;
  const best = {};
  sum.sets.forEach(s => { const sc = s.weight > 0 ? e1rm(s.weight, s.reps) : s.reps; if (!best[s.exId] || sc > best[s.exId].sc) best[s.exId] = { ...s, sc }; });
  Object.values(best).forEach(s => recordLift(s.exId, s.weight, s.reps));
  if (sum.sets.length) state.sessions.push(sum);
  if (sum.sets.length && !state.cycleStart) state.cycleStart = sum.date;
  save();
  clearSaved();
  const after = rankInfo();
  const newBadges = checkBadges();
  S = null;
  wakeLock?.release?.(); wakeLock = null;

  const local = debrief(sum);
  const delta = c => {
    if (c.delta === null) return `<span class="delta n">nouveau</span>`;
    if (Math.abs(c.delta) < 0.5) return `<span class="delta n">=</span>`;
    const v = c.type === "load" ? `${c.delta > 0 ? "+" : ""}${Math.round(c.delta)} kg` : `${c.delta > 0 ? "+" : ""}${Math.round(c.delta)}`;
    return `<span class="delta ${c.delta > 0 ? "p" : "m"}">${v}</span>`;
  };
  const reps = sum.sets.reduce((a, s) => a + (+s.reps || 0), 0);
  const nEx = new Set(sum.sets.map(s => s.exId)).size;
  const tiles = [
    { v: sum.durationSec, f: "time", l: "Durée", ic: I.clock },
    sum.volume > 0 ? { v: sum.volume, f: "num", u: "kg", l: "Volume soulevé", ic: I.bolt } : { v: reps, f: "num", l: "Répétitions", ic: I.bolt },
    { v: sum.sets.length, f: "num", l: sum.sets.length > 1 ? "Séries" : "Série", ic: I.check },
    sum.prs.length ? { v: sum.prs.length, f: "num", l: sum.prs.length > 1 ? "Records" : "Record", ic: I.trophy, cls: "gold" } : { v: nEx, f: "num", l: nEx > 1 ? "Exercices" : "Exercice", ic: I.flame },
  ];
  const fmtV = (v, f) => (f === "time" ? fmtTime(v) : fmtNum(v));
  const burst = Array.from({ length: 14 }, (_, i) => `<i style="--a:${Math.round(i * 360 / 14 + (i % 2) * 9)}deg;--d:${i % 3 === 0 ? 92 : i % 3 === 1 ? 74 : 60}px;--c:var(${["--red", "--amber", "--blue", "--green"][i % 4]})"></i>`).join("");
  overlay().innerHTML = `
  <div class="live fin"><div class="live-wrap stagger">
    <div class="done-hero">
      <div class="badge-wrap"><div class="burst" aria-hidden="true">${burst}</div><div class="ring" aria-hidden="true"></div><div class="badge">${spider()}</div></div>
      <div class="eyebrow">${esc(sum.name)} · terminée</div>
      <h1>Mission accomplie</h1>
      <div class="xp-pill">${I.bolt}<span>+<span data-count="${sum.xp}">${sum.xp}</span> XP</span></div>
      ${after.level > before.level ? `<div class="chip amber rank-up">${I.trophy} Nouveau rang : ${esc(after.rank.name)}</div>` : ""}
    </div>
    <div class="fin-stats">${tiles.map(t => `<div class="card fin-stat ${t.cls || ""}"><span class="fs-ic">${t.ic}</span><div class="v tnum"><span data-count="${t.v}" data-fmt="${t.f}">${fmtV(t.v, t.f)}</span>${t.u ? `<small>${t.u}</small>` : ""}</div><div class="l">${t.l}</div></div>`).join("")}</div>
    <div class="coach-line ai"><div class="av">${spider()}</div><div class="grow"><b>Débrief du coach</b><p id="debrief">${esc(local)}</p></div></div>
    ${sum.compare.length ? `<div class="section"><h2>Par exercice</h2><span class="xs dim">vs dernière fois</span></div>
    <div class="card card-list fin-cmp">${sum.compare.map(c => `<div class="cmp"><span class="ellipsis">${esc(c.name)}${sum.prs.includes(c.id) ? ` <span class="pr-tag">${I.trophy}PR</span>` : ""}</span>
      <span class="small muted tnum">${c.type === "load" ? `${fmtKg(c.best.weight)}×${c.best.reps}` : `${c.best.reps}${c.type === "time" ? " s" : ""}`}</span>${delta(c)}</div>`).join("")}</div>` : ""}
    ${newBadges.length ? `<div class="section"><h2>Succès débloqués</h2></div><div class="badges">${newBadges.map(b => `<div class="badge-card on pop"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}</div>` : ""}
    ${sum.sets.length ? `<label class="field fin-note"><span>Note de séance (facultatif)</span><textarea class="input" id="sess-note" rows="2" maxlength="300" placeholder="Sensations, énergie, ce que tu veux retenir…"></textarea></label>` : ""}
    <div class="fin-actions">${next ? `<button class="btn btn-soft btn-block" id="home">Retour à l'accueil</button>`
      : isWorkout(done.program) ? `<button class="btn btn-soft btn-block cool-btn" id="cool">${I.heart} Retour au calme · 8 min</button>` : ""}</div>
    <div class="fin-foot">${next ? `<button class="btn btn-primary btn-lg btn-block" id="next">${I.play} Échauffé ! Enchaîner : ${esc(next.program.name)}</button>`
      : `<button class="btn btn-primary btn-lg btn-block" id="home">Retour à l'accueil</button>`}</div>
  </div></div>`;
  countUp(overlay());
  const relaunch = (program, readiness) => { const exit = onExit; onExit = null; close(); startLive(program, readiness, exit); };
  $("#next")?.addEventListener("click", () => relaunch(next.program, next.readiness));
  $("#cool")?.addEventListener("click", () => relaunch(getProgram("cooldown"), done.readiness));
  $("#sess-note")?.addEventListener("change", e => { const s2 = state.sessions.find(x => x.id === sum.id); if (s2) { s2.note = e.target.value.trim(); save(); } });
  success();
  spidey.setContext("app");
  setTimeout(() => { spidey.react("party"); spidey.say(`Mission accomplie ! +${sum.xp} XP.`, { mood: "party" }); }, 500);
  speak(`Séance terminée. ${local}`, { interrupt: true });
  $("#home").onclick = () => { close(); if (location.hash && location.hash !== "#/") location.hash = "#/"; };

  if (aiReady() && sum.sets.length) {
    $("#debrief").textContent = "Le coach analyse ta séance…";
    aiDebrief(sum).then(t => { const d = $("#debrief"); if (d) d.textContent = t || local; if (t) speak(t, { interrupt: true }); })
      .catch(() => { const d = $("#debrief"); if (d) d.textContent = local; });
  } else if (llm.info().ready && sum.sets.length) {
    const lines = sum.compare.map(c => `${c.name} : meilleure série ${c.best.weight ? c.best.weight + " kg × " : ""}${c.best.reps}${c.delta === null ? " (première fois)" : c.delta > 0 ? " (en progrès)" : c.delta < 0 ? " (en baisse)" : " (stable)"}`).join("\n");
    llm.chat([
      { role: "system", content: `Tu es ${coachName()}, coach sportif. Réponds en français, en tutoyant, en 3 ou 4 phrases maximum, sans liste.` },
      { role: "user", content: `${athleteContext()}\n\nSéance terminée : ${sum.name}, ${Math.round(sum.durationSec / 60)} min, ${sum.volume} kg, ${sum.sets.length} séries, ${sum.prs.length} record(s), fatigue ${sum.fatigue} %.\n${lines}\n\nFais un débrief : ce qui était bien, un point à améliorer, et quoi viser à la prochaine séance.` },
    ], { maxTokens: 220, onDelta: t => { const d = $("#debrief"); if (d && t) d.textContent = t; } })
      .then(t => { if (t) speak(t, { interrupt: true }); })
      .catch(() => { const d = $("#debrief"); if (d) d.textContent = local; });
  }
}

// Les chiffres de la fin de séance défilent jusqu'à leur valeur (texte seulement, ~1 s).
function countUp(root) {
  const els = [...root.querySelectorAll("[data-count]")];
  if (!els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fmt = (el, v) => (el.dataset.fmt === "time" ? fmtTime(Math.round(v)) : fmtNum(v));
  els.forEach(el => (el.textContent = fmt(el, 0)));
  const t0 = performance.now() + 250, dur = 950;
  const step = now => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
    for (const el of els) if (el.isConnected) el.textContent = fmt(el, +el.dataset.count * e);
    if (k < 1 && els[0].isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function close() {
  stopVoice();
  clearInterval(tick); clearInterval(rest?.timer); rest = null;
  clearSaved();
  wakeLock?.release?.(); wakeLock = null;
  S = null;
  mounted = false;
  overlay().innerHTML = "";
  document.body.classList.remove("hide-tabs");
  spidey.hang(false);
  spidey.setContext("app");
  onExit?.();
}

export const isLive = () => !!S;
