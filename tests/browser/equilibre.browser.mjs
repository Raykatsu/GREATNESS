// Équilibre musculaire et charge d'entraînement, dans un iPhone simulé : avec un historique qui ne fait que pousser
// (développé couché, squat), l'onglet Progrès montre la charge de la semaine, les séries par muscle, le déséquilibre
// pousser / tirer, et la séance de rattrapage s'ouvre en un geste. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, sleep } from "./kit.mjs";

test("équilibre : charge de la semaine, muscles en retard, séance de rattrapage", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "equi", "1357");
    await seed(page);
    await go(page, "#/progress");
    await page.waitForSelector(".load-card", { timeout: 10000 });
    assert.match(await page.$eval(".load-card", e => e.innerText), /4 semaines/);
    const bal = await page.$eval("#bal-card", e => e.innerText);
    assert.match(bal, /Pectoraux/);
    assert.match(bal, /Tu pousses bien plus que tu ne tires/);
    assert.ok(await page.$$eval(".bal-row", r => r.length) >= 10, "une ligne par muscle");
    // séance de rattrapage : le dos en tête
    assert.match(await page.$eval("#bal-go", e => e.innerText), /Dos/);
    await page.click("#bal-go"); await sleep(600);
    await page.waitForSelector("#start", { timeout: 10000 });
    assert.match(await page.$eval(".sheet", e => e.innerText), /Séance de rattrapage/);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
