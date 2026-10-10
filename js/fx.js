// Effets : voix, sons, vibrations, toile animée en fond, onomatopées comics.
import { state } from "./store.js";

/* ---------- Voix ---------- */
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => /fr/i.test(v.lang) && /google|amélie|audrey|thomas|female/i.test(v.name))
       || voices.find(v => /^fr/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, { interrupt = false } = {}) {
  if (!state.profile.voice || !("speechSynthesis" in window) || !text) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}

/* ---------- Sons ---------- */
let audio;
export function beep(freq = 880, dur = 0.12, type = "sine", gain = 0.15) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch { /* pas d'audio */ }
}

// "Thwip" synthétique : bruit filtré très court.
export function thwipSound() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const len = audio.sampleRate * 0.18;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audio.createBufferSource(); src.buffer = buf;
    const f = audio.createBiquadFilter(); f.type = "bandpass";
    f.frequency.setValueAtTime(3200, audio.currentTime);
    f.frequency.exponentialRampToValueAtTime(900, audio.currentTime + 0.18);
    const g = audio.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(audio.destination);
    src.start();
  } catch { /* pas d'audio */ }
}

export const vibrate = p => navigator.vibrate?.(p);

/* ---------- Onomatopée comics ---------- */
export function burst(text = "THWIP!", x = innerWidth / 2, y = innerHeight / 2, color = "red") {
  const el = document.createElement("div");
  el.className = `burst burst-${color}`;
  el.innerHTML = `<span>${text}</span>`;
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.setProperty("--rot", (Math.random() * 20 - 10).toFixed(1) + "deg");
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
  webShot(x, y);
}

// Trait de toile qui part d'un coin vers un point.
export function webShot(x, y) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("webshot");
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  const sx = x < innerWidth / 2 ? innerWidth + 20 : -20, sy = -20;
  const mx = (sx + x) / 2 + (Math.random() * 60 - 30), my = (sy + y) / 2 + 40;
  svg.innerHTML = `<path d="M${sx},${sy} Q${mx},${my} ${x},${y}" />`;
  document.body.appendChild(svg);
  setTimeout(() => svg.remove(), 700);
}

/* ---------- Fond : toile + particules ---------- */
export function startBackground(canvas) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, dpr, t = 0;
  const motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, v: Math.random() * 0.00025 + 0.00005, hue: Math.random() < 0.5 ? 355 : 220 }));

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
  }
  addEventListener("resize", resize);
  resize();

  function web(cx, cy, radius, spokes, rings, rot, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(200,210,255,${alpha})`;
    ctx.lineWidth = 1 * dpr;
    const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2);
    ctx.beginPath();
    angles.forEach(a => { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); });
    ctx.stroke();
    for (let r = 1; r <= rings; r++) {
      const rr = (r / rings) * radius;
      ctx.beginPath();
      const step = (Math.PI * 2) / spokes;
      angles.forEach((a, i) => {
        const b = a + step, m = a + step / 2, sag = 0.84;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.quadraticCurveTo(Math.cos(m) * rr * sag, Math.sin(m) * rr * sag, Math.cos(b) * rr, Math.sin(b) * rr);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame() {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    const sway = Math.sin(t / 240) * 0.03;
    web(w + 30 * dpr, -30 * dpr, Math.max(w, h) * 0.55, 14, 9, sway, 0.07);
    web(-60 * dpr, h + 40 * dpr, Math.max(w, h) * 0.38, 12, 7, -sway, 0.045);
    motes.forEach(m => {
      m.y -= m.v * (reduce ? 0 : 1);
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      const x = m.x * w + Math.sin((t + m.x * 1000) / 120) * 8 * dpr, y = m.y * h;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${m.hue}, 90%, 60%, ${0.25 + 0.25 * Math.sin(t / 50 + m.x * 10)})`;
      ctx.arc(x, y, m.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
}
