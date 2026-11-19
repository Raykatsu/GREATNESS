// Ta chanson de guerre (js/warsong.js) : le moment (série lourde ou record en vue), où l'écouter, ce qui est gardé.
import test from "node:test";
import assert from "node:assert/strict";
import { warMoment, warRecord, warLink, cleanWar } from "../js/warsong.js";

test("le moment : une série chargée à 95 % de ton meilleur niveau ou plus, ou un record en vue", () => {
  const best = 100 * (1 + 5 / 30); // 100 kg × 5 → 116,7
  assert.equal(warMoment({ type: "load", weight: 100, reps: 5, best }), true, "ton meilleur niveau");
  assert.equal(warMoment({ type: "load", weight: 95, reps: 5, best }), true, "95 %");
  assert.equal(warMoment({ type: "load", weight: 85, reps: 5, best }), false, "série d'échauffement ou de volume");
  assert.equal(warMoment({ type: "load", weight: 102.5, reps: 5, best }), true);
  assert.equal(warRecord({ weight: 102.5, reps: 5, best }), true, "record en vue");
  assert.equal(warRecord({ weight: 100, reps: 5, best }), false);
  assert.equal(warMoment({ type: "reps", weight: 0, reps: 12, best: 10 }), false, "au poids du corps : pas de chanson de guerre");
  assert.equal(warMoment({ type: "load", weight: 60, reps: 8, best: 0 }), false, "première fois : rien à dépasser");
  assert.equal(warMoment(), false);
});

test("où l'écouter : son lien Apple Music, sinon une recherche ; Spotify sur demande ; seulement ce qu'il faut est gardé", () => {
  const war = { title: "Till I Collapse", artist: "Eminem", url: "https://music.apple.com/fr/album/x?i=1" };
  assert.equal(warLink(war), "https://music.apple.com/fr/album/x?i=1");
  assert.equal(warLink({ title: "Till I Collapse", artist: "Eminem" }), "https://music.apple.com/search?term=Eminem%20Till%20I%20Collapse");
  assert.equal(warLink(war, "spotify"), "https://open.spotify.com/search/Eminem%20Till%20I%20Collapse");
  assert.equal(warLink(null), "");
  assert.deepEqual(cleanWar({ title: "Till I Collapse", artist: "Eminem", art: "https://is1-ssl.mzstatic.com/a.jpg", url: "javascript:alert(1)", src: "manual", playing: true }),
    { title: "Till I Collapse", artist: "Eminem", art: "https://is1-ssl.mzstatic.com/a.jpg" });
  assert.equal(cleanWar({ artist: "X" }), null);
});
