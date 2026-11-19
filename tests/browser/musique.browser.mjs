// Musique dans un iPhone simulé (serveur Supabase simulé) : on relie Last.fm, le morceau en cours arrive, l'app prend
// les couleurs de la pochette (lue par le relais de la fonction « music », l'image directe n'étant pas lisible) avec
// la pochette floutée en décor ; carte « En écoute » de l'accueil ; nouveau morceau = nouvelles couleurs ; le lecteur
// pendant la séance, la bande-son en fin de séance ; choix manuel par la recherche iTunes ; musique coupée = couleurs
// d'origine. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep, closeSheets, png } from "./kit.mjs";

const GREEN = png(24, 24, x => (x < 8 ? [40, 210, 90] : [14, 20, 48]));   // bleu nuit avec une bande verte vive
const PINK = png(24, 24, (x, y) => (y < 15 ? [230, 40, 160] : [30, 10, 40])); // rose vif
const hueOf = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.trim().slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const accent = page => page.evaluate(() => document.documentElement.style.getPropertyValue("--red"));

test("musique : Last.fm, couleurs et décor de la pochette, accueil, séance et bande-son, choix manuel", { timeout: 180000 }, async () => {
  const app = await openApp({ online: true });
  const { page, errors } = app;
  let track = { title: "Numb", artist: "Linkin Park", album: "Meteora", art: "https://covers.test/green.png", playing: true };
  const relayed = [];
  // la fonction « music » simulée : morceau en cours d'un compte Last.fm, et relais des pochettes (avec CORS)
  await page.route("**/functions/v1/music**", r => {
    const u = new URL(r.request().url());
    if (u.searchParams.has("lastfm")) return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, track }) });
    // le catalogue iTunes, lu par la fonction (choix manuel)
    if (u.searchParams.has("search")) return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ ok: true, results: u.searchParams.get("search") === "pink" ? [{ trackName: "Pink Song", artistName: "Artiste", collectionName: "Album", artworkUrl100: "https://covers.test/pink/100x100bb.png" }] : [] }) });
    const c = u.searchParams.get("cover") || "";
    relayed.push(c);
    return r.fulfill({ contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: c.includes("pink") ? PINK : GREEN });
  });
  // les pochettes d'origine : affichables, mais pas lisibles par l'app (un site tiers sans autorisation CORS : une
  // demande de lecture, avec l'en-tête Origin, est refusée)
  await page.route("https://covers.test/**", r => (r.request().headers().origin ? r.fulfill({ status: 403, body: "" })
    : r.fulfill({ contentType: "image/png", body: r.request().url().includes("pink") ? PINK : GREEN })));
  try {
    await signup(page, "musique", "1357");
    await go(page, "#/");
    const before = await accent(page);
    // invitation sur l'accueil → réglages Musique → Last.fm
    await page.waitForSelector("#music-home.m-invite");
    await page.click("#music-go");
    await page.waitForSelector(".m-sheet");
    // une seule façon de relier sa musique : ce que joue le téléphone (automatique), avec ses comptes
    assert.equal(await page.$eval('.m-src[data-src="auto"]', b => b.classList.contains("on")), true);
    assert.match(await page.$eval(".m-wait", e => e.innerText), /Relie un de tes comptes/);
    await page.fill("#ms-user", "rayane_b");
    await page.click("#ms-user-save");
    await page.waitForSelector(".m-prev", { timeout: 10000 });
    assert.match(await page.$eval(".m-prev", e => e.innerText), /Numb[\s\S]*Linkin Park/);
    // couleurs de la pochette : l'accent devient le vert de la pochette, la pochette floutée en décor
    await page.waitForFunction(() => document.documentElement.classList.contains("music-tint"), null, { timeout: 10000 });
    const green = await accent(page);
    assert.notEqual(green, before);
    assert.ok(hueOf(green) > 100 && hueOf(green) < 170, `accent vert attendu : ${green}`);
    assert.ok(relayed.includes("https://covers.test/green.png"), "pochette illisible directement : relais de la fonction");
    assert.match(await page.$eval(".m-cover i.on", i => i.style.backgroundImage), /covers\.test\/green\.png/);
    assert.equal(await page.$$eval(".m-prev .m-sw i", l => l.length), 4);
    await closeSheets(page);

    // carte « En écoute » de l'accueil
    await go(page, "#/profile"); await go(page, "#/");
    assert.match(await page.$eval("#music-home.m-now", e => e.innerText), /En écoute · Last\.fm[\s\S]*Numb[\s\S]*Linkin Park/i);
    // nouveau morceau : nouvelles couleurs, carte mise à jour sur place
    track = { title: "Rose", artist: "Artiste", art: "https://covers.test/pink.png", playing: true };
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => /Rose/.test(document.querySelector("#music-home")?.innerText || ""), null, { timeout: 10000 });
    await page.waitForFunction(g => document.documentElement.style.getPropertyValue("--red") !== g, green, { timeout: 10000 });
    const pink = await accent(page);
    assert.ok(hueOf(pink) > 290 && hueOf(pink) < 340, `accent rose attendu : ${pink}`);

    // en séance : le lecteur, puis la bande-son en fin de séance
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    await page.click("#start").catch(() => {}); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    assert.match(await page.$eval("#music-bar", e => e.innerText), /Rose/);
    await page.click("#log"); await sleep(500);
    track = { title: "Numb", artist: "Linkin Park", art: "https://covers.test/green.png", playing: true };
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => /Numb/.test(document.querySelector("#music-bar")?.innerText || ""), null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.waitForSelector("#log", { timeout: 10000 }); await page.click("#log"); await sleep(500);
    await page.click("#quit"); await sleep(400);
    await page.click('.sheet [data-r="1"]');
    await page.waitForSelector(".live.fin .m-sound", { timeout: 10000 });
    assert.match(await page.$eval(".m-sound", e => e.innerText), /Bande-son de la séance[\s\S]*Rose[\s\S]*Numb/i);
    const saved = await page.evaluate(async () => { const { state } = await import("/js/store.js"); const s = state.sessions.at(-1); return { music: s.music.map(m => m.title), songs: s.sets.map(x => x.song) }; });
    assert.deepEqual(saved.music, ["Rose", "Numb"]);
    assert.deepEqual(saved.songs, [0, 1], "chaque série retient le morceau qui passait");
    await page.click("#home"); await sleep(600);

    // choix manuel : un morceau cherché dans le catalogue iTunes
    await go(page, "#/profile");
    await page.click("#p-music");
    await page.click('.m-src[data-src="manual"]');
    await page.fill("#ms-q", "pink");
    await page.click("#ms-form button");
    await page.waitForSelector(".m-res");
    await page.click(".m-res");
    await page.waitForFunction(() => /Pink Song/.test(document.querySelector(".m-prev")?.innerText || ""), null, { timeout: 10000 });
    assert.match(await page.$eval(".m-prev", e => e.innerText), /Ambiance · Choix manuel/i);
    // couper la musique : couleurs d'origine, plus de décor
    await page.click("#ms-off"); await sleep(400);
    await page.waitForFunction(() => !document.documentElement.classList.contains("music-tint"), null, { timeout: 5000 });
    assert.equal(await accent(page), before);
    assert.equal(await page.$$eval(".m-cover i.on", l => l.length), 0);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test("musique : stats.fm, lien du profil collé, morceau en cours et ses couleurs, profil qui cache son écoute", { timeout: 120000 }, async () => {
  const app = await openApp({ online: true });
  const { page, errors } = app;
  const CORS = { "access-control-allow-origin": "*" };
  let reply = { ok: true, track: { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", art: "https://covers.test/pink.png", playing: true } };
  const asked = [];
  // la fonction « music » simulée : morceau en cours d'un profil stats.fm, relais des pochettes
  await page.route("**/functions/v1/music**", r => {
    const u = new URL(r.request().url());
    if (u.searchParams.has("statsfm")) {
      asked.push(u.searchParams.get("statsfm"));
      return r.fulfill({ status: reply.ok ? 200 : 403, contentType: "application/json", headers: CORS, body: JSON.stringify(reply) });
    }
    return r.fulfill({ contentType: "image/png", headers: CORS, body: PINK });
  });
  await page.route("https://covers.test/**", r => r.fulfill({ contentType: "image/png", headers: CORS, body: PINK }));
  try {
    await signup(page, "statsfm", "1357");
    await go(page, "#/profile");
    await page.click("#p-music");
    // un pseudo impossible : refusé sans rien demander
    await page.fill("#ms-sf", "a");
    await page.click("#ms-sf-save");
    await page.waitForSelector("#toast.show");
    assert.deepEqual(asked, []);
    // le lien du profil, collé tel quel
    await page.fill("#ms-sf", "https://stats.fm/rayane?ref=share");
    await page.click("#ms-sf-save");
    await page.waitForFunction(() => /Blinding Lights/.test(document.querySelector(".m-prev")?.innerText || ""), null, { timeout: 10000 });
    assert.equal(asked[0], "rayane");
    assert.match(await page.$eval(".m-prev", e => e.innerText), /En écoute · stats\.fm/i);
    await page.waitForFunction(() => document.documentElement.classList.contains("music-tint"), null, { timeout: 10000 });
    const pink = await accent(page);
    assert.ok(hueOf(pink) > 290 && hueOf(pink) < 340, `accent rose attendu : ${pink}`);
    // le profil cache son écoute : le morceau disparaît, l'explication s'affiche
    reply = { ok: false, error: "PRIVATE" };
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => /cache ce que tu écoutes/.test(document.querySelector('[data-err="statsfm"]')?.innerText || ""), null, { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector(".m-prev"), null, { timeout: 5000 }); // son morceau n'est plus affiché
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test("musique : l'ambiance du morceau change tout le thème (formes, titres, battement au tempo), réglage pour la couper", { timeout: 150000 }, async () => {
  const app = await openApp({ online: true, reducedMotion: "no-preference" });
  const { page, errors } = app;
  const CORS = { "access-control-allow-origin": "*" };
  let track = { title: "Numb", artist: "Linkin Park", art: "https://covers.test/green.png", playing: true };
  // la fonction « music » simulée : morceau en cours (Last.fm), tempo (Deezer), relais des pochettes ; genre (iTunes)
  await page.route("**/functions/v1/music**", r => {
    const u = new URL(r.request().url());
    if (u.searchParams.has("lastfm")) return r.fulfill({ contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, track }) });
    if (u.searchParams.has("bpm")) return r.fulfill({ contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, bpm: u.searchParams.get("title") === "Numb" ? 110 : 76 }) });
    // le genre du morceau : catalogue iTunes, lu par la fonction
    if (u.searchParams.has("search")) return r.fulfill({ contentType: "application/json", headers: CORS,
      body: JSON.stringify({ ok: true, results: [{ trackName: "x", primaryGenreName: /Numb/.test(u.searchParams.get("search")) ? "Hard Rock" : "R&B/Soul" }] }) });
    return r.fulfill({ contentType: "image/png", headers: CORS, body: GREEN });
  });
  await page.route("https://covers.test/**", r => r.fulfill({ contentType: "image/png", headers: CORS, body: GREEN }));
  const css = (v, el = "documentElement") => page.evaluate(([v, el]) => getComputedStyle(document[el]).getPropertyValue(v).trim(), [v, el]);
  const vibe = () => page.evaluate(() => document.documentElement.dataset.vibe || "");
  try {
    await signup(page, "ambiance", "1357");
    const radius = await css("--r");
    await go(page, "#/profile");
    await page.click("#p-music");
    await page.fill("#ms-user", "rayane_b");
    await page.click("#ms-user-save");
    // du rock à 110 BPM : ambiance intense — angles vifs, battement à 0,545 s pendant qu'il joue
    await page.waitForFunction(() => document.documentElement.dataset.vibe === "intense", null, { timeout: 15000 });
    assert.equal(await css("--r"), "12px");
    assert.notEqual(radius, "12px");
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--beat")), "0.545s");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("music-playing")), true);
    await page.waitForSelector("#ms-vibe-now");
    assert.match(await page.$eval("#ms-vibe-now", e => e.innerText), /Ambiance\s*:\s*Intense\s*·\s*110 BPM/i);
    // de la soul lente : ambiance chill — arrondis doux, mouvements lents
    track = { title: "Douceur", artist: "Artiste", art: "https://covers.test/green.png", playing: true };
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => document.documentElement.dataset.vibe === "chill", null, { timeout: 15000 });
    assert.equal(await css("--r"), "30px");
    assert.equal(await css("--dur-4"), "620ms");
    // en pause : plus de battement, l'ambiance reste
    track = { ...track, playing: false };
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => !document.documentElement.classList.contains("music-playing"), null, { timeout: 10000 });
    assert.equal(await vibe(), "chill");
    // ambiance coupée : l'app reprend son allure habituelle, les couleurs de la pochette restent
    await page.$eval("#ms-vibe", e => e.click());
    await page.waitForFunction(() => !document.documentElement.dataset.vibe, null, { timeout: 5000 });
    assert.equal(await css("--r"), radius);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("music-tint")), true);
    assert.equal(await page.$("#ms-vibe-now"), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test("musique : tes morceaux de records dans l'onglet Progrès, la playlist à copier ou écouter", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors, ctx } = app;
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  try {
    await signup(page, "records", "1357");
    // trois séances : la première sert de référence ; sur « Numb », deux records et des séries plus lourdes
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      const NUMB = { title: "Numb", artist: "Linkin Park", src: "lastfm" }, SOFT = { title: "Douceur", artist: "Artiste", src: "lastfm" };
      const set = (exId, name, weight, reps, song) => ({ exId, name, weight, reps, rpe: 8, song });
      const H = 864e5, now = Date.now();
      state.sessions.push(
        { id: "a", date: now - 3 * H, name: "Push", programId: "push", durationSec: 3000, volume: 3000, prs: [], xp: 80, music: [SOFT], sets: [set("bench", "Développé couché", 60, 8, 0), set("squat", "Squat", 80, 8, 0)] },
        { id: "b", date: now - 2 * H, name: "Push", programId: "push", durationSec: 3000, volume: 3000, prs: ["bench", "squat"], xp: 80, music: [NUMB, SOFT],
          sets: [set("bench", "Développé couché", 65, 8, 0), set("squat", "Squat", 85, 8, 0), set("bench", "Développé couché", 55, 8, 1), set("squat", "Squat", 70, 8, 1)] },
        { id: "c", date: now - H, name: "Push", programId: "push", durationSec: 3000, volume: 3000, prs: [], xp: 80, music: [NUMB, SOFT],
          sets: [set("bench", "Développé couché", 64, 8, 0), set("squat", "Squat", 60, 8, 1), set("bench", "Développé couché", 50, 8, 1)] });
      save();
    });
    await go(page, "#/progress");
    await page.waitForSelector(".songs-card");
    const card = await page.$eval(".songs-card", e => e.innerText);
    assert.match(card, /Numb[\s\S]*Linkin Park[\s\S]*🏆\s*2\s*records[\s\S]*\+\d+ %\s*d'intensité[\s\S]*3\s*séries[\s\S]*Douceur/);
    // la playlist : à copier, à écouter dans Spotify ou Apple Music
    await page.click("#songs-all");
    await page.waitForSelector(".songs-sheet");
    assert.deepEqual(await page.$$eval(".songs-sheet .song-row .m-txt > b", l => l.map(b => b.textContent)), ["Numb"]);
    assert.equal(await page.getAttribute(".songs-sheet .song-go a", "href"), "https://open.spotify.com/search/Linkin%20Park%20Numb");
    await page.click("#songs-copy");
    await page.waitForFunction(() => /Liste copiée/.test(document.querySelector("#toast")?.textContent || ""));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "1. Numb — Linkin Park");
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test("musique : ta chanson de guerre, choisie dans le catalogue, proposée avant ta série lourde, une fois", { timeout: 150000 }, async () => {
  const app = await openApp({ online: true });
  const { page, errors } = app;
  const CORS = { "access-control-allow-origin": "*" };
  await page.route("**/functions/v1/music**", r => {
    const u = new URL(r.request().url());
    if (u.searchParams.has("search")) return r.fulfill({ contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, results: [
      { trackName: "Till I Collapse", artistName: "Eminem", collectionName: "The Eminem Show", artworkUrl100: "https://covers.test/war/100x100bb.png", trackViewUrl: "https://music.apple.com/fr/album/x?i=1" }] }) });
    return r.fulfill({ status: 404, headers: CORS, body: "{}" });
  });
  await page.route("https://covers.test/**", r => r.fulfill({ contentType: "image/png", headers: CORS, body: PINK }));
  try {
    await signup(page, "guerre", "1357");
    // le réglage : chercher et choisir sa chanson de guerre
    await go(page, "#/profile");
    await page.click("#p-music");
    await page.fill("#ms-war-q", "collapse");
    await page.click("#ms-war-f button");
    await page.waitForSelector("#ms-war-res [data-w]");
    await page.click("#ms-war-res [data-w]");
    await page.waitForSelector(".m-war-now");
    assert.match(await page.$eval(".m-war-now", e => e.innerText), /Till I Collapse[\s\S]*Eminem/);
    assert.deepEqual(await page.evaluate(async () => (await import("/js/store.js")).state.profile.music.war),
      { title: "Till I Collapse", artist: "Eminem", art: "https://covers.test/war/600x600bb.png", url: "https://music.apple.com/fr/album/x?i=1" });
    await closeSheets(page);
    // un développé couché déjà fait à 60 kg × 8 : la première série prévue est à ton meilleur niveau
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.lifts.bench = { weight: 60, reps: 8, best: 76, date: Date.now() - 2 * 864e5 }; save(); });
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    await page.click("#start").catch(() => {}); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    await page.waitForSelector("#war");
    assert.match(await page.$eval("#war", e => e.innerText), /c'est le moment de ta chanson de guerre[\s\S]*Till I Collapse — Eminem/);
    // « Lancer » : sans Spotify connecté, le morceau s'ouvre dans Apple Music ; le moment ne revient plus
    await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
    await page.click("#war-go");
    await page.waitForSelector("#war", { state: "detached" });
    assert.deepEqual(await page.evaluate(() => window.__opened), ["https://music.apple.com/fr/album/x?i=1"]);
    await page.click("#log"); await sleep(500);
    assert.equal(await page.$("#war"), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
