// Guide « Découvrir GREATNESS » dans un iPhone simulé : la carte « Bien démarrer » de l'Accueil, les étapes qui se
// cochent pour de vrai, la recherche, chaque bouton « Essayer » / « Me montrer où » (l'écran s'ouvre, l'élément brille,
// ou la fonction s'ouvre), le bouton « ? » d'un onglet, la carte masquée qui le reste ; puis le guide en anglais sans
// reste de français. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { EN_READY } from "../../js/i18n.js";
import { openApp, signup, seed, go, closeSheets, sleep } from "./kit.mjs";

const ITEMS = (await import("../../js/guide-data.js")).ITEMS;
// feuilles ouvertes en plus du guide
const sheets = page => page.$$eval(".sheet-wrap:not(.closing)", l => l.filter(w => !w.querySelector(".gd")).length);
async function openGuideAt(page, sec) {
  await page.evaluate(s => dispatchEvent(new CustomEvent("greatness:guide", { detail: s })), sec);
  await page.waitForSelector(`#gd-tabs [data-sec="${sec}"][aria-selected="true"]`);
}

test("guide : Bien démarrer, recherche, chaque bouton mène à sa fonction, bouton « ? »", { timeout: 240000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "guide", "1357");
    await page.addStyleTag({ content: ".mascot-bubble{display:none!important}" }); // astuces de la mascotte au hasard
    await go(page, "#/");
    // carte « Bien démarrer » : rien de fait
    await page.waitForSelector("#gd-card");
    assert.equal((await page.textContent("#gd-card .gd-card-n")).trim(), "0/5");
    await page.click("#gd-open");
    await page.waitForSelector(".gd-steps");
    assert.equal(await page.$$eval(".gd-step", l => l.length), 5);
    assert.equal(await page.$$eval(".gd-step.ok", l => l.length), 0);
    // « Regarde la démo d'un exercice » : la démo s'ouvre par-dessus le guide, l'étape se coche
    await page.click('[data-step="s-demo"]');
    await page.waitForSelector(".demo");
    await page.evaluate(() => [...document.querySelectorAll(".sheet-wrap")].pop().remove());
    await page.waitForSelector('.gd-step.ok');
    assert.equal(await page.$$eval(".gd-step.ok", l => l.length), 1);
    // recherche, accents et majuscules compris
    await page.fill("#gd-q", "MANUEL");
    await page.waitForSelector('#gd-body [data-id="manual"]');
    await page.fill("#gd-q", "");
    await closeSheets(page);

    // chaque fonction : son bouton ouvre la fonction ou montre où elle se trouve (sauf la caméra et les séances)
    const misses = [];
    for (const it of ITEMS.filter(x => x.go && !x.go.start && x.go.fn !== "cam")) {
      await openGuideAt(page, it.sec);
      await page.click(`.gd-it[data-id="${it.id}"] .gd-row`);
      assert.equal(await page.getAttribute(`.gd-it[data-id="${it.id}"] .gd-row`, "aria-expanded"), "true");
      const before = await sheets(page);
      // rien ne brille encore (l'élément montré juste avant brille quelques secondes)
      await page.evaluate(() => { document.querySelectorAll(".g-spot").forEach(n => n.classList.remove("g-spot")); document.querySelector("#toast")?.classList.remove("show"); });
      await page.click(`[data-go="${it.id}"]`);
      if (it.go.fn) {
        // la fonction s'ouvre : une feuille de plus (ou la vue 3D)
        await page.waitForFunction(n => [...document.querySelectorAll(".sheet-wrap:not(.closing)")].filter(w => !w.querySelector(".gd")).length > n || document.querySelector(".b3d"), before, { timeout: 15000 })
          .catch(() => misses.push(`${it.id} : rien ne s'ouvre`));
      } else {
        // l'écran s'ouvre et l'élément brille, ou un message dit pourquoi il n'existe pas encore
        await page.waitForFunction(() => document.querySelector(".g-spot") || document.querySelector("#toast.show") || window.__guideMiss?.length, null, { timeout: 8000 })
          .catch(() => misses.push(`${it.id} : rien n'est montré`));
        const hash = await page.evaluate(() => location.hash || "#/");
        if (!hash.startsWith(it.go.to.split("?")[0])) misses.push(`${it.id} : écran ${hash} au lieu de ${it.go.to}`);
      }
      await closeSheets(page);
      await page.evaluate(() => { document.querySelectorAll(".b3d").forEach(n => n.remove()); document.querySelector("#toast")?.classList.remove("show"); });
    }
    assert.deepEqual(await page.evaluate(() => window.__guideMiss || []), [], "éléments introuvables");
    assert.deepEqual(misses, []);
    // les fonctions lues ou essayées comptent comme découvertes
    const n = await page.evaluate(async () => (await import("/js/store.js")).state.guide.seen.length);
    assert.ok(n >= 40, `découvertes : ${n}`);

    // le bouton « ? » d'un onglet ouvre le guide sur cet onglet
    await go(page, "#/train");
    await page.click('.tr-head [data-guide="train"]');
    await page.waitForSelector('#gd-tabs [data-sec="train"][aria-selected="true"]');
    await closeSheets(page);
    await go(page, "#/food");
    await page.click('.page-head [data-guide="food"]');
    await page.waitForSelector('#gd-tabs [data-sec="food"][aria-selected="true"]');
    await closeSheets(page);

    // carte masquée : choix gardé sur le compte, elle ne revient pas
    await go(page, "#/");
    await page.click("#gd-hide");
    await page.waitForSelector("#gd-card", { state: "detached" });
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("greatness.data.guide") || "{}").guide?.hide);
    assert.equal(kept, true);
    await go(page, "#/train");
    await go(page, "#/");
    await page.waitForSelector(".home-head");
    assert.equal(await page.$("#gd-card"), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

// mots qui trahissent un texte resté en français
const FRENCH = /(^|[^\p{L}])(séances?|séries?|réglages|accueil|semaine|objectif|récupération|entraînement|exercices?|avec|dans|très|déjà|les|des|une|tu|ta|tes|mes|ton|moi|repas|créer)(?=$|[^\p{L}])/iu;

test("guide en anglais : toutes les parties traduites", { skip: !EN_READY && "version anglaise pas encore livrée", timeout: 120000 }, async () => {
  const app = await openApp({ locale: "en-US" });
  const { page, errors } = app;
  try {
    await signup(page, "liam", "2468");
    await seed(page, 3);
    await go(page, "#/");
    await page.waitForSelector("#gd-card");
    const left = [];
    const scan = async where => {
      const lines = await page.evaluate(() => {
        const out = [], root = [...document.querySelectorAll(".sheet")].pop() || document.querySelector("#view");
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && !n.parentElement.closest('[translate="no"]')) out.push(n.data.trim());
        for (const el of root.querySelectorAll("[aria-label], [placeholder]")) out.push(el.getAttribute("aria-label") || "", el.getAttribute("placeholder") || "");
        return out.filter(Boolean);
      });
      for (const l of lines) if (FRENCH.test(l)) left.push(`${where} « ${l.slice(0, 90)} »`);
    };
    await scan("accueil");
    await page.click("#gd-open");
    for (const sec of (await import("../../js/guide-data.js")).SECTIONS.map(s => s.id)) {
      await page.click(`#gd-tabs [data-sec="${sec}"]`);
      await page.waitForSelector(`#gd-tabs [data-sec="${sec}"][aria-selected="true"]`);
      // toutes les explications ouvertes
      for (const b of await page.$$(".gd-row")) await b.click();
      await sleep(150);
      await scan(sec);
    }
    assert.deepEqual(left.slice(0, 25), [], `${left.length} textes encore en français`);
    assert.equal((await page.textContent(".gd .h2")).trim(), "Discover GREATNESS");
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
