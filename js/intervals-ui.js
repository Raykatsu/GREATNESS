// Minuteur d'intervalles : réglages (mode, exercices, temps) et écran plein écran — grand compte à rebours, démo animée
// de l'exercice, prochain exercice, voix, bips et vibrations. Le temps se lit sur l'horloge : rien ne dérive si le
// téléphone se met en veille (les annonces manquées pendant ce temps ne sont pas rattrapées).
import { EXERCISES } from "./data.js";
import { state, save, rankInfo } from "./store.js";
import { MODES, PRESETS, normalize, timeline, totalOf, at, events, roundLabel, sessionOf, ivSummary, exName } from "./intervals.js";
import { pickExercises } from "./train.js";
import { animSvg, mountAnims } from "./anim.js";
import { speak, stopSpeaking, beep, success, vibrate } from "./fx.js";
import { checkBadges } from "./badges.js";
import { mascot } from "./mascot.js";
import { $, $$, esc, I, sheet, toast, confirmSheet, fmtTime } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M19 6.5l1.5-1.5"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
};
const dur = s => { const m = Math.floor(s / 60), r = s % 60; return m ? `${m} min${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} s`; };
const repsOf = e => (EXERCISES[e.id]?.type === "time" ? `${e.reps} s` : `${e.reps} reps`);

/* ---------- Carte de l'onglet Séances ---------- */
export const intervalCard = () => `<button class="card tap free-card iv-card" id="iv-start">
    <span class="bi">${IC.timer}</span>
    <span class="grow"><b>Minuteur d'intervalles</b><span class="xs muted">Tabata, EMOM, AMRAP, circuits : guidé à la voix</span></span>
    <span class="chev">${I.chev}</span></button>`;

/* ---------- Réglages ---------- */
// Pas, bornes et libellés des réglages de chaque mode
const FIELDS = {
  work: ["Effort", 5, 5, 300, "s"], rest: ["Repos", 5, 0, 300, "s"], rounds: ["Tours", 1, 1, 30, ""],
  minutes: ["Durée", 1, 1, 60, "min"], restRound: ["Repos entre les tours", 15, 0, 300, "s"],
};
const FIELDS_OF = { tabata: ["work", "rest", "rounds"], emom: ["minutes"], amrap: ["minutes"], circuit: ["work", "rest", "rounds", "restRound"] };

