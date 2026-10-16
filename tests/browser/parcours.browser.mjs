// Parcours complet dans un iPhone simulé, compte sur l'appareil : création du compte, tous les onglets, une séance
// jusqu'à la fin, la carte de séance à partager, l'historique, puis Face ID (activation et déverrouillage).
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, closeSheets, sleep } from "./kit.mjs";

test("parcours : onglets, séance, carte à partager, Face ID", { timeout: 180000 }, async () => {
  const app = await openApp({ webauthn: true });
  const { page, errors } = app;
  try {
    await signup(page, "nina", "2468");
    await seed(page);

    // tous les onglets s'affichent
    for (const h of ["#/", "#/train", "#/create", "#/coach", "#/food", "#/progress", "#/profile", "#/"]) {
      await go(page, h);
      const len = await page.$eval("#view", e => e.innerText.trim().length);
      assert.ok(len > 40, `écran ${h} vide`);
    }

    // une séance de musculation (onglet Séances → Push) : aperçu, bilan de forme, deux séries, fin
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    await page.click("#start").catch(() => {}); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    await page.click("#log"); await sleep(500);
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.waitForSelector("#log", { timeout: 10000 }); await page.click("#log"); await sleep(500);
    await page.click("#quit"); await sleep(400);
    await page.click('.sheet [data-r="1"]');
    await page.waitForSelector(".live.fin", { timeout: 10000 });
    assert.match(await page.$eval(".done-hero", e => e.innerText), /Mission accomplie/);

    // carte de séance : aperçu au format story
    await page.click("#share-sess");
    await page.waitForSelector(".share-img", { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector(".share-img")?.complete);
    const size = await page.$eval(".share-img", i => [i.naturalWidth, i.naturalHeight]);
    assert.deepEqual(size, [1080, 1920]);
    // le coach est bien dessiné sur la carte (pixels non uniformes au centre)
    const drawn = await page.evaluate(async () => {
      const img = document.querySelector(".share-img"), c = document.createElement("canvas");
      c.width = 1080; c.height = 1920; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(340, 300, 400, 500).data; let min = 255, max = 0;
      for (let i = 0; i < d.length; i += 4) { min = Math.min(min, d[i]); max = Math.max(max, d[i]); }
      return max - min;
    });
    assert.ok(drawn > 60, "coach absent de la carte");
    await closeSheets(page);
    await page.click("#home"); await sleep(600);

    // historique : la séance a son bouton « Partager »
    await go(page, "#/progress");
    const n = await page.$$eval("[data-share]", b => b.length);
    assert.ok(n >= 1, "pas de bouton Partager dans l'historique");

    // Face ID : activé dans les réglages, puis déverrouillage sans le code
    await go(page, "#/profile");
    await page.waitForSelector("#bio-row:not(.hidden)", { timeout: 5000 });
    assert.match(await page.$eval("#bio-row", e => e.innerText), /Face ID/);
    await page.click("#bio-row");
    await page.waitForFunction(async () => { const { registry } = await import("/js/cloud.js"); return !!registry().nina?.bio?.id; }, null, { timeout: 8000 });
    await page.evaluate(() => { window.__lock = false; new MutationObserver(() => { if (document.querySelector(".keypad")) window.__lock = true; }).observe(document.body, { subtree: true, childList: true }); });
    await page.click("#acc-lock");
    // Face ID est proposé tout de suite à l'écran du code (sinon par le bouton) : l'app se rouvre sans taper le code
    const first = await page.waitForSelector("#bio:not(.hidden), #acc-lock", { timeout: 10000 });
    if (await first.evaluate(e => e.id === "bio")) { await first.click().catch(() => {}); await page.waitForSelector("#acc-lock", { timeout: 10000 }); }
    assert.equal(await page.evaluate(() => window.__lock), true, "l'écran du code ne s'est pas affiché");
    assert.equal(await page.$(".keypad"), null);
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).currentUser), "nina");
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
