// Le coach IA agit sur toute l'app, dans un iPhone simulé (compte en ligne, IA simulée) : il reçoit la consigne d'agir
// (plus « envoie-moi telle phrase ») et l'état de l'app ; ses actions sont appliquées tout de suite (calories, eau,
// couleur, plan de repas) avec « Annuler » qui remet tout comme avant ; une simple suggestion devient un bouton à
// valider ; une demande simple (« Baisse mes calories de 200 ») marche aussi sans l'IA. Aucune erreur JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, go, sleep } from "./kit.mjs";

const sse = text => `data: ${JSON.stringify({ t: text })}\n\ndata: ${JSON.stringify({ done: true, remaining: 20 })}\n\n`;
const block = a => `\n\`\`\`action\n${JSON.stringify(a)}\n\`\`\``;
const ask = async (page, text) => {
  const n = await page.$$eval(".msg.bot", l => l.length);
  await page.fill("#q", text);
  await page.click("#send");
  await page.waitForFunction(k => document.querySelectorAll(".msg.bot:not(.is-typing)").length > k && !document.querySelector(".is-sending"), n, { timeout: 15000 });
  return page.$eval(".msg-row.bot:last-child .msg", e => e.innerText);
};
const st = page => page.evaluate(async () => {
  const { state } = await import("/js/store.js"); const { targets, dayKey } = await import("/js/nutrition.js");
  return { kcal: targets(state.profile).kcal, custom: !!state.profile.nutri?.custom, water: state.food[dayKey()]?.water || 0, accent: state.profile.accent || "rouge", plan: state.mealPlan?.days?.length || 0, goal: state.profile.goal };
});

test("le coach agit : appliqué tout de suite, annulable, suggestion à valider, demande simple sans IA", { timeout: 150000 }, async () => {
  const app = await openApp({ online: true });
  const { page, errors } = app;
  const sent = [];
  await page.route("**/functions/v1/coach", r => {
    const body = JSON.parse(r.request().postData() || "{}"), q = body.messages?.at(-1)?.content || "";
    sent.push(body.system || "");
    const reply = /trop de calories/.test(q)
      ? `C'est fait : je te mets à 2 000 kcal, j'ajoute tes 2 verres d'eau, l'app passe en bleu et je te compose un plan de 2 jours.${block({ type: "set_nutrition", kcal: 2000 })}${block({ type: "water", add: 2 })}${block({ type: "set_setting", setting: "accent", value: "bleu" })}${block({ type: "meal_plan", days: 2 })}`
      : `Je te propose de passer en force.${block({ type: "set_goal", goal: "force", confirm: true })}`;
    return r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse(reply) });
  });
  try {
    await signup(page, "agit", "2468");
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.profile.mascot = false; save(); });
    const before = await st(page);
    await go(page, "#/coach");
    await page.waitForSelector("#q");

    // l'IA agit : tout est appliqué tout de suite
    const reply = await ask(page, "Le plan me met trop de calories, mets-moi à 2000 et ajoute 2 verres d'eau, et passe l'app en bleu");
    assert.match(sent[0], /### Agir dans l'app/);
    assert.match(sent[0], /Ne lui demande jamais de faire la modification lui-même/);
    assert.match(sent[0], /### État de l'app\n- Objectifs nutrition/);
    assert.doesNotMatch(sent[0], /donne-lui la phrase exacte à envoyer/);
    assert.match(reply, /✓ Objectifs\s?: 2000 kcal/);
    assert.match(reply, /✓ Eau\s?: 2 verre/);
    assert.match(reply, /✓ Plan de repas\s?: 2 jour/);
    assert.doesNotMatch(reply, /```/);
    let s = await st(page);
    assert.deepEqual([s.kcal, s.custom, s.water, s.accent, s.plan], [2000, true, 2, "bleu", 2]);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--red").trim()), "#3b6cf6"); // l'app est passée en bleu
    // le plan composé suit les 2 000 kcal
    const planK = await page.evaluate(async () => { const { state } = await import("/js/store.js"); const { totalsOf } = await import("/js/mealplan.js"); return state.mealPlan.days.map(d => Math.round(totalsOf(d.meals.flatMap(m => m.items)).k)); });
    assert.ok(planK.every(k => Math.abs(k - 2000) <= 100), planK.join(", "));
    // « Voir le plan de repas » ouvre le plan par-dessus la discussion
    await page.click('.msg-row.bot:last-child [data-act]:has-text("Voir le plan de repas")');
    await page.waitForSelector("#pl-day", { timeout: 5000 });
    await page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));

    // « Annuler » : tout revient comme avant
    await page.click(".msg-row.bot:last-child [data-undo]");
    await page.waitForFunction(() => /Modification annulée/.test(document.querySelector("#toast")?.textContent || ""));
    s = await st(page);
    assert.deepEqual([s.kcal, s.custom, s.water, s.accent, s.plan], [before.kcal, false, 0, "rouge", 0]);
    assert.match(await page.$eval(".msg-row.bot:last-child .msg", e => e.innerText), /↩ Modification annulée/);
    assert.equal(await page.$(".msg-row.bot:last-child [data-undo]"), null);

    // une simple suggestion du coach : un bouton à valider, rien n'a encore changé
    const sug = await ask(page, "Tu me conseilles quoi comme objectif ?");
    assert.doesNotMatch(sug, /✓/);
    assert.equal((await st(page)).goal, before.goal);
    await page.click('.msg-row.bot:last-child [data-act]:has-text("Objectif")');
    await page.waitForFunction(async () => (await import("/js/store.js")).state.profile.goal === "force");

    // une demande simple marche tout de suite, sans l'IA, et s'annule pareil
    const n = sent.length, k0 = (await st(page)).kcal;
    const local = await ask(page, "Baisse mes calories de 200");
    assert.equal(sent.length, n, "pas d'appel à l'IA");
    assert.match(local, /✓ Objectifs\s?:/);
    assert.equal((await st(page)).kcal, Math.round((k0 - 200) / 10) * 10);
    await page.click(".msg-row.bot:last-child [data-undo]");
    await sleep(200);
    assert.equal((await st(page)).custom, false);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
