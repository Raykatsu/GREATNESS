// L'ambiance du morceau : au-delà des couleurs, tout le thème de l'app suit la musique — les formes (arrondis), la
// typographie (graisse et espacement des titres), les mouvements (vitesse, ressorts), les lueurs, le décor et un
// battement discret au tempo. Cinq ambiances, d'après le genre du morceau (l'app Musique de l'iPhone, sinon le
// catalogue iTunes), son tempo (catalogue Deezer, fonction « music ») et sa pochette (claire ou sombre, vive ou douce,
// chaude ou froide). Logique pure, testée dans Node ; musictheme.js l'applique (data-vibe et --beat sur la page).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// les ambiances, avec ce qu'elles changent (affiché dans les réglages Musique)
export const VIBES = {
  intense: { name: "Intense", what: "Angles vifs, titres massifs, mouvements secs" },
  festif: { name: "Festive", what: "Arrondis généreux, lueurs néon, rebonds" },
  chill: { name: "Chill", what: "Formes douces, titres légers, mouvements lents" },
  sombre: { name: "Mélancolique", what: "Couleurs voilées, lumière tamisée, gestes lents" },
  epique: { name: "Épique", what: "Titres espacés, lueur dorée, mouvements amples" },
};

// Genres → ambiance (noms du catalogue iTunes, en français ou en anglais, et de l'app Musique). L'ordre compte : le
// premier qui correspond gagne (« pop rock » est du rock, « dance pop » de la dance).
const GENRES = [
  [/metal|hard ?core|punk|grunge|drill|trap|grime|dubstep|industri|hard ?rock|phonk/, "intense"],
  [/hip.?hop|\brap\b/, "intense"],
  [/classique|classical|orchestr|opera|bandes? originales?|soundtrack|musique de film|film score|\bscore\b|epic|cinemat/, "epique"],
  [/dance|electro|house|techno|edm|disco|funk|reggaeton|latin|k-?pop|j-?pop|afro|afri|amapiano|dancehall|zouk|party|baile/, "festif"],
  [/jazz|soul|r&b|rnb|lo.?fi|ambient|chill|acousti|bossa|reggae|lounge|new age|easy listening|downtempo|relax|chanson/, "chill"],
  [/blues|folk|singer|auteur|alternati|indie|emo|ballad|piano/, "sombre"],
  [/rock/, "intense"],
  [/pop|variete/, "festif"],
];
export function genreVibe(genre) {
  const g = norm(genre);
  if (!g) return null;
  for (const [re, v] of GENRES) if (re.test(g)) return v;
  return null;
}

// Humeur d'une pochette (0 sombre et terne → 1 claire, vive, chaude), d'après son ton (palette.js, themeFrom)
export const coverMood = tone => (tone ? clamp(0.45 * (tone.light ?? 0.4) + 0.35 * (tone.vivid ?? 0.25) + 0.2 * (tone.warm ?? 0.5), 0, 1) : null);
// Énergie d'un tempo (0 lent → 1 rapide)
export const tempoEnergy = bpm => (bpm > 0 ? clamp((bpm - 75) / 70, 0, 1) : null);

// L'ambiance d'un morceau : le genre d'abord (nuancé par le tempo), sinon l'énergie du tempo et l'humeur de la pochette.
// null : rien pour en juger (l'app garde son allure habituelle)
export function vibeOf({ genre = "", bpm = 0, tone = null } = {}) {
  const g = genreVibe(genre), energy = tempoEnergy(bpm), mood = coverMood(tone);
  if (g) {
    if (g === "chill" && energy !== null && energy > 0.8) return "festif"; // un morceau « calme » joué très vite
    if (g === "festif" && energy !== null && energy < 0.12 && mood !== null && mood < 0.3) return "sombre"; // une ballade pop
    return g;
  }
  if (energy === null && mood === null) return null;
  const e = energy ?? 0.5, m = mood ?? 0.45;
  if (e >= 0.55) return m >= 0.4 ? "festif" : "intense";
  return m >= 0.3 ? "chill" : "sombre";
}

// Battement au tempo (durée d'un temps, en secondes, bornée pour rester lisible : 50 à 200 BPM)
export const beatSeconds = bpm => +(60 / clamp(bpm > 0 ? bpm : 100, 50, 200)).toFixed(3);
