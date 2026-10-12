// IA locale : après un chargement interrompu (téléphone à court de mémoire), on ne relance pas en boucle.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";

test("chargement interrompu : modèle plus petit et pas de relance automatique", async () => {
  localStorage.setItem("greatness.llm", JSON.stringify({ v: 2, model: "Qwen3.5-2B", enabled: true, pending: Date.now() }));
  const llm = await import("../js/llm.js");
  const p = llm.prefs();
  assert.equal(p.model, "Qwen3.5-0.8B");
  assert.equal(p.enabled, false);
  assert.equal(p.pending, null);
  assert.equal(llm.info().status, "error");
  assert.match(llm.info().error, /Léger/);
});
