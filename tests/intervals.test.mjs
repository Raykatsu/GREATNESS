// Minuteur d'intervalles : segments, position dans le temps, annonces (voix, bips), séance enregistrée.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
import { normalize, timeline, totalOf, workOf, at, events, roundLabel, sessionOf, ivSummary, PRESETS, MODES } from "../js/intervals.js";
import { recovery } from "../js/recovery.js";
import { EXERCISES } from "../js/data.js";

const contiguous = segs => segs.every((s, i) => s.t0 === (i ? segs[i - 1].t0 + segs[i - 1].dur : 0) && s.dur > 0);

test("réglages : bornes, exercices connus, répétitions seulement en EMOM / AMRAP", () => {
  const c = normalize({ mode: "inconnu", ex: [{ id: "nope" }, { id: "pushup", reps: 999 }], work: 9999, rest: -5, rounds: 0 });
  assert.equal(c.mode, "tabata");
  assert.deepEqual(c.ex, [{ id: "pushup" }]);
  assert.deepEqual([c.work, c.rest, c.rounds], [300, 0, 1]);
  assert.deepEqual(normalize({ mode: "emom", ex: [{ id: "pushup", reps: 999 }, { id: "plank" }] }).ex, [{ id: "pushup", reps: 200 }, { id: "plank", reps: 30 }]);
  assert.deepEqual(normalize({}).ex, [{ id: "burpee" }]); // jamais vide
  for (const p of PRESETS) {
    assert.ok(MODES[p.mode], p.id);
    assert.ok(p.ex.every(e => EXERCISES[e.id]), `${p.id} : exercice inconnu`);
    assert.equal(normalize(p).ex.length, p.ex.length, p.id);
  }
});

test("Tabata : 8 × (20 s / 10 s), le repos annonce l'exercice suivant", () => {
  const cfg = { mode: "tabata", ex: [{ id: "jumping_jack" }, { id: "mountain" }], work: 20, rest: 10, rounds: 8 };
  const segs = timeline(cfg);
  assert.ok(contiguous(segs));
  assert.equal(segs.length, 1 + 8 + 7);
  assert.equal(totalOf(segs), 10 + 8 * 20 + 7 * 10);
  assert.equal(workOf(segs), 160);
  assert.deepEqual(segs.filter(s => s.kind === "work").map(s => s.ex.id), ["jumping_jack", "mountain", "jumping_jack", "mountain", "jumping_jack", "mountain", "jumping_jack", "mountain"]);
  for (const [i, s] of segs.entries()) if (s.kind === "rest") assert.equal(s.ex.id, segs[i + 1].ex.id);
  assert.equal(roundLabel(cfg, segs[3]), "Tour 2 / 8");
});

test("EMOM, AMRAP, circuit : les bons segments", () => {
  const emom = timeline({ mode: "emom", ex: [{ id: "pushup", reps: 10 }, { id: "air_squat", reps: 15 }], minutes: 6 });
  assert.equal(totalOf(emom), 10 + 360);
  assert.deepEqual(emom.slice(1).map(s => [s.kind, s.dur, s.ex.id]), Array.from({ length: 6 }, (_, i) => ["work", 60, i % 2 ? "air_squat" : "pushup"]));
  const amrap = timeline({ mode: "amrap", ex: [{ id: "pushup", reps: 10 }], minutes: 12 });
  assert.deepEqual(amrap.map(s => [s.kind, s.dur]), [["prep", 10], ["work", 720]]);
  const cfg = { mode: "circuit", ex: [{ id: "pushup" }, { id: "air_squat" }, { id: "plank" }], work: 40, rest: 20, rounds: 2, restRound: 60, prep: 5 };
  const ci = timeline(cfg);
  assert.ok(contiguous(ci));
  assert.deepEqual(ci.map(s => `${s.kind[0]}${s.dur}${s.roundRest ? "*" : ""}`).join(" "), "p5 w40 r20 w40 r20 w40 r60* w40 r20 w40 r20 w40");
  assert.equal(roundLabel(cfg, ci[7]), "Tour 2 / 2 · exercice 1 / 3");
});

test("position dans le temps : segment, temps restant, fin", () => {
  const segs = timeline({ mode: "tabata", ex: [{ id: "burpee" }], rounds: 2 }); // p10 w20 r10 w20
  assert.deepEqual([at(segs, 0).seg.kind, at(segs, 0).left], ["prep", 10]);
  assert.deepEqual([at(segs, 10).seg.kind, at(segs, 10).left], ["work", 20]);
  assert.deepEqual([at(segs, 29.5).seg.kind, at(segs, 29.5).left], ["work", 0.5]);
  assert.equal(at(segs, 30).seg.kind, "rest");
  assert.equal(at(segs, 60).done, true);
  assert.equal(at(segs, 99).done, true);
});