export function openIntervals(init) {
  let cfg = normalize(init || state.profile.interval || PRESETS[0]);
  const sh = sheet(`<div class="eyebrow">Minuteur</div><h2 class="h2">Intervalles</h2>
    <div class="seg mt" id="iv-mode">${Object.entries(MODES).map(([k, m]) => `<button data-m="${k}">${m.name}</button>`).join("")}</div>
    <p class="muted small iv-desc" id="iv-desc"></p>
    <div class="chips iv-presets" id="iv-presets"></div>
    <div class="eyebrow mt">Exercices</div>
    <div class="iv-exs" id="iv-ex"></div>
    <button class="btn btn-ghost btn-sm" id="iv-add">${I.plus} Ajouter un exercice</button>
    <div class="eyebrow mt">Réglages</div>
    <div class="iv-set" id="iv-set"></div>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="iv-go"></button></div>`, { z: 55 });
  const set = patch => { cfg = normalize({ ...cfg, ...patch, name: patch.name ?? "" }); draw(); };
  const draw = () => {
    const reps = cfg.mode === "emom" || cfg.mode === "amrap";
    $$("#iv-mode button", sh.el).forEach(b => b.classList.toggle("on", b.dataset.m === cfg.mode));
    $("#iv-desc", sh.el).textContent = MODES[cfg.mode].desc;
    $("#iv-presets", sh.el).innerHTML = PRESETS.filter(p => p.mode === cfg.mode).map(p => `<button class="chip ${cfg.name === p.name ? "on" : ""}" data-p="${p.id}">${esc(p.name)}</button>`).join("");
    $("#iv-ex", sh.el).innerHTML = cfg.ex.map((e, i) => `<div class="iv-row">${animSvg(e.id, "iv-mini")}
      <span class="grow iv-rn">${esc(exName(e.id))}</span>
      ${reps ? `<span class="iv-step"><button data-r="${i}" data-d="-1" aria-label="Moins">${I.minus}</button><b class="tnum">${repsOf(e)}</b><button data-r="${i}" data-d="1" aria-label="Plus">${I.plus}</button></span>` : ""}
      ${cfg.ex.length > 1 ? `<button class="icon-btn plain sm" data-del="${i}" aria-label="Retirer">${I.trash}</button>` : ""}</div>`).join("");
    $("#iv-set", sh.el).innerHTML = FIELDS_OF[cfg.mode].map(k => { const [label, , , , u] = FIELDS[k]; return `<div class="iv-srow"><span class="grow">${label}</span>
      <span class="iv-step"><button data-f="${k}" data-d="-1" aria-label="Moins">${I.minus}</button><b class="tnum">${k === "minutes" ? `${cfg[k]} min` : u === "s" ? dur(cfg[k]) : cfg[k]}</b><button data-f="${k}" data-d="1" aria-label="Plus">${I.plus}</button></span></div>`; }).join("");
    const segs = timeline(cfg);
    $("#iv-go", sh.el).innerHTML = `${I.play} Lancer · ${dur(totalOf(segs) - cfg.prep)}`;
    mountAnims(sh.el);
  };
  $$("#iv-mode button", sh.el).forEach(b => b.onclick = () => {
    const p = PRESETS.find(x => x.mode === b.dataset.m);
    // on garde ses exercices ; le préréglage du mode donne les temps
    cfg = normalize({ ...p, ex: cfg.ex.map(e => ({ id: e.id, reps: e.reps })), name: "" });
    draw();
  });
  sh.el.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.p) { cfg = normalize(PRESETS.find(p => p.id === t.dataset.p)); draw(); }
    else if (t.dataset.r) { const i = +t.dataset.r, e2 = cfg.ex[i], step = EXERCISES[e2.id]?.type === "time" ? 5 : e2.reps >= 20 ? 5 : 1; set({ ex: cfg.ex.map((x, k) => (k === i ? { ...x, reps: x.reps + step * +t.dataset.d } : x)) }); }
    else if (t.dataset.del) set({ ex: cfg.ex.filter((_, k) => k !== +t.dataset.del) });
    else if (t.dataset.f) { const [, step, lo, hi] = FIELDS[t.dataset.f]; set({ [t.dataset.f]: Math.min(hi, Math.max(lo, cfg[t.dataset.f] + step * +t.dataset.d)) }); }
    else return;
    navigator.vibrate?.(6);
  });
  $("#iv-add", sh.el).onclick = () => pickExercises(ids => set({ ex: [...cfg.ex, ...ids.map(id => ({ id }))] }), { title: "Exercices du minuteur" });
  $("#iv-go", sh.el).onclick = () => {
    state.profile.interval = cfg; save();
    sh.close();
    runIntervals(cfg);
  };
  draw();
}

/* ---------- Écran du minuteur ---------- */
let R = null; // minuteur en cours
const now = () => Date.now() / 1000;
const elapsed = () => (R.pausedAt ?? now()) - R.base;
const RING = 2 * Math.PI * 46;
const KIND = { prep: "Prépare-toi", work: "Effort", rest: "Repos" };

export const intervalsRunning = () => !!R;

export function runIntervals(cfgIn) {
  if (R) return;
  const cfg = normalize(cfgIn), segs = timeline(cfg);
  const el = document.createElement("div");
  el.className = "ivx";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Minuteur d'intervalles");
  document.body.append(el);
  document.body.classList.add("hide-tabs");
  R = { cfg, segs, total: totalOf(segs), el, base: now() - 0.01, pausedAt: null, last: -1, i: -1, amrap: 0, skipped: [], startedAt: Date.now(), raf: 0, timer: 0, wake: null };
  navigator.wakeLock?.request("screen").then(l => { if (R) R.wake = l; }).catch(() => {});
  mascot.setContext("live");
  beep(440, 0.01, "sine", 0.0001); // débloque le son sur iPhone (on est encore dans le geste « Lancer »)
  el.innerHTML = `<div class="iv-top">
      <button class="icon-btn" id="ivx-x" aria-label="Arrêter">${I.x}</button>
      <div class="iv-title"><b>${esc(cfg.name || MODES[cfg.mode].name)}</b><span class="xs muted tnum" id="ivx-round"></span></div>
      <button class="icon-btn" id="ivx-voice" aria-label="Voix">${state.profile.voice ? I.sound : I.mute}</button></div>
    <div class="iv-main">
      <div class="iv-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" id="ivx-arc" cx="50" cy="50" r="46" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
        <div class="iv-c"><span class="iv-kind" id="ivx-kind"></span><b class="iv-t tnum" id="ivx-t">0:00</b><span class="xs muted tnum" id="ivx-left"></span></div></div>
      <div class="iv-now" id="ivx-now"></div>
      <div class="iv-next small" id="ivx-next"></div>
    </div>
    <div class="iv-bar"><i id="ivx-bar"></i></div>
    <div class="iv-ctl">
      <button class="iv-b" id="ivx-back" aria-label="Recommencer le segment">${I.undo}</button>
      <button class="iv-b iv-play" id="ivx-pause" aria-label="Pause">${IC.pause}</button>
      <button class="iv-b" id="ivx-skip" aria-label="Passer">${I.skip}</button></div>`;
  $("#ivx-x", el).onclick = stopAsk;
  $("#ivx-pause", el).onclick = togglePause;
  $("#ivx-skip", el).onclick = () => jump(1);
  $("#ivx-back", el).onclick = () => jump(0);
  $("#ivx-voice", el).onclick = () => {
    state.profile.voice = !state.profile.voice; save();
    $("#ivx-voice", el).innerHTML = state.profile.voice ? I.sound : I.mute;
    if (!state.profile.voice) stopSpeaking();
  };
  el.addEventListener("click", e => {
    if (e.target.closest("#ivx-plus")) { R.amrap++; vibrate(12); beep(990, 0.08); paintAmrap(); }
    if (e.target.closest("#ivx-minus") && R.amrap > 0) { R.amrap--; paintAmrap(); }
  });
  frame();
  R.timer = setInterval(frame, 250); // en plus de l'animation : les annonces partent même si l'écran ne se redessine pas
}

