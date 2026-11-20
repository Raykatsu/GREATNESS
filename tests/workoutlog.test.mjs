// Tes séances dans Apple Santé (js/workoutlog.js) : type d'entraînement, énergie active estimée (MET du Compendium),
// pas de doublon quand la montre a déjà enregistré l'entraînement.
import test from "node:test";
import assert from "node:assert/strict";
import { workoutKind, activeKcal, coveredBy, METS } from "../js/workoutlog.js";

test("type d'entraînement", () => {
  assert.equal(workoutKind({ cat: "gym" }), "strength");
  assert.equal(workoutKind({ cat: "home" }), "strength");
  assert.equal(workoutKind({ cat: "cardio" }), "cardio");
  assert.equal(workoutKind({ cat: "stretch" }), "mobility");
  assert.equal(workoutKind({ cat: "gym" }, { iv: { kind: "tabata" } }), "hiit");
});

test("énergie active : (MET − 1) × poids × durée", () => {
  assert.equal(activeKcal({ minutes: 60, weight: 80 }), (METS.strength - 1) * 80);
  assert.equal(activeKcal({ minutes: 30, weight: 70, kind: "hiit" }), Math.round(7 * 70 * 0.5));
  assert.equal(activeKcal({ minutes: 20, weight: 0, kind: "mobility" }), Math.round(1.5 * 75 / 3), "poids inconnu : 75 kg");
  assert.equal(activeKcal({ minutes: -5 }), 0);
});

test("pas de doublon avec la montre", () => {
  const from = Date.UTC(2026, 10, 20, 18, 0), to = from + 60 * 60e3, iso = t => new Date(t).toISOString();
  const watch = { sourceName: "Apple Watch de Rayane", sourceId: "com.apple.health.1234", startDate: iso(from + 5 * 60e3), endDate: iso(to - 2 * 60e3) };
  assert.ok(coveredBy([watch], from, to));
  assert.ok(!coveredBy([{ ...watch, endDate: iso(from + 20 * 60e3) }], from, to), "moins de la moitié");
  assert.ok(!coveredBy([{ ...watch, sourceName: "GREATNESS", sourceId: "io.github.raykatsu.greatness" }], from, to), "la nôtre ne compte pas");
  assert.ok(!coveredBy([], from, to));
});
