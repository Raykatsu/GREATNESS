// Musique (music.js) : réponses de Spotify, d'iTunes et de la fonction Last.fm lues en morceaux propres ; connexion
// Spotify PKCE (vérificateur, défi, adresse, retour vérifié, jetons sur l'appareil, renouvellement) ; lecture du
// morceau en cours par source, avec le délai de grâce entre deux morceaux et les erreurs.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { state } from "../js/store.js";
import {
  parseSpotify, parseItunes, bigArt, cleanTrack, trackKey, pkceVerifier, pkceChallenge, spotifyAuthUrl, webRedirect, spotifyFinish,
  spotifyLinked, spotifyLogout, spotifyControl, poll, startMusic, stopMusic, setMusic, nowPlaying, onMusic, musicError, musicSource, LASTFM_RE, _reset, NATIVE_REDIRECT,
  statsfmId, SOURCE_NAME, autoSources, musicErrors, appleState, autoAsk,
} from "../js/music.js";

const realFetch = globalThis.fetch;
let routes = [];
const mock = (match, reply) => routes.push({ match, reply });
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), r = routes.find(x => (typeof x.match === "string" ? u.includes(x.match) : x.match.test(u)));
  if (!r) return new Response("introuvable", { status: 404 });
  const out = await r.reply(u, opts);
  return out instanceof Response ? out : Response.json(out);
};
globalThis.history ||= { replaceState() {} };
const reset = () => { routes = []; _reset(); state.profile.music = {}; localStorage.removeItem("greatness.spotify"); localStorage.removeItem("greatness.spotify.pkce"); };

const SPOTIFY_NOW = {
  is_playing: true, progress_ms: 61000, currently_playing_type: "track",
  item: { name: "Till I Collapse", duration_ms: 297000, artists: [{ name: "Eminem" }, { name: "Nate Dogg" }], external_ids: { isrc: "USIR10211559" },
    external_urls: { spotify: "https://open.spotify.com/track/abc" },
    album: { name: "The Eminem Show", images: [{ url: "https://i.scdn.co/image/big", width: 640 }, { url: "https://i.scdn.co/image/small", width: 64 }, { url: "https://i.scdn.co/image/mid", width: 300 }] } },
};

test("Spotify : morceau en cours lu proprement ; publicité ou rien : null", () => {
  const t = parseSpotify(SPOTIFY_NOW);
  assert.deepEqual(t, { title: "Till I Collapse", artist: "Eminem, Nate Dogg", album: "The Eminem Show", art: "https://i.scdn.co/image/big", playing: true, src: "spotify",
    url: "https://open.spotify.com/track/abc", isrc: "USIR10211559", duration: 297000, progress: 61000 });
  assert.equal(parseSpotify({ currently_playing_type: "ad", item: null }), null);
  assert.equal(parseSpotify({}), null);
  const ep = parseSpotify({ is_playing: false, currently_playing_type: "episode", item: { name: "Épisode 12", show: { name: "Mon podcast", images: [{ url: "https://i.scdn.co/image/pod", width: 600 }] } } });
  assert.deepEqual([ep.title, ep.artist, ep.art, ep.playing], ["Épisode 12", "Mon podcast", "https://i.scdn.co/image/pod", false]);
});

test("iTunes : résultats de recherche, pochettes en 600 px ; morceau nettoyé (adresses sûres, textes bornés)", () => {
  assert.equal(bigArt("https://is1-ssl.mzstatic.com/image/thumb/a/b/100x100bb.jpg"), "https://is1-ssl.mzstatic.com/image/thumb/a/b/600x600bb.jpg");
  const list = parseItunes({ results: [{ trackName: "Lose Yourself", artistName: "Eminem", collectionName: "8 Mile", artworkUrl100: "https://is1-ssl.mzstatic.com/x/100x100bb.jpg", trackViewUrl: "https://music.apple.com/x" }, { wrapperType: "artist" }] });
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].title, list[0].art, list[0].src, list[0].playing], ["Lose Yourself", "https://is1-ssl.mzstatic.com/x/600x600bb.jpg", "manual", false]);
  assert.equal(cleanTrack({ title: "X", art: "javascript:alert(1)", url: "http://pas-sur" }, "lastfm").art, "");
  assert.equal(cleanTrack({ title: "X", url: "http://pas-sur" }, "lastfm").url, undefined);
  assert.equal(cleanTrack({ title: "T".repeat(500) }, "lastfm").title.length, 120);
  assert.equal(cleanTrack({ title: "" }, "lastfm"), null);
  assert.equal(trackKey({ title: "Été  Indien", artist: "Joe DASSIN" }), trackKey({ title: "ete indien", artist: "joe dassin" }));
  assert.ok(LASTFM_RE.test("rayane_b") && !LASTFM_RE.test("x") && !LASTFM_RE.test("a b") && !LASTFM_RE.test("1abc"));
});

