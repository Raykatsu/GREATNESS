// Conseils du coach avant / pendant / après la séance : personnalisés (gênes, forme du jour, profil, repas, récupération).
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { preTips, restTip, quickAnswer, expressPlan, postTips, sensitiveZones, nextSession, breathing } = await import("../js/advice.js");
const { setUser, state, getProgram } = await import("../js/store.js");
const { dayKey } = await import("../js/nutrition.js");

const NOW = new Date(2026, 10, 16, 18, 0); // lundi 18 h
const ex = (id, sets = 3, reps = [8, 10], weight = 60) => ({ id, sets, reps, weight, rest: 90, rpe: 8 });
const prog = (exercises, extra = {}) => ({ id: "t", name: "Test", cat: "gym", exercises, ...extra });
const ok = { sleep: 4, energy: 3, soreness: 2 };
const keys = tips => tips.map(t => t.k);
const mem = text => ({ id: text, text, at: 1, src: "onb" });

test("zones sensibles : seulement les gênes signalées, pas les simples préférences", () => {
  setUser("a1", { memory: [mem("Prudence : gêne au niveau épaule"), mem("J'adore les séances dos"), mem("J'ai mal au genou droit")] });
  assert.deepEqual(sensitiveZones(), ["shoulder", "knee"]);
});

test("avant : une gêne connue passe en premier, avec les exercices concernés", () => {
  setUser("a2", { memory: [mem("Prudence : gêne au niveau épaule")] });
  const tips = preTips(prog([ex("bench"), ex("squat"), ex("ohp")]), ok, { now: NOW });
  assert.equal(tips[0].k, "zone");
  assert.match(tips[0].title, /Épaule sensible/);
  assert.match(tips[0].text, /Développé couché/);
  assert.doesNotMatch(tips[0].text, /Squat/); // le squat ne concerne pas l'épaule
  assert.ok(tips.length <= 4);
});

test("avant : la forme du jour change le conseil (nuit courte, courbatures, batterie faible, feu vert)", () => {
  setUser("a3", {});
  const p = prog([ex("bench"), ex("row")]);
  assert.ok(keys(preTips(p, { sleep: 1, energy: 3, soreness: 2 }, { now: NOW })).includes("sleep"));
  assert.ok(keys(preTips(p, { sleep: 4, energy: 3, soreness: 5 }, { now: NOW })).includes("sore"));
  assert.ok(keys(preTips(p, { sleep: 4, energy: 1, soreness: 2 }, { now: NOW })).includes("energy"));
  const green = preTips(p, { sleep: 5, energy: 5, soreness: 1 }, { now: NOW }).find(t => t.k === "green");
  assert.match(green.text, /Développé couché/);
});

test("avant : montée en charge calculée sur la charge prévue du premier exercice", () => {
  setUser("a4", { lifts: { bench: { weight: 80, reps: 8, best: 100, bestReps: 0, date: 1 } } });
  const ramp = preTips(prog([ex("bench", 4, [8, 10], 60)]), ok, { now: NOW }).find(t => t.k === "ramp");
  assert.match(ramp.text, /8 répétitions à 40 kg, puis 4 à 60 kg, avant ta première série à 80 kg/);
});

test("avant : zone prioritaire du quiz et niveau débutant pris en compte", () => {
  setUser("a5", { profile: { focus: ["pecs"], experience: "debutant" } });
  const tips = preTips(prog([ex("pushup", 3, [8, 15], 0)]), ok, { now: NOW, max: 9 });
  assert.match(tips.find(t => t.k === "focus").text, /zone prioritaire \(Pecs\)/);
  assert.ok(keys(tips).includes("level"));
  assert.ok(!keys(tips).includes("goal")); // un seul des deux
});

test("avant : peu mangé / peu bu seulement si c'est noté dans le journal", () => {
  setUser("a6", { profile: { bodyweight: 80, sex: "m", age: 30, height: 180 } });
  let tips = preTips(prog([ex("bench")]), ok, { now: NOW, max: 12 });
  assert.ok(!keys(tips).includes("fuel"));
  assert.match(tips.find(t => t.k === "water").title, /Hydratation/); // eau non suivie : simple rappel
  state.food = { [dayKey(NOW)]: { items: [{ id: "x", name: "Pomme", per: { k: 52, p: 0.3, c: 14, f: 0.2 }, g: 150 }], water: 1 } };
  tips = preTips(prog([ex("bench")]), ok, { now: NOW, max: 12 });
  assert.ok(keys(tips).includes("fuel"));
  assert.match(tips.find(t => t.k === "water").text, /0,25 L/);
});

test("avant : étirements et séance libre ont leurs propres conseils", () => {
  setUser("a7", {});
  assert.deepEqual(keys(preTips(getProgram("mobility"), ok, { now: NOW })), ["soft"]);
  assert.deepEqual(keys(preTips({ id: "free", name: "Séance libre", free: true, exercises: [] }, ok, { now: NOW })), ["free"]);
});

