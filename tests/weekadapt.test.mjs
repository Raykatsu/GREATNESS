// Semaine adaptative (js/weekadapt.js) : séance manquée rattrapée aujourd'hui ou sur le prochain jour libre, échange
// quand les muscles de la séance du jour ne sont pas remis, séance allégée après un pic de charge, rattrapage un jour
// libre. Les déplacements ne valent que pour la semaine en cours ; un refus ne revient pas.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../js/store.js";
import { proposals, apply, dismiss } from "../js/weekadapt.js";
import { todaysMission, weekStrip, weekPlanNow, adaptOf } from "../js/planner.js";
import { Session } from "../js/engine.js";

const WED = new Date(2026, 10, 18, 10); // mercredi 18 novembre 2026, 10 h
const at = (d, h = 18) => { const x = new Date(WED); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.getTime(); };
let n = 0;
const sess = (d, programId, sets, h) => ({ id: `w${n++}`, date: at(d, h), programId, name: programId, durationSec: 3000, volume: 1000, prs: [], xp: 50,
  sets: sets.flatMap(([exId, k, rpe = 8]) => Array.from({ length: k }, () => ({ exId, weight: 60, reps: 8, rpe }))) });
const reset = (plan, sessions = []) => { state.weekPlan = plan; state.weekAdapt = null; state.sessions = sessions.sort((a, b) => a.date - b.date); };
const kinds = now => proposals(now).map(p => p.kind);

test("séance manquée hier, aujourd'hui libre : on la fait aujourd'hui, pour cette semaine seulement", () => {
  assert.equal(WED.getDay(), 3);
  reset({ 1: "pull", 4: "legs", 6: "mobility" });
  const [p] = proposals(WED);
  assert.equal(p.kind, "missed"); assert.equal(p.p.id, "pull"); assert.equal(p.to, undefined);
  assert.deepEqual(p.act.moves, { 1: null, 2: "pull" });
  apply(p, WED);
  assert.equal(todaysMission(WED).program.id, "pull");
  const w = weekStrip(WED);
  assert.equal(w[1].program, null, "mardi devient un jour de repos");
  assert.equal(w[2].program.id, "pull");
  assert.ok(!kinds(WED).includes("missed"), "plus rien à rattraper");
  // la semaine suivante : le programme type, intact
  const next = new Date(WED); next.setDate(next.getDate() + 7);
  assert.equal(weekPlanNow(next)[1], "pull");
  assert.deepEqual(adaptOf(next).moves, {});
});

test("séance manquée, aujourd'hui déjà pris : placée sur le prochain jour libre ; faite depuis : rien", () => {
  reset({ 1: "pull", 2: "push", 4: "legs" });
  const [p] = proposals(WED);
  assert.equal(p.kind, "missed"); assert.equal(p.to, 3);
  assert.deepEqual(p.act.moves, { 1: null, 3: "pull" });
  // la séance a été faite ce matin : rien à rattraper
  reset({ 1: "pull", 4: "legs" }, [sess(0, "pull", [["row", 3]], 8)]);
  assert.ok(!kinds(WED).includes("missed"));
  // refus : ne revient pas de la semaine
  reset({ 1: "pull", 4: "legs" });
  dismiss(proposals(WED)[0], WED);
  assert.deepEqual(kinds(WED), []);
});

test("muscles de la séance du jour pas remis : échange avec une séance plus loin dans la semaine", () => {
  reset({ 2: "legs", 4: "pull" }, [sess(-1, "legs", [["squat", 6, 9.5], ["leg_press", 5, 9.5], ["rdl", 5, 9.5], ["leg_curl", 4, 9]], 19)]);
  const p = proposals(WED).find(x => x.kind === "tired");
  assert.ok(p, `proposition : ${kinds(WED)}`);
  assert.equal(p.q.id, "pull"); assert.equal(p.day, 4);
  assert.ok(p.muscles.length >= 2);
  apply(p, WED);
  assert.equal(todaysMission(WED).program.id, "pull");
  assert.equal(weekPlanNow(WED)[4], "legs");
});

test("pic de charge : la séance du jour est allégée (une série de moins par exercice, charges plus légères)", () => {
  const old = [];
  for (let w = 1; w <= 4; w++) old.push(sess(-7 * w - 1, "push", [["bench", 4], ["ohp", 3]]), sess(-7 * w - 4, "legs", [["squat", 4]]));
  const recent = [-1, -2, -3, -4, -5].map(d => sess(d, "push", [["bench", 5], ["ohp", 4], ["pushdown", 4]], 7));
  reset({ 2: "push" }, [...old, ...recent]);
  const p = proposals(WED).find(x => x.kind === "spike");
  assert.ok(p, `proposition : ${kinds(WED)}`);
  assert.ok(p.pct > 50);
  apply(p, WED);
  const m = todaysMission(WED);
  assert.equal(m.light, true);
  const fit = { sleep: 4, energy: 4, soreness: 1 };
  const normal = new Session(m.program, fit), light = new Session(m.program, fit, { light: true });
  assert.equal(light.verdict.label, "Séance allégée");
  const sets = s => s.plan.reduce((a, e) => a + e.sets, 0);
  assert.ok(sets(light) < sets(normal), `${sets(light)} < ${sets(normal)}`);
  assert.ok(!kinds(WED).includes("spike"), "déjà allégée");
});

test("jour libre pris par une séance manquée : pas de rattrapage en plus ; refusée, le rattrapage revient", () => {
  const list = [];
  for (let d = 2; d <= 26; d += 3) list.push(sess(-d, "push", [["bench", 4], ["ohp", 3], ["pushdown", 3]]));
  reset({ 1: "pull", 4: "push" }, list);
  assert.deepEqual(kinds(WED), ["missed"], "la séance manquée prend le jour libre");
  dismiss(proposals(WED)[0], WED);
  assert.deepEqual(kinds(WED), ["catchup"]);
});
test("jour libre et muscles en retard : séance de rattrapage de 25 minutes", () => {
  const list = [];
  for (let d = 1; d <= 27; d += 3) list.push(sess(-d, "push", [["bench", 4], ["ohp", 3], ["pushdown", 3]]));
  reset({ 1: "push", 4: "push" }, list);
  const p = proposals(WED).find(x => x.kind === "catchup");
  assert.ok(p, `proposition : ${kinds(WED)}`);
  assert.ok(p.muscles.length);
  const prog = apply(p, WED);
  assert.equal(prog.name, "Séance de rattrapage");
  assert.ok(prog.exercises.length >= 3);
  assert.ok(!kinds(WED).includes("catchup"), "proposée une fois");
});
