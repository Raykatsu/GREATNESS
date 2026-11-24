// Le coach agit sur l'app (actions de l'IA en ligne), sa mémoire, et le bilan de la semaine.
import test from "node:test";
import assert from "node:assert/strict";
import { state, setUser } from "../js/store.js";
import { parseActions, streamText, resolveExercise, resolveProgram, applyAction, describe, actionsGuide, needsConfirm, snapshot, restore } from "../js/aiact.js";
import { addMemory, removeMemory, memoryCommand, memoryContext } from "../js/memory.js";
import { weekReport, reviewWeek, mondayOf, reportText } from "../js/weekly.js";
import { dayKey, sumItems } from "../js/nutrition.js";
import { mergeData } from "../js/merge.js";

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const reset = (data = {}) => setUser("test", { profile: { goal: "muscle", days: 3, bodyweight: 80 }, ...data });

test("lecture des blocs d'action : texte propre, actions valides, blocs cassés masqués", () => {
  const raw = `Voici ta séance !\n\n\`\`\`action\n{"type":"create_program","name":"Jambes","exercises":[{"name":"Squat","sets":4,"reps":"6-8"}]}\n\`\`\`\n\`\`\`action\n[{"type":"remember","fact":"Genou fragile"},{"type":"inconnu"}]\n\`\`\``;
  const { text, actions } = parseActions(raw);
  assert.equal(text, "Voici ta séance !");
  assert.deepEqual(actions.map(a => a.type), ["create_program", "remember"]);
  // bloc json reconnu, code normal conservé, bloc cassé masqué, bloc coupé en fin de flux masqué
  assert.equal(parseActions('A\n```json\n{"type":"set_goal","goal":"force"}\n```').actions[0].goal, "force");
  assert.equal(parseActions("Exemple :\n```\nsquat 3x5\n```").text, "Exemple :\n```\nsquat 3x5\n```");
  assert.equal(parseActions("Ok\n```action\n{pas du json}\n```").text, "Ok");
  assert.equal(parseActions('Ok\n```action\n{"type":"remem').text, "Ok");
  assert.equal(streamText('Bonjour\n```action\n{"ty'), "Bonjour\n");
  assert.match(actionsGuide("Crée-moi une séance jambes"), /Noms exacts des exercices/);
  assert.doesNotMatch(actionsGuide("Combien de protéines ?"), /Noms exacts/);
});

test("exercices et séances désignés par leur nom", () => {
  reset();
  assert.equal(resolveExercise("bench"), "bench");
  assert.equal(resolveExercise("Développé couché"), "bench");
  assert.equal(resolveExercise("developpe couche"), "bench");
  assert.equal(resolveExercise("Squats"), "squat");
  assert.equal(resolveExercise("Blablabla"), null);
  assert.equal(resolveProgram("Push")?.id, "push");
  assert.equal(resolveProgram("repos"), null);
});

