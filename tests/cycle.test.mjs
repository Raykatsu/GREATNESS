// Périodisation (planner.js, cycle-ui.js) : le cycle de 7 semaines enchaîne Volume, Force, Pic (2 semaines chacun) puis
// la semaine allégée ; la fourchette de reps et le ressenti visé suivent le bloc, la double progression fait monter les
// charges quand la fourchette descend ; carte « Ton cycle » et note du bloc dans l'aperçu.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { state, getProgram } from "../js/store.js";
import { cycleInfo, blockTargets, adaptToGoal, BLOCKS } from "../js/planner.js";
import { progressionOf } from "../js/engine.js";
import { cycleCardHtml, blockNote } from "../js/cycle-ui.js";

const D = 864e5, START = Date.UTC(2026, 0, 5, 9);
const weekNow = k => START + (k - 1) * 7 * D + D; // un jour après le début de la semaine k du cycle

test("cycle : Volume, Force, Pic deux semaines chacun, puis la semaine allégée, en boucle ; désactivable", () => {
  state.cycleStart = START; state.profile.deload = true;
  const blocks = Array.from({ length: 14 }, (_, i) => cycleInfo(weekNow(i + 1)).block);
  assert.deepEqual(blocks, ["volume", "volume", "force", "force", "pic", "pic", "deload", "volume", "volume", "force", "force", "pic", "pic", "deload"]);
  const w7 = cycleInfo(weekNow(7));
  assert.equal(w7.deload, true); assert.equal(w7.pos, 7);
  assert.equal(cycleInfo(weekNow(6)).next, 1, "dernière semaine avant la semaine allégée");
  state.profile.deload = false;
  assert.deepEqual([cycleInfo(weekNow(3)).week, cycleInfo(weekNow(3)).block], [0, null]);
  state.profile.deload = true;
  for (const b of ["volume", "force", "pic", "deload"]) assert.ok(BLOCKS[b].name && BLOCKS[b].text);
});

test("cibles des blocs : plus de reps en Volume, moins en Pic, pour chaque objectif", () => {
  assert.deepEqual(blockTargets("muscle", "volume").main, [8, 12]);
  assert.deepEqual(blockTargets("muscle", "force").main, [6, 10]);
  assert.deepEqual(blockTargets("muscle", "pic").main, [4, 8]);
  assert.deepEqual(blockTargets("force", "volume").main, [5, 8]);
  assert.deepEqual(blockTargets("force", "pic").main, [3, 5]);
  for (const goal of ["force", "muscle", "seche", "forme"]) {
    const v = blockTargets(goal, "volume"), f = blockTargets(goal, "force"), p = blockTargets(goal, "pic");
    assert.ok(v.main[1] > f.main[1] && f.main[1] > p.main[1], goal);
    assert.ok(v.rpe < f.rpe && f.rpe < p.rpe, `${goal} : ressenti`);
    assert.ok(p.mainRest > f.mainRest, `${goal} : repos`);
    assert.ok(v.acc[1] <= 20);
    assert.deepEqual(blockTargets(goal, "deload").main, f.main, `${goal} : semaine allégée, fourchette normale`);
  }
});

test("séance du jour : la fourchette suit le bloc ; programmes célèbres, séances perso et exercices en secondes intacts", () => {
  state.profile.goal = "muscle"; state.profile.experience = "intermediaire";
  const push = getProgram("push");
  const main = b => adaptToGoal(push, "muscle", "intermediaire", b).exercises.find(e => e.weight > 0);
  assert.deepEqual(main("volume").reps, [8, 12]);
  assert.deepEqual(main("pic").reps, [4, 8]);
  assert.ok(main("pic").rpe > main("volume").rpe);
  const custom = { ...push, cat: "custom" }, classic = { ...push, classic: true };
  assert.equal(adaptToGoal(custom, "muscle", "intermediaire", "pic"), custom);
  assert.equal(adaptToGoal(classic, "muscle", "intermediaire", "pic"), classic);
  const timed = { ...push, exercises: [{ id: "plank", sets: 3, reps: [30, 45], weight: 0, rest: 45, rpe: 7 }] };
  assert.deepEqual(adaptToGoal(timed, "muscle", "intermediaire", "pic").exercises[0].reps, [30, 45]);
  // passage du Volume au Pic : 10 reps faites, la fourchette descend à 4-8 → la charge monte
  state.lifts.bench = { weight: 60, reps: 10, rpe: 8, date: Date.now(), best: 80, bestReps: 0 };
  const p = progressionOf({ id: "bench", reps: blockTargets("muscle", "pic").main, weight: 60, sets: 4 });
  assert.equal(p.move, "up"); assert.ok(p.weight > 60);
});

test("carte « Ton cycle » et note du bloc dans l'aperçu", () => {
  state.cycleStart = START; state.profile.deload = true; state.profile.goal = "muscle";
  const card = cycleCardHtml(weekNow(3));
  assert.match(card, /semaine 3 sur 7/);
  assert.match(card, /cy-b b-force">Force/);
  assert.match(card, /6–10/);
  assert.match(card, /Ensuite :<\/span> <b>Pic<\/b> <span>dans<\/span> <span class="tnum">2<\/span>/);
  assert.equal((card.match(/<i class="b-/g) || []).length, 7);
  assert.match(cycleCardHtml(weekNow(7)), /Récupération/);
  assert.match(blockNote(getProgram("push"), weekNow(5)), /Bloc Pic/);
  assert.equal(blockNote(getProgram("mobility"), weekNow(5)), "");
  assert.equal(blockNote(getProgram("push"), weekNow(7)), "", "semaine allégée : pas de note de bloc");
  state.profile.deload = false;
  assert.equal(cycleCardHtml(weekNow(3)), "");
  state.profile.deload = true; state.cycleStart = null;
});
