// Séance en direct : tableau des séries, ajustements temps réel, repos, fin de séance.
import { EXERCISES } from "./data.js";
import { state, save, rankInfo, recordLift, e1rm, currentUser } from "./store.js";
import { Session, fmtTarget, plates } from "./engine.js";
import { cycleInfo } from "./planner.js";
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

export function startLive(program, readiness, exit) {
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

function render() {
  if (!S) return;
  const ex = S.current;
  persist();
  if (!ex) return S.program.free ? renderFreeEmpty() : finish();
  const simple = S.program.simple;
  const note = state.exNotes?.[ex.id];
  const last = ex.last;
  const rows = Array.from({ length: Math.max(ex.sets, ex.done.length) }, (_, i) => {
    const d = ex.done[i];
    const prev = last?.[i] ? fmtSet(last[i], ex) : "—";
    if (d) return `<div class="set done ${i === justDone ? "just" : ""}"><span class="i">${i + 1}</span><span class="prev">${prev}</span>
      <span class="val">${ex.type === "load" ? d.weight + "<small>kg</small>" : "—"}</span><span class="val">${d.reps}<small>${unit(ex) || ""}</small> <span class="rpe-b">@${d.rpe}</span></span><span class="ok">${I.check}</span></div>`;
    const cur = i === ex.done.length;
    return `<div class="set ${cur ? "cur" : ""}"><span class="i">${i + 1}</span><span class="prev">${prev}</span>
      <span class="val ${cur ? "" : "dim"}">${ex.type === "load" ? (cur ? ui.weight : ex.weight) + "<small>kg</small>" : "—"}</span>
      <span class="val ${cur ? "" : "dim"}">${cur ? ui.reps : ex.goal}<small>${unit(ex)}</small></span><span class="ok">${cur ? "" : ""}</span></div>
      ${cur ? editor(ex, simple) : ""}`;
  }).join("");
  const msg = S.log[0];
  overlay().innerHTML = `
  <div class="live"><div class="live-wrap">
    <header class="live-head">
      <div class="row between">
        <button class="icon-btn" id="quit" aria-label="Terminer">${I.x}</button>
        <div class="center grow"><div class="title ellipsis">${esc(S.program.name)}</div><div class="timer" id="elapsed">${fmtTime(S.elapsed)}</div></div>
        <div class="row" style="gap:6px"><button class="icon-btn ${listener?.active ? "on" : ""}" id="mic" aria-label="Mains libres">${I.mic}</button>
        <button class="icon-btn" id="menu" aria-label="Options">${I.more}</button></div>
      </div>
      <div class="thread"><i style="width:${S.progress * 100}%"></i></div>
    </header>

    <nav class="ex-tabs" id="tabs">${S.plan.map((e, i) => `<button class="ex-tab ${i === S.idx ? "cur" : e.status}" data-i="${i}">
      <span class="k">${e.status === "done" ? "✓" : i + 1}</span>${esc(e.name)}${e.ss ? `<span class="ss">${esc(e.ss)}</span>` : ""}</button>`).join("")}
      <button class="ex-tab" id="add-ex">${I.plus} Exercice</button></nav>

    <div class="ex-head">
      <div class="grow"><h2>${esc(ex.name)}</h2>
        <div class="row mt-s" style="gap:6px;flex-wrap:wrap"><span class="chip">${esc(ex.muscle)}</span><span class="chip red">Objectif ${fmtTarget(ex)}</span>${ex.ss ? `<span class="chip blue">Superset ${esc(ex.ss)}</span>` : ""}${ex.plateau ? `<span class="chip amber">Relance plateau</span>` : ""}${simple ? "" : `<span class="chip">Ressenti ${ex.rpe}</span>`}</div></div>
      <button class="icon-btn" id="cues-btn" aria-label="Technique" style="${showCues ? "background:var(--text);color:var(--bg)" : ""}">${I.info}</button>
    </div>
    ${showCues ? `<div class="cues">${animSvg(ex.id, "cues-anim")}<div class="grow">${ex.cues.map(c => `<div>${esc(c)}</div>`).join("")}</div></div>` : ""}
    <div class="xs muted mt-s">${last ? `Dernière fois : ${last.map(s => fmtSet(s, ex)).join(" · ")}` : "Première fois sur cet exercice : je calibre dès la première série."}</div>
    ${note ? `<button class="note-line" id="note-show">${I.edit}<span>${esc(note)}</span></button>` : ""}

    <div class="sets">
      <div class="sets-h"><span>#</span><span>Avant</span><span>${ex.type === "load" ? "Kg" : ""}</span><span>${ex.type === "time" ? "Sec" : "Reps"}</span><span></span></div>
      ${rows}
    </div>

    <div class="ex-actions">
      <button class="btn btn-soft btn-sm" id="add-set">${I.plus} Série</button>
      <button class="btn btn-soft btn-sm" id="swap">${I.swap} Remplacer</button>
      <button class="btn btn-soft btn-sm" id="skip">${I.skip} Passer</button>
      <button class="btn btn-soft btn-sm" id="note">${I.edit} Note</button>
      ${camSupported() && ex.type !== "time" && camTrackable(ex.id) ? `<button class="btn btn-soft btn-sm" id="cam">${I.camera} Compter</button>` : ""}
      ${S.history.length ? `<button class="btn btn-soft btn-sm" id="undo">${I.undo} Annuler</button>` : ""}
    </div>

    ${msg ? `<div class="coach-line ${msg.kind}"><div class="av">${spider()}</div><div><b>${esc(msg.title)}</b><p>${esc(msg.text)}</p>
      ${msg.swap && EXERCISES[msg.swap] ? `<button class="btn btn-soft btn-sm mt-s" id="add-alt">Ajouter ${esc(EXERCISES[msg.swap].name)}</button>` : ""}</div></div>` : ""}
  </div></div>
  <div class="dock"><div class="dock-in" id="dock"></div></div>`;
  justDone = -1;
  renderDock();
  bind(ex);
  const cur = $(`.ex-tab[data-i="${S.idx}"]`);
  cur?.scrollIntoView({ inline: "center", block: "nearest" });
}

function editor(ex, simple) {
  const stepper = (key, val, label, step) => `<div class="stepper"><button data-s="${key}" data-d="${-step}" aria-label="moins">−</button>
    <div class="mid" id="m-${key}"><input id="in-${key}" type="number" inputmode="decimal" step="${step}" value="${val}"/><small>${label}</small></div>
    <button data-s="${key}" data-d="${step}" aria-label="plus">+</button></div>`;
  const repStep = ex.type === "time" ? 5 : 1;
  return `<div class="editor">
    <div class="steppers ${ex.type === "load" ? "" : "one"}">
      ${ex.type === "load" ? stepper("weight", ui.weight, "KG", ex.step) : ""}
      ${stepper("reps", ui.reps, ex.type === "time" ? "SECONDES" : "RÉPÉTITIONS", repStep)}
    </div>
    ${EXERCISES[ex.id]?.equip === "bar" && ex.type === "load" ? `<button class="plates" id="plates">${platesText(ui.weight)}</button>` : ""}
    ${simple ? "" : `<div class="rpe-lab"><span>Ressenti</span><span class="dim">6 facile → 10 échec</span></div>
    <div class="rpe">${[[6, "Facile"], [7, "Modéré"], [8, "Dur"], [9, "Très dur"], [10, "Échec"]].map(([v, l]) => `<button data-rpe="${v}" class="${ui.rpe === v ? "on" : ""}">${v}<small>${l}</small></button>`).join("")}</div>
    <label class="pain"><input type="checkbox" id="pain" ${ui.pain ? "checked" : ""}/> Douleur articulaire ou inhabituelle</label>`}
  </div>`;
}

function platesText(w) {
  const p = plates(w);
  if (w < 20) return "Moins lourd qu'une barre olympique (20 kg)";
  return `<b>Par côté</b> ${p.side.length ? p.side.map(x => String(x).replace(".", ",")).join(" + ") : "rien"}${p.rest > 0 ? ` <span class="dim">(+${String(p.rest).replace(".", ",")} kg à arrondir)</span>` : ""} <span class="dim">· barre 20 kg</span>`;
}

function renderFreeEmpty() {
  overlay().innerHTML = `
  <div class="live"><div class="live-wrap">
    <header class="live-head"><div class="row between">
      <button class="icon-btn" id="quit" aria-label="Terminer">${I.x}</button>
      <div class="center grow"><div class="title">${esc(S.program.name)}</div><div class="timer" id="elapsed">${fmtTime(S.elapsed)}</div></div>
      <button class="icon-btn" id="menu" aria-label="Options">${I.more}</button></div></header>
    ${S.plan.length ? `<div class="card mt"><div class="eyebrow">Déjà fait</div>${S.plan.map(e => `<div class="cmp"><span>${esc(e.name)}</span><span class="small muted">${e.done.length} série${e.done.length > 1 ? "s" : ""}</span><span></span></div>`).join("")}</div>` : ""}
    <div class="empty mt-l">${spider()}<b style="color:var(--text)">${S.plan.length ? "Et maintenant ?" : "Séance libre"}</b><br>Ajoute les exercices au fur et à mesure, le coach ajuste tout en direct.</div>
    <button class="add-big" id="free-add">${I.plus} Ajouter un exercice</button>
  </div></div>
  <div class="dock"><div class="dock-in">${S.totalDone ? `<button class="btn btn-primary btn-lg btn-block" id="free-end">${I.check} Terminer la séance</button>` : ""}</div></div>`;
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
  if (rest) {
    const nx = S.current;
    dock.innerHTML = `<div class="rest" id="rest"><div class="fill" id="rest-fill"></div>
      <div class="t" id="rest-t">${fmtTime(Math.ceil((rest.end - Date.now()) / 1000))}<small>REPOS</small></div>
      <div class="nx">Ensuite<br><b>${esc(nx.name)}</b> · ${fmtTarget(nx)}</div>
      <div class="ctr"><button data-r="-15">−15</button><button data-r="15">+15</button><button class="go" id="rest-skip">Go</button></div></div>`;
    $$("[data-r]", dock).forEach(b => b.onclick = () => { rest.end += +b.dataset.r * 1000; rest.total = Math.max(rest.total + +b.dataset.r, 10); paintRest(); });
    $("#rest-skip", dock).onclick = () => endRest(true);
    paintRest();
  } else {
    dock.innerHTML = `<button class="btn btn-primary btn-lg btn-block" id="log">${I.check} Valider la série ${ex.done.length + 1}/${Math.max(ex.sets, ex.done.length + 1)}</button>`;
    $("#log", dock).onclick = logSet;
  }
}

function bind(ex) {
  $("#quit").onclick = quit;
  $("#menu").onclick = menu;
  $("#mic").onclick = toggleVoice;
  $("#cues-btn").onclick = () => { showCues = !showCues; render(); };
  mountAnims(overlay());
  $("#cam")?.addEventListener("click", () => openCam(ex, { onDone: n => {
    ui.reps = n; const inp = $("#in-reps"); if (inp) inp.value = n;
    toast(`${n} reps comptées : ajuste le ressenti puis valide.`);
  } }));
  $$(".ex-tab").forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (i === S.idx) return;
    if (!S.jump(i)) return toast("Exercice déjà terminé.");
    resetInputs(); render();
    const intro = S.intro(); speak(intro.say, { interrupt: true });
  });
  $$("[data-s]").forEach(b => b.onclick = () => {
    const k = b.dataset.s, d = +b.dataset.d;
    ui[k] = Math.max(0, +(ui[k] + d).toFixed(2));
    const inp = $(`#in-${k}`); if (inp) inp.value = ui[k];
    if (k === "weight" && $("#plates")) $("#plates").innerHTML = platesText(ui.weight);
    vibrate(6);
  });
  $$(".stepper input").forEach(inp => inp.onchange = () => { const k = inp.id.slice(3); ui[k] = Math.max(0, +inp.value || 0); });
  $$("[data-rpe]").forEach(b => b.onclick = () => { ui.rpe = +b.dataset.rpe; $$("[data-rpe]").forEach(x => x.classList.toggle("on", x === b)); vibrate(8); });
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

