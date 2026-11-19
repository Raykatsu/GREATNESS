// Le récap de fin de séance (js/recap.js) : séries par muscle (principal 1, qui aide ½, étirements et course à 0), les
// muscles très sollicités / sollicités pour la planche et le corps 3D, les plus travaillés d'abord.
import test from "node:test";
import assert from "node:assert/strict";
import { sessionMuscles, workedClass, topMuscles, HARD } from "../js/recap.js";

const sets = ids => ids.map(exId => ({ exId, weight: 60, reps: 8 }));

test("séries par muscle : principal 1, muscle qui aide ½, rien pour les étirements ni la course", () => {
  const mus = sessionMuscles(sets(["bench", "bench", "bench", "squat", "squat", "run", "stretch-hams"]));
  assert.equal(mus.pecs, 3);
  assert.equal(mus.triceps, 3);
  assert.equal(mus.delts, 1.5);
  assert.equal(mus.quads, 2);
  assert.equal(mus.hams, 1);
  assert.equal(mus.lats, undefined, "la course et les étirements ne comptent pas");
  assert.deepEqual(sessionMuscles([]), {});
});

test("couleurs : très sollicité à partir de 3 séries, sollicité en dessous, le reste éteint", () => {
  const cls = workedClass({ pecs: HARD, delts: 1.5, quads: 0 });
  assert.equal(cls("pecs"), "mus p");
  assert.equal(cls("delts"), "mus s");
  assert.equal(cls("quads"), "mz");
  assert.equal(cls("calves"), "mz");
});

test("les plus travaillés d'abord, avec leur nom", () => {
  const top = topMuscles({ delts: 1.5, pecs: 3, calves: 0, quads: 2 }, 2);
  assert.deepEqual(top.map(t => [t.id, t.name, t.sets]), [["pecs", "Pectoraux", 3], ["quads", "Quadriceps", 2]]);
  assert.equal(topMuscles({}).length, 0);
});
