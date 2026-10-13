// Caméra : compte les répétitions et corrige la posture en direct. La pose est détectée sur le téléphone
// (MediaPipe), rien n'est envoyé sur internet. Le compteur suit l'angle d'une articulation ; form.js
// repère les défauts du mouvement (dos rond, bassin, coudes, élan, amplitude, vitesse) et le coach le dit.
import { PATTERNS, patternOf, angle, JOINTS, RepCounter } from "./motion.js";
import { FormCoach, formHold, formConfig, ISSUES, summaryText } from "./form.js";
import { beep, vibrate, speak } from "./fx.js";
import { $, esc, I, toast } from "./ui.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const GOOD = "#35d07f", BAD = "#ff3b4e";

let landmarker = null;
async function loadLandmarker() {
  if (landmarker) return landmarker;
  const { FilesetResolver, PoseLandmarker } = await import(`${MP}/vision_bundle.mjs`);
  const files = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: "VIDEO", numPoses: 1 });
  try { landmarker = await PoseLandmarker.createFromOptions(files, opts("GPU")); }
  catch { landmarker = await PoseLandmarker.createFromOptions(files, opts("CPU")); }
  return landmarker;
}

export const camSupported = () => !!navigator.mediaDevices?.getUserMedia;
export const camTrackable = id => !!PATTERNS[patternOf(id)].joint || formHold(id);
// Bouton caméra pour cet exercice ? (reps comptées, ou exercice tenu chronométré)
export const camFor = ex => camSupported() && (formHold(ex.id) || (ex.type !== "time" && !!PATTERNS[patternOf(ex.id)].joint));

