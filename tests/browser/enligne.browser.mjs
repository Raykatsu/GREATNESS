// Compte en ligne (serveur Supabase simulé) dans un iPhone simulé : « Une idée ? Un souci ? » (envoi signé, file
// d'attente hors réseau), boîte « Retours reçus » de l'administrateur, et plantages signalés une seule fois.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

test("en ligne : retours des utilisateurs, administrateur, plantages", { timeout: 180000 }, async () => {
  const app = await openApp({ online: true, rpc: {
    gt_is_admin: () => ({ admin: true }),
    gt_feedback_list: () => ({ feedback: [
      { id: 2, kind: "bug", msg: "Le minuteur saute une seconde", username: "leo", screen: "#/train", version: "greatness-v24", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", at: Date.now() - 6e4 },
      { id: 1, kind: "idea", msg: "Un mode vélo", username: "", screen: "#/", version: "greatness-v24", ua: "", at: Date.now() - 864e5 }],
      errors: [{ msg: "TypeError: x is undefined", place: "js/live.js:412:15", version: "greatness-v24", count: 3, last_at: new Date().toISOString() }] }),
  } });
  const { page, errors, rpcs, net } = app;
  try {
    await signup(page, "nina", "2468");

    // un retour signé
    await go(page, "#/profile");
    await page.click("#feedback");
    await page.click('.fb-kind [data-k="bug"]');
    await page.fill("#fb-text", "Le bouton Valider est caché par le clavier");
    await page.click("#fb-send");
    await page.waitForFunction(() => !document.querySelector("#fb-send"), null, { timeout: 5000 });
    const sent = rpcs.filter(r => r.fn === "gt_feedback_add");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].args.p_kind, "bug");
    assert.equal(sent[0].args.p_token, "t".repeat(64));
    assert.match(sent[0].args.p_version, /^greatness-v\d+$/);
    assert.match(sent[0].args.p_ua, /iPhone/);

    // hors réseau : gardé, puis envoyé au retour de la connexion
    net.down = true;
    await page.click("#feedback");
    await page.fill("#fb-text", "Idée envoyée sans réseau");
    await page.click("#fb-sign"); // anonyme
    await page.click("#fb-send"); await sleep(500);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("greatness.feedback") || "[]").length), 1);
    net.down = false;
    await page.evaluate(() => dispatchEvent(new Event("online")));
    await page.waitForFunction(() => !localStorage.getItem("greatness.feedback"), null, { timeout: 8000 });
    const last = rpcs.filter(r => r.fn === "gt_feedback_add").at(-1).args;
    assert.equal(last.p_text, "Idée envoyée sans réseau");
    assert.equal(last.p_token, null);

    // l'administrateur lit les retours et les plantages dans l'app
    await go(page, "#/profile");
    await page.waitForSelector("#inbox:not(.hidden)", { timeout: 5000 });
    assert.equal(await page.$eval("#inbox-n", e => e.textContent), "2");
    await page.click("#inbox");
    await page.waitForSelector(".fb-item", { timeout: 5000 });
    const items = await page.$$eval(".fb-item", l => l.map(e => e.innerText.replace(/\n+/g, " | ")));
    assert.match(items[0], /@leo/); assert.match(items[0], /minuteur/); assert.match(items[0], /iPhone, iOS 18\.1/);
    assert.match(items[1], /Anonyme/);
    await page.click('#fb-tabs [data-t="err"]');
    assert.match(await page.$eval(".fb-item", e => e.innerText), /×3 · js\/live\.js:412:15/);

    // plantage : signalé une fois, avec la version
    await page.evaluate(() => { setTimeout(() => { null.boom(); }, 0); });
    await sleep(600);
    await page.evaluate(() => { setTimeout(() => { null.boom(); }, 0); });
    await sleep(600);
    const crashes = rpcs.filter(r => r.fn === "gt_error_log");
    assert.equal(crashes.length, 1);
    assert.match(crashes[0].args.p_version, /^greatness-v\d+$/);
    assert.deepEqual(errors.filter(e => !/boom/.test(e)), []);
  } finally { await app.close(); }
});
