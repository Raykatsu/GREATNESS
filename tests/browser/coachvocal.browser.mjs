// Parler au coach pendant la séance, dans un iPhone simulé (micro et voix simulés) : question dictée dans « Demander
// au coach », puis question en mains libres (« Coach, … ? ») ; la réponse s'affiche et est lue à voix haute.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

test("coach vocal : question dictée ou en mains libres, réponse lue", { timeout: 180000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  await page.addInitScript(() => {
    // micro simulé : chaque écoute rend la phrase posée dans window.__next ; voix simulée : phrases lues gardées
    class FakeRec {
      start() {
        this.on = true;
        const t = window.__next;
        if (!t) return;
        window.__next = null;
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: t }], { isFinal: true })] });
          if (!this.continuous) { this.on = false; this.onend?.(); }
        }, 80);
      }
      stop() { if (this.on) { this.on = false; setTimeout(() => this.onend?.(), 10); } }
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeRec;
    window.__spoken = [];
    speechSynthesis.speak = u => { window.__spoken.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); };
    speechSynthesis.cancel = () => {};
  });
  await page.reload();
  await page.waitForSelector("#new");
  try {
    await signup(page, "vox", "2468");
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.profile.voice = false; save(); }); // consignes vocales coupées
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(500);
    await page.click("#start"); await sleep(500);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });

    // question dictée : le micro de « Demander au coach »
    await page.click("#ask");
    await page.waitForSelector("#ak-mic");
    await page.evaluate(() => { window.__next = "Combien de repos entre les séries ?"; });
    await page.click("#ak-mic");
    await page.waitForFunction(() => document.querySelector("#ak-out")?.innerText.trim().length > 20, null, { timeout: 8000 });
    assert.match(await page.$eval("#ak-q", e => e.innerText), /🎙️ « Combien de repos entre les séries \? »/);
    const answer = await page.$eval("#ak-out", e => e.innerText.trim());
    await page.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 5000 });
    const spoken = await page.evaluate(() => window.__spoken.at(-1));
    assert.ok(answer.replace(/\s+/g, " ").includes(spoken.slice(0, 30).replace(/\s+/g, " ")), `lu : ${spoken}`); // lu même consignes coupées
    await page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));

    // mains libres : « Coach, … ? » ouvre la réponse et la lit
    const before = await page.evaluate(() => window.__spoken.length);
    await page.evaluate(() => { window.__next = "Coach, j'ai mal à l'épaule, je remplace par quoi ?"; });
    await page.click("#mic");
    await page.waitForSelector("#ak-q", { timeout: 8000 });
    assert.match(await page.$eval("#ak-q", e => e.innerText), /j'ai mal à l'épaule/);
    await page.waitForFunction(n => window.__spoken.length > n, before, { timeout: 5000 });
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
