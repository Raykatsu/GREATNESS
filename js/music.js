// Musique : le morceau que tu écoutes, d'où qu'il vienne, pour que l'app vive avec (thème, décor, séance). Sources :
// - Last.fm, le pont universel : Spotify, Deezer, YouTube Music, Tidal… y envoient ce que tu écoutes (« scrobbling ») ;
//   il suffit de ton pseudo Last.fm. Lu par la fonction Supabase « music » (la clé Last.fm reste secrète) ;
// - stats.fm, l'app de statistiques de Spotify et d'Apple Music : le morceau en cours de ton profil (s'il laisse voir
//   l'écoute en cours), lu par la même fonction, sans clé ;
// - Spotify en direct (connexion PKCE, sans serveur) : en temps réel, avec lecture, pause, suivant (Premium). En « mode
//   développement », Spotify n'autorise que 5 comptes par app : voir SUPABASE.md, « Musique » ;
// - Apple Music (app iPhone) : le morceau en cours dans l'app Musique, lu par le natif (GreatnessPlugin.swift) ;
// - Choix manuel : un morceau cherché dans le catalogue iTunes, pour l'ambiance, sans compte.
// Le morceau en cours est diffusé (onMusic) ; musictheme.js en tire les couleurs de l'app. Les jetons Spotify restent sur
// l'appareil (localStorage), jamais dans les données synchronisées. Les fonctions pures sont testées dans Node.
import * as CFG from "./config.js";
import { state, save } from "./store.js";

export const SOURCES = ["lastfm", "statsfm", "spotify", "apple", "manual"];
export const SOURCE_NAME = { lastfm: "Last.fm", statsfm: "stats.fm", spotify: "Spotify", apple: "Apple Music", manual: "Choix manuel" };
const EVERY = { lastfm: 15000, statsfm: 15000, spotify: 5000, apple: 5000, manual: 0 }; // rythme de lecture du morceau en cours
const GRACE = 90000; // entre deux morceaux, la source ne dit parfois plus rien : on garde le dernier 1 min 30
const SP_KEY = "greatness.spotify", SP_PKCE = "greatness.spotify.pkce";
export const SPOTIFY_SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
export const NATIVE_REDIRECT = "greatness://spotify";
const NATIVE_SCHEME = "greatness";

const cfg = () => state.profile.music || {};
export const musicSource = () => (SOURCES.includes(cfg().src) ? cfg().src : "");
export const spotifyConfigured = () => !!CFG.SPOTIFY_CLIENT_ID;
const supabase = () => (CFG.SUPABASE_URL ? CFG.SUPABASE_URL.replace(/\/$/, "") : "");
export const musicFunction = () => (supabase() ? `${supabase()}/functions/v1/music` : "");
const capacitor = () => (typeof window !== "undefined" ? window.Capacitor : null);
const isNative = () => !!capacitor()?.isNativePlatform?.();
const native = () => { const c = capacitor(); return isNative() ? c?.Plugins?.Greatness || c?.registerPlugin?.("Greatness") || null : null; };
export const appleAvailable = () => !!native();

/* ---------- Morceaux ---------- */
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
// même morceau ? (le titre et l'artiste, sans accents ni majuscules)
export const trackKey = t => (t ? `${norm(t.artist)}|${norm(t.title)}` : "");
const clip = (s, n = 120) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const cleanTrack = (t, src) => (t && t.title ? {
  title: clip(t.title), artist: clip(t.artist), album: clip(t.album), art: typeof t.art === "string" && /^(https:|data:image\/)/.test(t.art) ? t.art : "",
  playing: t.playing !== false, src, ...(t.url && /^https:\/\//.test(t.url) ? { url: t.url } : {}), ...(t.isrc ? { isrc: clip(t.isrc, 16) } : {}),
  ...(t.duration > 0 ? { duration: Math.round(t.duration) } : {}), ...(t.progress >= 0 && t.duration > 0 ? { progress: Math.round(t.progress) } : {}),
} : null);

// Réponse de Spotify (GET /me/player/currently-playing) → morceau ; null : rien en cours (ou une publicité)
export function parseSpotify(j) {
  const it = j?.item;
  if (!it || (j.currently_playing_type && !["track", "episode"].includes(j.currently_playing_type))) return null;
  const imgs = (it.album?.images || it.images || it.show?.images || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0));
  const art = (imgs.find(i => (i.width || 0) <= 640) || imgs[0])?.url || "";
  return cleanTrack({
    title: it.name, artist: (it.artists || []).map(a => a.name).join(", ") || it.show?.name || "", album: it.album?.name || it.show?.name || "",
    art, playing: !!j.is_playing, url: it.external_urls?.spotify, isrc: it.external_ids?.isrc, duration: it.duration_ms, progress: j.progress_ms,
  }, "spotify");
}

