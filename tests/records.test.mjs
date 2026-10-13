// Progrès en images : niveaux de force, mur des records, courbes de force, photos (calculs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { strengthLevel, liftRecords, curvePoints, curveChoices } from "../js/records.js";
import { linear } from "../js/chart.js";
import { measureNear, spanText } from "../js/records.js";

const DAY = 864e5, T0 = Date.UTC(2026, 6, 6, 18);
const sess = (i, sets) => ({ id: "s" + i, date: T0 + i * 7 * DAY, name: "S", volume: 1, durationSec: 1, prs: [], sets: sets.map(([exId, weight, reps]) => ({ exId, name: exId, weight, reps })) });

test("niveau de force selon le poids de corps et le sexe", () => {
  const a = strengthLevel("bench", 100, { bw: 80, sex: "m" }); // 1,25 × le poids
  assert.equal(a.name, "Intermédiaire");
  assert.equal(a.next, 120); // avancé : 1,5 × 80
  assert.ok(a.pct > 0.4 && a.pct < 0.6);
  assert.equal(strengthLevel("bench", 100, { bw: 80, sex: "f" }).name, "Élite");
  assert.equal(strengthLevel("pullup", 8, { sex: "m" }).name, "Intermédiaire");
  assert.equal(strengthLevel("pullup", 8, { sex: "m" }).next, 12);
  assert.equal(strengthLevel("leg_ext", 80), null); // pas de repère pour cet exercice
  assert.equal(strengthLevel("squat", 0, { bw: 80 }), null);
});

test("mur des records : charge réelle, 1RM, progression, palier, plaques", () => {
  const st = {
    profile: { bodyweight: 80, sex: "m" },
    sessions: [
      sess(0, [["bench", 70, 8], ["pullup", 0, 5]]),
      sess(1, [["bench", 80, 5], ["bench", 75, 8], ["pullup", 0, 8]]),
      sess(2, [["bench", 85, 3], ["pullup", 0, 7], ["cat_cow", 0, 30]]),
    ],
  };
  const list = liftRecords(st, T0 + 15 * DAY);
  const bench = list.find(r => r.id === "bench"), pull = list.find(r => r.id === "pullup");
  assert.equal(bench.value, 85); assert.equal(bench.reps, 3);
  assert.equal(Math.round(bench.e1rm), Math.round(75 * (1 + 8 / 30))); // 95 : la série à 75 × 8
  assert.ok(bench.gain > 0);
  assert.equal(bench.next, 90); assert.equal(bench.toNext, 5);
  assert.equal(bench.plates, 3); // 85 kg : 1 plaque (60) atteinte → index 3 dans [180, 140, 100, 60]
  assert.equal(bench.level.name, "Intermédiaire");
  assert.equal(pull.load, false); assert.equal(pull.value, 8); assert.equal(pull.gain, 3);
  assert.ok(!list.some(r => r.id === "cat_cow")); // mobilité exclue
  assert.equal(list.find(r => r.id === "bench").recent, true);
});

test("courbes : records marqués, période, total des 3 grands mouvements", () => {
  const st = {
    profile: {},
    sessions: [
      sess(0, [["squat", 100, 5], ["bench", 70, 5], ["deadlift", 120, 5]]),
      sess(1, [["squat", 105, 5], ["bench", 70, 5]]),
      sess(2, [["squat", 100, 5], ["bench", 75, 5], ["deadlift", 130, 5]]),
      sess(3, [["squat", 110, 5]]),
    ],
  };
  const sq = curvePoints(st, "squat");
  assert.equal(sq.pts.length, 4);
  assert.deepEqual(sq.marks, [1, 3]);
  const late = curvePoints(st, "squat", T0 + 2 * 7 * DAY);
  assert.equal(late.pts.length, 2);
  assert.deepEqual(late.marks, [1]);
  const tot = curvePoints(st, "total");
  assert.equal(tot.pts.length, 4);
  assert.ok(tot.pts[3].y > tot.pts[0].y);
  assert.deepEqual(curveChoices(st), ["squat", "bench", "deadlift", "total"]);
});

test("tendance, mesures proches d'une photo, durée lisible", () => {
  const f = linear([{ x: 0, y: 100 }, { x: 30 * DAY, y: 103 }, { x: 60 * DAY, y: 106 }]);
  assert.ok(Math.abs(f.perDay * 30 - 3) < 1e-9);
  const body = [{ date: T0, weight: 80 }, { date: T0 + 20 * DAY, weight: 78.5, waist: 84 }];
  assert.equal(measureNear(body, T0 + 2 * DAY), 80);
  assert.equal(measureNear(body, T0 + 10 * DAY), null);
  assert.equal(measureNear(body, T0 + 19 * DAY, "waist"), 84);
  assert.equal(spanText(9 * DAY), "en 9 jours");
  assert.equal(spanText(63 * DAY), "en 9 semaines");
  assert.equal(spanText(120 * DAY), "en 4 mois");
});
