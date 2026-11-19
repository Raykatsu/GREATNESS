// Ce qu'on sait d'un morceau au-delà de son titre : son genre (l'app Musique de l'iPhone le donne, sinon le catalogue
// iTunes) et son tempo (tapé en rythme, sinon le catalogue Deezer par la fonction « music »). Gardés sur l'appareil
// (300 morceaux), pour l'ambiance du thème (musictheme.js, vibe.js) et le mannequin qui danse (dance-ui.js). Une seule
// demande à la fois par morceau, même si plusieurs écrans la font.
import * as CFG from "./config.js";
import { trackKey, musicFunction, itunesSearch } from "./music.js";

const BPM_KEY = "greatness.bpm", GENRE_KEY = "greatness.genres", MAX = 300;
const read = k => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
function keep(k, key, value) {
  try {
    const all = read(k);
    delete all[key]; all[key] = value; // le plus récent à la fin
    for (const x of Object.keys(all).slice(0, -MAX)) delete all[x];
    localStorage.setItem(k, JSON.stringify(all));
  } catch { /* stockage plein */ }
}
const once = new Map();
function single(key, fn) {
  if (!once.has(key)) once.set(key, fn().finally(() => setTimeout(() => once.delete(key), 30000)));
  return once.get(key);
}

// Tempo : { bpm, how: "tap" | "auto" } ou null
export const knownTempo = t => read(BPM_KEY)[trackKey(t)] || null;
export const keepTempo = (t, bpm, how) => { if (trackKey(t)) keep(BPM_KEY, trackKey(t), { bpm, how }); };
export function tempoOf(t) {
  const k = trackKey(t), known = knownTempo(t), fn = musicFunction();
  if (known?.bpm) return Promise.resolve(known);
  if (!fn || !k) return Promise.resolve(null);
  return single(`bpm|${k}`, async () => {
    try {
      const q = new URLSearchParams({ bpm: "1", artist: t.artist || "", title: t.title || "", ...(t.isrc ? { isrc: t.isrc } : {}) });
      const r = await fetch(`${fn}?${q}`, { headers: { apikey: CFG.SUPABASE_ANON_KEY || "" } });
      const j = await r.json();
      if (j?.bpm > 0) { keep(BPM_KEY, k, { bpm: j.bpm, how: "auto" }); return { bpm: j.bpm, how: "auto" }; }
    } catch { /* hors ligne */ }
    return null;
  });
}

// Genre : celui que donne la source (app Musique de l'iPhone), sinon le catalogue iTunes ; "" si inconnu
export function genreOf(t) {
  if (t?.genre) return Promise.resolve(String(t.genre).slice(0, 60));
  const k = trackKey(t);
  if (!k) return Promise.resolve("");
  const known = read(GENRE_KEY)[k];
  if (typeof known === "string") return Promise.resolve(known);
  return single(`genre|${k}`, async () => {
    try {
      const r = await itunesSearch(`${t.artist} ${t.title}`.slice(0, 120), 1);
      if (!r.ok) return "";
      const g = String((await r.json())?.results?.[0]?.primaryGenreName || "").slice(0, 60);
      keep(GENRE_KEY, k, g);
      return g;
    } catch { return ""; } // hors ligne : on redemandera
  });
}
// pour les tests
export const _resetInfo = () => once.clear();
