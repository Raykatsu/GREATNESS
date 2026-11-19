// Ta chanson de guerre : le morceau qui te galvanise, que l'app te propose juste avant ta série la plus lourde ou une
// tentative de record (une fois par séance). Spotify connecté en direct : il se lance tout seul ; sinon, un geste
// l'ouvre dans Apple Music ou Spotify. Logique pure, testée dans Node ; live.js affiche le moment, music-ui.js le
// réglage (Moi → Réglages → Musique).

const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : 0); // même formule que store.js
export const WAR_SHARE = 0.95; // une série à 95 % de ton meilleur niveau, ou plus : c'est le moment

// La série en cours mérite-t-elle ta chanson de guerre ? Une série chargée, à au moins 95 % de ton meilleur niveau sur
// l'exercice (charge × répétitions), ou qui battrait ton record. Jamais sans meilleur niveau connu (première fois).
export function warMoment({ type, weight, reps, best } = {}) {
  if (type !== "load" || !(weight > 0) || !(reps > 0) || !(best > 0)) return false;
  return e1rm(weight, reps) >= WAR_SHARE * best;
}
// Est-ce un record en vue (plutôt qu'une série lourde) ?
export const warRecord = ({ weight, reps, best } = {}) => best > 0 && e1rm(weight, reps) > best + 0.01;

// Où écouter ta chanson de guerre : son lien (Apple Music, depuis le catalogue), sinon une recherche Spotify
export function warLink(war, where = "") {
  if (!war?.title) return "";
  const q = encodeURIComponent(`${war.artist || ""} ${war.title}`.trim());
  if (where === "spotify") return `https://open.spotify.com/search/${q}`;
  return /^https:\/\//.test(war.url || "") ? war.url : `https://music.apple.com/search?term=${q}`;
}
// La chanson de guerre gardée dans le profil : seulement ce qu'il faut (titre, artiste, pochette, lien)
export const cleanWar = t => (t?.title ? {
  title: String(t.title).slice(0, 120), artist: String(t.artist || "").slice(0, 120),
  ...(typeof t.art === "string" && /^https:\/\//.test(t.art) ? { art: t.art } : {}),
  ...(typeof t.url === "string" && /^https:\/\//.test(t.url) ? { url: t.url } : {}),
} : null);
