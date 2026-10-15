// Accessibilité (axe-core, WCAG 2.1 A et AA) de chaque écran et des principales feuilles, dans un iPhone simulé,
// en thème sombre puis clair : contrastes, noms des boutons, rôles, feuilles utilisables au lecteur d'écran.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { openApp, signup, seed, go, closeSheets, sleep, ROOT } from "./kit.mjs";

const AXE = path.join(ROOT, "node_modules/axe-core/axe.min.js");

async function audit(page, name, found) {
  // les bulles de notification passent en fondu : on audite l'écran une fois qu'elles sont parties
  await page.waitForFunction(() => !document.querySelector(".toast.show"), null, { timeout: 8000 }).catch(() => {});
  await page.addScriptTag({ path: AXE }).catch(() => {});
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }))
    .violations.map(v => `${v.id} (${v.nodes.length}) : ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`));
  for (const x of v) found.push(`${name} · ${x}`);
}

for (const mode of ["dark", "light"]) {
  test(`accessibilité : tous les écrans en thème ${mode === "dark" ? "sombre" : "clair"}`, { timeout: 240000 }, async () => {
    const app = await openApp({ colorScheme: mode, online: true, rpc: { gt_is_admin: () => ({ admin: true }), gt_feedback_list: () => ({ feedback: [], errors: [] }) } });
    const { page, errors } = app, found = [];
    try {
      await audit(page, "connexion", found);
      await signup(page, "access", "1357");
      await seed(page, 8);
      if (mode === "light") await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); const { applyAppearance } = await import("/js/actions.js"); state.profile.mode = "light"; save(); applyAppearance(); });
      for (const [h, name] of [["#/", "accueil"], ["#/train", "séances"], ["#/create", "créer"], ["#/food", "repas"], ["#/coach", "coach"], ["#/progress", "progrès"], ["#/profile", "réglages"]]) {
        await go(page, h); await sleep(300);
        await audit(page, name, found);
      }
      // feuilles
      const sheets = [
        ["mode histoire", async () => (await import("/js/story-ui.js")).openStory()],
        ["démo squat", async () => (await import("/js/demo.js")).openDemo("squat")],
        ["une idée ? un souci ?", async () => (await import("/js/feedback.js")).openFeedback()],
        ["retours reçus", async () => (await import("/js/feedback.js")).openInbox()],
        ["carte à partager", async () => { const { state } = await import("/js/store.js"); return (await import("/js/sharecard.js")).openShare(state.sessions.at(-1)); }],
        ["programme célèbre", async () => (await import("/js/classics-ui.js")).openClassic("gzclp")],
      ];
      for (const [name, fn] of sheets) {
        await go(page, "#/");
        await page.evaluate(`(${fn})()`); await sleep(1200);
        await audit(page, name, found);
        await closeSheets(page);
      }
      // séance en direct et repos
      await go(page, "#/train");
      await page.click('.prog[data-id="push"]'); await sleep(600);
      await audit(page, "aperçu de séance", found);
      await page.click("#start").catch(() => {}); await sleep(600);
      await audit(page, "bilan de forme", found);
      await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
      await audit(page, "séance en direct", found);
      await page.click("#ask"); await sleep(500);
      await audit(page, "demander au coach", found);
      await closeSheets(page);
      await page.click("#log"); await sleep(700);
      await audit(page, "repos", found);
      assert.deepEqual(found, [], `\n${found.join("\n")}`);
      assert.deepEqual(errors, []);
    } finally { await app.close(); }
  });
}
