// Effets : voix, sons, vibrations et petits détails visuels.
import { state } from "./store.js";

/* ---------- Voix ---------- */
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => /^fr/i.test(v.lang) && /google|thomas|nicolas|paul|male/i.test(v.name))
       || voices.find(v => /^fr/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

// Le mode mains libres coupe l'écoute pendant que le coach parle.
export const speechHooks = { start: null, end: null };

export function speak(text, { interrupt = false } = {}) {
  if (!state.profile.voice || !("speechSynthesis" in window) || !text) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
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

// "Thwip" discret : bruit filtré très court.
export function thwip(vol = 0.35) {
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

/* ---------- Petite toile qui éclot (validation, record) ---------- */
export function webPop(x, y, color = "#ff3b4e") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "-50 -50 100 100");
  el.classList.add("webpop");
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.color = color;
  const spokes = Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<line x1="0" y1="0" x2="${48 * Math.cos(a)}" y2="${48 * Math.sin(a)}"/>`; }).join("");
  const rings = [16, 30, 44].map(r => `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `${r * Math.cos(a)},${r * Math.sin(a)}`; }).join(" ")}"/>`).join("");
  el.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="1.4">${spokes}${rings}</g>`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// Toile fine utilisée comme ornement (coins de cartes, chargement…).
export function webSvg(cls = "", n = 12, rings = [12, 24, 36, 48]) {
  const spokes = Array.from({ length: n }, (_, i) => { const a = (i * 2 * Math.PI) / n; return `<line x1="0" y1="0" x2="${50 * Math.cos(a)}" y2="${50 * Math.sin(a)}"/>`; }).join("");
  const polys = rings.map(r => `<path d="${Array.from({ length: n + 1 }, (_, i) => {
    const a = (i * 2 * Math.PI) / n, b = ((i - 0.5) * 2 * Math.PI) / n;
    return i === 0 ? `M${r * Math.cos(a)},${r * Math.sin(a)}` : `Q${r * 0.86 * Math.cos(b)},${r * 0.86 * Math.sin(b)} ${r * Math.cos(a)},${r * Math.sin(a)}`;
  }).join(" ")}"/>`).join("");
  return `<svg class="${cls}" viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width=".5" aria-hidden="true">${spokes}${polys}</svg>`;
}