test("connexion Spotify (PKCE) : vérificateur, défi SHA-256, adresse d'autorisation, adresse de retour", async () => {
  const v = pkceVerifier();
  assert.match(v, /^[A-Za-z0-9_-]{64}$/);
  assert.equal(await pkceChallenge(v), createHash("sha256").update(v).digest("base64url"));
  const u = new URL(spotifyAuthUrl({ clientId: "abc", redirect: "https://raykatsu.github.io/GREATNESS/", challenge: "CH", stateId: "ST" }));
  assert.equal(u.origin + u.pathname, "https://accounts.spotify.com/authorize");
  assert.deepEqual(Object.fromEntries(u.searchParams), { response_type: "code", client_id: "abc", scope: "user-read-currently-playing user-read-playback-state user-modify-playback-state",
    code_challenge_method: "S256", code_challenge: "CH", redirect_uri: "https://raykatsu.github.io/GREATNESS/", state: "ST" });
  assert.equal(webRedirect("https://raykatsu.github.io/GREATNESS/index.html?code=1#/food"), "https://raykatsu.github.io/GREATNESS/");
  assert.equal(webRedirect("http://127.0.0.1:8080/"), "http://127.0.0.1:8080/");
  assert.equal(NATIVE_REDIRECT, "greatness://spotify");
});

test("retour de Spotify : état vérifié, code échangé contre des jetons gardés sur l'appareil, puis renouvelés", async () => {
  reset();
  await assert.rejects(spotifyFinish("https://app.test/?code=C&state=S"), /BAD_STATE/); // aucune connexion en attente
  localStorage.setItem("greatness.spotify.pkce", JSON.stringify({ verifier: "V", stateId: "S", redirect: "https://app.test/", at: Date.now() }));
  await assert.rejects(spotifyFinish("https://app.test/?code=C&state=AUTRE"), /BAD_STATE/);
  assert.equal(localStorage.getItem("greatness.spotify.pkce"), null, "une seule tentative");
  localStorage.setItem("greatness.spotify.pkce", JSON.stringify({ verifier: "V", stateId: "S", redirect: "https://app.test/", at: Date.now() }));
  let sent = null;
  mock("accounts.spotify.com/api/token", (u, o) => { sent = Object.fromEntries(new URLSearchParams(String(o.body))); return { access_token: "A1", refresh_token: "R1", expires_in: 3600 }; });
  await spotifyFinish("https://app.test/?code=C&state=S");
  assert.deepEqual([sent.grant_type, sent.code, sent.code_verifier, sent.redirect_uri], ["authorization_code", "C", "V", "https://app.test/"]);
  assert.equal(spotifyLinked(), true);
  assert.equal(musicSource(), "auto", "Spotify relié : la musique se lit en automatique, avec les autres sources");
  assert.ok(!JSON.stringify(state).includes("R1"), "les jetons ne vont pas dans les données synchronisées");
  // jeton expiré : renouvelé avant la lecture du morceau en cours
  localStorage.setItem("greatness.spotify", JSON.stringify({ access: "OLD", refresh: "R1", exp: Date.now() - 1 }));
  routes = [];
  let auth = "";
  mock("accounts.spotify.com/api/token", (u, o) => { assert.equal(new URLSearchParams(String(o.body)).get("grant_type"), "refresh_token"); return { access_token: "A2", expires_in: 3600 }; });
  mock("/me/player/currently-playing", (u, o) => { auth = o.headers.Authorization; return SPOTIFY_NOW; });
  await poll();
  assert.equal(auth, "Bearer A2");
  assert.equal(nowPlaying().title, "Till I Collapse");
  assert.equal(JSON.parse(localStorage.getItem("greatness.spotify")).refresh, "R1", "le jeton de renouvellement est gardé");
  // lecture à distance : Premium requis, aucun appareil, ou fait
  routes = [];
  mock("/me/player/pause", () => new Response(JSON.stringify({ error: { status: 403, reason: "PREMIUM_REQUIRED" } }), { status: 403 }));
  mock("/me/player/next", () => new Response(null, { status: 204 }));
  mock("/me/player/play", () => new Response("{}", { status: 404 }));
  assert.equal(await spotifyControl("pause"), "PREMIUM");
  assert.equal(await spotifyControl("next"), "ok");
  assert.equal(await spotifyControl("play"), "NO_DEVICE");
  spotifyLogout();
  assert.equal(spotifyLinked(), false);
  assert.equal(musicSource(), "auto", "les autres sources continuent");
});

