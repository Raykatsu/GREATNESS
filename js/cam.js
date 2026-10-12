// Compteur de répétitions à la caméra : la pose est détectée sur le téléphone (MediaPipe),
// rien n'est envoyé sur internet. On suit l'angle d'une articulation et on compte les allers-retours.
import { PATTERNS, patternOf, angle, JOINTS, RepCounter } from "./motion.js";
import { beep, vibrate, speak } from "./fx.js";
import { $, esc, I, toast } from "./ui.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

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
export const camTrackable = id => !!PATTERNS[patternOf(id)].joint;

// Ouvre la caméra pour l'exercice `ex` ; onDone(reps) si l'utilisateur garde le compte.
export function openCam(ex, { onDone, voice = true } = {}) {
  const pat = PATTERNS[patternOf(ex.id)];
  const wrap = document.createElement("div");
  wrap.className = "cam";
  wrap.innerHTML = `<video playsinline muted></video><canvas></canvas>
    <div class="cam-top"><button class="icon-btn" data-x aria-label="Fermer">${I.x}</button>
      <div class="cam-title"><b>${esc(ex.name)}</b><small>${esc(pat.name)} · place-toi de profil, tout le corps visible</small></div>
      <button class="icon-btn" data-flip aria-label="Changer de caméra">${I.refresh}</button></div>
    <div class="cam-count"><span id="cam-n">0</span><small id="cam-msg">Chargement de la détection…</small></div>
    <div class="cam-bottom"><button class="btn btn-soft" data-reset>${I.undo} Remettre à 0</button>
      <button class="btn btn-primary" data-use>${I.check} Garder ce compte</button></div>`;
  document.body.appendChild(wrap);
  const video = wrap.querySelector("video"), canvas = wrap.querySelector("canvas"), g = canvas.getContext("2d");
  const msg = t => { const m = $("#cam-msg", wrap); if (m) m.textContent = t; };
  let stream = null, raf = null, closed = false, facing = "user", counter = new RepCounter(pat), lastSeen = 0, side = null;

  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); stream = null; };
  const close = () => { if (closed) return; closed = true; stop(); wrap.remove(); };
  const setN = () => { $("#cam-n", wrap).textContent = counter.count; };

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
    msg("Prêt : fais ta première rep.");
    loop();
  }

  function loop() {
    if (closed || !stream) return;
    if (video.readyState >= 2) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const res = landmarker.detectForVideo(video, performance.now());
      g.clearRect(0, 0, canvas.width, canvas.height);
      const lm = res.landmarks?.[0];
      if (lm) { lastSeen = performance.now(); draw(lm); track(lm); }
      else if (performance.now() - lastSeen > 1500) msg("Je ne te vois pas : recule un peu.");
    }
    raf = requestAnimationFrame(loop);
  }

  function draw(lm) {
    const W = canvas.width, H = canvas.height;
    const pts = side == null ? [] : JOINTS[pat.joint][side];
    g.lineWidth = Math.max(3, W / 160); g.lineCap = "round";
    for (const [a, b] of BONES) {
      if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue;
      g.strokeStyle = pts.includes(a) && pts.includes(b) ? "#ff3b4e" : "rgba(255,255,255,.75)";
      g.beginPath(); g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); g.stroke();
    }
  }

  function track(lm) {
    // on suit le côté le plus visible (celui tourné vers la caméra)
    const vis = s => JOINTS[pat.joint][s].reduce((t, i) => t + (lm[i].visibility ?? 1), 0);
    const best = vis(0) >= vis(1) ? 0 : 1;
    if (side == null || vis(best) - vis(side) > 0.6) side = best;
    const [a, b, c] = JOINTS[pat.joint][side];
    if (vis(side) < 1.5) return msg("Articulation mal visible : tourne-toi de profil.");
    const r = counter.update(angle(lm[a], lm[b], lm[c]));
    if (r === "rep") {
      setN(); beep(1040, 0.08); vibrate(15);
      msg(counter.count === 1 ? "Bien ! Continue." : "Rep comptée");
      if (voice && counter.count % 5 === 0) speak(String(counter.count));
    } else if (r === "partial") { beep(300, 0.12, "square", 0.05); msg("Amplitude trop courte : va plus loin."); }
  }

  wrap.querySelector("[data-x]").onclick = close;
  wrap.querySelector("[data-flip]").onclick = () => { facing = facing === "user" ? "environment" : "user"; startCam(); };
  wrap.querySelector("[data-reset]").onclick = () => { counter = new RepCounter(pat); setN(); msg("Compteur remis à zéro."); };
  wrap.querySelector("[data-use]").onclick = () => { const n = counter.count; close(); if (n) onDone?.(n); };
  startCam();
  return { close };
}
