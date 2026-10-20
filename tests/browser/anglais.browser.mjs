// Version anglaise : un téléphone réglé en anglais ouvre l'app en anglais (accueil, onglets, écrans, coach), sans
// reste de français visible, et l'on repasse en français depuis les réglages.
import test from "node:test";
import assert from "node:assert/strict";
import { EN_READY } from "../../js/i18n.js";
import { openApp, signup, seed, go, sleep } from "./kit.mjs";

// mots qui trahissent un texte resté en français (hors noms propres, aliments et contenus de l'utilisateur)
const FRENCH = /(^|[^\p{L}])(séances?|séries?|aujourd'hui|réglages|accueil|semaine|objectif|récupération|entraînement|exercices?|avec|dans|très|déjà|les|des|une|tu|ta|tes|mes|ici|encore|plus que)(?=$|[^\p{L}])/iu;

test("version anglaise : écrans traduits sans reste de français, retour au français", { skip: !EN_READY && "version anglaise pas encore livrée" }, async () => {
  const app = await openApp({ locale: "en-US" });
  const { page, errors } = app;
  try {
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    assert.match(await page.textContent("#new"), /account/i);
    await signup(page, "liam", "2468");
    await seed(page);
    const tabs = await page.$$eval(".tabbar a span:last-child", s => s.map(x => x.textContent.trim()));
    assert.deepEqual(tabs, ["Home", "Workouts", "Create", "Meals", "Coach", "Me"]);
    const left = [];
    for (const h of ["#/", "#/train", "#/create", "#/food", "#/coach", "#/progress", "#/profile"]) {
      await go(page, h);
      const lines = await page.evaluate(() => {
        const out = [], w = document.createTreeWalker(document.querySelector("#view"), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && !n.parentElement.closest('[translate="no"], script, style')) out.push(n.data.trim());
        return out;
      });
      for (const l of lines) if (FRENCH.test(l)) left.push(`${h} « ${l.slice(0, 90)} »`);
    }
    assert.deepEqual(left.slice(0, 25), [], `${left.length} textes encore en français`);
    // retour au français depuis Moi → Réglages → Apparence
    await go(page, "#/profile");
    await page.click('#lang [data-v="fr"]');
    await page.waitForFunction(() => document.documentElement.lang === "fr", null, { timeout: 15000 });
    await page.waitForSelector(".tabbar", { timeout: 15000 });
    await sleep(800);
    assert.equal((await page.textContent('.tabbar a[data-tab="home"] span')).trim(), "Accueil");
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