// Catalogue iTunes (recherche, sans compte) : pochettes en grand (600 px au lieu de 100)
export const bigArt = (u, px = 600) => String(u || "").replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, `/${px}x${px}bb.$2`);
export function parseItunes(j) {
  return (j?.results || []).filter(r => r.trackName || r.collectionName).map(r => cleanTrack({
    title: r.trackName || r.collectionName, artist: r.artistName, album: r.collectionName, art: bigArt(r.artworkUrl100), url: r.trackViewUrl || r.collectionViewUrl, playing: false,
  }, "manual")).filter(Boolean);
}
const country = () => { const m = String(globalThis.navigator?.language || "fr-FR").match(/-([A-Za-z]{2})$/); return (m ? m[1] : "FR").toLowerCase(); };
export async function searchMusic(q) {
  const term = clip(q, 80);
  if (term.length < 2) return [];
  const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=12&country=${country()}`);
  if (!r.ok) throw new Error(`iTunes : HTTP ${r.status}`);
  return parseItunes(await r.json());
}
// Pochette d'un morceau d'Apple Music connu par son identifiant de catalogue
async function itunesArt(id) {
  if (!id) return "";
  try { const r = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`); return bigArt((await r.json())?.results?.[0]?.artworkUrl100); } catch { return ""; }
}

/* ---------- Spotify : connexion PKCE (sans secret ni serveur) ---------- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const pkceVerifier = (bytes = crypto.getRandomValues(new Uint8Array(48))) => b64url(bytes);
export const pkceChallenge = async v => b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
export const webRedirect = (href = location.href) => new URL(".", href.split(/[?#]/)[0]).href;
export const spotifyRedirect = () => (isNative() ? NATIVE_REDIRECT : webRedirect());
export function spotifyAuthUrl({ clientId, redirect, challenge, stateId }) {
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, scope: SPOTIFY_SCOPES, code_challenge_method: "S256", code_challenge: challenge, redirect_uri: redirect, state: stateId });
  return `https://accounts.spotify.com/authorize?${q}`;
}
const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privé */ } },
};
export const spotifyLinked = () => !!ls.get(SP_KEY)?.refresh;

