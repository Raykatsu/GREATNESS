// La playlist de séance au bon tempo (js/songstats.js) et le pilotage de l'app Musique de l'iPhone (js/music.js).
import test from "node:test";
import assert from "node:assert/strict";
import { tempoPlaylist } from "../js/songstats.js";

const song = (title, bpm, extra = {}) => ({ title, artist: "A", sets: 3, records: 0, lift: null, bpm0: bpm, ...extra });

test("trois temps, du plus lent au plus rapide, les plus efficaces d'abord ; tempo inconnu laissé de côté", () => {
  const songs = [song("Lent", 90), song("Moyen", 128), song("Rapide", 150), song("Très rapide", 174), song("Inconnu", 0), song("Moyen 2", 118, { records: 2 })];
  const phases = tempoPlaylist(songs, s => s.bpm0);
  assert.deepEqual(phases.map(p => p.id), ["warm", "work", "heavy"]);
  assert.deepEqual(phases.map(p => p.songs.map(s => `${s.title} ${s.bpm}`)), [["Lent 90"], ["Moyen 2 118", "Moyen 128"], ["Rapide 150", "Très rapide 174"]]);
  // quotas : 20 % échauffement, 45 % séries, le reste pour les séries lourdes ; les records passent devant
  const many = Array.from({ length: 12 }, (_, i) => song(`W${i}`, 100 + i, { records: i === 11 ? 3 : 0 }));
  const warm = tempoPlaylist(many, s => s.bpm0, { max: 10 })[0];
  assert.equal(warm.songs.length, 2);
  assert.ok(warm.songs.some(s => s.title === "W11"), "le morceau de records passe devant");
  assert.deepEqual(tempoPlaylist([song("X", 0)], () => 0), []);
});

test("app Musique de l'iPhone : lecture, suivant, accès refusé", async () => {
  const calls = [];
  let status = "ok";
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { Greatness: {
    musicControl: async o => { calls.push(o.cmd); return status === "ok" ? { ok: true } : { ok: false, status: "denied" }; },
    musicNow: async () => ({ playing: false, status: "authorized" }),
  } } } };
  try {
    const { appleControl, canControl } = await import("../js/music.js");
    assert.equal(await appleControl("next"), "ok");
    status = "denied";
    assert.equal(await appleControl("pause"), "DENIED");
    assert.deepEqual(calls, ["next", "pause"]);
    assert.ok(canControl({ src: "apple", title: "Numb" }));
    assert.ok(!canControl({ src: "lastfm", title: "Numb" }));
  } finally { delete globalThis.window; }
});
