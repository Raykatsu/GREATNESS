// Genre et tempo d'un morceau (js/trackinfo.js) : le genre donné par la source, sinon le catalogue iTunes ; le tempo
// tapé, sinon le catalogue Deezer (fonction « music ») ; gardés sur l'appareil, une seule demande à la fois, rien de
// gardé hors ligne (on redemandera).
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { tempoOf, genreOf, knownTempo, keepTempo, _resetInfo } from "../js/trackinfo.js";

let calls = [], replies = {};
globalThis.fetch = async url => {
  const u = String(url);
  calls.push(u);
  for (const [k, fn] of Object.entries(replies)) if (u.includes(k)) return fn(u);
  return new Response("introuvable", { status: 404 });
};
const NUMB = { title: "Numb", artist: "Linkin Park" };

test("genre : celui de la source, sinon le catalogue iTunes, gardé ; une seule demande ; hors ligne : redemandé", async () => {
  _resetInfo(); calls = [];
  assert.equal(await genreOf({ ...NUMB, genre: "Alternative" }), "Alternative");
  assert.equal(calls.length, 0, "l'app Musique de l'iPhone donne le genre");
  replies = { "/functions/v1/music?search=": () => new Promise(r => setTimeout(() => r(Response.json({ results: [{ primaryGenreName: "Hard Rock" }] })), 5)) };
  const [a, b] = await Promise.all([genreOf(NUMB), genreOf({ title: "numb", artist: "LINKIN PARK" })]);
  assert.deepEqual([a, b], ["Hard Rock", "Hard Rock"]);
  assert.equal(calls.length, 1, "même morceau : une seule demande");
  assert.match(calls[0], /\/functions\/v1\/music\?search=Linkin%20Park%20Numb&limit=1&country=[a-z]{2}$/, "par la fonction (sur iPhone, le catalogue renvoie vers l'app Musique)");
  _resetInfo();
  assert.equal(await genreOf(NUMB), "Hard Rock");
  assert.equal(calls.length, 1, "gardé sur l'appareil");
  // hors ligne : rien de gardé
  replies = { "/functions/v1/music?search=": () => { throw new Error("réseau"); } };
  assert.equal(await genreOf({ title: "Autre", artist: "X" }), "");
  replies = { "/functions/v1/music?search=": () => Response.json({ results: [{ primaryGenreName: "Pop" }] }) };
  _resetInfo();
  assert.equal(await genreOf({ title: "Autre", artist: "X" }), "Pop");
});

test("tempo : tapé en rythme d'abord, sinon le catalogue Deezer (fonction « music »), gardé ; inconnu : null", async () => {
  _resetInfo(); calls = [];
  replies = { "?bpm=1": u => Response.json({ ok: true, bpm: new URL(u).searchParams.get("title") === "Numb" ? 110 : 0 }) };
  assert.deepEqual(await tempoOf(NUMB), { bpm: 110, how: "auto" });
  assert.deepEqual(knownTempo(NUMB), { bpm: 110, how: "auto" });
  assert.equal(await tempoOf({ title: "Inconnu", artist: "Y" }), null);
  const n = calls.length;
  await tempoOf(NUMB);
  assert.equal(calls.length, n, "déjà connu : pas redemandé");
  keepTempo(NUMB, 112, "tap");
  assert.deepEqual(await tempoOf(NUMB), { bpm: 112, how: "tap" }, "le tempo tapé passe devant");
  assert.equal(await tempoOf(null), null);
});
