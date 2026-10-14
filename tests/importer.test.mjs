// Import depuis Strong, Hevy, Fitbod, MyFitnessPal et export (js/importer.js)
import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../js/data.js";
import { parseCSV, detectFormat, parseDate, parseDuration, matchExercise, importWorkouts, importFood, importWeights, applyImport, rebuildLifts, sessionsCSV, foodCSV, backupJSON } from "../js/importer.js";

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Bench Press (Barbell)",W,40,10,0,0,,,
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Bench Press (Barbell)",1,80,8,0,0,,"Bonne ""séance""",8
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Bench Press (Barbell)",2,82.5,6,0,0,,"Bonne ""séance""",9
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Incline Bench Press (Dumbbell)",1,26,10,0,0,,,
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Plank",1,0,0,0,60,,,
2024-03-15 18:30:00,"Push, lourd",1h 5m,"Zercher Squat",1,70,5,0,0,,,
2024-03-18 07:00:00,"Jambes",50m,"Squat (Barbell)",1,100,5,0,0,,,
2024-03-18 07:00:00,"Jambes",50m,"Squat (Barbell)",2,100,5,0,0,,,
2024-03-18 07:00:00,"Jambes",50m,"Zercher Squat",1,75,5,0,0,,,`;

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Upper A","15 Mar 2024, 18:30","15 Mar 2024, 19:35","","Bench Press (Barbell)","","","0","warmup","95","10","","",""
"Upper A","15 Mar 2024, 18:30","15 Mar 2024, 19:35","","Bench Press (Barbell)","","","1","normal","185","8","","","8.5"
"Upper A","15 Mar 2024, 18:30","15 Mar 2024, 19:35","","Lat Pulldown (Cable)","","","0","normal","120","12","","",""
"Upper A","15 Mar 2024, 18:30","15 Mar 2024, 19:35","","Pull Up (Assisted)","","","0","normal","40","8","","",""`;

