// L'avis du coach sur ce que tu manges, dans un iPhone simulé : une journée notée (soda, saucisson, brocoli, saumon…) ;
// chaque aliment a son point de couleur ; la carte « Ton assiette du jour » ouvre la revue (à éviter, à réduire, ce qui
// manque, échanges, aliment par aliment) et mène aux repères de « Comprendre » ; la feuille d'un aliment donne son avis ;
// ajouter un soda affiche l'avis, en taquin la pique ; coupé dans les réglages, plus rien. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

const toastText = page => page.$eval("#toast", e => e.textContent);
const closeSheets = page => page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));

test("assiette : avis par aliment, revue du jour, bulle après l'ajout, coach taquin, réglage", { timeout: 150000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "assiette", "2468");
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      const { FOODS } = await import("/js/foods.js");
      const { addItem, dayKey } = await import("/js/nutrition.js");
      state.profile.mascot = false;
      const f = n => FOODS.find(x => x.name === n);
      for (const [n, g, meal] of [["Pain au chocolat", 70, "breakfast"], ["Soda", 330, "lunch"], ["Saucisson sec", 60, "lunch"], ["Brocoli", 150, "dinner"], ["Saumon", 125, "dinner"]])
        addItem(state, dayKey(), f(n), { g, meal });
      save();
    });
    await go(page, "#/food");
    await page.waitForSelector("#plate-open", { timeout: 10000 });

    // mode normal : la ligne du coach donne un conseil concret
    assert.match(await page.$eval("#plate-advice", e => e.innerText), /boisson sucrée[\s\S]*eau pétillante/);

    // un point de couleur par aliment notable : vert, orange, rouge
    const dots = await page.$$eval(".food-row .tier-dot", l => l.map(d => d.className.replace("tier-dot ", "")));
    assert.deepEqual(dots.sort(), ["t-avoid", "t-limit", "t-limit", "t-top", "t-top"]);

    // la carte : une note, des puces, le point le plus important
    const card = await page.$eval("#plate-open", e => e.innerText.replace(/\s+/g, " "));
    assert.match(card, /Ton assiette du jour/);
    assert.match(card, /à éviter/);
    assert.match(card, /Boissons sucrées/);

    // la revue
    await page.click("#plate-open");
    await page.waitForSelector(".plate-sheet");
    const sheet = await page.$eval(".plate-sheet", e => e.innerText.replace(/\s+/g, " "));
    for (const re of [/Ce qui est bien/, /À éviter au quotidien/, /À réduire/, /Ce qui manque/, /Échanges conseillés/, /Aliment par aliment/, /poisson gras/i, /Charcuterie/, /morceaux/])
      assert.match(sheet, re);
    // les repères et leurs sources : l'onglet « Comprendre », partie ouverte
    await page.click("#ps-learn");
    await page.waitForFunction(() => document.querySelector("#nl-plate")?.open === true, null, { timeout: 5000 });
    assert.ok(await page.$eval("#nl-plate", e => e.querySelectorAll(".nl-cite").length >= 10));
    await page.click('#nut-tabs [data-tab="log"]').catch(() => {});
    await go(page, "#/food");
    await page.waitForSelector("#plate-open");

    // la feuille d'un aliment donne son avis
    const sauc = await page.evaluate(async () => (await import("/js/store.js")).state.food[(await import("/js/nutrition.js")).dayKey()].items.find(x => x.name === "Saucisson sec").id);
    await page.click(`[data-item="${sauc}"]`);
    await page.waitForSelector(".pf-verdict.t-limit");
    assert.match(await page.$eval(".pf-verdict", e => e.innerText), /À limiter[\s\S]*Charcuterie[\s\S]*150 g/);
    await closeSheets(page);

    // ajouter un soda : la bulle donne l'avis
    await page.evaluate(async () => { const { FOODS } = await import("/js/foods.js"); (await import("/js/food.js")).openPortion(FOODS.find(x => x.name === "Soda"), { meal: "snack" }); });
    await page.waitForSelector("#pf-ok");
    assert.match(await page.$eval(".pf-verdict", e => e.innerText), /À éviter au quotidien/);
    await page.click("#pf-ok");
    await page.waitForFunction(() => /⛔/.test(document.querySelector("#toast")?.textContent || ""));
    assert.match(await toastText(page), /Soda ajouté[\s\S]*Boisson sucrée[\s\S]*morceaux de sucre/);
    // mode normal : un commentaire aussi pour ce qui « passe », et la journée qui avance pour une famille déjà notée
    await page.evaluate(async () => { const { FOODS } = await import("/js/foods.js"); (await import("/js/food.js")).openPortion(FOODS.find(x => x.name === "Riz blanc cuit"), { meal: "dinner" }); });
    await page.waitForSelector("#pf-ok");
    await page.click("#pf-ok");
    await page.waitForFunction(() => /Riz blanc cuit ajouté/.test(document.querySelector("#toast")?.textContent || ""));
    assert.match(await toastText(page), /Ça passe · Féculent[\s\S]*complet/);
    await page.evaluate(async () => { const { FOODS } = await import("/js/foods.js"); (await import("/js/food.js")).openPortion(FOODS.find(x => x.name === "Carotte"), { meal: "dinner" }); });
    await page.waitForSelector("#pf-ok");
    await page.click("#pf-ok");
    await page.waitForFunction(() => /Carotte ajouté/.test(document.querySelector("#toast")?.textContent || ""));
    assert.match(await toastText(page), /À privilégier · Légumes[\s\S]*Fruits et légumes\s:\s3 portions sur 5 aujourd'hui/);

    // en taquin : la pique de la famille
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.profile.banter = true; save(); });
    await page.evaluate(async () => { const { FOODS } = await import("/js/foods.js"); (await import("/js/food.js")).openPortion(FOODS.find(x => x.name === "Bière"), { meal: "dinner" }); });
    await page.waitForSelector("#pf-ok");
    await page.click("#pf-ok");
    await sleep(300);
    const pique = await toastText(page);
    const lines = await page.evaluate(async () => (await import("/js/banter.js")).LINES.eatAlcohol);
    // la pique est tirée au sort ; typographie française : espace fine insécable avant « ! ? : ; » (pas dans le modèle)
    const plain = pique.replace(/[\u202f\u00a0]/g, " ");
    assert.ok(lines.some(l => plain.startsWith(l.split(/%|\[\[/)[0].slice(0, 12))), pique);

    // coupé dans les réglages : plus de points, plus de carte, plus d'avis
    await go(page, "#/profile");
    await page.waitForSelector("#p-plate", { state: "attached", timeout: 10000 });
    await page.evaluate(() => { const t = document.querySelector("#p-plate"); t.scrollIntoView({ block: "center" }); t.click(); });
    await page.waitForFunction(() => /Avis sur tes repas coupé/.test(document.querySelector("#toast")?.textContent || ""));
    await go(page, "#/food");
    await sleep(300);
    assert.equal(await page.$("#plate-open"), null);
    assert.equal(await page.$(".food-row .tier-dot"), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
