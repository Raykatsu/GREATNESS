// Biomécanique : chaque mouvement de force a un agoniste et des rôles cohérents (un muscle n'a qu'un seul rôle) ;
// les étirements et le cardio n'ont pas de biomécanique.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../js/data.js";
import { patternOf } from "../js/motion.js";
import { roles, roleClass } from "../js/biomech.js";

test("tout mouvement de force a un agoniste et des rôles sans doublon", () => {
  let covered = 0;
  for (const id of Object.keys(EXERCISES)) {
    const r = roles(id);
    if (["stretch", "cardio"].includes(patternOf(id))) { assert.equal(r, null, `${id} ne devrait pas avoir de biomécanique`); continue; }
    if (!r) continue; // pattern sans entrée biomécanique : toléré
    covered++;
    assert.ok(r.agonist.length >= 1, `${id} : aucun agoniste`);
    assert.ok(r.how && r.how.length > 20, `${id} : explication manquante`);
    const all = [...r.agonist, ...r.synergist, ...r.antagonist, ...r.stabil];
    assert.equal(new Set(all).size, all.length, `${id} : un muscle a deux rôles`);
  }
  assert.ok(covered > 100, `seulement ${covered} exercices couverts`);
});

test("les couleurs par rôle sont attribuées correctement", () => {
  const r = roles("bench");
  const c = roleClass(r);
  assert.equal(c(r.agonist[0]), "mus p");
  if (r.synergist[0]) assert.equal(c(r.synergist[0]), "mus s");
  if (r.stabil[0]) assert.equal(c(r.stabil[0]), "mus st");
  if (r.antagonist[0]) assert.equal(c(r.antagonist[0]), "mus an");
  assert.equal(c("___aucun___"), "mz");
});
