// Périodisation, dans un iPhone simulé : en 4e semaine du cycle (bloc Force), l'onglet Progrès montre la carte « Ton
// cycle » (7 semaines, bloc en cours, prochain bloc) et l'aperçu d'une séance rappelle le bloc ; en 6e semaine (Pic),
// la fourchette des mouvements principaux descend. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, sleep } from "./kit.mjs";

test("cycle : carte « Ton cycle », bloc dans l'aperçu de séance, fourchette du bloc Pic", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "cycle", "1357");
    await seed(page);
    const setWeek = k => page.evaluate(async k => {
      const { state, save } = await import("/js/store.js");
      state.cycleStart = Date.now() - ((k - 1) * 7 + 2) * 864e5; state.profile.goal = "muscle"; save();
    }, k);
    await setWeek(4);
    await go(page, "#/progress");
    await page.waitForSelector("#cycle-card", { timeout: 10000 });
    const card = await page.$eval("#cycle-card", e => e.innerText);
    assert.match(card, /Force/);
    assert.match(card, /Ensuite/);
    assert.match(await page.$eval("#cycle-card", e => e.previousElementSibling.innerText), /semaine 4 sur 7/);
    assert.equal(await page.$$eval("#cycle-card .cy-bar i", l => l.length), 7);
    // aperçu d'une séance : le bloc en cours
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    assert.match(await page.$eval(".pv-cycle", e => e.innerText), /Bloc Force/);
    await page.keyboard.press("Escape"); await sleep(400);
    // bloc Pic : 4 à 8 reps sur le premier mouvement principal
    await setWeek(6);
    await go(page, "#/progress"); await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    assert.match(await page.$eval(".pv-cycle", e => e.innerText), /Bloc Pic/);
    assert.match(await page.$eval(".pv-ex", e => e.innerText), /4[–-]8|4 à 8/);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
