// Le mannequin qui danse : plein écran par-dessus l'app, la pochette floutée derrière, le corps musclé 3D (celui des
// démos) qui danse au tempo du morceau (dance.js) et pulse sur chaque temps, ses muscles teintés aux couleurs de la
// pochette. S'ouvre tout seul sur l'accueil quand tu ne touches plus l'écran depuis 20 s pendant que la musique joue
// (avant le verrouillage automatique de l'iPhone ; réglage « Le mannequin danse »), ou depuis la carte « En écoute » ;
// toucher l'écran (ou Échap) le referme. L'écran reste allumé pendant la danse, 10 minutes au plus. Tempo : tapé en
// rythme (gardé par morceau sur l'appareil), sinon celui du morceau (fonction « music »), sinon 100 BPM.
import { state } from "./store.js";
import * as CFG from "./config.js";
import { nowPlaying, onMusic, trackKey, musicFunction } from "./music.js";
import { danceQ, tapTempo, DEFAULT_BPM } from "./dance.js";
import { musicTint } from "./actions.js";
import { esc, I, toast } from "./ui.js";

const BPM_KEY = "greatness.bpm", IDLE_MS = 20000, WAKE_MS = 10 * 60000;
const MUSCLES = new Set(["pecs", "delts", "traps", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lowerback", "glutes", "quads", "hams", "adductors", "abductors", "calves", "hipflex"]);
// le corps : un pas de danse « de face » dont la pose vient de dance.js (demo3d.js lift → move.pose)
let bpm = DEFAULT_BPM, anchor = { t: 0, beat: 0 };
const beatAt = now => anchor.beat + ((now - anchor.t) * bpm) / 60000;
const DANCER = { view: "front", loop: true, fists: true, mus: { p: [], s: [] }, keys: [{ p: 0 }], pose: p => danceQ(p, bpm).q };

const tempos = () => { try { return JSON.parse(localStorage.getItem(BPM_KEY) || "{}"); } catch { return {}; } };
function keepTempo(key, value, how) {
  try { const all = tempos(); delete all[key]; all[key] = { bpm: value, how }; const ks = Object.keys(all); for (const k of ks.slice(0, Math.max(0, ks.length - 300))) delete all[k]; localStorage.setItem(BPM_KEY, JSON.stringify(all)); } catch { /* plein */ }
}
// tempo du morceau : tapé avant, sinon demandé à la fonction « music » (catalogue Deezer), sinon rien
async function tempoOf(t) {
  const k = trackKey(t), known = tempos()[k];
  if (known?.bpm) return known;
  const fn = musicFunction();
  if (!fn) return null;
  try {
    const q = new URLSearchParams({ bpm: "1", artist: t.artist || "", title: t.title || "", ...(t.isrc ? { isrc: t.isrc } : {}) });
    const r = await fetch(`${fn}?${q}`, { headers: { apikey: CFG.SUPABASE_ANON_KEY || "" } });
    const j = await r.json();
    if (j?.bpm > 0) { keepTempo(k, j.bpm, "auto"); return { bpm: j.bpm, how: "auto" }; }
  } catch { /* hors ligne */ }
  return null;
}

let root = null;
export const dancing = () => !!root;
export async function openDance({ auto = false } = {}) {
  if (root) return;
  let t = nowPlaying();
  const el = document.createElement("div");
  el.className = `dance ${auto ? "auto" : ""}`;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Le mannequin danse");
  el.innerHTML = `<div class="dc-bg" aria-hidden="true"><i></i></div><canvas class="dc-cv" aria-hidden="true"></canvas>
    <div class="dc-load"><i class="spinner"></i><span>Le mannequin s'échauffe…</span></div>
    <div class="dc-top"><span class="chip dc-bpm" id="dc-bpm"></span><button class="icon-btn" id="dc-x" aria-label="Fermer">${I.x}</button></div>
    <div class="dc-foot"><div class="dc-song" id="dc-song"></div>
      <button class="btn btn-soft dc-tap" id="dc-tap">Tape en rythme</button>
      <p class="xs dc-hint">${auto ? "Touche l'écran pour revenir" : "Glisse pour tourner autour du mannequin"}</p></div>`;
  document.body.appendChild(el);
  document.body.classList.add("dancing");
  root = el;
  let view = null, raf = 0, last = 0, taps = [], dead = false, off = null, wake = null;
  const cv = el.querySelector(".dc-cv"), song = el.querySelector("#dc-song"), chip = el.querySelector("#dc-bpm"), bg = el.querySelector(".dc-bg i");
  const showTempo = how => { chip.textContent = `${bpm} BPM${how === "tap" ? " · tapé" : how === "auto" ? "" : " · par défaut"}`; };
  const setSong = async tr => {
    t = tr;
    song.innerHTML = tr ? `${tr.art ? `<img src="${esc(tr.art)}" alt="" referrerpolicy="no-referrer"/>` : ""}<div><b translate="no">${esc(tr.title)}</b><span translate="no">${esc(tr.artist)}</span></div>` : "";
    bg.style.backgroundImage = tr?.art ? `url("${tr.art.replace(/["\\\n]/g, "")}")` : "none";
    const now = performance.now(), b = beatAt(now);
    bpm = DEFAULT_BPM; anchor = { t: now, beat: b }; showTempo("default");
    if (!tr) return;
    const known = await tempoOf(tr);
    if (known && root === el && trackKey(t) === trackKey(tr)) { const n = performance.now(); anchor = { t: n, beat: beatAt(n) }; bpm = known.bpm; showTempo(known.how); }
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  // l'écran reste allumé pendant la danse (10 minutes au plus, pour la batterie ; l'iPhone se verrouille ensuite comme
  // d'habitude) ; repris au retour dans l'app
  const until = Date.now() + WAKE_MS;
  const awake = () => {
    if (dead || wake || document.hidden || Date.now() > until) return;
    navigator.wakeLock?.request("screen").then(l => { if (dead) return l.release(); wake = l; l.onrelease = () => { wake = null; }; }).catch(() => {});
  };
  const onVis = () => awake();
  const sleepy = setTimeout(() => wake?.release(), WAKE_MS);
  const close = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf); off?.(); view?.destroy();
    clearTimeout(sleepy); wake?.release(); document.removeEventListener("visibilitychange", onVis);
    removeEventListener("keydown", onKey);
    el.classList.add("closing");
    document.body.classList.remove("dancing");
    setTimeout(() => el.remove(), 260);
    root = null;
    lastActive = Date.now();
  };
  addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);
  awake();
  el.querySelector("#dc-x").onclick = e => { e.stopPropagation(); close(); };
  el.querySelector("#dc-tap").onclick = e => {
    e.stopPropagation();
    const now = performance.now();
    taps = taps.filter(x => now - x < 4000).concat(now);
    const r = tapTempo(taps);
    if (!r) { chip.textContent = `${taps.length}…`; return; }
    const b = beatAt(r.at); // le temps en cours (ancien tempo), arrondi : le dernier coup tombe sur un temps
    bpm = r.bpm; anchor = { t: r.at, beat: Math.round(b) };
    showTempo("tap");
    if (t) keepTempo(trackKey(t), bpm, "tap");
  };
  // en veille : n'importe quel toucher (hors boutons) referme, comme la fin de la musique
  if (auto) el.addEventListener("pointerdown", e => { if (!e.target.closest("button")) close(); });
  off = onMusic(tr => {
    if (auto && !tr?.playing) return close();
    if (trackKey(tr) !== trackKey(t)) setSong(tr);
  });
  setSong(t);
  el.querySelector("#dc-x").focus({ preventScroll: true });
  try {
    const [b3, d3] = await Promise.all([import("./body3d.js"), import("./demo3d.js")]);
    const body = await b3.loadBody();
    if (dead) return;
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    // muscles de l'écorché, teintés vers l'accent de la pochette
    const acc = b3.hexToLinear(musicTint()?.accent || css("--red") || "#e8283b");
    const colors = b3.colorTable(body.parts).map((c, i) => (MUSCLES.has(body.parts[i]) ? c.map((v, k) => v * 0.55 + acc[k] * 0.45) : c));
    const camera = { yaw: 0.32, pitch: 0.14, target: [0, 1.02, 0], dist: 4.4 };
    const fit = () => { const a = cv.clientWidth / Math.max(1, cv.clientHeight); camera.dist = Math.max(4.1, 0.95 / (0.32 * a)) * 1.04; };
    fit();
    view = d3.mountDemo3D(cv, body, DANCER, colors, { glow: [...MUSCLES], floor: b3.hexToLinear(css("--card-3") || "#1a1b22"), camera });
    el.querySelector(".dc-load").remove();
    el.classList.add("ready");
    addEventListener("resize", fit);
    const frame = now => {
      if (dead) return removeEventListener("resize", fit);
      raf = requestAnimationFrame(frame);
      if (now - last < 32 || document.hidden) return; // 30 images par seconde suffisent
      last = now;
      const beat = window.__danceBeat ?? beatAt(now); // (tests : un temps imposé)
      view.draw(beat, danceQ(beat, bpm).act);
    };
    raf = requestAnimationFrame(frame);
  } catch (err) {
    console.warn("Danse 3D :", err);
    if (!dead) { toast("Le mannequin 3D ne peut pas danser sur cet appareil", 3000); close(); }
  }
}

/* ---------- Veille : la danse démarre toute seule quand on ne fait rien ---------- */
let lastActive = Date.now(), armed = false;
export function armDance(blocked = () => false) {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const touch = () => { lastActive = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) addEventListener(ev, touch, { passive: true, capture: true });
  setInterval(() => {
    if (root || document.hidden) return;
    const t = nowPlaying(), m = state.profile?.music || {};
    if (!t?.playing || t.src === "manual" || m.dance === false || blocked()) return;
    // pas par-dessus une feuille ouverte ni un texte en cours de saisie ; jamais si les animations sont réduites
    if (document.querySelector(".sheet-wrap") || document.activeElement?.matches?.("input, textarea, select")) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (Date.now() - lastActive >= (window.__danceIdleMs ?? IDLE_MS)) openDance({ auto: true }); // (tests : attente raccourcie)
  }, 2000);
}