test("actions : séance, programme, objectif, charge, repas, mémoire", () => {
  reset();
  const created = {};
  let r = applyAction({ type: "create_program", name: "Jambes 45 min", exercises: [{ name: "Squat", sets: 4, reps: "6-8", rest: 150 }, { name: "Fente", sets: 3, reps: [10, 12] }, { name: "Truc inconnu" }] }, created);
  assert.ok(r.ok);
  assert.match(r.text, /pas trouvé : Truc inconnu/);
  const prog = state.customPrograms.find(p => p.id === r.programId);
  assert.deepEqual(prog.exercises.map(e => [e.id, e.sets, e.reps, e.rest]), [["squat", 4, [6, 8], 150], ["lunge", 3, [10, 12], 75]]);
  r = applyAction({ type: "week_plan", days: { lundi: "Jambes 45 min", mercredi: "Pull", vendredi: "Push", dimanche: "repos", jeudi: "Inconnue" } }, created);
  assert.ok(r.ok);
  assert.deepEqual(state.weekPlan, { 0: prog.id, 2: "pull", 4: "push" });
  assert.match(r.text, /inconnu : Inconnue/);
  r = applyAction({ type: "set_goal", goal: "force", days: 4 });
  assert.deepEqual([r.ok, state.profile.goal, state.profile.days, r.replan], [true, "force", 4, true]);
  assert.equal(applyAction({ type: "set_goal", goal: "nimporte" }).ok, false);
  state.lifts.bench = { weight: 80, reps: 8, best: 100, bestReps: 0, date: 1 };
  r = applyAction({ type: "set_weight", exercise: "Développé couché", weight: 82.5 });
  assert.deepEqual([r.ok, state.lifts.bench.next, state.lifts.bench.best], [true, 82.5, 100]);
  assert.equal(applyAction({ type: "set_weight", exercise: "Pompes", weight: 10 }).ok, false); // pas de charge
  r = applyAction({ type: "log_food", meal: "lunch", items: [{ name: "Poulet", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 }, { name: "vide" }] });
  assert.ok(r.ok);
  const day = state.food[dayKey()];
  assert.equal(day.items.length, 1);
  assert.equal(Math.round(sumItems(day.items).k), 248);
  assert.equal(day.items[0].meal, "lunch");
  r = applyAction({ type: "remember", fact: "Genou droit sensible : éviter les sauts" });
  assert.ok(r.ok);
  assert.equal(state.memory.at(-1).src, "ai");
  assert.match(describe({ type: "set_weight", exercise: "bench", weight: 82.5 }), /Développé couché : 82.5 kg/);
});

test("la charge fixée par le coach sert à la séance suivante", async () => {
  reset();
  const { Session } = await import("../js/engine.js");
  state.lifts.bench = { weight: 80, reps: 8, best: 100, bestReps: 0, date: 1, next: 85 };
  // forme « prête » (facteur 1) : exactement la charge du coach
  const S = new Session({ id: "x", name: "Test", exercises: [{ id: "bench", sets: 3, reps: [6, 10], weight: 60, rest: 120, rpe: 8 }] }, { sleep: 3, energy: 3, soreness: 2 });
  assert.equal(S.plan[0].weight, 85);
  assert.equal(S.plan[0].goal, 6);
});