// Ouvre la page de connexion Spotify ; dans l'app iPhone, une fenêtre sécurisée qui revient d'elle-même
export async function spotifyLogin() {
  if (!spotifyConfigured()) throw new Error("SPOTIFY_NOT_CONFIGURED");
  const verifier = pkceVerifier(), stateId = pkceVerifier(new Uint8Array(crypto.getRandomValues(new Uint8Array(12)))), redirect = spotifyRedirect();
  ls.set(SP_PKCE, { verifier, stateId, redirect, at: Date.now() });
  const url = spotifyAuthUrl({ clientId: CFG.SPOTIFY_CLIENT_ID, redirect, challenge: await pkceChallenge(verifier), stateId });
  const N = native();
  if (N?.webAuth) {
    const r = await N.webAuth({ url, scheme: NATIVE_SCHEME });
    if (!r?.url) throw new Error("CANCELLED");
    return spotifyFinish(r.url);
  }
  location.assign(url); // revient sur l'app avec ?code=… (spotifyResume au démarrage)
  return false;
}
// Retour de Spotify : échange du code contre les jetons (une seule fois, l'état doit correspondre)
export async function spotifyFinish(href) {
  const u = new URL(href), code = u.searchParams.get("code"), got = u.searchParams.get("state"), err = u.searchParams.get("error");
  const p = ls.get(SP_PKCE);
  ls.set(SP_PKCE, null);
  if (err) throw new Error(err === "access_denied" ? "DENIED" : err);
  if (!code || !p || got !== p.stateId || Date.now() - p.at > 15 * 60000) throw new Error("BAD_STATE");
  const tok = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: p.redirect, code_verifier: p.verifier });
  state.profile.music = { ...cfg(), src: "spotify" };
  save();
  return tok;
}
// Au démarrage de l'app web : la page revient de Spotify (?code=…&state=…) → connexion, puis adresse nettoyée
export async function spotifyResume(href = location.href) {
  const u = new URL(href);
  if (!u.searchParams.get("state") || !ls.get(SP_PKCE) || !(u.searchParams.get("code") || u.searchParams.get("error"))) return null;
  history.replaceState(null, "", `${u.pathname}${u.hash}`);
  try { await spotifyFinish(href); return "ok"; } catch (e) { return e.message || "ERROR"; }
}
async function tokenCall(params) {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CFG.SPOTIFY_CLIENT_ID, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === "invalid_grant") ls.set(SP_KEY, null); // connexion retirée côté Spotify : il faut se reconnecter
    throw new Error(j.error || `HTTP ${r.status}`);
  }
  const old = ls.get(SP_KEY) || {};
  const tok = { access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  ls.set(SP_KEY, tok);
  return tok;
}
async function spotifyToken(force = false) {
  const t = ls.get(SP_KEY);
  if (!t?.refresh) throw new Error("NOT_LINKED");
  if (!force && t.access && t.exp > Date.now() + 60000) return t.access;
  return (await tokenCall({ grant_type: "refresh_token", refresh_token: t.refresh })).access;
}
export function spotifyLogout() { ls.set(SP_KEY, null); if (cfg().src === "spotify") { state.profile.music = { ...cfg(), src: "" }; save(); } }
async function spotifyApi(path, init = {}, retry = true) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${await spotifyToken()}`, ...(init.headers || {}) } });
  if (r.status === 401 && retry) { await spotifyToken(true); return spotifyApi(path, init, false); }
  return r;
}
async function spotifyNow() {
  const r = await spotifyApi("/me/player/currently-playing?additional_types=episode");
  if (r.status === 204) return null;
  if (r.status === 429) throw new Error("RATE_LIMIT");
  if (!r.ok) throw new Error(`Spotify : HTTP ${r.status}`);
  return parseSpotify(await r.json());
}
// Lecture, pause, suivant, précédent (Spotify Premium, avec un appareil actif) → "ok" | "PREMIUM" | "NO_DEVICE" | "ERROR"
export async function spotifyControl(cmd) {
  const [method, path] = { play: ["PUT", "/me/player/play"], pause: ["PUT", "/me/player/pause"], next: ["POST", "/me/player/next"], previous: ["POST", "/me/player/previous"] }[cmd] || [];
  if (!path) return "ERROR";
  try {
    const r = await spotifyApi(path, { method });
    if (r.ok || r.status === 204) { setTimeout(poll, 600); return "ok"; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 403 || /PREMIUM/.test(j?.error?.reason || "")) return "PREMIUM";
    if (r.status === 404) return "NO_DEVICE";
    return "ERROR";
  } catch { return "ERROR"; }
}

/* ---------- Last.fm (fonction Supabase « music ») ---------- */
export const LASTFM_RE = /^[A-Za-z][\w-]{1,14}$/;
async function lastfmNow() {
  const user = cfg().user, url = musicFunction();
  if (!url || !LASTFM_RE.test(user || "")) return null;
  const r = await fetch(`${url}?lastfm=${encodeURIComponent(user)}`, { headers: { apikey: CFG.SUPABASE_ANON_KEY || "" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return cleanTrack(j.track, "lastfm");
}

/* ---------- stats.fm (même fonction, sans clé) ---------- */
export const STATSFM_RE = /^[A-Za-z0-9._-]{2,40}$/;
// ton profil stats.fm : le pseudo, ou le lien du profil collé tel quel (stats.fm/pseudo, stats.fm/user/…)
export function statsfmId(s) {
  let v = String(s || "").trim().replace(/^@/, "");
  const m = v.match(/stats\.fm\/(?:user\/)?([^/?#\s]+)/i);
  if (m) v = m[1];
  return STATSFM_RE.test(v) ? v : "";
}
async function statsfmNow() {
  const user = cfg().sfUser, url = musicFunction();
  if (!url || !STATSFM_RE.test(user || "")) return null;
  const r = await fetch(`${url}?statsfm=${encodeURIComponent(user)}`, { headers: { apikey: CFG.SUPABASE_ANON_KEY || "" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return cleanTrack(j.track, "statsfm");
}

/* ---------- Apple Music (app iPhone) ---------- */
// ask : demande l'autorisation d'accès à la musique si elle n'a pas encore été donnée
async function appleNow(ask = false) {
  const N = native();
  if (!N?.musicNow) return null;
  const r = await N.musicNow({ ask });
  if (r?.denied) throw new Error("DENIED");
  if (!r?.title) return null;
  return cleanTrack({ ...r, art: r.art || (await itunesArt(r.id)) }, "apple");
}
export const appleAsk = () => appleNow(true);

/* ---------- Le morceau en cours, pour toute l'app ---------- */
let current = null, lastSeen = 0, timer = null, started = false, active = false, lastErr = "", inflight = null, again = false;
const listeners = new Set();
export const nowPlaying = () => current;
// dernière erreur de la source (pseudo Last.fm inconnu, accès refusé…), "" si tout va bien
export const musicError = () => lastErr;
export function onMusic(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(t) {
  current = t;
  for (const fn of listeners) { try { fn(t); } catch (e) { console.warn("music", e); } }
}
const sameState = (a, b) => trackKey(a) === trackKey(b) && !!a?.playing === !!b?.playing && a?.art === b?.art;
async function readOnce() {
  const src = musicSource();
  try {
    let t = null;
    if (src === "lastfm") t = await lastfmNow();
    else if (src === "statsfm") t = await statsfmNow();
    else if (src === "spotify") t = spotifyLinked() ? await spotifyNow() : null;
    else if (src === "apple") t = await appleNow();
    else if (src === "manual") t = cleanTrack(cfg().pick, "manual");
    if (t) lastSeen = Date.now();
    // plus rien : le dernier morceau reste affiché un moment (entre deux titres), en pause
    else if (current && current.src === src && Date.now() - lastSeen < GRACE) t = { ...current, playing: false };
    lastErr = "";
    if (!sameState(t, current)) emit(t);
  } catch (e) {
    lastErr = e.message || "ERROR";
    if (["NOT_LINKED", "DENIED", "USER_NOT_FOUND", "NO_KEY", "PRIVATE"].includes(lastErr) && current) emit(null);
  }
}
// Lit le morceau en cours ; une demande pendant une lecture en relance une juste après (nouvelle source…), et tous
// attendent le résultat à jour
export function poll() {
  if (inflight) { again = true; return inflight; }
  inflight = (async () => { do { again = false; await readOnce(); } while (again); })().finally(() => { inflight = null; });
  return inflight;
}
function schedule() {
  clearInterval(timer); timer = null;
  const every = EVERY[musicSource()];
  if (active && every && !(typeof document !== "undefined" && document.hidden)) timer = setInterval(poll, every);
}
// À lancer au démarrage, puis à chaque changement de réglage : lit tout de suite, puis au rythme de la source
// (seulement quand l'app est à l'écran)
export function startMusic() {
  if (!started && typeof document !== "undefined") {
    started = true;
    document.addEventListener("visibilitychange", () => { if (!active) return; schedule(); if (!document.hidden) poll(); });
  }
  active = true;
  if (!musicSource()) { clearInterval(timer); timer = null; if (current) emit(null); return Promise.resolve(); }
  if (current && current.src !== musicSource()) emit(null);
  schedule();
  return poll();
}
// Déconnexion du compte GREATNESS : plus de musique ni de couleurs, jusqu'au prochain startMusic
export function stopMusic() { active = false; clearInterval(timer); timer = null; lastErr = ""; if (current) emit(null); }
export function setMusic(patch) {
  state.profile.music = { theme: true, deco: true, ...cfg(), ...patch };
  save();
  return startMusic();
}
// pour les tests
export const _reset = () => { clearInterval(timer); timer = null; current = null; lastSeen = 0; inflight = null; again = false; active = false; lastErr = ""; listeners.clear(); };
