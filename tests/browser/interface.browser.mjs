// L'interface allégée, dans un iPhone simulé : l'écran Séances range ses outils en grille (séance libre, manuel,
// minuteur, objectif chiffré) et ne montre que 3 séances par catégorie dans « Tout » (celle du jour reste visible), le
// reste à un geste (« Voir les 14 séances ») ; plus de bouton « + » en double avec l'onglet Créer. Les Réglages ont un
// sommaire qui mène à chaque section. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

test("interface : outils en grille, catégories raccourcies, sommaire des réglages", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "interface", "2468");
    // la séance du jour : « Fessiers », la dernière de la salle
    await page.evaluate(async () => {
      const { state, save, todayIndex } = await import("/js/store.js");
      state.profile.mascot = false; state.weekPlan = { [todayIndex()]: "glutes" }; state.weekAdapt = null; save();
    });
    await go(page, "#/train");
    await page.waitForSelector(".tr-tools");

    // les outils : quatre tuiles, deux par ligne
    assert.deepEqual(await page.$$eval(".tr-tools > *", l => l.map(e => e.id)), ["free-start", "manual-start", "iv-start", "goal-new"]);
    const at = await page.$$eval(".tr-tools > *", l => l.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left)]; }));
    assert.ok(at[0][0] === at[1][0] && at[2][0] === at[3][0] && at[2][0] > at[0][0] && at[1][1] > at[0][1], JSON.stringify(at));
    assert.equal(await page.$(".fab"), null, "plus de « + » en double avec l'onglet Créer");

    // « Tout » : les 3 premières de chaque catégorie, plus celle du jour ; tout le reste à un geste
    assert.deepEqual(await page.$$eval(".tr-list .prog.cat-gym", l => l.map(e => e.dataset.id)), ["push", "pull", "legs", "glutes"]);
    assert.ok(await page.$('.prog[data-id="glutes"] .pc-today'), "la séance du jour, marquée");
    assert.ok((await page.$$(".tr-list .prog")).length <= 20);
    assert.match(await page.$eval('[data-more="gym"]', b => b.textContent.trim()), /^Voir les 14 séances$/);
    assert.equal(await page.$('[data-more="cardio"]'), null, "deux séances : montrées en entier");
    await page.click('[data-more="gym"]');
    await page.waitForFunction(() => document.querySelectorAll(".tr-list .prog").length === 14);
    assert.equal(await page.$eval(".tr-f.on", b => b.dataset.f), "gym");
    assert.equal(await page.$eval(".tr-f.on", b => b.getAttribute("aria-selected")), "true");
    assert.equal(await page.$(".tr-more"), null);
    await page.click('.tr-f[data-f="all"]');
    await page.waitForSelector('[data-more="gym"]');

    // les Réglages : un sommaire, chaque section à un geste
    await go(page, "#/profile");
    await page.waitForSelector(".set-jump button");
    const jumps = await page.$$eval(".set-jump button", l => l.map(b => b.dataset.jump));
    assert.equal(jumps.length, 9);
    for (const id of jumps) assert.ok(await page.$(`#${id}`), `section ${id}`);
    await page.click('[data-jump="set-rem"]');
    await page.waitForFunction(() => { const t = document.querySelector("#set-rem").getBoundingClientRect().top; return t >= 0 && t < 140; }, null, { timeout: 5000 });
    await sleep(200);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
