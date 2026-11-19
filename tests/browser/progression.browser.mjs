// Surcharge progressive expliquée, dans un iPhone simulé : l'aperçu d'une séance montre la charge prévue d'après
// l'historique (et pourquoi), la séance redit la raison avant la première série, et la fin de séance donne les cibles
// de la prochaine fois. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

test("progression : charge prévue et raison dans l'aperçu, en séance, et « la prochaine fois »", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "prog", "1357");
    // historique : 72,5 kg × 10 au développé couché (haut de la fourchette, ressenti 8)
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      state.lifts.bench = { weight: 72.5, reps: 10, rpe: 8, date: Date.now(), best: 96.7, bestReps: 0 };
      state.sessions.push({ id: "s1", date: Date.now() - 3 * 864e5, name: "Push", programId: "push", durationSec: 3000, volume: 2175, prs: [], xp: 80,
        sets: [{ exId: "bench", name: "Développé couché", weight: 72.5, reps: 10, rpe: 8 }] });
      save();
    });
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    // aperçu : 75 kg prévus (+2,5 kg), et la raison
    const first = await page.$eval(".pv-ex", e => e.innerText);
    assert.match(first, /75 kg/);
    assert.match(await page.$eval(".pv-ex .pv-why", e => e.innerText), /Haut de la fourchette atteint \(10 reps\)/);
    assert.ok(await page.$(".pv-ex .pv-why.mv-up"));
    // séance : la raison avant la première série, puis plus rien une fois lancé
    await page.click("#start"); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    assert.match(await page.$eval(".ex-why", e => e.innerText), /\+2,5 kg/);
    await page.click("#log"); await sleep(500);
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.waitForSelector("#log", { timeout: 10000 });
    assert.equal(await page.$(".ex-why"), null);
    // fin : la prochaine fois, d'après la série faite
    await page.click("#quit"); await sleep(400);
    await page.click('.sheet [data-r="1"]');
    await page.waitForSelector(".live.fin", { timeout: 10000 });
    const next = await page.$eval(".fin-next", e => e.innerText);
    assert.match(next, /Développé couché/);
    assert.match(next, /75×7/); // une série à 75 kg × 6 : même charge, une rep de plus
    // le ressenti de la série est gardé avec la charge
    assert.ok(await page.evaluate(async () => (await import("/js/store.js")).state.lifts.bench.rpe != null));
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test("séries d'échauffement : la montée en charge calculée avant la première série, à cocher, sans compter dans la séance", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "echauffe", "1357");
    // 72,5 kg × 10 au développé couché la dernière fois : 75 kg prévus aujourd'hui
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      state.lifts.bench = { weight: 72.5, reps: 10, rpe: 8, date: Date.now(), best: 96.7, bestReps: 0 };
      save();
    });
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    await page.click("#start"); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    // barre à vide × 10, puis 30 kg × 5, 45 kg × 3, 60 kg × 2
    await page.waitForSelector("#warm");
    const rows = await page.$$eval("#warm .warm-set", l => l.map(b => [...b.querySelectorAll(".val")].map(v => v.textContent.trim()).join("×")));
    assert.deepEqual(rows, ["20×10", "30×5", "45×3", "60×2"]);
    // cocher la 3e coche aussi celles d'avant ; la décocher revient en arrière
    await page.click('[data-warm="2"]');
    assert.equal(await page.$$eval("#warm .warm-set.done", l => l.length), 3);
    await page.click('[data-warm="1"]');
    assert.equal(await page.$$eval("#warm .warm-set.done", l => l.length), 1);
    // la première série de travail : l'échauffement disparaît, il ne compte pas
    await page.click("#log"); await sleep(600);
    assert.equal(await page.$("#warm"), null);
    const done = await page.evaluate(async () => (await import("/js/live.js")).liveState?.()?.current?.done?.length ?? null);
    if (done !== null) assert.equal(done, 1, "une seule série comptée");
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