test("mémoire : ajout sans doublon, limite, commande « retiens que », contexte, synchro", () => {
  reset();
  assert.equal(memoryCommand("Retiens que j'ai mal au genou droit"), "j'ai mal au genou droit");
  assert.equal(memoryCommand("souviens-toi que je n'ai pas de barre"), "je n'ai pas de barre");
  assert.equal(memoryCommand("Comment progresser ?"), null);
  const a = addMemory(state, "j'ai mal au genou droit");
  assert.equal(a.text, "J'ai mal au genou droit");
  assert.equal(addMemory(state, "J'ai mal au genou droit !").id, a.id); // même info
  assert.equal(addMemory(state, "x"), null);
  for (let i = 0; i < 35; i++) addMemory(state, `info numéro ${i}`);
  assert.equal(state.memory.length, 30);
  assert.ok(state.deleted.memory.includes(a.id), "la plus ancienne est oubliée");
  removeMemory(state, state.memory[0].id);
  assert.equal(state.memory.length, 29);
  assert.match(memoryContext(state), /^À retenir sur l'athlète/);
  const m1 = { meta: { updatedAt: 1 }, memory: [{ id: "a", text: "A", at: 1 }, { id: "b", text: "B", at: 2 }], deleted: {} };
  const m2 = { meta: { updatedAt: 2 }, memory: [{ id: "c", text: "C", at: 3 }], deleted: { memory: ["b"] } };
  assert.deepEqual(mergeData(m1, m2).memory.map(m => m.id), ["a", "c"]);
});

test("bilan de la semaine : chiffres, points forts, à travailler, note", () => {
  const mon = new Date(2026, 9, 5); // lundi 5 octobre 2026
  const at = (d, h = 18) => new Date(2026, 9, 5 + d, h).getTime();
  const set = (exId, weight, reps) => ({ exId, name: exId, weight, reps, rpe: 8 });
  reset({
    weekPlan: { 0: "push", 2: "pull", 4: "legs" },
    sessions: [
      { id: "p1", date: at(-6), programId: "push", volume: 4000, durationSec: 3000, prs: [], sets: [set("bench", 80, 8)] },
      { id: "a", date: at(0), programId: "push", volume: 5000, durationSec: 3600, prs: ["bench"], sets: [set("bench", 82.5, 8), set("ohp", 50, 8)] },
      { id: "b", date: at(2), programId: "pull", volume: 4500, durationSec: 3300, prs: [], sets: [set("row", 70, 10)] },
      { id: "c", date: at(4), programId: "push", volume: 4800, durationSec: 3400, prs: ["ohp"], sets: [set("bench", 82.5, 9)] },
    ],
    body: [{ date: at(-3), weight: 80 }, { date: at(5), weight: 80.4 }],
  });
  state.food = {};
  for (let d = 0; d < 5; d++) state.food[dayKey(new Date(at(d, 12)))] = { items: [{ id: "f" + d, meal: "lunch", g: 100, per: { k: 2900, p: 170 } }], water: 8, at: 1 };
  const r = weekReport(state, mon);
  assert.deepEqual([r.sessions, r.planned, r.volume, r.prevVolume, r.dv, r.minutes], [3, 3, 14300, 4000, 258, 172]);
  assert.deepEqual(r.prs, ["bench", "ohp"]);
  assert.equal(r.muscles.Pectoraux, 2);
  assert.deepEqual([r.nutri.n, r.nutri.k, r.nutri.p], [5, 2900, 170]);
  assert.equal(r.bwDelta, 0.4);
  assert.match(r.good.join(" | "), /Semaine bouclée : 3 séances sur 3/);
  assert.match(r.good.join(" | "), /2 records battus : Développé couché, Développé militaire/);
  assert.match(r.todo.join(" | "), /Rien pour : jambes/);
  assert.ok(r.score >= 85 && r.score <= 100, `note ${r.score}`);
  assert.match(reportText(r), /3 séance\(s\) sur 3 prévues/);
  // semaine vide
  const empty = weekReport(state, new Date(2026, 8, 7));
  assert.equal(empty.empty, true);
  assert.match(empty.todo[0], /Aucune séance/);
  // quelle semaine présenter
  assert.equal(reviewWeek(new Date(2026, 9, 11, 18)).getTime(), mon.getTime()); // dimanche soir : la semaine en cours
  assert.equal(reviewWeek(new Date(2026, 9, 12, 9)).getTime(), mon.getTime());  // lundi : la semaine passée
  assert.equal(mondayOf(new Date(2026, 9, 11, 9)).getTime(), mon.getTime());
});

test("le coach agit sur toute l'app : calories et macros, plan de repas suivi, garde-fou du minimum", async () => {
  reset({ profile: { goal: "seche", days: 3, bodyweight: 80, sex: "m", age: 30, height: 180, activity: "light" } });
  const { targets } = await import("../js/nutrition.js");
  const { localPlan, totalsOf } = await import("../js/mealplan.js");
  const t0 = targets(state.profile);
  let r = applyAction({ type: "set_nutrition", delta: "−200 kcal" }); // nombre écrit avec son unité, signe moins typographique
  assert.ok(r.ok, r.text);
  assert.equal(targets(state.profile).kcal, Math.round((t0.kcal - 200) / 10) * 10);
  assert.equal(targets(state.profile).custom, true);
  r = applyAction({ type: "set_nutrition", kcal: "2 100", protein: "170 g" });
  const t = targets(state.profile);
  assert.deepEqual([t.kcal, t.p], [2100, 170]);
  assert.ok(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - 2100) < 40, "macros cohérentes avec les calories");
  // jamais sous le métabolisme de base : garde-fou
  r = applyAction({ type: "set_nutrition", kcal: 900 });
  assert.ok(targets(state.profile).kcal >= 1400);
  assert.match(r.text, /Je ne descends pas plus bas/);
  // un plan de repas existant suit les nouveaux objectifs
  state.mealPlan = { id: "x", at: Date.now(), source: "ai", kcal: 2600, p: 150, days: localPlan({ kcal: 2600, p: 150 }, { days: 2 }), shopping: [] };
  r = applyAction({ type: "set_nutrition", kcal: 2000 });
  assert.match(r.text, /Ton plan de repas suit/);
  for (const d of state.mealPlan.days) assert.ok(Math.abs(totalsOf(d.meals.flatMap(m => m.items)).k - 2000) <= 60);
  r = applyAction({ type: "set_nutrition", auto: true });
  assert.equal(targets(state.profile).custom, false);
  applyAction({ type: "set_nutrition", rate: -0.6, goalWeight: 75, dailyAdapt: false });
  assert.deepEqual([state.profile.nutri.rate, state.profile.nutri.goalWeight, state.profile.nutri.dailyAdapt], [-0.5, 75, false]);
});

