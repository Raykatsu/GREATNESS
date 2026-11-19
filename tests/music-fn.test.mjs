// Fonction Supabase « music » (supabase/functions/music/index.ts) : morceau en cours d'un compte Last.fm (clé secrète,
// pochette générique remplacée par celle du catalogue iTunes, erreurs lisibles, cache de 10 s) et relais des pochettes
// (hôtes connus seulement, images seulement, autorisation CORS).
import test from "node:test";
import assert from "node:assert/strict";

let handler;
const env = {};
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
let calls = [];
const replies = {};
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push(u);
  for (const [k, fn] of Object.entries(replies)) if (u.includes(k)) return fn(u, opts);
  return new Response("?", { status: 404 });
};
console.error = () => {};
const { parseLastfm, coverAllowed, USER_RE, tempoOk } = await import(new URL("../supabase/functions/music/index.ts", import.meta.url));
const call = async qs => { const res = await handler(new Request(`https://fn.test/music${qs}`)); return { res, body: await res.text() }; };

const PLACE = "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
const nowFm = (art = "https://lastfm.freetls.fastly.net/i/u/300x300/cover.jpg") => ({ recenttracks: { track: [
  { name: "Numb", artist: { "#text": "Linkin Park" }, album: { "#text": "Meteora" }, url: "https://www.last.fm/music/x", "@attr": { nowplaying: "true" },
    image: [{ "#text": "https://lastfm.freetls.fastly.net/i/u/34s/c.jpg", size: "small" }, { "#text": art, size: "extralarge" }] },
  { name: "Ancien", artist: { "#text": "Quelqu'un" } }] } });

test("Last.fm : seul le morceau en cours compte ; pochette générique ignorée", () => {
  assert.deepEqual(parseLastfm(nowFm()), { title: "Numb", artist: "Linkin Park", album: "Meteora", art: "https://lastfm.freetls.fastly.net/i/u/300x300/cover.jpg", playing: true, url: "https://www.last.fm/music/x" });
  assert.equal(parseLastfm({ recenttracks: { track: [{ name: "Ancien", artist: { "#text": "X" } }] } }), null, "déjà écouté : pas en cours");
  assert.equal(parseLastfm(nowFm(PLACE)).art, "https://lastfm.freetls.fastly.net/i/u/34s/c.jpg", "l'étoile grise n'est pas une pochette");
  assert.equal(parseLastfm({}), null);
  assert.ok(USER_RE.test("rayane_b") && !USER_RE.test("../x") && !USER_RE.test("a"));
});

test("pochettes : seulement des hôtes connus, en https", () => {
  for (const u of ["https://i.scdn.co/image/ab67", "https://lastfm.freetls.fastly.net/i/u/x.jpg", "https://is3-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg", "https://cdn-images.dzcdn.net/images/cover/x.jpg"])
    assert.ok(coverAllowed(u), u);
  for (const u of ["http://i.scdn.co/image/x", "https://example.com/x.jpg", "https://i.scdn.co.evil.com/x", "https://user@i.scdn.co/x", "https://i.scdn.co:8443/x", "file:///etc/passwd", "pas une adresse"])
    assert.ok(!coverAllowed(u), u);
});

