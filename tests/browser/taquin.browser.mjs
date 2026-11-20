// Le coach taquin dans un iPhone simulé : coupé par défaut ; activé dans Réglages → Coach & sons, l'accueil et
// l'onglet Repas prennent une pique (objectif dépassé en sèche : l'excès repris sur 3 jours) ; une pizza notée
// déclenche une pique ; coupé, tout revient au langage habituel. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, sleep } from "./kit.mjs";

test("coach taquin : réglage, accueil, repas, aliment plaisir, retour au langage habituel", { timeout: 150000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "taquin", "2468");
    await seed(page);
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.profile.goal = "seche"; save(); });
    // coupé par défaut : rien de taquin
    await go(page, "#/");
    assert.equal(await page.$('.hello-sub[translate="no"]'), null);

    // Réglages → Coach & sons → Coach taquin
    await go(page, "#/profile");
    await page.waitForSelector("#p-banter", { state: "attached", timeout: 10000 });
    await page.evaluate(() => { const t = document.querySelector("#p-banter"); t.scrollIntoView({ block: "center" }); t.click(); });
    await page.waitForFunction(() => /Mode taquin activé/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 5000 });
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.profile.banter), true);

    // accueil : la phrase du jour devient une pique
    await go(page, "#/");
    const hello = await page.$eval('.hello-sub[translate="no"]', e => e.textContent.trim());
    assert.ok(hello.length > 15, hello);

    // repas : objectif explosé en sèche → l'excès repris sur 3 jours
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      const { addItem, dayKey } = await import("/js/nutrition.js");
      addItem(state, dayKey(), { name: "Lasagnes", per: { k: 1000, p: 40, c: 90, f: 50 }, unit: { label: "portion", g: 100 } }, { g: 300, meal: "dinner" });
      save();
    });
    await go(page, "#/food");
    await page.waitForSelector(".coach-line.quip", { timeout: 10000 });
    const q = await page.$eval(".coach-line.quip", e => e.innerText);
    assert.match(q, /\d+ kcal/);
    assert.match(q, /3 (jours|prochains jours)/);

    // une pizza notée : la pique arrive à la place du simple « ajouté »
    const pique = await page.evaluate(async () => (await import("/js/banter.js")).quip("junk", { f: "Pizza reine" }));
    assert.match(pique, /Pizza reine/);

    // coupé : retour au langage habituel
    await go(page, "#/profile");
    await page.evaluate(() => document.querySelector("#p-banter").click());
    await page.waitForFunction(() => /Coach taquin coupé/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 5000 });
    await go(page, "#/food");
    await sleep(300);
    assert.equal(await page.$(".coach-line.quip"), null);
    await go(page, "#/");
    assert.equal(await page.$('.hello-sub[translate="no"]'), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
