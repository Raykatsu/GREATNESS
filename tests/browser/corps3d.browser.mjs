// Corps 3D dans un iPhone simulé : depuis le manuel, la vue 3D s'ouvre (WebGL, ou la planche en images si le
// navigateur n'a pas de WebGL) ; un muscle touché se nomme et mène à ses exercices ; aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, closeSheets, sleep } from "./kit.mjs";

test("corps 3D : ouverture depuis le manuel, muscle touché, retour à ses exercices", { timeout: 180000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "anat", "1357");
    await go(page, "#/train");
    await page.click("#manual-start");
    await page.waitForSelector("#mnl-3d");
    // la planche en images est là (corps gris + muscles allumés)
    assert.ok(await page.$$eval(".mnl-mus .ar-l", l => l.length) >= 17);
    await page.click("#mnl-3d");
    await page.waitForFunction(() => document.querySelector(".b3d")?.dataset.ready, null, { timeout: 60000 });
    const state = await page.$eval(".b3d", e => e.dataset.ready);
    if (state === "1") {
      // WebGL : les vues se règlent, et un muscle touché se nomme avec un lien vers ses exercices
      for (const v of ["side", "back", "front"]) await page.$eval(`#b3d-views [data-v="${v}"]`, b => b.click());
      await sleep(400);
      const box = await page.$eval(".b3d-cv", c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      // on touche le tronc et les cuisses jusqu'à tomber sur un muscle de l'app (os et tendons n'ont pas d'exercices)
      let name = null;
      for (const [fx, fy] of [[0.56, 0.3], [0.5, 0.42], [0.45, 0.62], [0.55, 0.65], [0.6, 0.25], [0.42, 0.35]]) {
        await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
        await sleep(250);
        if (await page.$("#b3d-go")) { name = (await page.$eval("#b3d-tip b", e => e.innerText)).trim(); break; }
      }
      assert.ok(name, "aucun muscle touché");
      await page.$eval("#b3d-go", b => b.click());
      await page.waitForSelector(".mnl-head");
      assert.equal((await page.$eval(".mnl-head h3", e => e.innerText)).trim(), name); // « Voir les exercices » ouvre ce muscle
    } else {
      // pas de WebGL dans ce navigateur : la planche en images prend le relais
      assert.equal(state, "fallback");
      assert.ok(await page.$(".b3d-fallback .ar-map"));
    }
    await closeSheets(page);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
