// Scanner de code-barres (caméra arrière). Utilise le détecteur natif quand il existe (Android, Chrome),
// sinon la bibliothèque libre ZXing (WebAssembly), chargée une seule fois à la demande : iPhone compris.
import { cleanBarcode } from "./nutrition.js";
import { $, I, esc, sheet } from "./ui.js";

const PONYFILL = "https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/iife/ponyfill.js";
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
let detectorP = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = () => { s.remove(); rej(new Error("chargement impossible")); };
    document.head.appendChild(s);
  });
}

export function getDetector() {
  return (detectorP ||= (async () => {
    if ("BarcodeDetector" in window) {
      try {
        const ok = await window.BarcodeDetector.getSupportedFormats();
        if (ok.includes("ean_13")) return new window.BarcodeDetector({ formats: FORMATS.filter(f => ok.includes(f)) });
      } catch { /* détecteur natif inutilisable : on prend ZXing */ }
    }
    if (!window.BarcodeDetectionAPI) await loadScript(PONYFILL);
    return new window.BarcodeDetectionAPI.BarcodeDetector({ formats: FORMATS });
  })().catch(e => { detectorP = null; throw e; }));
}

const beep = () => {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 1320; g.gain.value = 0.06; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.09); o.onended = () => ac.close();
  } catch { /* pas de son */ }
};

// Saisie du code à la main (étiquette abîmée, caméra refusée…)
export function askCode(onCode) {
  const sh = sheet(`<h2 class="h2">Code-barres</h2><p class="muted small">Les chiffres sous les barres (8 ou 13).</p>
    <label class="field"><span>Code</span><input class="input" id="bc-in" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" placeholder="3017620422003"/></label>
    <p class="xs" id="bc-err" style="color:var(--red);min-height:1.2em"></p>
    <button class="btn btn-primary btn-block" id="bc-ok">${I.search} Chercher le produit</button>`, { z: 90 });
  const input = $("#bc-in", sh.el);
  setTimeout(() => input.focus(), 250);
  const go = () => {
    const code = cleanBarcode(input.value);
    if (!code) { $("#bc-err", sh.el).textContent = "Code invalide : vérifie les chiffres."; return; }
    sh.close(); onCode(code);
  };
  $("#bc-ok", sh.el).onclick = go;
  input.onkeydown = e => { if (e.key === "Enter") go(); };
}

export function openScanner({ onCode, title = "Scanne le code-barres" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "scan";
  wrap.innerHTML = `<video playsinline muted autoplay></video>
    <div class="scan-frame" aria-hidden="true"><i class="scan-line"></i></div>
    <div class="scan-top"><button class="icon-btn" data-x aria-label="Fermer">${I.x}</button><b class="grow">${esc(title)}</b>
      <button class="icon-btn" data-torch aria-label="Lampe" hidden>${I.bolt}</button></div>
    <div class="scan-bottom"><p class="scan-msg" aria-live="polite">Démarrage de la caméra…</p>
      <button class="btn btn-soft" data-type>${I.edit} Taper le code</button></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("hide-tabs");
  const video = $("video", wrap), canvas = document.createElement("canvas"), g = canvas.getContext("2d", { willReadFrequently: true });
  const msg = t => { const m = $(".scan-msg", wrap); if (m) m.textContent = t; };
  let stream = null, timer = 0, closed = false, busy = false, torch = false, detector = null;

  const close = () => {
    if (closed) return;
    closed = true; clearTimeout(timer);
    stream?.getTracks().forEach(t => t.stop());
    wrap.remove();
    if (!document.querySelector(".live, .cam")) document.body.classList.remove("hide-tabs");
  };
  const found = code => { navigator.vibrate?.(40); beep(); close(); onCode?.(code); };

  async function tick() {
    if (closed) return;
    if (!busy && detector && video.readyState >= 2 && video.videoWidth) {
      busy = true;
      try {
        // zone du cadre (centre de l'image), réduite : plus rapide et moins de faux positifs
        const vw = video.videoWidth, vh = video.videoHeight, cw = vw * 0.86, ch = Math.min(vh * 0.5, cw * 0.62);
        const scale = Math.min(1, 900 / cw);
        canvas.width = Math.round(cw * scale); canvas.height = Math.round(ch * scale);
        g.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
        const codes = await detector.detect(canvas);
        for (const c of codes) { const code = cleanBarcode(c.rawValue); if (code) return found(code); }
      } catch { /* image illisible : on réessaie */ }
      busy = false;
    }
    timer = setTimeout(tick, 140);
  }

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      msg("Caméra refusée ou indisponible : tape le code à la main.");
      return;
    }
    if (closed) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    if (track?.getCapabilities?.().torch) {
      const b = $("[data-torch]", wrap);
      b.hidden = false;
      b.onclick = () => { torch = !torch; b.classList.toggle("on", torch); track.applyConstraints({ advanced: [{ torch }] }).catch(() => {}); };
    }
    msg("Chargement du lecteur…");
    try { detector = await getDetector(); } catch { msg("Lecteur introuvable (connexion ?) : tape le code à la main."); return; }
    if (closed) return;
    msg("Place le code-barres dans le cadre");
    tick();
  })();

  $("[data-x]", wrap).onclick = close;
  $("[data-type]", wrap).onclick = () => { close(); askCode(code => onCode?.(code)); };
  return { close };
}
