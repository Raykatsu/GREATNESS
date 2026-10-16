// Programmes célèbres dans un iPhone simulé : choisir 5/3/1, régler ses maximums, la carte de suivi, une séance
// aux séries imposées (série au max annoncée) et le programme qui avance à la fin.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, closeSheets, sleep } from "./kit.mjs";

test("programmes célèbres : 5/3/1 choisi, séance aux séries imposées, programme qui avance", { timeout: 180000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "max", "1357");
    await go(page, "#/train");
    assert.equal(await page.$$eval("[data-classic]", l => l.length), 4);
    await page.click('[data-classic="wendler"]');
    await page.waitForSelector("#cl-go");
    assert.match(await page.$eval(".sheet-wrap:last-child .sheet", e => e.innerText), /Boring But Big/);
    await page.click("#cl-go");
    await page.waitForSelector("#mx-squat");
    for (const [l, v] of [["squat", "100"], ["bench", "80"], ["deadlift", "140"], ["ohp", "50"]]) await page.fill(`#mx-${l}`, v);
    await page.click("#cl-start");
    await page.waitForSelector(".cl-next", { timeout: 5000 }); // détail : prochaine séance
    assert.match(await page.$eval(".cl-next", e => e.innerText), /Développé militaire[\s\S]*30×5 · 35×5 · 37,5×5\+ kg/);
    await closeSheets(page);

    // accueil : carte de suivi ; la semaine suit le programme
    await go(page, "#/");
    assert.match(await page.$eval(".classic-card", e => e.innerText), /5\/3\/1 de Wendler[\s\S]*Cycle 1 · semaine 1/);
    assert.deepEqual(await page.evaluate(async () => Object.values((await import("/js/store.js")).state.weekPlan).filter(x => x === "classic").length), 4);

    // la séance : aperçu, bilan, séries imposées
    await page.evaluate(async () => {
      const { getProgram } = await import("/js/store.js"), { openProgram } = await import("/js/train.js"), { startLive } = await import("/js/live.js");
      openProgram(getProgram("classic"), startLive);
    });
    await page.waitForSelector("#start");
    assert.match(await page.$eval(".pv-list", e => e.innerText), /séries imposées/);
    await page.click("#start"); await sleep(500);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    const live = () => page.$eval(".live", e => e.innerText);
    assert.match(await live(), /30 kg × 5/);
    await page.click("#log"); await sleep(400);
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.waitForSelector("#log"); await page.click("#log"); await sleep(400);
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.waitForSelector("#log");
    assert.match(await live(), /37,5 kg × 5\+/);
    assert.match(await live(), /Série au maximum/);
    // la série au max : 9 reps
    for (let i = 0; i < 4; i++) await page.click('.st-btn[data-s="reps"][data-d="1"]');
    assert.equal(await page.$eval("#in-reps", e => e.value), "9");
    await page.click("#log"); await sleep(500);
    await page.click("#quit"); await sleep(300);
    await page.click('.sheet [data-r="1"]');
    await page.waitForSelector(".classic-res", { timeout: 10000 });
    assert.match(await page.$eval(".classic-res", e => e.innerText), /5\/3\/1 de Wendler[\s\S]*Prochaine séance : Soulevé de terre/);
    assert.equal(await page.evaluate(async () => (await import("/js/store.js")).state.classic.n), 1);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
