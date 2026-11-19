// L'ambiance du morceau (js/vibe.js) : genre → ambiance (catalogue iTunes en français ou en anglais), nuancée par le
// tempo ; sans genre, l'énergie du tempo et l'humeur de la pochette ; battement au tempo.
import test from "node:test";
import assert from "node:assert/strict";
import { VIBES, genreVibe, vibeOf, coverMood, tempoEnergy, beatSeconds } from "../js/vibe.js";

const BRIGHT = { light: 0.62, vivid: 0.55, warm: 0.85 }, DARK = { light: 0.12, vivid: 0.05, warm: 0.1 }, MID = { light: 0.35, vivid: 0.25, warm: 0.45 };

test("genres du catalogue (français et anglais) → ambiance ; l'ordre départage les genres mixtes", () => {
  const cases = {
    "Hip-Hop/Rap": "intense", "Rap français": "intense", "Metal": "intense", "Hard Rock": "intense", "Pop rock": "intense", "Rock": "intense", "Drill": "intense",
    "Dance": "festif", "Électronique": "festif", "House": "festif", "Latino": "festif", "K-Pop": "festif", "Pop": "festif", "Variété française": "festif", "Musique africaine": "festif",
    "R&B/Soul": "chill", "Jazz": "chill", "Reggae": "chill", "Lo-Fi": "chill", "Chanson française": "chill",
    "Alternative": "sombre", "Singer/Songwriter": "sombre", "Folk": "sombre", "Blues": "sombre",
    "Bandes originales de films": "epique", "Classique": "epique", "Soundtrack": "epique",
  };
  for (const [g, v] of Object.entries(cases)) assert.equal(genreVibe(g), v, g);
  assert.equal(genreVibe(""), null);
  assert.equal(genreVibe("Podcasts"), null);
  for (const v of ["intense", "festif", "chill", "sombre", "epique"]) assert.ok(VIBES[v]?.name && VIBES[v].what, v);
});

test("le tempo nuance le genre : un morceau calme joué très vite, une ballade pop sombre", () => {
  assert.equal(vibeOf({ genre: "R&B/Soul", bpm: 92 }), "chill");
  assert.equal(vibeOf({ genre: "R&B/Soul", bpm: 140 }), "festif");
  assert.equal(vibeOf({ genre: "Pop", bpm: 120, tone: BRIGHT }), "festif");
  assert.equal(vibeOf({ genre: "Pop", bpm: 70, tone: DARK }), "sombre");
  assert.equal(vibeOf({ genre: "Hip-Hop/Rap", bpm: 70, tone: BRIGHT }), "intense", "le rap reste intense");
});

test("sans genre : énergie du tempo × humeur de la pochette ; rien pour juger : pas d'ambiance", () => {
  assert.equal(vibeOf({ bpm: 150, tone: BRIGHT }), "festif");
  assert.equal(vibeOf({ bpm: 150, tone: DARK }), "intense");
  assert.equal(vibeOf({ bpm: 80, tone: MID }), "chill");
  assert.equal(vibeOf({ bpm: 80, tone: DARK }), "sombre");
  assert.equal(vibeOf({ tone: BRIGHT }), "chill", "pochette seule : tempo moyen supposé");
  assert.equal(vibeOf({ bpm: 170 }), "festif", "tempo seul : humeur moyenne supposée");
  assert.equal(vibeOf({}), null);
  assert.ok(coverMood(BRIGHT) > 0.6 && coverMood(DARK) < 0.15 && coverMood(null) === null);
  assert.deepEqual([tempoEnergy(75), tempoEnergy(145), tempoEnergy(0)], [0, 1, null]);
});

test("battement au tempo : durée d'un temps, bornée (50 à 200 BPM), 100 BPM sans tempo", () => {
  assert.deepEqual([beatSeconds(120), beatSeconds(60), beatSeconds(0), beatSeconds(400), beatSeconds(20)], [0.5, 1, 0.6, 0.3, 1.2]);
});
