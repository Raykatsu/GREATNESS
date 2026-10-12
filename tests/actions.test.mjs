// Le coach comprend les demandes… et ne confond pas avec les questions.
import test from "node:test";
import assert from "node:assert/strict";
import "./setup.mjs";
const { parseCommand } = await import("../js/actions.js");
const { setUser } = await import("../js/store.js");
setUser("cmd", { customPrograms: [{ id: "c1", name: "Pecs du jeudi", exercises: [] }] });

const cases = [
  ["Crée une séance pecs triceps de 45 min", c => c.type === "create" && c.groups.includes("pecs") && c.minutes === 45],
  ["Crée-moi une séance jambes sans matériel pour samedi", c => c.type === "create" && c.equipment === "home" && c.day === 5],
  ["tu peux me faire une séance bras de 30 min ?", c => c.type === "create" && c.minutes === 30],
  ["Mets Legs le mercredi", c => c.type === "plan" && c.day === 2 && c.program === "legs"],
  ["lundi repos", c => c.type === "plan" && c.program === null],
  ["Passe à 4 séances par semaine", c => c.type === "days" && c.value === 4],
  ["Change mon objectif en sèche", c => c.type === "goal" && c.value === "seche"],
  ["Passe l'app en bleu", c => c.type === "accent" && c.value === "bleu"],
  ["Mode clair", c => c.type === "mode" && c.value === "light"],
  ["Agrandis le texte", c => c.type === "zoom" && c.value === "up"],
  ["Désactive la voix", c => c.type === "toggle" && c.target === "voice" && c.value === false],
  ["Lance la séance du jour", c => c.type === "start" && c.program === "today"],
  ["lance une séance libre", c => c.type === "start" && c.program === "free"],
  ["ajoute curl marteau à ma séance Pecs du jeudi", c => c.type === "addex" && c.exercise === "hammer"],
];
for (const [text, ok] of cases) test(`commande : ${text}`, () => { const c = parseCommand(text); assert.ok(c && ok(c), JSON.stringify(c)); });

for (const q of ["Comment progresser au squat ?", "la viande rouge c'est bon pour les muscles ?", "combien de séances par semaine je dois faire ?", "Que manger le lundi ?", "j'ai mal au dos"]) {
  test(`question (pas d'action) : ${q}`, () => assert.equal(parseCommand(q), null));
}
