// Le bilan de chaque cycle (js/cyclereport.js) : quand le montrer, séances, volume comparé au cycle d'avant, records,
// ce que les mouvements ont gagné (meilleur 1RM estimé du cycle contre celui d'avant).
import test from "node:test";
import assert from "node:assert/strict";
import { reportCycle, cycleReport, CYCLE_MS } from "../js/cyclereport.js";

const DAY = 864e5, START = Date.UTC(2026, 0, 5);
const at = (week, day = 1) => START + (week - 1) * 7 * DAY + day * DAY;
const sess = (date, sets, volume = 1000) => ({ id: String(date), date, volume, sets });
const set = (exId, weight, reps) => ({ exId, name: { bench: "Développé couché", squat: "Squat" }[exId], weight, reps });

test("quand montrer le bilan : la semaine de récupération du cycle, puis la première semaine du suivant", () => {
  assert.equal(reportCycle(START, at(1)), 0);
  assert.equal(reportCycle(START, at(6)), 0, "semaine test : pas encore");
  assert.equal(reportCycle(START, at(7)), 1, "récupération du cycle 1");
  assert.equal(reportCycle(START, at(8)), 1, "première semaine du cycle 2 : le bilan du cycle 1");
  assert.equal(reportCycle(START, at(9)), 0);
  assert.equal(reportCycle(START, at(14)), 2);
  assert.equal(reportCycle(0, at(7)), 0, "pas de cycle");
  assert.equal(reportCycle(START, START - DAY), 0);
});

test("bilan : séances, volume contre le cycle d'avant, records, progrès des mouvements", () => {
  const sessions = [
    // avant le cycle 2 (cycle 1) : la référence
    sess(at(2), [set("bench", 80, 8), set("squat", 100, 5)], 2000),
    sess(at(5), [set("bench", 82.5, 6)], 1500),
    // cycle 2 : développé couché qui monte (2 records), squat plus léger, un mouvement nouveau (pas de comparaison)
    sess(at(9), [set("bench", 82.5, 8), set("squat", 90, 5)], 2200),
    sess(at(12), [set("bench", 85, 8), { exId: "row", name: "Rowing", weight: 60, reps: 10 }], 2600),
    sess(at(13), [set("bench", 84, 8)], 1700),
    // après le cycle 2 : ignoré
    sess(at(15), [set("bench", 100, 8)], 9000),
  ];
  const r = cycleReport(sessions, START, 2);
  assert.equal(r.to - r.from, CYCLE_MS);
  assert.deepEqual([r.sessions, r.volume, r.records], [3, 6500, 2]);
  assert.equal(r.volumeVsPrev, Math.round(((6500 - 3500) / 3500) * 100));
  assert.deepEqual(r.lifts.map(l => [l.name, l.before, l.now]), [["Développé couché", 101.3, 107.7], ["Squat", 116.7, 105]]);
  assert.ok(r.lifts[0].pct > 0 && r.lifts[1].pct < 0);
  assert.deepEqual([r.up, r.tracked], [1, 2]);
  // premier cycle : rien à comparer
  const first = cycleReport(sessions, START, 1);
  assert.deepEqual([first.sessions, first.records, first.volumeVsPrev, first.tracked], [2, 0, null, 0]);
});
