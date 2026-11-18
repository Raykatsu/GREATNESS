// Nutrition qui s'adapte, dans un iPhone simulé : en sèche, 600 kcal de trop hier → l'objectif du jour baisse de
// 200 kcal (carte « Objectif du jour ajusté »), le jour du plan de repas suit ; toucher une barre de macro ouvre
// « Comprendre » sur ce nutriment, un nom d'étude ouvre la source ; « Pourquoi ces quantités ? » mène à l'explication.
// En anglais, l'onglet « Comprendre » s'affiche sans reste de français. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

// profil en sèche, 600 kcal de trop hier, et un plan de repas de 3 jours commencé aujourd'hui
const setup = page => page.evaluate(async () => {
  const { state, save } = await import("/js/store.js");
  const { dayKey, shiftKey } = await import("/js/nutrition.js");
  const { localPlan, shoppingList } = await import("/js/mealplan.js");
  Object.assign(state.profile, { sex: "h", age: 28, height: 180, bodyweight: 80, activity: "mod", days: 4, goal: "seche", nutri: {} });
  const item = (id, k) => ({ id, name: "Repas test", meal: "lunch", g: 100, per: { k, p: 30, c: 40, f: 20 }, at: Date.now() });
  state.food[shiftKey(dayKey(), -1)] = { items: [item("t1", 1430), item("t2", 1430)], water: 0, at: Date.now() };
  const days = localPlan({ kcal: 2260, p: 176 }, { days: 3 });
  state.mealPlan = { id: "t", at: Date.now(), source: "local", diet: [], prefs: "", kcal: 2260, p: 176, days, shopping: shoppingList(days), tips: "" };
  save();
});

test("nutrition : objectif ajusté au jour le jour, plan qui suit, onglet « Comprendre » et ses sources", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "nutri", "1357");
    await setup(page);
    await go(page, "#/food");
    await page.waitForSelector("#nut-adj", { timeout: 10000 });
    assert.match(await page.textContent("#nut-adj"), /Objectif du jour ajusté\s*−200 kcal/);
    assert.match(await page.textContent(".nut-kcal"), /2\s?060 kcal/);
    // la barre des protéines ouvre l'explication des protéines
    await page.click(".mb-p"); await sleep(500);
    assert.equal(await page.$eval('#nut-tabs [data-tab="learn"]', b => b.classList.contains("on")), true);
    assert.equal(await page.$eval("#nl-p", d => d.open), true);
    assert.match(await page.textContent("#nl-kcal"), /10 × 80 kg \+ 6,25 × 180 cm/);
    assert.match(await page.textContent("#nl-adapt"), /Hier/);
    // un nom d'étude ouvre la liste des sources sur cette étude
    await page.click('#nl-kcal .nl-cite[data-ref="mifflin"]'); await sleep(500);
    assert.equal(await page.$eval("#nl-refs", d => d.open), true);
    assert.equal(await page.$eval("#nl-ref-mifflin", li => li.classList.contains("hl")), true);
    assert.match(await page.$eval("#nl-ref-mifflin a", a => a.href), /^https:\/\/doi\.org\/10\.1093\/ajcn\/51\.2\.241$/);
    assert.equal(await page.evaluate(() => location.hash), "#/food", "aucun changement d'écran");
    // un rafraîchissement de l'écran (synchronisation…) garde l'onglet « Comprendre »
    await page.evaluate(() => dispatchEvent(new HashChangeEvent("hashchange"))); await sleep(500);
    assert.equal(await page.$eval('#nut-tabs [data-tab="learn"]', b => b.classList.contains("on")), true);
    // retour au journal, puis le plan de repas : le jour d'aujourd'hui est recalculé
    await page.click('#nut-tabs [data-tab="log"]'); await sleep(400);
    await page.waitForSelector(".nut-sum");
    await page.click("#plan-open"); await sleep(600);
    assert.match(await page.textContent(".pl-adj"), /−200 kcal/);
    assert.equal(await page.$$eval("#pl-days .pl-dot", l => l.length), 1);
    await page.click("#pl-why"); await sleep(800);
    assert.equal(await page.$eval("#nl-adapt", d => d.open), true);
    // quitter l'écran puis y revenir : le journal
    await go(page, "#/"); await go(page, "#/food");
    assert.equal(await page.$eval('#nut-tabs [data-tab="log"]', b => b.classList.contains("on")), true);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

// mots qui trahissent un texte resté en français
const FRENCH = /(^|[^\p{L}])(séances?|aujourd'hui|objectif|semaine|entraînement|avec|dans|très|les|des|une|tu|ta|tes|ton|pour|calcul|dépense|protéines|glucides|lipides|minéraux|pourquoi)(?=$|[^\p{L}])/iu;
test("nutrition en anglais : « Comprendre » traduit, sans reste de français", { timeout: 120000 }, async () => {
  const app = await openApp({ locale: "en-US" });
  const { page, errors } = app;
  try {
    await signup(page, "nutrien", "2468");
    await setup(page);
    await go(page, "#/food");
    await page.waitForSelector("#nut-adj", { timeout: 10000 });
    assert.match(await page.textContent("#nut-adj"), /Today's target adjusted/);
    await page.click('#nut-tabs [data-tab="learn"]'); await sleep(500);
    await page.evaluate(() => document.querySelectorAll(".nl details").forEach(d => (d.open = true))); await sleep(300);
    const left = await page.evaluate(re => {
      const out = [], w = document.createTreeWalker(document.querySelector("#view"), NodeFilter.SHOW_TEXT), FR = new RegExp(re, "iu");
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && !n.parentElement.closest('[translate="no"], script, style') && FR.test(n.data)) out.push(n.data.trim().slice(0, 90));
      return out;
    }, FRENCH.source);
    assert.deepEqual(left.slice(0, 20), [], `${left.length} textes encore en français`);
    assert.match(await page.textContent("#nl-kcal"), /Basal metabolic rate/);
    assert.match(await page.textContent("#nl-kcal"), /6\.25 × 180 cm/);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
