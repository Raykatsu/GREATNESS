// Mode mains libres : ce que le coach comprend à la voix.
import test from "node:test";
import assert from "node:assert/strict";
import { parseVoice, wordsToNumbers } from "../js/voice.js";

test("nombres en lettres", () => {
  assert.equal(wordsToNumbers("vingt et un"), "21");
  assert.equal(wordsToNumbers("soixante deux et demi"), "62.5");
  assert.equal(wordsToNumbers("quatre vingt dix"), "90");
  assert.equal(wordsToNumbers("cent vingt"), "120");
  assert.equal(wordsToNumbers("huit reps"), "8 reps");
});

const cases = [
  ["8 reps difficile", { action: "log", reps: 8, rpe: 8 }],
  ["huit répétitions très dur", { action: "log", reps: 8, rpe: 9 }],
  ["10 à 60 kilos facile", { action: "log", reps: 10, weight: 60, rpe: 6 }],
  ["douze à soixante deux et demi kilos", { action: "log", reps: 12, weight: 62.5 }],
  ["valide", { action: "log" }],
  ["c'est bon", { action: "log" }],
  ["échec", { action: "log", rpe: 10 }],
  ["45 secondes", { action: "log", reps: 45 }],
  ["passe", { action: "skip" }],
  ["exercice suivant", { action: "skip" }],
  ["annule", { action: "undo" }],
  ["go", { action: "go" }],
  ["c'est parti", { action: "go" }],
  ["coupe le micro", { action: "stop" }],
];
for (const [text, expected] of cases) test(`voix : « ${text} »`, () => assert.deepEqual(parseVoice(text), expected));
test("phrase sans rapport : rien", () => assert.equal(parseVoice("il fait beau aujourd'hui"), null));
