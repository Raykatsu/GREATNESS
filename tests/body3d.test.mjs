// Modèle 3D : les pièces du corps sont bien formées (sommets, normales, indices valides) et les muscles éclairables
// existent. supports3D() ne plante pas sans navigateur.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { PARTS, supports3D } from "../js/body3d.js";
import { MUSCLES } from "../js/body.js";

test("le corps 3D est fait de pièces valides", () => {
  assert.ok(PARTS.length >= 20, `${PARTS.length} pièces`);
  for (const p of PARTS) {
    assert.ok(Array.isArray(p.cc) && p.cc.length === 3 && p.cc.every(Number.isFinite), "centre");
    assert.ok(p.rr > 0, "rayon");
    assert.ok(p.pos.length % 3 === 0 && p.pos.length > 0 && p.pos.every(Number.isFinite), "sommets");
    assert.equal(p.nor.length, p.pos.length, "une normale par sommet");
    assert.ok(p.idx.length % 3 === 0 && p.idx.length > 0, "triangles");
    const n = p.pos.length / 3;
    for (const i of p.idx) assert.ok(i >= 0 && i < n, "indice dans les bornes");
    if (p.id) assert.ok(MUSCLES[p.id], `muscle inconnu : ${p.id}`);
  }
  // au moins les gros muscles sont présents
  const ids = new Set(PARTS.map(p => p.id).filter(Boolean));
  for (const m of ["pecs", "delts", "lats", "biceps", "triceps", "abs", "quads", "hams", "glutes", "calves"]) assert.ok(ids.has(m), m);
});

test("supports3D() renvoie un booléen sans navigateur", () => {
  assert.equal(typeof supports3D(), "boolean");
});