function frame() {
  if (!R) return;
  cancelAnimationFrame(R.raf);
  const t = Math.min(elapsed(), R.total), p = at(R.segs, t);
  // annonces et bips depuis la dernière image (sauf ceux manqués pendant une mise en veille)
  for (const e of events(R.cfg, R.segs, R.last, t)) {
    if (t - e.t > 1.5) continue;
    if (e.beep === "tick") beep(880, 0.09, "sine", 0.1);
    if (e.beep === "go") { beep(1320, 0.35, "sine", 0.14); vibrate(180); }
    if (e.beep === "rest") { beep(620, 0.3, "sine", 0.12); vibrate([60, 50, 60]); }
    if (e.say) speak(e.say, { interrupt: true });
  }
  R.last = t;
  if (p.done) return finish(true);
  if (p.i !== R.i) { R.i = p.i; paintSeg(p.seg); if (R.pausedAt != null) $("#ivx-kind", R.el).textContent = "Pause"; }
  const left = Math.ceil(p.left - 1e-6);
  $("#ivx-t", R.el).textContent = fmtTime(left);
  $("#ivx-arc", R.el).setAttribute("stroke-dashoffset", String(RING * (1 - p.left / p.seg.dur)));
  $("#ivx-left", R.el).textContent = `reste ${fmtTime(Math.ceil(R.total - t))}`;
  $("#ivx-bar", R.el).style.transform = `scaleX(${t / R.total})`;
  R.el.classList.toggle("ending", p.left <= 3.05 && p.seg.dur > 4);
  if (R.pausedAt == null) R.raf = requestAnimationFrame(frame);
}

function paintSeg(seg) {
  const { cfg, el } = R, amrap = seg.amrap;
  el.dataset.kind = seg.kind;
  $("#ivx-kind", el).textContent = amrap ? "AMRAP" : cfg.mode === "emom" && seg.kind === "work" ? `Minute ${seg.round}` : KIND[seg.kind];
  $("#ivx-round", el).textContent = roundLabel(cfg, seg);
  const showReps = cfg.mode === "emom" || cfg.mode === "amrap";
  if (amrap) {
    $("#ivx-now", el).innerHTML = `<div class="iv-list">${cfg.ex.map(e => `<div class="iv-li">${animSvg(e.id, "iv-mini")}<span class="grow">${esc(exName(e.id))}</span><b class="tnum">${repsOf(e)}</b></div>`).join("")}</div>
      <div class="iv-amrap"><button class="iv-b" id="ivx-minus" aria-label="Un tour de moins">${I.minus}</button>
        <button class="btn btn-primary iv-tour" id="ivx-plus">${I.plus} Tour fini <b class="tnum" id="ivx-n">0</b></button></div>`;
    paintAmrap();
  } else {
    const e = seg.ex, rest = seg.kind !== "work";
    $("#ivx-now", el).innerHTML = `${animSvg(e.id, "iv-anim")}<div class="iv-exn">${rest ? `<small>${seg.kind === "prep" ? "Premier exercice" : "Ensuite"}</small>` : ""}<b>${esc(exName(e.id))}</b>${showReps ? `<span class="chip">${repsOf(e)}</span>` : ""}</div>`;
  }
  // le prochain effort (pendant un effort) : on sait ce qui arrive
  const next = seg.kind === "work" && !amrap ? R.segs.slice(R.i + 1).find(s => s.kind === "work") : null;
  $("#ivx-next", el).innerHTML = next ? `Ensuite : <b>${esc(exName(next.ex.id))}</b>${showReps ? ` · ${repsOf(next.ex)}` : ""}` : "";
  mountAnims(el);
}
const paintAmrap = () => { const n = $("#ivx-n", R?.el); if (n) n.textContent = R.amrap; };

