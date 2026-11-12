// Manuel des exercices : chaque muscle a ses exercices, et chaque exercice listé existe vraiment et a une démo.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { muscleIndex, manualCard } from "../js/manual.js";
import { EXERCISES } from "../js/data.js";
import { MUSCLES } from "../js/body.js";

test("chaque muscle a des exercices principaux, tous valides et non perso", () => {
  const idx = muscleIndex();
  for (const [m, { p, s }] of Object.entries(idx)) {
    assert.ok(MUSCLES[m], `muscle inconnu : ${m}`);
    assert.ok(p.length >= 1, `${MUSCLES[m]} : aucun exercice principal`);
    for (const id of [...p, ...s]) {
      assert.ok(EXERCISES[id] && !EXERCISES[id].custom, `${m} : exercice « ${id} » introuvable ou perso`);
    }
  }
  // les 17 muscles de la carte sont couverts
  assert.equal(Object.keys(idx).length, Object.keys(MUSCLES).length);
});

test("la carte d'entrée ouvre le manuel", () => {
  const c = manualCard();
  assert.match(c, /id="manual-start"/);
  assert.match(c, /Manuel des exercices/);
});
