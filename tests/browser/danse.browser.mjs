// Le mannequin qui danse, dans un iPhone simulé (serveur Supabase simulé) : depuis la carte « En écoute », au tempo
// du morceau (fonction « music », ?bpm=), tempo tapé en rythme et gardé pour ce morceau ; tout seul sur l'accueil quand
// on ne touche plus l'écran pendant que la musique joue (pas sur les autres onglets), refermé d'un toucher ; réglage
// pour l'éviter. Puis l'app qui garde les
// couleurs du dernier morceau quand la musique s'arrête, même après un redémarrage sans réseau. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { openApp, signup, go, sleep, closeSheets, png, ROOT } from "./kit.mjs";

const GREEN = png(24, 24, x => (x < 8 ? [40, 210, 90] : [14, 20, 48])); // bleu nuit avec une bande verte vive
const CORS = { "access-control-allow-origin": "*" };
const hueOf = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.trim().slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const accent = page => page.evaluate(() => document.documentElement.style.getPropertyValue("--red"));
const tinted = page => page.evaluate(() => document.documentElement.classList.contains("music-tint"));
const chip = page => page.$eval("#dc-bpm", e => e.textContent.trim());
// accessibilité (axe-core, WCAG 2.1 A et AA) d'une partie de l'écran
const AXE = path.join(ROOT, "node_modules/axe-core/axe.min.js");
async function audit(page, sel) {
  await page.addScriptTag({ path: AXE }).catch(() => {});
  return page.evaluate(async s => (await window.axe.run(s, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }))
    .violations.map(v => `${v.id} : ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`), sel);
}