test("Last.fm par la fonction « music » : morceau en cours, délai de grâce entre deux morceaux, erreurs", async () => {
  reset();
  const seen = [];
  onMusic(t => seen.push(t && `${t.title}${t.playing ? "" : " (pause)"}`));
  let reply = { ok: true, track: { title: "Numb", artist: "Linkin Park", album: "Meteora", art: "https://lastfm.freetls.fastly.net/i/u/300x300/a.jpg", playing: true } };
  let asked = "";
  mock("/functions/v1/music?lastfm=", u => { asked = u; return typeof reply === "function" ? reply() : reply; });
  await setMusic({ src: "lastfm", user: "rayane_b" });
  assert.match(asked, /lastfm=rayane_b$/);
  assert.deepEqual(seen, ["Numb"]);
  await poll();
  assert.deepEqual(seen, ["Numb"], "même morceau : rien de nouveau");
  // plus rien en cours : le dernier morceau reste, en pause, pendant le délai de grâce
  reply = { ok: true, track: null };
  await poll();
  assert.deepEqual(seen, ["Numb", "Numb (pause)"]);
  // pseudo inconnu : erreur lisible, le morceau disparaît
  reply = () => new Response(JSON.stringify({ ok: false, error: "USER_NOT_FOUND" }), { status: 404 });
  await poll();
  assert.equal(musicError(), "USER_NOT_FOUND");
  assert.equal(nowPlaying(), null);
  // réseau coupé : on garde ce qu'on avait
  reply = { ok: true, track: { title: "In the End", artist: "Linkin Park", playing: true } };
  await poll();
  assert.equal(musicError(), "");
  reply = () => { throw new Error("réseau"); };
  await poll();
  assert.equal(nowPlaying().title, "In the End");
  _reset();
});

test("lectures qui se chevauchent : une à la fois, la demande arrivée pendant la lecture est relancée ; arrêt à la déconnexion", async () => {
  reset();
  let n = 0, release;
  mock("/functions/v1/music?lastfm=", async () => { n++; if (n === 1) await new Promise(r => (release = r)); return { ok: true, track: { title: `T${n}`, artist: "A", playing: true } }; });
  state.profile.music = { src: "lastfm", user: "rayane_b" };
  const a = poll(), b = poll(); // la deuxième demande arrive pendant la première lecture
  assert.equal(a, b, "même lecture attendue");
  release();
  await b;
  assert.equal(n, 2, "relancée une fois, après la première");
  assert.equal(nowPlaying().title, "T2", "résultat à jour pour tous");
  stopMusic();
  assert.equal(nowPlaying(), null, "déconnexion : plus de musique");
  _reset();
});

test("stats.fm par la fonction « music » : profil (pseudo ou lien collé), morceau en cours, profil qui cache son écoute", async () => {
  assert.equal(statsfmId("rayane"), "rayane");
  assert.equal(statsfmId("  @Rayane.B "), "Rayane.B");
  assert.equal(statsfmId("https://stats.fm/rayane?ref=share"), "rayane");
  assert.equal(statsfmId("stats.fm/user/abc123def"), "abc123def");
  assert.equal(statsfmId("https://stats.fm/"), "");
  assert.equal(statsfmId("a"), "");
  assert.equal(statsfmId("<script>"), "");
  assert.equal(SOURCE_NAME.statsfm, "stats.fm");
  reset();
  const seen = [];
  onMusic(t => seen.push(t && `${t.title} · ${t.src}`));
  let reply = { ok: true, track: { title: "Blinding Lights", artist: "The Weeknd", art: "https://i.scdn.co/image/x", playing: true } };
  let asked = "";
  mock("/functions/v1/music?statsfm=", u => { asked = u; return typeof reply === "function" ? reply() : reply; });
  await setMusic({ src: "statsfm", sfUser: "rayane" });
  assert.equal(musicSource(), "statsfm");
  assert.match(asked, /statsfm=rayane$/);
  assert.deepEqual(seen, ["Blinding Lights · statsfm"]);
  // profil qui cache son écoute : erreur lisible, le morceau disparaît
  reply = () => new Response(JSON.stringify({ ok: false, error: "PRIVATE" }), { status: 403 });
  await poll();
  assert.equal(musicError(), "PRIVATE");
  assert.equal(nowPlaying(), null);
  // profil invalide gardé par erreur : rien n'est demandé
  asked = "";
  await setMusic({ sfUser: "../x" });
  assert.equal(asked, "");
  _reset();
});

