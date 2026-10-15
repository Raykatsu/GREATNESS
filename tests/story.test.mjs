// Mode histoire (js/story.js) et costumes (js/costumes.js) ; fusion entre appareils
import test from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, GOALS, storyStart, storyStatus, advanceStory, chapterText, wornCostume } from "../js/story.js";
import { COSTUMES, costumeOf } from "../js/costumes.js";
import { mergeData } from "../js/merge.js";

const T0 = Date.UTC(2026, 9, 1, 12);
const sess = (d, extra = {}) => ({ id: `s${d}-${Math.random()}`, date: T0 + d * 864e5, volume: 2000, durationSec: 3000, prs: [], sets: [], ...extra });

test("dix chapitres, chacun avec un objectif connu et des costumes qui existent", () => {
  assert.equal(CHAPTERS.length, 10);
  assert.equal(new Set(CHAPTERS.map(c => c.id)).size, 10);
  for (const c of CHAPTERS) {
    assert.ok(GOALS[c.goal.kind], c.id);
    assert.ok(c.goal.n > 0);
    for (const r of [].concat(c.reward)) assert.ok(COSTUMES[r], `${c.id} → ${r}`);
    assert.match(c.text, /\S/);
  }
  // chaque costume se gagne une seule fois
  const all = CHAPTERS.flatMap(c => [].concat(c.reward));
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(Object.keys(COSTUMES).sort(), [...all].sort());
  assert.equal(costumeOf("cape").name, "Cape de héros");
  assert.equal(costumeOf("inconnu"), null);
  for (const c of Object.values(COSTUMES)) assert.ok(c.filter || c.head || c.torso || c.back);
  assert.equal(chapterText(CHAPTERS[0], "Kitty").includes("Kitty"), true);
});

test("objectifs comptés depuis le début du chapitre, sans les séances importées", () => {
  const st = { sessions: [sess(-3), sess(1, { imported: "strong" }), sess(2, { prs: ["bench"], kind: "interval" }), sess(3, { programId: "mobility" })],
    food: { "2026-10-02": { items: [{}] }, "2026-09-20": { items: [{}] }, "2026-10-03": { items: [] } }, formChecks: [{ at: T0 + 864e5 }, { at: T0 - 864e5 }] };
  const f = T0;
  assert.equal(GOALS.sessions.val(st, f), 2);
  assert.equal(GOALS.volume.val(st, f), 4000);
  assert.equal(GOALS.prs.val(st, f), 1);
  assert.equal(GOALS.minutes.val(st, f), 100);
  assert.equal(GOALS.interval.val(st, f), 1);
  assert.equal(GOALS.mobility.val(st, f), 1);
  assert.equal(GOALS.food.val(st, f), 1);
  assert.equal(GOALS.video.val(st, f), 1);
  assert.equal(GOALS.volume.fmt(5000), "5 000 kg soulevés".replace(" ", " "));
});

test("l'histoire avance chapitre par chapitre ; chaque objectif demande de nouvelles séances ; costumes gagnés", () => {
  const st = { profile: { costume: "cape" }, sessions: [], story: storyStart(T0) };
  let s = storyStatus(st, T0);
  assert.deepEqual([s.index, s.chapter.id, s.value, s.goal, s.progress, s.unlocked], [0, "reveil", 0, 2, "0 / 2", []]);
  assert.equal(wornCostume(st), null); // pas encore gagné : pas porté
  st.sessions.push(sess(1));
  assert.deepEqual(advanceStory(st, T0 + 2 * 864e5), []);
  st.sessions.push(sess(2));
  const now = T0 + 3 * 864e5;
  const won = advanceStory(st, now);
  assert.deepEqual(won.map(w => [w.chapter.id, w.rewards]), [["reveil", ["bandeau"]]]);
  s = storyStatus(st, now);
  assert.deepEqual([s.index, s.chapter.id, s.value, s.unlocked], [1, "salle", 0, ["bandeau"]]); // le volume d'avant ne compte plus
  st.profile.costume = "bandeau";
  assert.equal(wornCostume(st), "bandeau");
  // une grosse séance ne valide qu'un chapitre : le suivant commence à cet instant
  st.sessions.push(sess(4, { volume: 6000, prs: ["squat"], kind: "interval" }));
  const won2 = advanceStory(st, T0 + 5 * 864e5);
  assert.deepEqual(won2.map(w => w.chapter.id), ["salle"]); // le chapitre suivant commence maintenant : la même séance ne compte pas deux fois
  assert.equal(storyStatus(st, T0 + 5 * 864e5).chapter.id, "dojo");
  // fin de l'histoire
  st.story = { chapter: 9, started: T0, done: Object.fromEntries(CHAPTERS.slice(0, 9).map(c => [c.id, T0])) };
  for (let d = 10; d < 16; d++) st.sessions.push(sess(d));
  assert.deepEqual(advanceStory(st, T0 + 20 * 864e5).map(w => w.rewards), [["couronne", "or"]]);
  s = storyStatus(st);
  assert.equal(s.finished, true);
  assert.equal(s.unlocked.length, 11);
  assert.deepEqual(advanceStory(st), []);
});

test("fusion entre deux téléphones : chapitres réunis, le plus avancé gardé, analyses vidéo réunies", () => {
  const a = { meta: { updatedAt: 1 }, story: { chapter: 2, started: 500, done: { reveil: 100, salle: 300 } }, formChecks: [{ id: "a", at: 1 }] };
  const b = { meta: { updatedAt: 2 }, story: { chapter: 1, started: 200, done: { reveil: 90 } }, formChecks: [{ id: "b", at: 2 }] };
  const m = mergeData(a, b);
  assert.deepEqual(m.story, { chapter: 2, started: 500, done: { reveil: 90, salle: 300 } });
  assert.deepEqual(m.formChecks.map(x => x.id), ["a", "b"]);
  // même chapitre : le début le plus ancien (plus de séances comptées)
  assert.equal(mergeData({ story: { chapter: 1, started: 900 } }, { meta: { updatedAt: 5 }, story: { chapter: 1, started: 400 } }).story.started, 400);
  assert.equal(mergeData({}, {}).story, undefined);
});