test("?lastfm= : sans clé, pseudo invalide ou inconnu, quota, morceau en cours (pochette retrouvée sur iTunes), cache", async () => {
  delete env.LASTFM_API_KEY;
  assert.match((await call("?lastfm=rayane_b")).body, /NO_KEY/);
  env.LASTFM_API_KEY = "cle-secrete";
  const bad = await call("?lastfm=..%2Fx");
  assert.equal(bad.res.status, 400);
  replies["ws.audioscrobbler.com"] = u => Response.json(u.includes("user=inconnu") ? { error: 6, message: "User not found" } : u.includes("user=quota") ? { error: 29 } : nowFm(PLACE.replace("300x300", "174s")));
  replies["itunes.apple.com/search"] = () => Response.json({ results: [{ artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg" }] });
  const unk = await call("?lastfm=inconnu");
  assert.equal(unk.res.status, 404);
  assert.match(unk.body, /USER_NOT_FOUND/);
  assert.match((await call("?lastfm=quota")).body, /RATE_LIMIT/);
  // pas de vraie pochette chez Last.fm (que l'étoile grise) : celle du catalogue iTunes, en grand
  replies["ws.audioscrobbler.com"] = () => Response.json({ recenttracks: { track: [{ name: "Numb", artist: { "#text": "Linkin Park" }, "@attr": { nowplaying: "true" }, image: [{ "#text": PLACE }] }] } });
  calls = [];
  const ok = await call("?lastfm=rayane_b");
  assert.equal(ok.res.status, 200);
  assert.equal(ok.res.headers.get("access-control-allow-origin"), "*");
  const j = JSON.parse(ok.body);
  assert.deepEqual([j.ok, j.track.title, j.track.art], [true, "Numb", "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg"]);
  assert.ok(calls.some(u => u.includes("api_key=cle-secrete")), "la clé reste côté serveur");
  assert.ok(!ok.body.includes("cle-secrete"));
  // deuxième demande dans les 10 s : servie depuis le cache
  calls = [];
  await call("?lastfm=RAYANE_B");
  assert.equal(calls.length, 0);
});

test("?cover= : image d'un hôte connu relayée avec CORS ; le reste refusé", async () => {
  replies["i.scdn.co"] = u => (u.includes("pas-image") ? new Response("<html>", { headers: { "content-type": "text/html" } })
    : u.includes("enorme") ? new Response(new Uint8Array(2_100_000), { headers: { "content-type": "image/jpeg" } })
    : new Response(new Uint8Array([255, 216, 255, 224]), { headers: { "content-type": "image/jpeg" } }));
  const ok = await call(`?cover=${encodeURIComponent("https://i.scdn.co/image/ab67")}`);
  assert.equal(ok.res.status, 200);
  assert.equal(ok.res.headers.get("content-type"), "image/jpeg");
  assert.equal(ok.res.headers.get("access-control-allow-origin"), "*");
  assert.match(ok.res.headers.get("cache-control"), /max-age/);
  assert.equal((await call(`?cover=${encodeURIComponent("https://example.com/x.jpg")}`)).res.status, 400);
  assert.equal((await call(`?cover=${encodeURIComponent("https://i.scdn.co/pas-image")}`)).res.status, 502);
  assert.equal((await call(`?cover=${encodeURIComponent("https://i.scdn.co/enorme")}`)).res.status, 413);
});

test("adresse seule : la fonction se présente (version, clé présente ou non) ; préflight CORS", async () => {
  env.LASTFM_API_KEY = "x";
  assert.match((await call("")).body, /fonction musique en ligne \(music-2, Last\.fm prêt\)/);
  delete env.LASTFM_API_KEY;
  assert.match((await call("")).body, /clé Last\.fm absente/);
  const pre = await handler(new Request("https://fn.test/music", { method: "OPTIONS" }));
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
});

test("?bpm= : tempo par ISRC, sinon par artiste et titre (catalogue Deezer) ; inconnu ou absurde : 0 ; gardé en mémoire", async () => {
  assert.deepEqual([tempoOk(127.6), tempoOk(0), tempoOk(400), tempoOk("x")], [128, 0, 0, 0]);
  replies["api.deezer.com/track/isrc:USIR10211559"] = () => Response.json({ id: 1, bpm: 171.2 });
  replies["api.deezer.com/search/track"] = u => Response.json({ data: decodeURIComponent(u).includes('artist:"Inconnu"') ? [] : [{ id: 42 }] });
  replies["api.deezer.com/track/42"] = () => Response.json({ id: 42, bpm: 98 });
  const byIsrc = await call("?bpm=1&isrc=usir10211559&artist=Eminem&title=Till%20I%20Collapse");
  assert.deepEqual(JSON.parse(byIsrc.body), { ok: true, bpm: 171 });
  assert.deepEqual(JSON.parse((await call("?bpm=1&artist=Daft%20Punk&title=One%20More%20Time")).body), { ok: true, bpm: 98 });
  assert.deepEqual(JSON.parse((await call("?bpm=1&artist=Inconnu&title=Rien")).body), { ok: true, bpm: 0 });
  assert.equal((await call("?bpm=1")).res.status, 400);
  calls = [];
  await call("?bpm=1&artist=Daft%20Punk&title=One%20More%20Time");
  assert.equal(calls.length, 0, "déjà connu : pas de nouvel appel");
});
