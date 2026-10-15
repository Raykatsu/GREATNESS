// Préchargement des modules du démarrage (scripts/preload.mjs) : index.html doit être à jour
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { startupModules, withPreloads } from "../scripts/preload.mjs";

test("index.html précharge exactement les modules du démarrage", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const mods = startupModules();
  assert.equal(mods[0], "js/app.js");
  assert.ok(mods.includes("js/store.js") && mods.includes("js/chars/index.js"));
  assert.ok(!mods.includes("js/import-ui.js") && !mods.includes("js/videocoach.js"), "chargés à la demande");
  assert.equal(withPreloads(html, mods), html, "index.html n'est pas à jour : lance node scripts/preload.mjs");
  for (const m of mods) assert.ok(fs.existsSync(new URL(`../${m}`, import.meta.url)), m);
});
