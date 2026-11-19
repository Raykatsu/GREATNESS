// L'app prend les couleurs de ta musique : à chaque morceau (music.js), la pochette donne l'accent (boutons, liens,
// anneaux), les dégradés et les lueurs du fond (palette.js), et s'affiche floutée en décor derrière l'écran. Fondu doux
// d'un morceau à l'autre. Une pochette qui ne se laisse pas lire directement passe par le relais de la fonction
// « music ». Quand la musique s'arrête, l'app garde l'allure du dernier morceau, y compris à la prochaine ouverture
// (pour ce compte seulement ; rien à l'écran de connexion). Réglages : Moi → Réglages → Musique (« Couleurs de la
// pochette », « Décor », « Garder les couleurs »).
import { state, currentUser } from "./store.js";
import { setMusicTint } from "./actions.js";
import { onMusic, nowPlaying, musicFunction, musicSource } from "./music.js";
import { paletteOf } from "./palette.js";

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
// Le thème d'une pochette : directement, sinon par le relais de la fonction « music »
export async function coverTheme(url) {
  if (!url) return null;
  const hit = cached(url);
  if (hit) return hit;
  let px = await pixels(url);
  const relay = musicFunction();
  if (!px && relay && url.startsWith("https:")) px = await pixels(`${relay}?cover=${encodeURIComponent(url)}`);
  const th = px ? paletteOf(px) : null;
  if (th) remember(url, th);
  return th;
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
  if (!currentUser) { look = null; backdrop(""); return tinted(null); }
  // un morceau : son allure devient la dernière connue ; plus de morceau, mais une source réglée : on garde celle du
  // dernier (sauf si l'on a choisi de ne pas la garder)
  if (t && t.art !== look?.art) keepLook(t.art ? { art: t.art, th: null } : null);
  const keep = !t && o.keep !== false && !!musicSource() && !!look;
  if (!t && !keep) keepLook(null);
  const art = t ? t.art : keep ? look.art : "";
  backdrop(o.deco !== false ? art : "");
  if (o.theme === false || !art) return tinted(null);
  const th = t ? await coverTheme(art) : look.th;
  if (me !== seq) return; // un autre morceau a pu arriver entre-temps
  if (t && th) keepLook({ art, th });
  tinted(th);
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
export function resetMusicTheme() { seq++; look = null; backdrop(""); tinted(null); }
// après un changement de réglage (couleurs, décor)
export const refreshMusicTheme = () => apply(nowPlaying());