test("automatique : ce que joue le téléphone, d'où que ça vienne — le morceau qui joue gagne ; erreurs par compte", async () => {
  reset();
  // l'app iPhone : l'app Musique d'Apple, lue directement par le natif
  let apple = { status: "authorized", title: "Numb", artist: "Linkin Park", playing: false, art: "data:image/jpeg;base64,AAAA" };
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { Greatness: { musicNow: async () => apple } } } };
  let sf = { ok: true, track: { title: "Blinding Lights", artist: "The Weeknd", art: "https://i.scdn.co/image/x", playing: true } }, nSf = 0;
  mock("/functions/v1/music?statsfm=", () => { nSf++; return typeof sf === "function" ? sf() : sf; });
  mock("/functions/v1/music?lastfm=", () => ({ ok: true, track: null }));
  try {
    await setMusic({ src: "auto", sfUser: "rayane", user: "rayane_b" });
    assert.deepEqual(autoSources(), ["apple", "statsfm", "lastfm"]);
    // Apple Music en pause, stats.fm qui joue : celui qui joue gagne
    assert.deepEqual([nowPlaying().title, nowPlaying().src, nowPlaying().playing], ["Blinding Lights", "statsfm", true]);
    assert.equal(appleState(), "authorized");
    // au rythme régulier, les sources en ligne ne sont relues que toutes les 15 s ; une lecture demandée les relit
    const before = nSf;
    await poll(false);
    assert.equal(nSf, before, "stats.fm pas relu tout de suite");
    // l'iPhone joue maintenant, stats.fm ne dit plus rien
    apple = { ...apple, playing: true };
    sf = { ok: true, track: null };
    await poll();
    assert.equal(nSf, before + 1);
    assert.deepEqual([nowPlaying().title, nowPlaying().src], ["Numb", "apple"]);
    // un compte en erreur (profil qui cache son écoute) : noté pour les réglages, la musique de l'iPhone continue
    sf = () => new Response(JSON.stringify({ ok: false, error: "PRIVATE" }), { status: 403 });
    await poll();
    assert.equal(musicErrors().statsfm, "PRIVATE");
    assert.equal(nowPlaying().src, "apple");
    // accès à Apple Music refusé : noté aussi
    apple = { denied: true, status: "denied", playing: false };
    await poll();
    assert.deepEqual([musicErrors().apple, appleState()], ["DENIED", "denied"]);
    // stats.fm caché et Apple Music refusé : plus rien à afficher (pas de délai de grâce pour une erreur définitive)
    assert.equal(nowPlaying(), null);
  } finally { delete globalThis.window; _reset(); }
});

test("connexion toute seule : jamais réglée, la musique suit le téléphone ; l'app iPhone demande l'accès une seule fois", async () => {
  reset();
  assert.equal(musicSource(), "auto", "jamais réglée : automatique");
  await setMusic({ src: "" });
  assert.equal(musicSource(), "", "coupée : elle le reste");
  // site web : rien à demander
  state.profile.music = {};
  assert.equal(await autoAsk(), "");
  // app iPhone : l'accès à l'app Musique est demandé tout seul, une fois
  const asks = [];
  let allowed = false; // l'iPhone : rien avant l'autorisation, le morceau en cours après
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { Greatness: { musicNow: async ({ ask }) => {
    asks.push(ask);
    if (ask) allowed = true;
    return allowed ? { status: "authorized", title: "Numb", artist: "Linkin Park", playing: true, art: "data:image/jpeg;base64,AA" } : { status: "notDetermined", playing: false };
  } } } } };
  try {
    assert.equal(await autoAsk(), "authorized");
    assert.equal(state.profile.music.asked, true);
    assert.ok(asks.includes(true));
    await poll();
    assert.deepEqual([nowPlaying()?.title, nowPlaying()?.src], ["Numb", "apple"]);
    const n = asks.filter(Boolean).length;
    assert.equal(await autoAsk(), "", "déjà demandé : plus jamais tout seul");
    assert.equal(asks.filter(Boolean).length, n);
    // un choix manuel ou une musique coupée : rien n'est demandé
    state.profile.music = { src: "manual" };
    assert.equal(await autoAsk(), "");
  } finally { delete globalThis.window; _reset(); }
});

test("choix manuel : l'ambiance choisie, sans réseau ; aucune source : rien", async () => {
  reset();
  await setMusic({ src: "manual", pick: { title: "Blinding Lights", artist: "The Weeknd", art: "https://is1-ssl.mzstatic.com/x/600x600bb.jpg" } });
  assert.deepEqual([nowPlaying().title, nowPlaying().src, nowPlaying().playing], ["Blinding Lights", "manual", true]);
  await setMusic({ src: "" });
  assert.equal(nowPlaying(), null);
  await startMusic();
  assert.equal(nowPlaying(), null);
  reset();
  globalThis.fetch = realFetch;
});
