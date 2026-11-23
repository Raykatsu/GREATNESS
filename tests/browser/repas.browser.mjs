// Les repas dans un iPhone simulé (compte en ligne, IA du plan simulée) : « Sans l'IA, tout de suite » compose le plan
// à l'instant ; chaque repas du plan a sa recette (étapes, temps) ; un plan abîmé est refait au lieu de planter ; un
// repas du plan se garde dans « Mes repas » avec sa recette ; « Créer un repas » (aliments, quantités, portions,
// préparation) puis l'ajouter au journal, une portion. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

const journal = page => page.evaluate(async () => {
  const { state } = await import("/js/store.js"); const { dayOf, dayKey } = await import("/js/nutrition.js");
  return dayOf(state, dayKey()).items.map(x => `${x.name} ${x.g}`);
});

test("repas : plan sans attendre l'IA, recettes, plan abîmé refait, mes repas créés et ajoutés", { timeout: 150000 }, async () => {
  const app = await openApp({ online: true });
  const { page, errors } = app;
  // l'IA du plan ne répond jamais : « sans l'IA » ne doit pas attendre
  await page.route("**/functions/v1/coach", () => {});
  try {
    await signup(page, "repas", "2468");
    await go(page, "#/food");
    await page.click("#plan-open");
    await page.waitForSelector("#np-local");
    await page.click("#np-go");
    await sleep(300);
    assert.match(await page.$eval("#np-go", e => e.textContent), /L'IA compose ton plan/);
    await page.click("#np-local");
    await page.waitForSelector("#pl-day", { timeout: 5000 });
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.mealPlan.source), "local");

    // chaque repas a sa recette : étapes et temps
    const preps = await page.$$eval("#pl-day .pl-prep", l => l.map(d => ({ sum: d.querySelector("summary").innerText.replace(/\s+/g, " "), steps: d.querySelectorAll("li").length })));
    assert.ok(preps.length >= 3, `${preps.length} recettes`);
    assert.ok(preps.every(p => /Préparation · \d+ min/.test(p.sum) && p.steps >= 1));
    await page.click("#pl-day .pl-prep summary");
    assert.ok(await page.$eval("#pl-day .pl-prep", d => d.open));

    // garder le premier repas dans « Mes repas »
    await page.click('.sheet-wrap [data-keep="0"]');
    await page.waitForFunction(() => /gardé dans tes repas/.test(document.querySelector("#toast")?.textContent || ""));
    const kept = await page.evaluate(async () => (await import("/js/store.js")).state.foodMeals[0]);
    assert.ok(kept.prep.length >= 1 && kept.items.length >= 2);

    // un plan abîmé (ancienne version, synchro) : refait au lieu de planter
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.mealPlan = { days: [{ name: "Jour 1" }] }; save(); });
    await page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));
    await go(page, "#/food");
    await page.click("#plan-open");
    await page.waitForSelector("#np-go", { timeout: 5000 });
    await page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));

    // Mes repas → Créer un repas : deux aliments, 2 portions, une préparation
    await page.click("#mm-open");
    await page.waitForSelector("#mm-new");
    assert.match(await page.$eval("#mm-list", e => e.innerText), new RegExp(kept.name.slice(0, 12)));
    await page.click("#mm-new");
    await page.waitForSelector("#me-name");
    await page.fill("#me-name", "Mon bowl du dimanche");
    await page.fill("#me-q", "riz basmati");
    await page.click("#me-res [data-f]");
    await page.fill("#me-q", "blanc de poulet");
    await page.click("#me-res [data-f]");
    assert.equal(await page.$$eval("#me-items .me-item", l => l.length), 2);
    await page.fill('#me-items [data-g="0"]', "300");
    await page.fill('#me-items [data-g="1"]', "300");
    await page.fill("#me-serv", "2");
    await page.fill("#me-prep", "1. Fais cuire le riz 12 min.\n- Dore le poulet 8 min.");
    assert.match(await page.$eval("#me-tot", e => e.innerText), /par portion/);
    await page.click("#me-ok");
    await page.waitForFunction(() => /enregistré dans tes repas/.test(document.querySelector("#toast")?.textContent || ""));
    const mine = await page.evaluate(async () => (await import("/js/store.js")).state.foodMeals.find(m => m.name === "Mon bowl du dimanche"));
    assert.deepEqual([mine.items.map(x => x.g), mine.servings, mine.prep], [[300, 300], 2, ["Fais cuire le riz 12 min.", "Dore le poulet 8 min."]]);

    // l'ajouter au journal : une portion (la moitié des quantités)
    await page.click(`[data-mm-add="${mine.id}"]`);
    await page.waitForFunction(() => /Mon bowl du dimanche.*ajouté/.test(document.querySelector("#toast")?.textContent || ""));
    const j = await journal(page);
    assert.ok(j.some(x => /150$/.test(x)), j.join(", "));
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
