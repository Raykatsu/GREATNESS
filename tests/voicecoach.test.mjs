// Questions au coach à voix haute (voice.js) : repérées sans gêner les commandes de séance.
import test from "node:test";
import assert from "node:assert/strict";
import { parseVoice, parseQuestion } from "../js/voice.js";

test("questions au coach : « coach, … », mots interrogatifs ; les commandes restent des commandes", () => {
  assert.deepEqual(parseVoice("Coach, j'ai mal à l'épaule, je remplace par quoi ?"), { action: "ask", q: "j'ai mal à l'épaule, je remplace par quoi ?" });
  assert.deepEqual(parseVoice("Hey coach combien de repos ?"), { action: "ask", q: "combien de repos ?" });
  assert.equal(parseVoice("Est-ce que je peux monter la charge").action, "ask");
  assert.equal(parseVoice("pourquoi j'ai mal aux lombaires").action, "ask");
  assert.equal(parseVoice("comment je respire au squat").action, "ask");
  assert.equal(parseQuestion("coach"), null); // trop court
  assert.equal(parseQuestion("8 reps difficile"), null);
  assert.deepEqual(parseVoice("8 reps difficile"), { action: "log", reps: 8, rpe: 8 });
  assert.deepEqual(parseVoice("passe"), { action: "skip" });
  assert.deepEqual(parseVoice("go"), { action: "go" });
  assert.deepEqual(parseVoice("dix à soixante kilos"), { action: "log", weight: 60, reps: 10 });
  assert.deepEqual(parseVoice("coupe le micro"), { action: "stop" });
});