test("annonces : départ, 3-2-1, effort, repos, fin ; rien de doublé quand on avance par petits pas", () => {
  const cfg = { mode: "tabata", ex: [{ id: "burpee" }, { id: "pushup" }], rounds: 4 };
  const segs = timeline(cfg), total = totalOf(segs);
  const all = events(cfg, segs, -1, total);
  assert.match(all[0].say, /^Prépare-toi : Burpees/);
  assert.equal(all.filter(e => e.beep === "go").length, 4);
  assert.equal(all.filter(e => e.beep === "rest").length, 3);
  assert.equal(all.filter(e => e.beep === "tick").length, segs.length * 3);
  assert.deepEqual(all.at(-1), { t: total, beep: "end", say: "Terminé ! Bien joué." });
  assert.ok(all.some(e => e.say === "Repos. Ensuite : Pompes."));
  assert.ok(all.some(e => e.say === "Repos. Dernier effort : Pompes !"));
  // par pas de 0,25 s (comme l'écran) : exactement les mêmes annonces
  const stepped = [];
  for (let t = 0; t < total + 0.25; t += 0.25) stepped.push(...events(cfg, segs, t - 0.25 < 0 ? -1 : t - 0.25, Math.min(t, total)));
  assert.deepEqual(stepped, all);
  // un seul exercice : on annonce les tours restants
  const one = { mode: "tabata", ex: [{ id: "burpee" }], rounds: 3 }, s1 = timeline(one);
  assert.deepEqual(events(one, s1, -1, totalOf(s1)).filter(e => /^Repos/.test(e.say || "")).map(e => e.say), ["Repos. Encore 2 tours.", "Repos. Dernier tour !"]);
});

test("annonces : EMOM avec les répétitions, AMRAP avec mi-temps et dernière minute", () => {
  const emom = { mode: "emom", ex: [{ id: "pushup", reps: 12 }, { id: "plank", reps: 30 }], minutes: 2 };
  const se = timeline(emom);
  assert.deepEqual(events(emom, se, -1, totalOf(se)).filter(e => e.say).map(e => e.say),
    ["Prépare-toi : 12 pompes.", "Minute 1 : 12 pompes.", "Minute 2 : 30 secondes de gainage.", "Terminé ! Bien joué."]);
  const amrap = { mode: "amrap", ex: [{ id: "burpee", reps: 5 }], minutes: 10 };
  const sa = timeline(amrap);
  assert.deepEqual(events(amrap, sa, -1, totalOf(sa)).filter(e => e.say).map(e => [e.t, e.say]),
    [[1e-6, "Prépare-toi. 10 minutes, le plus de tours possible."], [10, "C'est parti !"], [310, "Mi-temps !"], [550, "Dernière minute !"], [600, "10 secondes !"], [610, "Terminé ! Bien joué."]]);
});

test("séance enregistrée : temps d'effort, tours, XP, sans toucher aux records", () => {
  const cfg = { mode: "tabata", ex: [{ id: "burpee" }], rounds: 8 };
  const full = sessionOf(cfg, { startedAt: 1000, elapsed: 240 });
  assert.equal(full.kind, "interval");
  assert.deepEqual([full.sets, full.prs, full.volume], [[], [], 0]); // pas de séries : records et charges intacts
  assert.equal(full.iv.workSec, 160);
  assert.equal(full.iv.rounds, 8);
  assert.equal(full.iv.work.length, 8);
  assert.ok(full.xp > 40 && full.xp < 80, `xp ${full.xp}`);
  assert.equal(ivSummary(full), "Tabata · 8 tours · 2 min 40 d'effort");
  // arrêté pendant le 3e effort, à peine commencé : 2 efforts comptés
  const early = sessionOf(cfg, { elapsed: 10 + 20 + 10 + 20 + 10 + 5 });
  assert.equal(early.iv.work.length, 2);
  assert.equal(early.iv.workSec, 40);
  const amrap = sessionOf({ mode: "amrap", ex: [{ id: "pushup", reps: 10 }, { id: "air_squat", reps: 15 }], minutes: 12 }, { elapsed: 730, amrapRounds: 7 });
  assert.equal(amrap.iv.workSec, 720);
  assert.equal(amrap.iv.work.length, 14);
  assert.equal(ivSummary(amrap), "AMRAP · 7 tours complets · 12 min d'effort");
  // efforts passés avec « Passer » : pas comptés
  const skip = sessionOf(cfg, { elapsed: 240, skipped: [[0, 10], [15, 30], [40, 240]] });
  assert.deepEqual([skip.iv.work.length, skip.iv.workSec, skip.durationSec], [0, 0, 15]);
  const half = sessionOf(cfg, { elapsed: 240, skipped: [[110, 240]] });
  assert.equal(half.iv.workSec, 60 + 10); // 3 efforts pleins + 10 s du 4e (compté : la moitié de l'effort)
  assert.equal(half.iv.work.length, 4);
  const emom = sessionOf({ mode: "emom", ex: [{ id: "pushup", reps: 10 }], minutes: 10 }, { elapsed: 10 + 4 * 60 + 20 });
  assert.equal(emom.iv.rounds, 5); // 4 minutes pleines + la 5e bien entamée
  assert.equal(ivSummary(emom), "EMOM · 5 minutes · 4 min 20 d'effort");
});

test("récupération : le travail du minuteur fatigue les bons muscles", () => {
  const now = Date.now();
  const s = sessionOf({ mode: "tabata", ex: [{ id: "pushup" }], rounds: 8 }, { startedAt: now - 2 * 36e5, elapsed: 240 });
  const rec = recovery([s], now);
  assert.ok(rec.pecs.fatigue > 1, `pecs ${rec.pecs.fatigue}`);
  assert.ok(rec.pecs.week >= 8);
  assert.equal(rec.quads.fatigue, 0);
});