// Ouvre la caméra pour l'exercice `ex`.
// onDone(n, bilan) si l'utilisateur garde le compte (reps, ou secondes pour un exercice tenu) ;
// practice : essai libre (depuis la démo), le bouton du bas affiche le bilan de technique.
export function openCam(ex, { onDone, voice = true, practice = false, goal = 0 } = {}) {
  const pat = PATTERNS[patternOf(ex.id)], hold = formHold(ex.id), face = formConfig(ex.id).view === "face";
  const wrap = document.createElement("div");
  wrap.className = "cam";
  wrap.innerHTML = `<video playsinline muted></video><canvas></canvas>
    <div class="cam-top"><button class="icon-btn" data-x aria-label="Fermer">${I.x}</button>
      <div class="cam-title"><b>${esc(ex.name)}</b><small>${face ? "Place-toi face à la caméra" : "Place-toi de profil"}, tout le corps visible, téléphone à 2-3 m</small></div>
      <button class="icon-btn" data-flip aria-label="Changer de caméra">${I.refresh}</button></div>
    <div class="cam-form" id="cam-form" aria-live="assertive" hidden></div>
    <div class="cam-count" aria-live="polite"><span id="cam-n">0</span><small id="cam-msg">Chargement de la détection…</small><em id="cam-q"></em></div>
    <div class="cam-bottom"><button class="btn btn-soft" data-reset>${I.undo} Remettre à 0</button>
      <button class="btn btn-primary" data-use>${practice ? `${I.check} Terminer` : `${I.check} Garder ce ${hold ? "temps" : "compte"}`}</button></div>
    <div class="cam-sum" id="cam-sum" hidden></div>`;
  document.body.appendChild(wrap);
  const video = wrap.querySelector("video"), canvas = wrap.querySelector("canvas"), g = canvas.getContext("2d");
  const msg = t => { const m = $("#cam-msg", wrap); if (m && m.textContent !== t) m.textContent = t; };
  let stream = null, raf = null, closed = false, facing = "user", lastSeen = 0, side = null;
  let counter = new RepCounter(pat), coach = new FormCoach(ex.id), event = null, sticky = null, shown = null, said = {}, lastSay = 0, lastSec = 0;

  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); stream = null; };
  const close = () => { if (closed) return; closed = true; stop(); wrap.remove(); };
  const value = () => (hold ? Math.floor(coach.hold.total / 1000) : counter.count);
  const setN = (pop = true) => {
    const n = $("#cam-n", wrap), v = value();
    if (n.textContent === String(v)) return;
    n.textContent = v;
    if (pop && v) n.animate?.([{ transform: "scale(1.25)" }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.9,.3,1.2)" });
  };
  const quality = () => {
    const s = coach.summary(), q = $("#cam-q", wrap);
    q.textContent = hold ? (s.seconds ? `${s.score} % du temps en bonne position` : "") : s.reps ? `Technique : ${s.clean}/${s.reps} reps propres` : "";
  };

  // Bandeau de correction : rouge avec le conseil, vert quand tout va bien
  const issueText = id => (id === "partial" ? coach.msg("partial") : ISSUES[id]?.msg || "");
  function showForm(id, active) {
    const box = $("#cam-form", wrap), key = id || (active ? "ok" : "");
    if (key === shown) return;
    shown = key;
    box.hidden = !key;
    if (!key) return;
    box.className = `cam-form ${id ? "bad" : "ok"}`;
    box.innerHTML = id ? `${I.alert}<span>${esc(issueText(id))}</span>` : `${I.check}<span>${hold ? "Position parfaite, tiens bon" : "Bonne technique, continue"}</span>`;
    if (id) nudge(id);
  }
  // le coach le dit (et le redit si le défaut continue), sans parler en boucle
  function nudge(id) {
    const now = performance.now();
    vibrate([30, 40, 30]);
    if (voice && now - lastSay > 3500 && now - (said[id] || -1e9) > 9000) { speak(ISSUES[id].say, { interrupt: true }); lastSay = now; said[id] = now; }
  }

  async function startCam() {
    stop();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch {
      msg("Caméra refusée ou indisponible."); toast("Autorise la caméra pour compter tes reps.", 3500); return;
    }
    video.srcObject = stream;
    wrap.classList.toggle("mirror", facing === "user");
    await video.play().catch(() => {});
    try { await loadLandmarker(); } catch { msg("Détection impossible à charger (connexion ?)."); return; }
    if (closed) return;
    msg(hold ? "Mets-toi en position." : "Prêt : fais ta première rep.");
    loop();
  }

  function loop() {
    if (closed || !stream) return;
    if (video.readyState >= 2) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      const now = performance.now(), res = landmarker.detectForVideo(video, now);
      g.clearRect(0, 0, canvas.width, canvas.height);
      const lm = res.landmarks?.[0];
      if (lm) { lastSeen = now; draw(lm, track(lm, now)); }
      else if (now - lastSeen > 1500) { msg("Je ne te vois pas : recule un peu."); showForm(null, false); }
    }
    raf = requestAnimationFrame(loop);
  }

  function draw(lm, f) {
    const W = canvas.width, H = canvas.height, lw = Math.max(3, W / 160);
    const work = side == null || !pat.joint ? [] : JOINTS[pat.joint][side];
    const bad = new Set((f?.bones || []).map(([a, b]) => `${a}-${b}`));
    const seen = i => (lm[i].visibility ?? 1) >= 0.4, line = (a, b) => { g.beginPath(); g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); g.stroke(); };
    g.lineCap = "round";
    for (const [a, b] of BONES) {
      if (!seen(a) || !seen(b) || bad.has(`${a}-${b}`) || bad.has(`${b}-${a}`)) continue;
      const hot = work.includes(a) && work.includes(b);
      g.lineWidth = hot ? lw * 1.4 : lw; g.strokeStyle = hot ? GOOD : "rgba(255,255,255,.75)";
      line(a, b);
    }
    // ligne guide : l'alignement à retrouver
    if (f?.guide) {
      const [[x1, y1], [x2, y2]] = f.guide;
      g.save(); g.setLineDash([lw * 2.5, lw * 2]); g.lineWidth = lw; g.strokeStyle = GOOD;
      g.beginPath(); g.moveTo(x1 * W, y1 * H); g.lineTo(x2 * W, y2 * H); g.stroke(); g.restore();
    }
    // segments en défaut, en rouge par-dessus
    g.lineWidth = lw * 1.8; g.strokeStyle = BAD; g.shadowColor = BAD; g.shadowBlur = lw * 3;
    for (const [a, b] of f?.bones || []) if (seen(a) && seen(b)) line(a, b);
    g.shadowBlur = 0; g.fillStyle = "#fff";
    for (const i of DOTS) if (seen(i)) { g.beginPath(); g.arc(lm[i].x * W, lm[i].y * H, lw * 0.9, 0, Math.PI * 2); g.fill(); }
  }

  function track(lm, now) {
    const ar = canvas.width / (canvas.height || 1), P = i => ({ x: lm[i].x * ar, y: lm[i].y });
    if (hold) {
      const f = coach.frame(lm, now, ar);
      const sec = value();
      if (!f.inPos) { msg("Mets-toi en position, de profil."); showForm(null, false); return f; }
      showForm(f.issue, true);
      msg(f.issue ? "Corrige ta position" : sec ? "Tiens bon !" : "C'est parti !");
      if (sec !== lastSec) {
        lastSec = sec; setN(false); quality();
        if (goal && sec === goal) { beep(1040, 0.2); vibrate(60); if (voice) speak("Objectif atteint !"); }
        else if (sec && sec % 10 === 0) { beep(880, 0.06); if (voice && !f.issue) speak(`${sec} secondes`); }
      }
      return f;
    }
    // on suit le côté le plus visible (celui tourné vers la caméra)
    const vis = s => JOINTS[pat.joint][s].reduce((t, i) => t + (lm[i].visibility ?? 1), 0);
    const best = vis(0) >= vis(1) ? 0 : 1;
    if (side == null || vis(best) - vis(side) > 0.6) side = best;
    const [a, b, c] = JOINTS[pat.joint][side];
    if (vis(side) < 1.5) { msg("Articulation mal visible : tourne-toi de profil."); return null; }
    const r = counter.update(angle(P(a), P(b), P(c)));
    const f = coach.frame(lm, now, ar, counter.start != null);
    if (r) {
      const e = coach.event(r, now);
      if (e) event = { id: e, until: now + 2600 };
      if (r === "rep") {
        // le défaut de cette rep reste affiché jusqu'à une rep propre
        const done = coach.reps[coach.reps.length - 1]?.issues || [];
        sticky = Object.keys(ISSUES).find(id => done.includes(id)) || null;
        if (sticky && sticky === shown) nudge(sticky);
        setN(); quality(); beep(1040, 0.08); vibrate(15);
        msg(counter.count === 1 ? "Bien ! Continue." : "Rep comptée");
        if (voice && counter.count % 5 === 0 && !f?.issue && !e) speak(String(counter.count));
      } else { beep(300, 0.12, "square", 0.05); msg("Rep non comptée"); }
    }
    if (event && now > event.until) event = null;
    showForm(f?.issue || event?.id || sticky, counter.start != null);
    return f;
  }

  // Bilan de technique (essai libre)
  function showSummary() {
    const s = coach.summary(), box = $("#cam-sum", wrap);
    const n = hold ? s.seconds : s.reps;
    stop();
    box.hidden = false;
    box.innerHTML = `<div class="cam-sum-card">
      <div class="eyebrow">Bilan de technique</div>
      ${n ? `<div class="cam-score ${s.score >= 80 ? "hi" : s.score >= 50 ? "mid" : "lo"}"><b class="tnum">${s.score}<small>%</small></b>
        <span>${hold ? `${s.good} s sur ${s.seconds} s en bonne position` : `${s.clean} rep${s.clean > 1 ? "s" : ""} propre${s.clean > 1 ? "s" : ""} sur ${s.reps}`}</span></div>`
        : `<p class="small muted">${hold ? "Aucun temps mesuré : mets-toi en position, de profil." : "Aucune rep comptée : place-toi de profil, tout le corps visible."}</p>`}
      ${s.issues.length ? `<ul class="cam-issues">${s.issues.map(i => `<li><span>${esc(i.label)}</span><b class="tnum">${hold ? `${i.n} s` : `× ${i.n}`}</b></li>`).join("")}</ul>
        <p class="cam-tip">${I.sparkle}<span>${esc(s.tip)}</span></p>` : n ? `<p class="cam-tip ok">${I.check}<span>Rien à corriger : belle technique !</span></p>` : ""}
      <div class="cam-sum-acts"><button class="btn btn-soft" data-again>${I.undo} Recommencer</button><button class="btn btn-primary" data-close>Fermer</button></div></div>`;
    box.querySelector("[data-close]").onclick = close;
    box.querySelector("[data-again]").onclick = () => { box.hidden = true; reset(); startCam(); };
  }
  function reset() {
    counter = new RepCounter(pat); coach = new FormCoach(ex.id); event = sticky = null; lastSec = 0;
    setN(false); quality(); showForm(null, false); msg("Compteur remis à zéro.");
  }

  wrap.querySelector("[data-x]").onclick = close;
  wrap.querySelector("[data-flip]").onclick = () => { facing = facing === "user" ? "environment" : "user"; startCam(); };
  wrap.querySelector("[data-reset]").onclick = reset;
  wrap.querySelector("[data-use]").onclick = () => {
    if (practice) return showSummary();
    const n = value(), s = coach.summary();
    close();
    if (n) onDone?.(n, s);
  };
  startCam();
  return { close };
}

export { summaryText };