const FITBOD = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2024-03-16 10:00:00 +0000,Dumbbell Bench Press,10,30,0,0,0,0,true,,2
2024-03-16 10:02:00 +0000,Dumbbell Bench Press,10,30,0,0,0,0,false,,2
2024-03-16 10:20:00 +0000,Running,0,0,600,1500,0,0,false,,1
2024-03-16 10:40:00 +0000,Cable Crunch,15,25,0,0,0,0,false,,1`;

const MFP = `Date,Meal,Calories,Fat (g),Saturated Fat,Carbohydrates (g),Fiber,Sugar,Protein (g),Note
2024-03-15,Breakfast,450.5,12,3,60,5,10,25,
2024-03-15,Dinner,800,30,10,70,8,5,50,
2024-03-16,Snacks,200,8,2,20,1,12,10,
2024-03-17,Lunch,0,0,0,0,0,0,0,`;

test("CSV : guillemets, virgules et guillemets doublés, point-virgule, fin de ligne Windows, BOM", () => {
  const { headers, rows } = parseCSV(STRONG);
  assert.equal(headers.length, 12);
  assert.equal(rows.length, 9);
  assert.equal(rows[1]["Workout Name"], "Push, lourd");
  assert.equal(rows[1]["Workout Notes"], 'Bonne "séance"');
  const semi = parseCSV("﻿Date;Poids\r\n15/03/2024;80,4\r\n\r\n16/03/2024;80\r\n");
  assert.deepEqual(semi.headers, ["Date", "Poids"]);
  assert.deepEqual(semi.rows, [{ Date: "15/03/2024", Poids: "80,4" }, { Date: "16/03/2024", Poids: "80" }]);
  assert.equal(parseCSV("a\tb\n1\t2").rows[0].b, "2");
});

test("chaque app est reconnue à ses colonnes", () => {
  assert.equal(detectFormat(parseCSV(STRONG).headers), "strong");
  assert.equal(detectFormat(parseCSV(HEVY).headers), "hevy");
  assert.equal(detectFormat(parseCSV(FITBOD).headers), "fitbod");
  assert.equal(detectFormat(parseCSV(MFP).headers), "mfp");
  assert.equal(detectFormat(["Date", "Weight"]), "weight");
  assert.equal(detectFormat(["Date", "Poids (kg)"]), "weight");
  assert.equal(detectFormat(["nom", "prix"]), null);
});

test("dates et durées dans tous les formats des apps", () => {
  const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
  assert.equal(parseDate("2024-03-15 18:30:00"), at(2024, 3, 15, 18, 30));
  assert.equal(parseDate("2024-03-15"), at(2024, 3, 15));
  assert.equal(parseDate("2024-03-15T18:30:00Z"), Date.UTC(2024, 2, 15, 18, 30));
  assert.equal(parseDate("2024-03-16 10:00:00 +0000"), Date.UTC(2024, 2, 16, 10));
  assert.equal(parseDate("2024-03-16 10:00:00 +01:00"), Date.UTC(2024, 2, 16, 9));
  assert.equal(parseDate("15 Mar 2024, 18:30"), at(2024, 3, 15, 18, 30));
  assert.equal(parseDate("15 mars 2024"), at(2024, 3, 15));
  assert.equal(parseDate("15/03/2024"), at(2024, 3, 15));
  assert.equal(parseDate("03/25/2024"), at(2024, 3, 25)); // américain
  assert.equal(parseDate("n'importe quoi"), null);
  assert.equal(parseDuration("1h 5m"), 3900);
  assert.equal(parseDuration("45m"), 2700);
  assert.equal(parseDuration("1:05:00"), 3900);
  assert.equal(parseDuration("50:30"), 3030);
  assert.equal(parseDuration("3600"), 3600);
  assert.equal(parseDuration("1 h 30 min"), 5400);
  assert.equal(parseDuration(""), 0);
});

test("noms d'exercices anglais (avec le matériel) et français reconnus", () => {
  const cases = {
    "Bench Press (Barbell)": "bench", "Bench Press (Dumbbell)": "db_bench", "Dumbbell Bench Press": "db_bench", "Bench Press (Smith Machine)": "smith_bench",
    "Incline Bench Press (Dumbbell)": "incline_db", "Lat Pulldown (Cable)": "lat_pull", "Squat (Barbell)": "squat", "Squat (Bodyweight)": "air_squat",
    "Bicep Curl (Dumbbell)": "curl", "Bicep Curl (Barbell)": "barbell_curl", "EZ Bar Curl": "ez_curl", "Hammer Curl (Dumbbell)": "hammer",
    "Triceps Pushdown (Cable - Straight Bar)": "pushdown", "Romanian Deadlift (Dumbbell)": "db_rdl", "Deadlift (Barbell)": "deadlift",
    "Pull Up": "pullup", "Pull-ups": "pullup", "Pull Up (Assisted)": "assisted_pullup", "Chin Up": "chinup", "Seated Cable Row": "cable_row",
    "Cable Crunch": "cable_crunch", "Kettlebell Swing": "kb_swing", "Smith Machine Squat": "smith_squat", "Leg Press": "leg_press",
    "Seated Leg Curl (Machine)": "seated_leg_curl", "Lying Leg Curl (Machine)": "leg_curl", "Hip Thrust (Barbell)": "hip_thrust",
    "Calf Raise (Standing)": "calf", "Running (Treadmill)": "treadmill", "Plank": "plank", "Benchpress": "bench", "Lateral Raises": "lateral",
    "Développé couché": "bench", "developpe couche": "bench", "Squat au poids du corps": "air_squat",
  };
  for (const [raw, id] of Object.entries(cases)) assert.equal(matchExercise(raw), id, raw);
  for (const id of Object.values(cases)) assert.ok(EXERCISES[id], `${id} existe`);
  assert.equal(matchExercise("Zercher Squat"), null);
  assert.equal(matchExercise(""), null);
});

test("Strong : séances regroupées, échauffements ignorés, inconnus créés en exercice perso, livres converties", () => {
  const { rows } = parseCSV(STRONG);
  const r = importWorkouts(rows, "strong");
  assert.equal(r.sessions.length, 2);
  assert.equal(r.skipped, 1); // l'échauffement « W »
  assert.deepEqual(r.unknown, ["Zercher Squat"]);
  const zid = Object.keys(r.custom)[0];
  assert.equal(zid, "imp_zercher_squat");
  assert.equal(r.custom[zid].type, "load");
  assert.equal(r.custom[zid].muscle, "Quadriceps");
  const [push, legs] = r.sessions;
  assert.equal(push.name, "Push, lourd");
  assert.equal(push.durationSec, 3900);
  assert.equal(push.note, 'Bonne "séance"');
  assert.equal(push.imported, "strong");
  assert.deepEqual(push.sets.map(s => [s.exId, s.weight, s.reps]), [["bench", 80, 8], ["bench", 82.5, 6], ["incline_db", 26, 10], ["plank", 0, 60], [zid, 70, 5]]);
  assert.equal(push.sets[0].rpe, 8);
  assert.equal(push.sets[2].rpe, 8); // RPE absent : 8 par défaut
  assert.equal(push.volume, Math.round(80 * 8 + 82.5 * 6 + 26 * 10 + 70 * 5));
  assert.equal(legs.durationSec, 3000);
  assert.ok(push.id.startsWith("imp-strong-"));
  // même fichier en livres
  const lb = importWorkouts(rows, "strong", { unit: "lb" });
  assert.equal(lb.sessions[0].sets[0].weight, 36.3); // 80 lb
  // ancien export avec une colonne d'unité par ligne
  const old = parseCSV("Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration\n2020-01-02 10:00:00;A;Deadlift (Barbell);1;225;lbs;5;;;;;;;45m");
  const o = importWorkouts(old.rows, "strong");
  assert.equal(detectFormat(old.headers), "strong");
  assert.deepEqual([o.sessions[0].sets[0].exId, o.sessions[0].sets[0].weight, o.sessions[0].durationSec], ["deadlift", 102.1, 2700]);
});

test("Hevy (livres) et Fitbod (kilos, cardio en secondes)", () => {
  const h = importWorkouts(parseCSV(HEVY).rows, "hevy");
  assert.equal(h.sessions.length, 1);
  assert.equal(h.skipped, 1);
  const s = h.sessions[0];
  assert.equal(s.durationSec, 65 * 60);
  assert.deepEqual(s.sets.map(x => [x.exId, x.weight, x.reps]), [["bench", 83.9, 8], ["lat_pull", 54.4, 12], ["assisted_pullup", 18.1, 8]]);
  assert.equal(s.sets[0].rpe, 8.5);
  const f = importWorkouts(parseCSV(FITBOD).rows, "fitbod");
  assert.equal(f.sessions.length, 1); // même jour = une séance
  assert.equal(f.skipped, 1);
  assert.deepEqual(f.sessions[0].sets.map(x => [x.exId, x.weight, x.reps]), [["db_bench", 30, 10], ["treadmill", 0, 600], ["cable_crunch", 25, 15]]);
  assert.deepEqual(importWorkouts([{ a: 1 }], "inconnu").sessions, []);
});

test("MyFitnessPal : repas et pesées", () => {
  const { days, skipped } = importFood(parseCSV(MFP).rows);
  assert.equal(skipped, 1); // repas vide
  assert.deepEqual(Object.keys(days), ["2024-03-15", "2024-03-16"]);
  const b = days["2024-03-15"][0];
  assert.deepEqual([b.name, b.meal, b.g, b.per], ["Petit-déjeuner (MyFitnessPal)", "breakfast", 100, { k: 450.5, p: 25, c: 60, f: 12, fi: 5 }]);
  assert.equal(days["2024-03-15"][1].meal, "dinner");
  assert.equal(days["2024-03-16"][0].meal, "snack");
  const w = importWeights(parseCSV("Date,Weight\n2024-03-15,80.2\n2024-03-16,79,8\n2024-03-17,9").rows);
  assert.deepEqual(w.map(x => x.weight), [80.2, 79]);
  assert.deepEqual(importWeights(parseCSV("Date,Weight (lbs)\n2024-03-15,176.4").rows).map(x => x.weight), [80]);
});

test("ajout aux données : rien d'écrasé, pas de doublon en réimportant, records recalculés", () => {
  const st = {
    sessions: [{ id: "a", date: new Date(2024, 2, 18, 7, 0, 30).getTime(), name: "Jambes (app)", sets: [{ exId: "squat", weight: 100, reps: 5 }] }],
    lifts: { bench: { weight: 90, reps: 3, date: new Date(2025, 0, 1).getTime(), best: 99, bestReps: 0 } },
    customExercises: { mine: { name: "Le mien" } }, food: { "2024-03-15": { items: [{ id: "x", name: "Pomme" }], water: 500, at: 1 } },
    body: [{ date: new Date(2024, 2, 15, 7).getTime(), weight: 81 }],
  };
  const w = importWorkouts(parseCSV(STRONG).rows, "strong");
  const r1 = applyImport(st, { ...w, days: importFood(parseCSV(MFP).rows).days, weights: importWeights(parseCSV("Date,Weight\n2024-03-15,80.2\n2024-03-16,79.8").rows) });
  // la séance « Jambes » du 18 à 7 h existe déjà dans l'app (à 30 s près) : ignorée
  assert.deepEqual([r1.sessions, r1.dup, r1.custom, r1.meals, r1.weights], [1, 1, 1, 3, 1]);
  assert.equal(st.sessions.length, 2);
  assert.deepEqual(st.sessions.map(s => s.name), ["Push, lourd", "Jambes (app)"]);
  assert.equal(st.customExercises.mine.name, "Le mien");
  assert.ok(st.customExercises.imp_zercher_squat);
  assert.equal(st.food["2024-03-15"].items.length, 3);
  assert.equal(st.food["2024-03-15"].water, 500);
  assert.equal(st.body.find(b => new Date(b.date).getDate() === 15).weight, 81); // pesée de l'app gardée
  // records : le meilleur 1RM des deux côtés ; la dernière charge reste la plus récente (celle de l'app, en 2025)
  assert.equal(st.lifts.bench.best, 80 * (1 + 8 / 30));
  assert.equal(st.lifts.bench.weight, 90);
  assert.equal(Math.round(st.lifts.incline_db.best), Math.round(26 * (1 + 10 / 30)));
  assert.equal(st.lifts.plank.bestReps, 60);
  const r2 = applyImport(st, { ...w, days: importFood(parseCSV(MFP).rows).days });
  assert.deepEqual([r2.sessions, r2.meals, r2.weights], [0, 0, 0]);
  assert.equal(st.sessions.length, 2);
  assert.equal(st.food["2024-03-15"].items.length, 3);
});

test("records recalculés dans l'ordre des dates", () => {
  const l = rebuildLifts([{ date: 2, sets: [{ exId: "bench", weight: 80, reps: 5 }] }, { date: 1, sets: [{ exId: "bench", weight: 100, reps: 1 }] }]);
  assert.equal(l.bench.weight, 80);
  assert.equal(Math.round(l.bench.best), Math.round(100 * (1 + 1 / 30)));
});

test("export : CSV au format Strong relu à l'identique, journal en CSV, sauvegarde sans la clé API", () => {
  const w = importWorkouts(parseCSV(STRONG).rows, "strong");
  const st = { sessions: [], customExercises: {}, lifts: {} };
  applyImport(st, w);
  for (const [id, e] of Object.entries(st.customExercises)) EXERCISES[id] = { ...e, custom: true };
  const csv = sessionsCSV(st.sessions);
  const back = parseCSV(csv);
  assert.equal(detectFormat(back.headers), "strong");
  const again = importWorkouts(back.rows, "strong");
  assert.deepEqual(again.sessions.map(s => s.sets.map(x => [x.exId, x.weight, x.reps])), st.sessions.map(s => s.sets.map(x => [x.exId, x.weight, x.reps])));
  assert.deepEqual(again.unknown, []); // l'exercice perso est retrouvé par son nom
  assert.equal(again.sessions[0].name, "Push, lourd");
  delete EXERCISES.imp_zercher_squat;
  const food = foodCSV({ "2024-03-15": { items: [{ name: "Riz, cuit", meal: "lunch", g: 150, per: { k: 130, p: 2.7, c: 28, f: 0.3 } }] } });
  assert.equal(food.split("\n")[1], '2024-03-15,lunch,"Riz, cuit",150,195,4.1,42,0.5');
  const b = JSON.parse(backupJSON({ profile: { name: "Miles", aiKey: "sk-secret" }, sessions: [], health: { linked: true, url: "https://x/health?k=miles.secret", days: {} } }));
  assert.equal(b.profile.aiKey, "");
  assert.deepEqual(b.health, { linked: true, days: {} });
  assert.equal(b.profile.name, "Miles");
  assert.equal(b.app, "GREATNESS");
});
