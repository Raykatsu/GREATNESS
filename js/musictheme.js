// L'app prend les couleurs de ta musique : à chaque morceau (music.js), la pochette donne l'accent (boutons, liens,
// anneaux), les dégradés et les lueurs du fond (palette.js), et s'affiche floutée en décor derrière l'écran. Fondu doux
// d'un morceau à l'autre. Une pochette qui ne se laisse pas lire directement passe par le relais de la fonction
// « music ». Au-delà des couleurs, l'ambiance du morceau (vibe.js : intense, festive, chill, mélancolique, épique,
// d'après son genre, son tempo et sa pochette) change tout le thème : formes, titres, mouvements, décor, et un battement
// au tempo pendant qu'il joue. Quand la musique s'arrête, l'app garde l'allure du dernier morceau, y compris à la
// prochaine ouverture (pour ce compte seulement ; rien à l'écran de connexion). Réglages : Moi → Réglages → Musique
// (« Couleurs de la pochette », « Ambiance du morceau », « Décor », « Garder les couleurs »).
import { state, currentUser } from "./store.js";
import { setMusicTint } from "./actions.js";
import { onMusic, nowPlaying, musicFunction, musicSource } from "./music.js";
import { paletteOf } from "./palette.js";
import { vibeOf, beatSeconds } from "./vibe.js";
import { genreOf, tempoOf } from "./trackinfo.js";

const CACHE_KEY = "greatness.palettes", KEEP = 40, LOOK_KEY = "greatness.musiclook";
const mem = new Map();
const opts = () => state.profile.music || {};

// Thèmes déjà calculés (les 40 dernières pochettes, gardées sur l'appareil)
function cached(url) {
  if (mem.has(url)) return mem.get(url);
  try { const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); if (all[url]) { mem.set(url, all[url]); return all[url]; } } catch { /* rien */ }
  return null;
}
function remember(url, th) {
  mem.set(url, th);
  if (url.startsWith("data:")) return; // pochette envoyée par l'iPhone : trop lourde pour être gardée
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    delete all[url]; all[url] = th;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* plein */ }
}

// Pixels d'une image réduite à 48 × 48 ; null si elle ne se laisse pas lire (un autre site sans autorisation)
function pixels(src) {
  return new Promise(res => {
    const img = new Image();
    let over = false;
    const done = v => { if (over) return; over = true; img.onload = img.onerror = null; res(v); };
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 48;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0, 48, 48);
        done(x.getImageData(0, 0, 48, 48).data);
      } catch { done(null); }
    };
    img.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    img.src = src;
  });
}
// Le thème d'une pochette : directement, sinon par le relais de la fonction « music » (une seule lecture à la fois)
const reading = new Map();
export function coverTheme(url) {
  if (!url) return Promise.resolve(null);
  const hit = cached(url);
  if (hit?.tone) return Promise.resolve(hit); // (un thème gardé avant le ton de la pochette est relu une fois)
  if (!reading.has(url)) reading.set(url, (async () => {
    let px = await pixels(url);
    const relay = musicFunction();
    if (!px && relay && url.startsWith("https:")) px = await pixels(`${relay}?cover=${encodeURIComponent(url)}`);
    const th = px ? paletteOf(px) : hit;
    if (th) remember(url, th);
    return th;
  })().finally(() => reading.delete(url)));
  return reading.get(url);
}

/* ---------- Décor : la pochette floutée derrière l'écran, en fondu ---------- */
let layer = null, flip = 0, shown = "";
function backdrop(art) {
  if (art === shown) return;
  const host = document.querySelector(".ambient");
  if (!host) return;
  if (!layer) { layer = document.createElement("div"); layer.className = "m-cover"; layer.innerHTML = "<i></i><i></i>"; host.prepend(layer); }
  shown = art;
  const [a, b] = layer.children, next = flip ? a : b, prev = flip ? b : a;
  flip ^= 1;
  prev.classList.remove("on");
  if (art) { next.style.backgroundImage = `url("${art.replace(/["\\\n]/g, "")}")`; next.classList.add("on"); }
}

