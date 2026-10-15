// Remontée des plantages (js/errors.js) et version de l'app (js/version.js)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { placeOf, shouldReport } from "../js/errors.js";
import { APP_VERSION } from "../js/version.js";

test("l'endroit du plantage dans notre code", () => {
  const stack = "TypeError: x is undefined\n    at render (https://raykatsu.github.io/GREATNESS/js/live.js:412:15)\n    at https://raykatsu.github.io/GREATNESS/js/app.js:88:3";
  assert.equal(placeOf(stack), "js/live.js:412:15");
  assert.equal(placeOf("render@https://x.io/GREATNESS/js/chars/index.js:170:9"), "js/chars/index.js:170:9");
  assert.equal(placeOf("", "https://x.io/GREATNESS/js/food.js", 10, 4), "js/food.js:10:4");
  assert.equal(placeOf("at chrome-extension://abc/content.js:1:1", "https://ailleurs.com/lib.min.js"), "");
});

test("pas de bruit, pas de doublon dans la journée, 10 par jour au plus", () => {
  const st = {};
  assert.equal(shouldReport("TypeError: a", st, "2026-10-14"), true);
  assert.equal(shouldReport("TypeError: a", st, "2026-10-14"), false);
  for (const m of ["ResizeObserver loop limit exceeded", "Script error.", "AbortError: The operation was aborted.", "TypeError: Failed to fetch", "TypeError: Load failed", ""]) assert.equal(shouldReport(m, st, "2026-10-14"), false, m);
  for (let i = 0; i < 20; i++) shouldReport(`Error ${i}`, st, "2026-10-14");
  assert.equal(st.n, 10);
  assert.equal(shouldReport("TypeError: a", st, "2026-10-15"), true); // nouveau jour
});

test("la version de l'app suit celle du cache hors ligne", () => {
  const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal(sw.match(/const CACHE = "([^"]+)"/)[1], APP_VERSION);
  // tous les modules de l'app sont dans le cache hors ligne
  const listed = new Set([...sw.matchAll(/"([a-z0-9/-]+)"/g)].map(m => m[1]));
  const files = fs.readdirSync(new URL("../js/", import.meta.url)).filter(f => f.endsWith(".js")).map(f => f.replace(/\.js$/, ""));
  const optional = ["voice"]; // déjà listé
  for (const f of files) assert.ok(listed.has(f) || optional.includes(f), `${f}.js absent du cache de sw.js`);
});