test("pendant : le conseil de repos suit le contexte (mi-séance, série très dure, rotation, zone sensible)", () => {
  setUser("a8", { memory: [mem("Douleur au genou")], profile: { goal: "muscle" } });
  const bench = { id: "bench", type: "load", cues: ["Omoplates serrées."] }, squat = { id: "squat", type: "load", cues: ["Genoux dans l'axe."] };
  assert.match(restTip(bench, { half: true }), /Mi-séance/);
  assert.match(restTip(bench, { lastRpe: 10 }), /respire lentement/);
  assert.equal(restTip(bench, { n: 0 }), breathing("bench"));
  assert.match(restTip(bench, { n: 1 }), /Rappel technique : Omoplates serrées\./);
  assert.match(restTip(squat, { n: 2 }), /Genou sensible/);
  assert.notEqual(restTip(bench, { n: 0 }), restTip(bench, { n: 2 }));
  assert.equal(restTip(null), "");
});

test("pendant : la version express garde les gros exercices et raccourcit le reste", () => {
  const item = (sets, done = 0, extra = {}) => ({ sets, done: Array(done).fill({}), rest: 120, status: "todo", ...extra });
  const plan = [item(4, 2), item(4), item(3), item(3), item(3, 0, { scheme: [{}] }), { ...item(3, 3), status: "done" }];
  const r = expressPlan(plan, 0);
  assert.deepEqual(plan.map(e => e.sets), [4, 3, 2, 2, 3, 3]); // en cours : inchangé (2 restantes) ; programme imposé et exercice fini : intacts
  assert.equal(r.cut, 3);
  assert.ok(r.minutes >= 5);
  assert.equal(plan[1].rest, 90);
  assert.equal(plan[4].rest, 120);
});

test("pendant : réponses rapides hors ligne (technique, respiration, tempo, motivation)", () => {
  setUser("a9", { profile: { name: "Rayane", goal: "force" } });
  const cur = { id: "squat", name: "Squat", type: "load", rest: 180, cues: ["Genoux dans l'axe des pieds."] };
  assert.match(quickAnswer("tech", cur), /Genoux dans l'axe des pieds\.[\s\S]*quadriceps/);
  assert.match(quickAnswer("breath", cur), /souffle en remontant[\s\S]*série lourde/);
  assert.match(quickAnswer("tempo", cur), /montée explosive[\s\S]*180 s/);
  assert.match(quickAnswer("motiv", cur, { left: 2 }), /2 exercices\*\*, Rayane/);
  assert.match(quickAnswer("motiv", cur, { left: 0 }), /Dernier exercice, Rayane/);
});

test("après : repas, eau, récupération et suite du programme, selon le profil", () => {
  setUser("b1", { profile: { bodyweight: 80, goal: "muscle" }, weekPlan: { 0: "push", 2: "pull", 4: "legs", 6: "mobility" } });
  const sets = Array.from({ length: 5 }, () => ({ exId: "bench", name: "Développé couché", weight: 80, reps: 8, rpe: 9 }));
  const sum = { id: "s", date: NOW.getTime() - 36e5, programId: "push", name: "Push", durationSec: 3600, sets, fatigue: 40, compare: [{ name: "Développé couché", delta: 2 }] };
  state.sessions.push({ id: "old", date: NOW.getTime() - 9 * 864e5, programId: "push", sets: [], prs: [] }, sum);
  const tips = postTips(sum, { now: NOW, max: 9 });
  assert.match(tips.find(t => t.k === "food").text, /25 g de protéines.*construire du muscle/);
  assert.match(tips.find(t => t.k === "water").text, /650 ml/);
  assert.match(tips.find(t => t.k === "rec").text, /Pectoraux/);
  assert.match(tips.find(t => t.k === "next").text, /Pull, mercredi/);
  assert.match(tips.find(t => t.k === "sleep").text, /8 heures/); // ressenti moyen 9
  assert.ok(!keys(tips).includes("doms") && !keys(tips).includes("pain"));
  assert.equal(postTips(sum, { now: NOW }).length, 5);
});

test("après : douleur signalée en tête, nouveaux exercices, séance douce, séance vide", () => {
  setUser("b2", { weekPlan: { 1: "pull" } });
  const sum = { id: "s", date: NOW.getTime(), programId: "push", name: "Push", durationSec: 1800, fatigue: 20, pain: ["bench"],
    sets: [{ exId: "dips", name: "Dips", weight: 0, reps: 8, rpe: 7 }], compare: [{ name: "Dips", delta: null }] };
  state.sessions.push({ id: "old", date: NOW.getTime() - 3 * 864e5, programId: "pull", sets: [], prs: [] }, sum);
  const tips = postTips(sum, { now: NOW, max: 9 });
  assert.equal(tips[0].k, "pain");
  assert.match(tips[0].text, /Développé couché/);
  assert.match(tips.find(t => t.k === "doms").text, /Nouveaux exercices \(Dips\)/);
  assert.match(tips.find(t => t.k === "next").text, /Pull, demain/);
  assert.deepEqual(keys(postTips({ ...sum, programId: "mobility" }, { now: NOW })), ["soft"]);
  assert.deepEqual(postTips({ ...sum, sets: [] }, { now: NOW }), []);
});

test("prochaine séance : à partir de demain, sans la mobilité, en bouclant sur la semaine suivante", () => {
  setUser("b3", { weekPlan: { 0: "push", 6: "mobility" } });
  assert.deepEqual(nextSession(state, NOW), { name: getProgram("push").name, when: "lundi", days: 7 });
  state.weekPlan = {};
  assert.equal(nextSession(state, NOW), null);
});
