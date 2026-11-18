// Semaine qui s'adapte, dans un iPhone simulé : après une semaine bien plus chargée que les précédentes, l'accueil propose
// d'alléger la séance du jour (la mission l'indique, la séance démarre allégée) ; un jour libre, il propose une séance
// de rattrapage pour les muscles en retard ; « Non merci » retire la proposition. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

test("semaine adaptative : séance allégée après un pic de charge, rattrapage un jour libre", { timeout: 120000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  try {
    await signup(page, "semaine", "1357");
    // 4 semaines tranquilles, puis 5 grosses séances ces derniers jours ; aujourd'hui : « Push » au programme
    await page.evaluate(async () => {
      const { state, save, todayIndex } = await import("/js/store.js");
      const D = 864e5, now = Date.now();
      const sess = (d, sets) => ({ id: `a${d}`, date: now - d * D, name: "Push", programId: "push", durationSec: 3000, volume: 3000, prs: [], xp: 80,
        sets: sets.flatMap(([exId, k]) => Array.from({ length: k }, () => ({ exId, name: exId, weight: 50, reps: 8, rpe: 8 }))) });
      for (let w = 1; w <= 4; w++) state.sessions.push(sess(7 * w + 1, [["bench", 4], ["ohp", 3]]), sess(7 * w + 4, [["bench", 3]]));
      for (const d of [1, 2, 3, 4, 5]) state.sessions.push(sess(d, [["bench", 5], ["ohp", 4], ["pushdown", 4]]));
      state.sessions.sort((a, b) => a.date - b.date);
      state.weekPlan = { [todayIndex()]: "push" };
      save();
    });
    await go(page, "#/");
    await page.waitForSelector("#wa-card", { timeout: 10000 });
    assert.match(await page.$eval("#wa-card", e => e.innerText), /Grosse semaine/);
    await page.click("#wa-card [data-wa-go]"); await sleep(500);
    assert.match(await page.$eval(".mission", e => e.innerText), /Séance allégée/);
    assert.ok(await page.evaluate(async () => (await import("/js/planner.js")).todaysMission().light), "séance du jour allégée");
    // jour libre : séance de rattrapage pour le dos, qui s'ouvre
    await page.evaluate(async () => {
      const { state, save, todayIndex } = await import("/js/store.js");
      state.weekPlan = { [(todayIndex() + 3) % 7]: "push" }; save();
    });
    await go(page, "#/progress"); await go(page, "#/");
    await page.waitForSelector("#wa-card .k-catchup", { timeout: 10000 });
    await page.click("#wa-card .k-catchup [data-wa-go]"); await sleep(600);
    await page.waitForSelector("#start", { timeout: 10000 });
    assert.match(await page.$eval(".sheet", e => e.innerText), /Séance de rattrapage/);
    await page.keyboard.press("Escape"); await sleep(400);
    // « Non merci » : plus de proposition aujourd'hui
    await page.evaluate(async () => {
      const { state, save } = await import("/js/store.js");
      state.weekAdapt = null; save();
    });
    await go(page, "#/progress"); await go(page, "#/");
    await page.waitForSelector("#wa-card [data-wa-no]", { timeout: 10000 });
    await page.click("#wa-card [data-wa-no]"); await sleep(500);
    assert.equal(await page.$("#wa-card"), null);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