test("danse : le mannequin danse au tempo du morceau, tout seul quand on ne fait rien ; les couleurs restent", { timeout: 240000 }, async () => {
  // animations permises : sinon le mannequin ne se lève jamais tout seul
  const app = await openApp({ online: true, reducedMotion: "no-preference" });
  const { page, errors } = app;
  let track = { title: "Numb", artist: "Linkin Park", album: "Meteora", art: "https://covers.test/green.png", playing: true }, down = false;
  const tempoAsked = [];
  // la fonction « music » simulée : morceau en cours (Last.fm), tempo du morceau, relais des pochettes
  await page.route("**/functions/v1/music**", r => {
    const u = new URL(r.request().url());
    if (down) return r.fulfill({ status: 503, contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: false, error: "ERROR" }) });
    if (u.searchParams.has("lastfm")) return r.fulfill({ contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, track }) });
    if (u.searchParams.has("bpm")) {
      tempoAsked.push(`${u.searchParams.get("artist")} – ${u.searchParams.get("title")}`);
      return r.fulfill({ contentType: "application/json", headers: CORS, body: JSON.stringify({ ok: true, bpm: u.searchParams.get("title") === "Numb" ? 110 : 0 }) });
    }
    return r.fulfill({ contentType: "image/png", headers: CORS, body: GREEN });
  });
  await page.route("https://covers.test/**", r => r.fulfill({ contentType: "image/png", headers: CORS, body: GREEN }));
  try {
    await signup(page, "danse", "1357");
    await go(page, "#/");
    const before = await accent(page);
    // Last.fm relié : le morceau en cours, ses couleurs
    await page.click("#music-go");
    await page.fill("#ms-user", "rayane_b");
    await page.click("#ms-user-save");
    await page.waitForSelector(".m-prev", { timeout: 10000 });
    await page.waitForFunction(() => document.documentElement.classList.contains("music-tint"), null, { timeout: 10000 });
    const green = await accent(page);
    assert.ok(hueOf(green) > 100 && hueOf(green) < 170, `accent vert attendu : ${green}`);
    await closeSheets(page);

    // la carte « En écoute » : le bouton qui fait danser le mannequin
    await go(page, "#/profile"); await go(page, "#/");
    assert.deepEqual(await audit(page, "#music-home"), [], "carte « En écoute »");
    await page.click("#music-home #music-dance");
    await page.waitForSelector(".dance", { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.body.classList.contains("dancing")), true);
    assert.match(await page.$eval("#dc-song", e => e.innerText), /Numb[\s\S]*Linkin Park/);
    await page.waitForSelector(".dance.ready", { timeout: 40000 }); // le corps 3D chargé
    // le tempo du morceau, demandé à la fonction « music »
    await page.waitForFunction(() => /^110 BPM$/.test(document.querySelector("#dc-bpm")?.textContent.trim() || ""), null, { timeout: 10000 });
    assert.deepEqual(tempoAsked, ["Linkin Park – Numb"]);
    assert.deepEqual(await audit(page, ".dance"), [], "écran de la danse");
    // il bouge vraiment : deux images à un instant d'écart diffèrent
    const box = await page.$eval(".dc-cv", c => { const r = c.getBoundingClientRect(); return { x: r.width * 0.2, y: r.height * 0.2, width: r.width * 0.6, height: r.height * 0.55 }; });
    const a = await page.screenshot({ clip: box });
    await sleep(450);
    const b = await page.screenshot({ clip: box });
    assert.ok(!a.equals(b), "le mannequin est immobile");

    // « Tape en rythme » : 6 coups à 0,5 s → 120 BPM, gardé pour ce morceau (images suspendues pendant les coups : le
    // rendu 3D sans carte graphique du navigateur de test retarderait les clics)
    await page.evaluate(() => Object.defineProperty(document, "hidden", { value: true, configurable: true }));
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) { document.querySelector("#dc-tap").click(); await new Promise(r => setTimeout(r, 500)); } });
    await page.evaluate(() => delete document.hidden);
    const tapped = await chip(page);
    const m = tapped.match(/^(\d+) BPM · tapé$/);
    assert.ok(m && +m[1] >= 112 && +m[1] <= 122, `tempo tapé : ${tapped}`);
    const kept = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("greatness.bpm") || "{}")));
    assert.deepEqual(kept.map(k => k.how), ["tap"]);
    assert.equal(kept[0].bpm, +m[1]);
    await page.click("#dc-x");
    await page.waitForSelector(".dance", { state: "detached", timeout: 5000 });
    assert.equal(await page.evaluate(() => document.body.classList.contains("dancing")), false);

    // on ne touche plus l'écran (attente raccourcie pour le test) : il se lève tout seul, au tempo tapé pour ce morceau
    await page.evaluate(() => { window.__danceIdleMs = 1500; });
    await page.waitForSelector(".dance.auto", { timeout: 10000 });
    assert.match(await page.$eval(".dc-hint", e => e.innerText), /Touche l'écran pour revenir/);
    await page.waitForSelector(".dance.auto.ready", { timeout: 40000 });
    assert.equal(await chip(page), tapped);
    assert.equal(tempoAsked.length, 1, "tempo déjà connu : pas redemandé");
    // un toucher n'importe où le referme
    await page.mouse.click(195, 330);
    await page.waitForSelector(".dance", { state: "detached", timeout: 5000 });
    // tout seul seulement sur l'accueil : pas sur un autre onglet (on y lit peut-être quelque chose)
    await go(page, "#/progress");
    await sleep(5000);
    assert.equal(await page.$(".dance"), null, "pas ailleurs que sur l'accueil");

    // réglage « Le mannequin danse » coupé : il ne se lève plus, même sur l'accueil
    await go(page, "#/profile");
    await page.click("#p-music");
    await page.waitForSelector("#ms-dance");
    await page.$eval("#ms-dance", e => e.click());
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.profile.music.dance), false);
    await closeSheets(page);
    await go(page, "#/");
    await sleep(5000);
    assert.equal(await page.$(".dance"), null);

    // la musique s'arrête : l'app garde les couleurs et le décor du dernier morceau
    track = null;
    await page.evaluate(async () => (await import("/js/music.js")).poll());
    await page.waitForFunction(() => !(document.querySelector("#music-home")?.innerText || "").includes("Numb"), null, { timeout: 10000 }).catch(() => {});
    await sleep(600);
    assert.equal(await tinted(page), true);
    assert.equal(await accent(page), green);
    assert.match(await page.$eval(".m-cover i.on", i => i.style.backgroundImage), /covers\.test\/green\.png/);
    // redémarrage de l'app, fonction « music » injoignable : les couleurs reviennent tout de suite
    down = true;
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains("music-tint"), null, { timeout: 15000 });
    assert.equal(await accent(page), green);
    assert.match(await page.$eval(".m-cover i.on", i => i.style.backgroundImage), /covers\.test\/green\.png/);
    // « Garder les couleurs » coupé : couleurs d'origine, plus de décor, rien de gardé
    await go(page, "#/profile");
    await page.click("#p-music");
    await page.waitForSelector("#ms-keep");
    await page.$eval("#ms-keep", e => e.click());
    await page.waitForFunction(() => !document.documentElement.classList.contains("music-tint"), null, { timeout: 5000 });
    assert.equal(await accent(page), before);
    assert.equal(await page.$$eval(".m-cover i.on", l => l.length), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("greatness.musiclook")), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
