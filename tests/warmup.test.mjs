// Séries d'échauffement calculées (js/warmup.js) : montée en charge arrondie au pas, barre à vide pour la barre, rien
// pour une charge légère, quels exercices s'échauffent, la phrase du coach.
import test from "node:test";
import assert from "node:assert/strict";
import { warmupSets, needsWarmup, warmupText } from "../js/warmup.js";

test("montée en charge : barre à vide, puis 40, 60 et 80 % arrondis au pas ; rien pour une charge légère", () => {
  assert.deepEqual(warmupSets(100), [{ weight: 20, reps: 10 }, { weight: 40, reps: 5 }, { weight: 60, reps: 3 }, { weight: 80, reps: 2 }]);
  assert.deepEqual(warmupSets(62.5), [{ weight: 20, reps: 10 }, { weight: 25, reps: 5 }, { weight: 37.5, reps: 3 }, { weight: 50, reps: 2 }]);
  // 45 kg : la barre et 40 % se confondent presque, le palier à 20 kg n'est pas répété
  assert.deepEqual(warmupSets(45), [{ weight: 20, reps: 10 }, { weight: 27.5, reps: 3 }, { weight: 35, reps: 2 }]);
  assert.deepEqual(warmupSets(25), [], "charge légère : rien à préparer");
  // haltères : pas de barre, pas de 2 kg
  assert.deepEqual(warmupSets(30, { step: 2, equip: "db" }), [{ weight: 12, reps: 5 }, { weight: 18, reps: 3 }, { weight: 24, reps: 2 }]);
  assert.deepEqual(warmupSets(12, { step: 2, equip: "db" }), []);
  assert.deepEqual(warmupSets(NaN), []);
});

test("quels exercices s'échauffent : la barre, et le premier mouvement chargé de la séance", () => {
  const plan = [
    { id: "lateral", type: "load", weight: 8, equip: "db" },
    { id: "pushdown", type: "load", weight: 20, equip: "cable" },
    { id: "bench", type: "load", weight: 60, equip: "bar" },
    { id: "incline_db", type: "load", weight: 22, equip: "db" },
    { id: "dips", type: "reps", weight: 0, equip: "bw" },
  ];
  assert.deepEqual(plan.map((e, i) => needsWarmup(e, i, plan)), [true, false, true, false, false]);
});

test("la phrase du coach", () => {
  assert.equal(warmupText(warmupSets(62.5)), "Échauffement : barre à vide × 10, 25 kg × 5, 37,5 kg × 3, 50 kg × 2.");
  assert.equal(warmupText(warmupSets(30, { step: 2, equip: "db" })), "Échauffement : 12 kg × 5, 18 kg × 3, 24 kg × 2.");
  assert.equal(warmupText([]), "");
});