test("plan de repas en parlant : composé à la demande, repas remplacé, aliment échangé ou retiré, calories toujours justes", async () => {
  reset({ profile: { goal: "muscle", days: 3, bodyweight: 80, sex: "m", age: 30, height: 180, activity: "light" } });
  const { targets } = await import("../js/nutrition.js");
  const { totalsOf } = await import("../js/mealplan.js");
  const kOf = d => totalsOf(d.meals.flatMap(m => m.items)).k, goal = () => targets(state.profile).kcal;
  assert.equal(applyAction({ type: "edit_plan", op: "fit" }).ok, false); // pas de plan
  let r = applyAction({ type: "meal_plan", days: 3, diet: ["Végétarien"] });
  assert.ok(r.ok);
  assert.equal(state.mealPlan.days.length, 3);
  assert.deepEqual(state.mealPlan.diet, ["vegetarien"]);
  assert.ok(state.mealPlan.days.every(d => Math.abs(kOf(d) - goal()) <= goal() * 0.05));
  assert.deepEqual(r.effects, { plan: true });
  // plan écrit par l'IA (valeurs de la base quand elle n'en donne pas), recalé sur l'objectif
  r = applyAction({ type: "meal_plan", plan: [{ meals: [
    { meal: "lunch", name: "Poulet riz", items: [{ name: "Blanc de poulet", grams: 400 }, { name: "Riz blanc cuit", grams: 700 }] },
    { meal: "dinner", name: "Saumon pâtes", items: [{ name: "Saumon", grams: 300 }, { name: "Pâtes cuites", grams: 600 }] },
  ] }] });
  assert.ok(r.ok);
  assert.equal(state.mealPlan.source, "ai");
  assert.ok(Math.abs(kOf(state.mealPlan.days[0]) - goal()) <= goal() * 0.03, `${kOf(state.mealPlan.days[0])}`);
  // d'autres calories que l'objectif, à la demande : le plan les garde
  applyAction({ type: "meal_plan", days: 2, kcal: 1900 });
  assert.equal(state.mealPlan.fixed, true);
  assert.ok(state.mealPlan.days.every(d => Math.abs(kOf(d) - 1900) <= 100));
  applyAction({ type: "meal_plan", days: 2 });
  // remplacer le dîner du jour 2 ; échanger un aliment partout ; en retirer un
  r = applyAction({ type: "edit_plan", op: "replace_meal", day: 2, meal: "dinner", name: "Omelette et salade", items: [{ name: "Œuf", grams: 165 }, { name: "Salade verte", grams: 80 }, { name: "Pain complet", grams: 60 }] });
  assert.ok(r.ok, r.text);
  assert.equal(state.mealPlan.days[1].meals.find(m => m.meal === "dinner").name, "Omelette et salade");
  assert.ok(Math.abs(kOf(state.mealPlan.days[1]) - goal()) <= goal() * 0.03);
  const someFood = state.mealPlan.days[0].meals[1].items[0].name;
  r = applyAction({ type: "edit_plan", op: "swap_food", from: someFood, to: "Escalope de dinde" });
  assert.ok(r.ok, r.text);
  assert.ok(!state.mealPlan.days.some(d => d.meals.some(m => m.items.some(x => x.name === someFood))));
  r = applyAction({ type: "edit_plan", op: "remove_food", food: "Huile d'olive" });
  assert.ok(!state.mealPlan.days.some(d => d.meals.some(m => m.items.some(x => x.name === "Huile d'olive"))));
  assert.equal(applyAction({ type: "edit_plan", op: "remove_food", food: "Caviar" }).ok, false);
  r = applyAction({ type: "edit_plan", op: "fit", kcal: 2300 });
  assert.ok(state.mealPlan.days.every(d => Math.abs(kOf(d) - 2300) <= 80));
});

