// Confort d'utilisation, au-delà d'axe-core, dans un iPhone simulé : sur chaque écran, chaque bouton se touche sur au
// moins 44 × 44 (Apple, WCAG 2.5.5 : zone élargie invisible pour les petits contrôles), aucun texte sous 12 px, l'onglet
// en cours annoncé à VoiceOver (« page actuelle ») ; une feuille ouverte rend le reste de l'écran inerte (VoiceOver et
// le clavier y restent), rendu à sa fermeture ; la taille du texte suit l'iPhone par défaut (« Auto »), ou le choix
// fait dans Moi. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, sleep } from "./kit.mjs";

// Les contrôles trop petits au toucher (leur zone élargie comprise), et les textes de moins de 12 px
const audit = page => page.evaluate(() => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[aria-hidden='true'], [hidden], [inert]"); };
  const id = el => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
  const small = [];
  for (const el of document.querySelectorAll("button, a[href], select, summary, [role=button], [role=tab]")) {
    if (!vis(el) || (el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li"))) continue; // lien dans une phrase
    const r = el.getBoundingClientRect(), b = getComputedStyle(el, "::before"), w = Math.max(r.width, parseFloat(b.width) || 0), h = Math.max(r.height, parseFloat(b.height) || 0);
    const row = el.closest("label, .set-row, summary"); // une ligne entière qui se touche
    if (row && row !== el && row.getBoundingClientRect().height >= 44) continue;
    if (w < 43.5 || h < 43.5) small.push(`${id(el)} ${Math.round(w)}×${Math.round(h)}`);
  }
  const tiny = new Set(), z = parseFloat(getComputedStyle(document.querySelector("#view")).zoom) || 1;
  const tw = document.createTreeWalker(document.querySelector("#view") || document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!n.data.trim() || !el || !vis(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) * z;
    if (fs < 11.9) tiny.add(`${id(el)} ${fs}px`);
  }
  return { small: [...new Set(small)], tiny: [...tiny] };
});

test("confort : zones tactiles, tailles de texte, onglet annoncé, feuilles, taille du texte de l'iPhone", { timeout: 200000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "confort", "2468");
    await seed(page, 8);
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js"); const { FOODS } = await import("/js/foods.js"); const { addItem, dayKey } = await import("/js/nutrition.js");
      state.profile.mascot = false;
      for (const [n, g, meal] of [["Flocons d'avoine", 60, "breakfast"], ["Blanc de poulet", 150, "lunch"], ["Soda", 330, "lunch"]]) addItem(state, dayKey(), FOODS.find(f => f.name === n), { g, meal });
      save();
    });
    const found = [];
    for (const [h, name, tab] of [["#/", "accueil", "Accueil"], ["#/train", "séances", "Séances"], ["#/create", "créer", "Créer"], ["#/food", "repas", "Repas"], ["#/coach", "coach", "Coach"], ["#/progress", "progrès", "Moi"], ["#/profile", "moi", "Moi"]]) {
      await go(page, h); await sleep(300);
      const r = await audit(page);
      for (const x of r.small) found.push(`${name} · trop petit au toucher : ${x}`);
      for (const x of r.tiny) found.push(`${name} · texte trop petit : ${x}`);
      assert.equal(await page.$eval('.tabbar a[aria-current="page"]', a => a.textContent.trim()), tab, `${name} : onglet en cours annoncé`);
      assert.equal(await page.$$eval(".tabbar a[aria-current]", l => l.length), 1);
    }
    assert.deepEqual(found, [], `\n${found.join("\n")}`);

    // une feuille ouverte : le reste de l'écran est inerte, rendu à la fermeture (même retirée d'un coup)
    await go(page, "#/food");
    await page.click("#plate-open");
    await page.waitForSelector(".plate-sheet");
    assert.deepEqual(await page.evaluate(() => [document.querySelector("#view").inert, document.querySelector(".tabbar").inert, document.querySelector(".sheet-wrap").inert, document.querySelector("#toast").inert]), [true, true, false, false]);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".sheet-wrap") && !document.querySelector("#view").inert);
    await page.click("#plate-open");
    await page.waitForSelector(".plate-sheet");
    await page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));
    await page.waitForFunction(() => !document.querySelector("#view").inert && !document.querySelector(".tabbar").inert);

    // taille du texte : « Auto » par défaut (ici, pas de police système d'iPhone : 100 %), ou le choix fait dans Moi
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--zoom").trim()), "1");
    assert.deepEqual(await page.evaluate(async () => { const { zoomFor } = await import("/js/actions.js"); return [17, 14, 20, 23, 33].map(zoomFor); }), [1, 0.9, 1.2, 1.35, 1.35]);
    await go(page, "#/profile");
    await page.waitForSelector("#zoom button.on", { state: "attached" });
    assert.equal(await page.$eval("#zoom button.on", b => b.textContent.trim()), "Auto");
    await page.evaluate(() => { const b = document.querySelector('#zoom button[data-v="1.2"]'); b.scrollIntoView({ block: "center" }); b.click(); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--zoom").trim()), "1.2");
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.profile.zoom), 1.2);
    await page.evaluate(() => document.querySelector('#zoom button[data-v=""]').click());
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.profile.zoom), null);

    // les réglages d'accessibilité de l'iPhone, transmis par l'app native : grand texte, transparence réduite, gras, contraste
    await page.evaluate(async () => (await import("/js/actions.js")).setSystemA11y({ textScale: 1.18, reduceTransparency: true, boldText: true, increaseContrast: true }));
    await page.waitForFunction(() => getComputedStyle(document.body).fontWeight === "600", null, { timeout: 3000 }); // le gras s'installe en douceur
    assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue("--zoom").trim(), [...document.documentElement.classList].filter(c => /reduce-transparency|bold-text|more-contrast/.test(c)).sort().join(" "),
      getComputedStyle(document.querySelector(".tabbar")).backdropFilter]), ["1.2", "bold-text more-contrast reduce-transparency", "none"]);
    await page.evaluate(async () => (await import("/js/actions.js")).setSystemA11y(null));
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("reduce-transparency")), false);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
