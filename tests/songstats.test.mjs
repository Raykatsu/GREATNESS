// Tes morceaux de records (js/songstats.js) : records battus pendant chaque morceau, intensité de tes séries sur ce
// morceau comparée à ta moyenne, classement, playlist et liens d'écoute.
import test from "node:test";
import assert from "node:assert/strict";
import { songRecords, recordPlaylist, playlistText, listenUrl } from "../js/songstats.js";

const NUMB = { title: "Numb", artist: "Linkin Park", art: "https://i.scdn.co/image/numb" };
const SOFT = { title: "Douceur", artist: "Artiste" };
const sess = (date, music, sets) => ({ id: `s${date}`, date, music, sets });
const set = (exId, weight, reps, song) => ({ exId, name: exId === "bench" ? "Développé couché" : "Squat", weight, reps, rpe: 8, ...(song === undefined ? {} : { song }) });

test("records battus pendant un morceau, intensité comparée à ta moyenne, classement", () => {
  const sessions = [
    // la première séance sert de référence (pas de record pour un premier essai)
    sess(1, [SOFT], [set("bench", 60, 8, 0), set("squat", 80, 8, 0)]),
    // Numb : deux records (développé couché puis squat)
    sess(2, [NUMB, SOFT], [set("bench", 65, 8, 0), set("squat", 85, 8, 0), set("bench", 55, 8, 1), set("squat", 70, 8, 1)]),
    sess(3, [NUMB, SOFT], [set("bench", 64, 8, 0), set("squat", 60, 8, 1), set("bench", 50, 8, 1)]),
    // une série sans morceau compte dans la moyenne seulement
    sess(4, [], [set("bench", 60, 8)]),
  ];
  const songs = songRecords(sessions);
  assert.deepEqual(songs.map(s => s.title), ["Numb", "Douceur"]);
  const [numb, soft] = songs;
  assert.deepEqual([numb.records, numb.sets, numb.sessions, numb.art], [2, 3, 2, "https://i.scdn.co/image/numb"]);
  assert.equal(soft.records, 0);
  assert.ok(numb.lift > 0 && soft.lift < 0, `Numb plus lourd que la moyenne (${numb.lift} %), Douceur moins (${soft.lift} %)`);
  assert.deepEqual(numb.best, { name: "Squat", weight: 85, reps: 8 });
});

test("peu de séries : pas de verdict d'intensité ; séries au poids du corps comparées en répétitions", () => {
  const songs = songRecords([
    sess(1, [], [{ exId: "pullup", name: "Tractions", weight: 0, reps: 8 }]),
    sess(2, [NUMB], [{ exId: "pullup", name: "Tractions", weight: 0, reps: 10, song: 0 }]),
  ]);
  assert.deepEqual([songs[0].records, songs[0].lift, songs[0].best], [1, null, null]);
  assert.deepEqual(songRecords([]), []);
  assert.deepEqual(songRecords([sess(1, [NUMB], [set("bench", 60, 8, 3)])]), [], "rang hors de la bande-son : ignoré");
});

test("playlist : les morceaux qui portent (record ou plus lourd que d'habitude), en texte et en liens d'écoute", () => {
  const list = recordPlaylist([
    { title: "Numb", artist: "Linkin Park", records: 2, lift: 6 },
    { title: "Douceur", artist: "Artiste", records: 0, lift: -4 },
    { title: "Lose Yourself", artist: "Eminem", records: 0, lift: 3 },
    { title: "Neuf", artist: "X", records: 0, lift: null },
  ]);
  assert.deepEqual(list.map(s => s.title), ["Numb", "Lose Yourself"]);
  assert.equal(playlistText(list), "1. Numb — Linkin Park\n2. Lose Yourself — Eminem");
  assert.equal(listenUrl(list[0]), "https://music.apple.com/search?term=Linkin%20Park%20Numb");
  assert.equal(listenUrl(list[0], "spotify"), "https://open.spotify.com/search/Linkin%20Park%20Numb");
});
