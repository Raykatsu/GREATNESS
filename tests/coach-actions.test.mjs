// Le coach agit sur l'app (actions de l'IA en ligne), sa mémoire, et le bilan de la semaine.
import test from "node:test";
import assert from "node:assert/strict";
import { state, setUser } from "../js/store.js";
import { parseActions, streamText, resolveExercise, resolveProgram, applyAction, describe, actionsGuide } from "../js/aiact.js";
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