function togglePause() {
  if (!R) return;
  const b = $("#ivx-pause", R.el);
  if (R.pausedAt == null) {
    R.pausedAt = now(); stopSpeaking();
    b.innerHTML = I.play; b.setAttribute("aria-label", "Reprendre"); R.el.classList.add("paused");
    $("#ivx-kind", R.el).textContent = "Pause";
  } else {
    R.base += now() - R.pausedAt; R.pausedAt = null;
    b.innerHTML = IC.pause; b.setAttribute("aria-label", "Pause"); R.el.classList.remove("paused");
    R.i = -1; frame();
  }
}
// Passer au segment suivant (dir 1) ou reprendre le segment au début (dir 0)
function jump(dir) {
  if (!R) return;
  const t = elapsed(), p = at(R.segs, t);
  if (p.done) return;
  const target = dir ? p.seg.t0 + p.seg.dur : p.seg.t0;
  if (dir) R.skipped.push([t, target]); // le temps sauté ne compte pas comme du travail fait
  R.base += t - target;
  R.last = target - 0.001; // l'annonce du segment repart
  if (R.pausedAt != null) R.pausedAt = R.base + target;
  R.i = -1; frame();
}

async function stopAsk() {
  if (!R) return;
  const was = R.pausedAt == null;
  if (was) togglePause();
  const t = elapsed();
  if (t < 15 || await confirmSheet("Arrêter le minuteur ?", "Le travail déjà fait sera enregistré dans ton historique.", "Arrêter")) return finish(false);
  if (was && R) togglePause();
}

function finish(complete) {
  if (!R) return;
  const { cfg, el } = R, t = Math.min(elapsed(), R.total);
  clearInterval(R.timer); cancelAnimationFrame(R.raf);
  R.wake?.release?.();
  const before = rankInfo();
  const s = sessionOf(cfg, { startedAt: R.startedAt, elapsed: t, amrapRounds: R.amrap, skipped: R.skipped });
  const kept = s.iv.workSec >= 20;
  let badges = [];
  if (kept) { state.sessions.push(s); save(); badges = checkBadges(); }
  const after = rankInfo();
  R = null;
  if (!kept) { if (t > 15) toast("Moins de 20 secondes d'effort : rien d'enregistré."); return close(el); }
  if (complete) success();
  el.dataset.kind = "done";
  el.innerHTML = `<div class="iv-done stagger">
      <div class="iv-trophy">${complete ? I.trophy : I.check}</div>
      <div class="eyebrow">${esc(s.name)}</div>
      <h1 class="h1">${complete ? "Terminé, bravo !" : "Bien joué"}</h1>
      <p class="muted">${esc(ivSummary(s))}</p>
      <div class="xp-pill">${I.bolt}<span>+${s.xp} XP</span></div>
      ${after.level > before.level ? `<div class="chip amber">${I.trophy} Nouveau rang : ${esc(after.rank.name)}</div>` : ""}
      ${badges.length ? `<div class="badges mt">${badges.map(b => `<div class="badge-card on pop"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}</div>` : ""}
      <div class="grid2 mt"><button class="btn btn-soft" id="ivx-again">${I.refresh} Recommencer</button><button class="btn btn-primary" id="ivx-end">${I.check} Terminer</button></div>
    </div>`;
  $("#ivx-again", el).onclick = () => { close(el); runIntervals(cfg); };
  $("#ivx-end", el).onclick = () => close(el);
  setTimeout(() => { mascot.react?.("party"); mascot.say?.(`${complete ? "Terminé" : "Bien joué"} ! +${s.xp} XP.`, { mood: "party" }); }, 400);
}

function close(el) {
  stopSpeaking();
  el?.remove();
  if (!R) { document.body.classList.remove("hide-tabs"); mascot.setContext("app"); }
}

// Retour sur l'app après une mise en veille : on resynchronise tout de suite
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (R && !document.hidden) { R.i = -1; frame(); } });