test("journal, eau, pesée, profil, réglages, séances, objectifs, mémoire, écrans", () => {
  reset({ profile: { goal: "muscle", days: 3, bodyweight: 80 } });
  let r = applyAction({ type: "log_food", meal: "lunch", items: [{ name: "Riz blanc cuit", grams: 200 }, { name: "Coca-Cola", grams: 330, kcal: 139 }] });
  assert.ok(r.ok);
  const day = () => state.food[dayKey()];
  assert.equal(Math.round(sumItems(day().items).k), 260 + 139); // riz : valeurs de la base
  r = applyAction({ type: "edit_food", name: "riz", grams: 150 });
  assert.equal(day().items.find(x => x.name === "Riz blanc cuit").g, 150);
  r = applyAction({ type: "remove_food", name: "coca" });
  assert.deepEqual(day().items.map(x => x.name), ["Riz blanc cuit"]);
  assert.equal(applyAction({ type: "remove_food", name: "pizza" }).ok, false);
  applyAction({ type: "water", add: 2 });
  applyAction({ type: "water", add: 1 });
  assert.equal(day().water, 3);
  applyAction({ type: "water", glasses: 8 });
  assert.equal(day().water, 8);
  r = applyAction({ type: "log_weight", kg: "78,4" });
  assert.deepEqual([r.ok, state.profile.bodyweight, state.body.at(-1).weight], [true, 78.4, 78.4]);
  applyAction({ type: "log_weight", kg: 78 }); // même jour : la pesée est remplacée
  assert.equal(state.body.length, 1);
  r = applyAction({ type: "set_profile", height: 182, age: 31, sex: "homme", activity: "mod", equipment: "home", days: 4, minutes: 60 });
  assert.deepEqual([state.profile.height, state.profile.age, state.profile.sex, state.profile.activity, state.profile.equipment, state.profile.days, r.replan], [182, 31, "m", "mod", "home", 4, true]);
  // réglages
  assert.deepEqual(applyAction({ type: "set_setting", setting: "banter", value: "on" }).ok && state.profile.banter, true);
  applyAction({ type: "set_setting", setting: "plateTips", value: false });
  assert.equal(state.profile.plateTips, false);
  assert.deepEqual(applyAction({ type: "set_setting", setting: "accent", value: "Bleu" }).effects, { appearance: true });
  applyAction({ type: "set_setting", setting: "mode", value: "clair" });
  applyAction({ type: "set_setting", setting: "zoom", value: 1.18 });
  applyAction({ type: "set_setting", setting: "remindAt", value: "7h" });
  assert.deepEqual([state.profile.accent, state.profile.mode, state.profile.zoom, state.profile.remindAt], ["bleu", "light", 1.2, "07:00"]);
  assert.deepEqual(applyAction({ type: "set_setting", setting: "mascot", value: false }).effects, { mascot: false });
  assert.deepEqual(applyAction({ type: "set_setting", setting: "lang", value: "en" }).effects, { lang: "en" });
  assert.equal(applyAction({ type: "set_setting", setting: "nimporte", value: 1 }).ok, false);
  assert.deepEqual(applyAction({ type: "set_coach", coach: "Mochi" }).effects, { coach: "Mochi" });
  // séances : une séance de l'app modifiée devient ta version, et ton programme la suit
  state.weekPlan = { 0: "push", 2: "pull" };
  r = applyAction({ type: "edit_program", program: "Push", add: [{ name: "Pompes", sets: 3, reps: "12-15" }], replace: [{ from: "Développé couché", to: "Développé incliné haltères" }], rename: "Push maison" });
  assert.ok(r.ok, r.text);
  const mine = state.customPrograms.find(p => p.name === "Push maison");
  assert.ok(mine && state.weekPlan[0] === mine.id);
  assert.ok(mine.exercises.some(e => e.id === "pushup"));
  assert.ok(!mine.exercises.some(e => e.id === "bench"));
  assert.ok(needsConfirm({ type: "delete_program", program: "Push maison" })); // une suppression se valide
  assert.ok(needsConfirm({ type: "set_goal", goal: "force", confirm: true })); // une simple suggestion aussi
  assert.ok(!needsConfirm({ type: "set_goal", goal: "force" }));
  r = applyAction({ type: "delete_program", program: "Push maison" });
  assert.ok(r.ok);
  assert.equal(state.weekPlan[0], undefined);
  assert.equal(applyAction({ type: "delete_program", program: "Pull" }).ok, false); // séance de l'app : pas supprimable
  assert.deepEqual(applyAction({ type: "regen_week" }).replan, true);
  r = applyAction({ type: "add_goal", exercise: "Squat", base: 100, target: 120, weeks: 8 });
  assert.ok(r.ok, r.text);
  assert.equal(state.goals.at(-1).exId, "squat");
  assert.deepEqual(applyAction({ type: "start_session", program: "today" }).effects, { start: "today" });
  assert.deepEqual(applyAction({ type: "start_session", program: "Pull" }).effects, { start: "pull" });
  applyAction({ type: "remember", fact: "Allergie aux noix" });
  r = applyAction({ type: "forget", fact: "noix" });
  assert.ok(r.ok);
  assert.equal(state.memory.length, 0);
  assert.deepEqual(applyAction({ type: "open", screen: "food" }).effects, { route: "#/food" });
  assert.deepEqual(applyAction({ type: "open", screen: "plan" }).effects, { open: "plan" });
});