function paintRest() {
  if (!rest) return;
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  const t = $("#rest-t"), f = $("#rest-fill"), box = $("#rest");
  if (t) t.innerHTML = `${fmtTime(Math.max(0, left))}<small>REPOS</small>`;
  if (f) f.style.width = `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%`;
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
  overlay().innerHTML = `
  <div class="live"><div class="live-wrap enter" style="padding-bottom:40px">
    <div class="done-hero"><div class="badge">${spider()}</div><h1>Mission accomplie</h1>
      <div class="xp mt-s">+${sum.xp} XP</div>
      ${after.level > before.level ? `<div class="chip amber mt-s">${I.trophy} Nouveau rang : ${after.rank.name}</div>` : ""}</div>
    <div class="grid2 mt-l">
      <div class="card stat"><div class="v">${fmtTime(sum.durationSec)}</div><div class="l">Durée</div></div>
      <div class="card stat"><div class="v">${fmtNum(sum.volume)}<small>kg</small></div><div class="l">Volume soulevé</div></div>
      <div class="card stat"><div class="v">${sum.sets.length}</div><div class="l">Séries</div></div>
      <div class="card stat"><div class="v">${sum.prs.length}</div><div class="l">Records</div></div>
    </div>
    <div class="coach-line ai"><div class="av">${spider()}</div><div><b>Débrief du coach</b><p id="debrief">${esc(local)}</p></div></div>
    ${sum.compare.length ? `<div class="section"><h2>Par exercice</h2><span class="xs dim">vs dernière fois</span></div>
    <div class="card" style="padding:4px 16px">${sum.compare.map(c => `<div class="cmp"><span class="ellipsis">${esc(c.name)}${sum.prs.includes(c.id) ? ` <span class="chip amber" style="height:20px;font-size:10.5px;padding:0 7px">PR</span>` : ""}</span>
      <span class="small muted">${c.type === "load" ? `${c.best.weight}×${c.best.reps}` : `${c.best.reps}${c.type === "time" ? " s" : ""}`}</span>${delta(c)}</div>`).join("")}</div>` : ""}
    ${newBadges.length ? `<div class="section"><h2>Succès débloqués</h2></div><div class="badges">${newBadges.map(b => `<div class="badge-card on pop"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}</div>` : ""}
    ${sum.sets.length ? `<label class="field mt-l"><span>Note de séance (facultatif)</span><textarea class="input" id="sess-note" rows="2" maxlength="300" placeholder="Sensations, énergie, ce que tu veux retenir…" style="height:auto;padding:12px"></textarea></label>` : ""}
    <button class="btn btn-primary btn-lg btn-block mt" id="home">Retour à l'accueil</button>
  </div></div>`;
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
      { role: "system", content: "Tu es Spider-Man, coach sportif. Réponds en français, en tutoyant, en 3 ou 4 phrases maximum, sans liste." },
      { role: "user", content: `${athleteContext()}\n\nSéance terminée : ${sum.name}, ${Math.round(sum.durationSec / 60)} min, ${sum.volume} kg, ${sum.sets.length} séries, ${sum.prs.length} record(s), fatigue ${sum.fatigue} %.\n${lines}\n\nFais un débrief : ce qui était bien, un point à améliorer, et quoi viser à la prochaine séance.` },
    ], { maxTokens: 220, onDelta: t => { const d = $("#debrief"); if (d && t) d.textContent = t; } })
      .then(t => { if (t) speak(t, { interrupt: true }); })
      .catch(() => { const d = $("#debrief"); if (d) d.textContent = local; });
  }
}

function close() {
  stopVoice();
  clearInterval(tick); clearInterval(rest?.timer); rest = null;
  clearSaved();
  wakeLock?.release?.(); wakeLock = null;
  S = null;
  overlay().innerHTML = "";
  document.body.classList.remove("hide-tabs");
  spidey.hang(false);
  spidey.setContext("app");
  onExit?.();
}

export const isLive = () => !!S;
