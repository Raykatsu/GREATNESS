// Synchronisation : deux appareils, rien ne doit se perdre.
import test from "node:test";
import assert from "node:assert/strict";
import { mergeData, differs } from "../js/merge.js";

const s = (id, date) => ({ id, date, name: id, sets: [], volume: 0 });

test("séances faites hors ligne sur deux appareils : on garde tout", () => {
  const phone = { sessions: [s("a", 1), s("b", 3)], meta: { updatedAt: 10 } };
  const tablet = { sessions: [s("a", 1), s("c", 2)], meta: { updatedAt: 20 } };
  const m = mergeData(phone, tablet);
  assert.deepEqual(m.sessions.map(x => x.id), ["a", "c", "b"]);
  assert.equal(m.meta.updatedAt, 20);
});

test("une séance supprimée ne revient pas", () => {
  const phone = { sessions: [s("a", 1)], meta: { updatedAt: 10 } };
  const tablet = { sessions: [], deleted: { sessions: ["a"] }, meta: { updatedAt: 20 } };
  assert.equal(mergeData(phone, tablet).sessions.length, 0);
  assert.equal(mergeData(tablet, phone).sessions.length, 0);
});

test("records : on garde le meilleur des deux", () => {
  const a = { lifts: { bench: { weight: 80, reps: 5, best: 93, date: 5 } }, meta: { updatedAt: 30 } };
  const b = { lifts: { bench: { weight: 85, reps: 3, best: 94, date: 9 }, squat: { weight: 100, reps: 5, best: 116, date: 9 } }, meta: { updatedAt: 10 } };
  const m = mergeData(a, b);
  assert.equal(m.lifts.bench.best, 94);
  assert.equal(m.lifts.bench.weight, 85);
  assert.ok(m.lifts.squat);
});

test("séances perso : réunion, la version la plus récente gagne", () => {
  const a = { customPrograms: [{ id: "c1", name: "Vieux nom" }], meta: { updatedAt: 1 } };
  const b = { customPrograms: [{ id: "c1", name: "Nouveau nom" }, { id: "c2", name: "Autre" }], meta: { updatedAt: 2 } };
  const m = mergeData(a, b);
  assert.deepEqual(m.customPrograms.map(p => p.name), ["Nouveau nom", "Autre"]);
});

test("réglages : le côté le plus récent", () => {
  const a = { profile: { goal: "force" }, meta: { updatedAt: 5 } };
  const b = { profile: { goal: "seche" }, meta: { updatedAt: 9 } };
  assert.equal(mergeData(a, b).profile.goal, "seche");
});

test("differs détecte un changement utile", () => {
  const a = { sessions: [s("a", 1)], meta: { updatedAt: 1 } };
  assert.equal(differs(mergeData(a, a), a), false);
  assert.equal(differs(mergeData(a, { sessions: [s("b", 2)], meta: { updatedAt: 2 } }), a), true);
});
