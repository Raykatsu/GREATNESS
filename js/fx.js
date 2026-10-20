// Effets : voix, sons, vibrations et petits détails visuels.
import { state } from "./store.js";
import { voiceLang, tr } from "./i18n.js";

/* ---------- Voix ---------- */
// La voix du téléphone dans la langue de l'app (choisie au moment de parler : la langue est connue après le chargement)
let voices = [];
const pickVoice = () => {
  const en = voiceLang().startsWith("en"), lang = en ? /^en/i : /^fr/i;
  return voices.find(v => lang.test(v.lang) && (en ? /google|samantha|alex|daniel|male/i : /google|thomas|nicolas|paul|male/i).test(v.name))
    || voices.find(v => lang.test(v.lang)) || null;
};
if ("speechSynthesis" in window) {
  voices = speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); };
}

// Le mode mains libres coupe l'écoute pendant que le coach parle.
export const speechHooks = { start: null, end: null };

// force : réponse à une question posée à voix haute (lue même si les consignes vocales sont coupées)
export function speak(text, { interrupt = false, force = false } = {}) {
  if ((!state.profile.voice && !force) || !("speechSynthesis" in window) || !text) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(tr(text)); // en anglais : la phrase traduite
  u.lang = voiceLang();
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.onstart = () => speechHooks.start?.();
  u.onend = u.onerror = () => { if (!speechSynthesis.speaking) speechHooks.end?.(); };
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => window.speechSynthesis?.cancel();

/* ---------- Sons ---------- */
let audio;
const ctx = () => (audio ||= new (window.AudioContext || window.webkitAudioContext)());

export function beep(freq = 880, dur = 0.12, type = "sine", gain = 0.12) {
  if (!state.profile.sound) return;
  try {
    const a = ctx(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch { /* pas d'audio */ }
}

// « Whoosh » discret : bruit filtré très court (élan du coach, validation).
export function whoosh(vol = 0.35) {
  if (!state.profile.sound) return;
  try {
    const a = ctx();
    const len = a.sampleRate * 0.16;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass";
    f.frequency.setValueAtTime(3400, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(900, a.currentTime + 0.16);
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  } catch { /* pas d'audio */ }
}

export function success() {
  beep(660, 0.09, "sine", 0.08);
  setTimeout(() => beep(990, 0.14, "sine", 0.08), 90);
}

export const vibrate = p => navigator.vibrate?.(p);

/* ---------- Petits anneaux qui éclosent (validation, record) ---------- */
export function ringPop(x, y, color = "#ff3b4e") {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "-50 -50 100 100");
  el.classList.add("ringpop");
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.color = color;
  const dots = Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4 + 0.39; return `<circle cx="${(40 * Math.cos(a)).toFixed(1)}" cy="${(40 * Math.sin(a)).toFixed(1)}" r="2.6"/>`; }).join("");
  el.innerHTML = `<g fill="none" stroke="currentColor"><circle r="15" stroke-width="2.2"/><circle r="28" stroke-width="1.4"/></g><g fill="currentColor">${dots}</g>`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
  setTimeout(() => el.remove(), 1500); // filet de sécurité si l'animation est interrompue
}

// Anneaux fins utilisés comme ornement (coins de cartes, fond, accueil).
export function ringsSvg(cls = "", rings = [12, 24, 36, 48]) {
  const dots = rings.map((r, i) => { const a = ((-38 + i * 61) * Math.PI) / 180; return `<circle cx="${(r * Math.cos(a)).toFixed(1)}" cy="${(r * Math.sin(a)).toFixed(1)}" r="1.5" fill="currentColor" stroke="none"/>`; }).join("");
  return `<svg class="${cls}" viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width=".55" aria-hidden="true">${rings.map(r => `<circle r="${r}"/>`).join("")}${dots}</svg>`;
}