test("annuler : les données touchées reviennent comme avant, et rien d'autre", () => {
  reset({ profile: { goal: "muscle", days: 3, bodyweight: 80 } });
  state.food[dayKey()] = { items: [{ id: "a", name: "Pomme", meal: "snack", g: 150, per: { k: 52 } }], water: 2, at: 1 };
  state.sessions.push({ id: "s1", date: 1, sets: [] });
  const list = [{ type: "set_nutrition", kcal: 1900 }, { type: "remove_food", name: "Pomme" }, { type: "water", add: 3 }, { type: "set_setting", setting: "accent", value: "vert" }];
  const snap = snapshot(list);
  for (const a of list) assert.ok(applyAction(a).ok);
  assert.equal(state.food[dayKey()].items.length, 0);
  restore(snap);
  assert.deepEqual(state.food[dayKey()].items.map(x => x.name), ["Pomme"]);
  assert.equal(state.food[dayKey()].water, 2);
  assert.equal(state.profile.nutri, null);
  assert.equal(state.profile.accent, undefined);
  assert.ok(!(state.deleted.food || []).includes("a"), "pas de trace de suppression : la synchro ne la retire pas");
  assert.equal(state.sessions.length, 1); // le reste n'est pas touché
  // la consigne : agir (pas « envoie-moi une phrase »), toutes les actions, l'état de l'app
  const g = actionsGuide("Baisse mes calories");
  assert.match(g, /Ne lui demande jamais de faire la modification lui-même/);
  for (const ty of ["set_nutrition", "meal_plan", "edit_plan", "remove_food", "water", "log_weight", "set_profile", "set_setting", "set_coach", "edit_program", "add_goal", "open"]) assert.match(g, new RegExp(`- ${ty}\\b|\\b${ty},`), ty);
  assert.match(g, /### État de l'app\n- Objectifs nutrition : \d+ kcal/);
  assert.match(g, /Journal d'aujourd'hui : snack : Pomme 150 g/);
});
