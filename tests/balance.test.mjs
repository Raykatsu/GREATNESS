// Équilibre musculaire et charge d'entraînement (js/balance.js), d'après les vraies séances : séries par muscle et par
// semaine (les muscles qui aident comptent pour moitié, les étirements pour rien), déséquilibres pousser / tirer,
// quadriceps / ischios, haut / bas du corps avec la séance de rattrapage, et charge de la semaine face aux 4 précédentes.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { weeklySets, volLevel, balanceOf, sessionLoad, trainingLoad } from "../js/balance.js";
import { balanceCardHtml, loadCardHtml } from "../js/balance-ui.js";
import { musclesOf } from "../js/recovery.js";

const DAY = 864e5, NOW = Date.UTC(2026, 10, 18, 12);
let n = 0;
// séance d'il y a d jours : [exercice, nombre de séries, ressenti]
const sess = (d, sets, extra = {}) => ({ id: `s${n++}`, date: NOW - d * DAY, sets: sets.flatMap(([exId, k, rpe]) => Array.from({ length: k }, () => ({ exId, weight: 50, reps: 8, rpe }))), ...extra });
// 4 semaines, une séance tous les 3 jours avec les mêmes exercices
const month = sets => Array.from({ length: 9 }, (_, i) => sess(1 + i * 3, sets));

test("séries par muscle et par semaine : muscles qui aident pour moitié, étirements pour rien", () => {
  const list = [0, 1, 2, 3].map(w => sess(2 + w * 7, [["bench", 4], ["child_pose", 3]]));
  const s = weeklySets(list, { now: NOW });
  const m = musclesOf("bench");
  for (const p of m.p) assert.equal(s[p], 4, p);
  for (const x of m.s) assert.equal(s[x], 2, x);
  assert.equal(s.hams, 0);
  // une séance hors des 4 semaines ne compte pas
  assert.equal(weeklySets([sess(40, [["bench", 4]])], { now: NOW }).pecs, 0);
  assert.deepEqual([3, 7, 15, 25].map(volLevel), ["low", "ok", "ideal", "high"]);
});

test("équilibre : pas assez de séances, puis pousser sans tirer, quadriceps sans ischios, séance de rattrapage", () => {
  assert.equal(balanceOf([sess(1, [["bench", 4]]), sess(3, [["ohp", 4]])], { now: NOW }).enough, false);
  // que du « pousser » et des quadriceps
  const B = balanceOf(month([["bench", 4], ["ohp", 3], ["pushdown", 3], ["leg_ext", 4]]), { now: NOW });
  assert.ok(B.enough);
  assert.ok(B.issues.some(i => i.k === "push"), "pousser > tirer");
  assert.ok(B.issues.some(i => i.k === "hams"), "ischios en retard");
  assert.ok(B.low.includes("lats") && B.low.includes("hams"));
  assert.ok(B.groups.includes("dos") && B.groups.includes("jambes"), B.groups.join());
  assert.ok(B.groups.length <= 3);
  // programme complet : pas de déséquilibre pousser / tirer ni avant / arrière de cuisse
  const ok = balanceOf(month([["bench", 3], ["row", 3], ["lat_pull", 3], ["ohp", 3], ["squat", 3], ["rdl", 3], ["leg_curl", 2]]), { now: NOW });
  assert.ok(!ok.issues.some(i => ["push", "pull", "hams", "legs", "upper"].includes(i.k)), ok.issues.map(i => i.k).join());
  // haut du corps seulement : le bas est oublié
  assert.ok(balanceOf(month([["bench", 4], ["row", 4], ["curl", 3]]), { now: NOW }).issues.some(i => i.k === "legs"));
});

test("charge : séries dures selon le ressenti, intervalles compris ; semaine comparée aux 4 précédentes", () => {
  assert.ok(sessionLoad(sess(0, [["bench", 3, 10]])) > sessionLoad(sess(0, [["bench", 3, 6]])));
  assert.equal(sessionLoad(sess(0, [["child_pose", 3]])), 0);
  assert.ok(sessionLoad(sess(0, [], { iv: { work: [{ sec: 40 }, { sec: 40 }] } })) >= 2);
  const weeks = (k, last) => [1, 2, 3, 4].flatMap(w => [sess(w * 7 + 1, [["bench", k], ["squat", k]]), sess(w * 7 + 4, [["row", k]])])
    .concat(last ? [sess(1, [["bench", last], ["squat", last]]), sess(4, [["row", last]])] : []);
  assert.equal(trainingLoad([sess(1, [["bench", 4]])], { now: NOW }).zone, "new");
  // débutant (2 semaines d'avant sur 4) : pas encore de comparaison, la charge monte forcément
  assert.equal(trainingLoad([sess(1, [["bench", 8]]), sess(8, [["bench", 4]]), sess(15, [["bench", 4]])], { now: NOW }).zone, "new");
  const ok = trainingLoad(weeks(4, 4), { now: NOW });
  assert.equal(ok.zone, "ok"); assert.ok(Math.abs(ok.ratio - 1) < 0.05, ok.ratio);
  assert.equal(ok.weeks.length, 8);
  assert.equal(trainingLoad(weeks(4, 8), { now: NOW }).zone, "spike");
  assert.equal(trainingLoad(weeks(4, 6), { now: NOW }).zone, "high");
  const low = trainingLoad(weeks(4, 2), { now: NOW });
  assert.equal(low.zone, "low"); assert.match(low.text, /50 %/);
});

test("cartes de l'onglet Progrès : charge et équilibre, avec le bouton de séance de rattrapage", () => {
  const list = month([["bench", 4], ["ohp", 3], ["pushdown", 3], ["leg_ext", 4]]);
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const bal = balanceCardHtml(list), load = loadCardHtml(list);
    assert.match(bal, /Équilibre musculaire/);
    assert.match(bal, /id="bal-go"/);
    assert.match(bal, /data-g="[^"]*dos/);
    assert.match(load, /Charge d'entraînement/);
    assert.match(balanceCardHtml([]), /Encore quelques séances/);
  } finally { Date.now = realNow; }
});