// L'allure du dernier morceau (pochette et couleurs), gardée sur l'appareil pour le compte ouvert (une pochette en
// data: URL, celle d'Apple Music, est trop lourde : gardée seulement en mémoire)
let look = null;
const readLook = () => { try { const l = JSON.parse(localStorage.getItem(LOOK_KEY) || "null"); return l?.u === currentUser ? l : null; } catch { return null; } };
function keepLook(l) {
  look = l;
  try { if (!l || l.art.startsWith("data:")) localStorage.removeItem(LOOK_KEY); else localStorage.setItem(LOOK_KEY, JSON.stringify({ ...l, u: currentUser })); } catch { /* plein */ }
}
let seq = 0;
async function apply(t) {
  const me = ++seq, o = opts();
  // écran de connexion (compte fermé ou verrouillé) : ni couleurs ni pochette à l'écran, mais rien d'effacé
  if (!currentUser) { look = null; backdrop(""); vibed(null); return tinted(null); }
  // un morceau : son allure devient la dernière connue ; plus de morceau, mais une source réglée : on garde celle du
  // dernier (sauf si l'on a choisi de ne pas la garder)
  if (t && t.art !== look?.art) keepLook(t.art ? { art: t.art, th: null } : null);
  const keep = !t && o.keep !== false && !!musicSource() && !!look;
  if (!t && !keep) keepLook(null);
  const art = t ? t.art : keep ? look.art : "";
  backdrop(o.deco !== false ? art : "");
  mood(t, keep, me); // l'ambiance, en même temps que les couleurs
  if (o.theme === false || !art) return tinted(null);
  const th = t ? await coverTheme(art) : look.th;
  if (me !== seq) return; // un autre morceau a pu arriver entre-temps
  if (t && th && look?.art === art) keepLook({ ...look, th });
  tinted(th);
}

/* ---------- L'ambiance (vibe.js) : formes, titres, mouvements, décor et battement au tempo ---------- */
let vibeNow = null;
// l'ambiance du morceau en cours (ou gardé) : { vibe, bpm, genre }, ou null
export const musicVibe = () => vibeNow;
function vibed(v) {
  const root = document.documentElement, on = !!v?.vibe && opts().vibe !== false;
  if (on) { root.dataset.vibe = v.vibe; root.style.setProperty("--beat", `${beatSeconds(v.bpm)}s`); }
  else { delete root.dataset.vibe; root.style.removeProperty("--beat"); }
  root.classList.toggle("music-playing", on && !!nowPlaying()?.playing);
  dispatchEvent(new Event("music-vibe"));
}
async function mood(t, keep, me) {
  if (!t) { vibeNow = keep ? look?.vibe || null : null; return vibed(vibeNow); }
  if (vibeNow?.art === t.art) vibed(vibeNow); // même morceau (lecture ↔ pause) : tout de suite
  const [genre, tempo, th] = await Promise.all([genreOf(t), tempoOf(t), t.art ? coverTheme(t.art).catch(() => null) : null]);
  if (me !== seq) return;
  const bpm = tempo?.bpm || 0, vibe = vibeOf({ genre, bpm, tone: th?.tone });
  vibeNow = vibe ? { vibe, bpm, genre, art: t.art } : null;
  if (look?.art === t.art) keepLook({ ...look, vibe: vibeNow });
  vibed(vibeNow);
}
// couleurs appliquées : prévient les écrans qui les montrent (aperçu des réglages Musique)
function tinted(th) { setMusicTint(th); dispatchEvent(new Event("music-tint")); }
let ready = false;
export function initMusicTheme() {
  if (!ready) { ready = true; onMusic(apply); }
  // à l'ouverture : l'allure du dernier morceau tout de suite, sans attendre la source (pas de retour au rouge)
  if (!nowPlaying() && musicSource() && opts().keep !== false) {
    const l = readLook();
    if (l?.art) { look = l; apply(null); }
  }
}
// Écran de connexion (déconnexion, verrou) : plus de couleurs ni de décor ; l'allure gardée attend le retour du compte
export function resetMusicTheme() { seq++; look = null; vibeNow = null; backdrop(""); vibed(null); tinted(null); }
// après un changement de réglage (couleurs, décor)
export const refreshMusicTheme = () => apply(nowPlaying());
