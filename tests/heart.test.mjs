// La fréquence cardiaque de la montre (js/heart.js) : dernière mesure récente pendant la séance, moyenne et maximum
// de la séance (pondérés par le temps), mesures absurdes ignorées.
import test from "node:test";
import assert from "node:assert/strict";
import { liveHr, hrStats, FRESH_MS } from "../js/heart.js";

const NOW = Date.UTC(2026, 10, 19, 18, 0);
const at = (sec, bpm) => ({ t: NOW + sec * 1000, bpm });

test("pendant la séance : la dernière mesure si elle est récente", () => {
  assert.equal(liveHr([at(-300, 90), at(-20, 131.6), at(-60, 120)], NOW), 132);
  assert.equal(liveHr([at(-(FRESH_MS / 1000) - 5, 140)], NOW), 0, "trop ancienne");
  assert.equal(liveHr([at(-10, 400), at(-10, 0)], NOW), 0, "mesures absurdes");
  assert.equal(liveHr([], NOW), 0);
});

test("fin de séance : moyenne pondérée par le temps, maximum, au moins 3 mesures", () => {
  // 10 min à 100 (mesures espacées d'une minute), puis une minute à 160 (mesures toutes les 5 s)
  const calm = Array.from({ length: 10 }, (_, i) => at(i * 60, 100));
  const hard = Array.from({ length: 12 }, (_, i) => at(600 + i * 5, 160));
  const s = hrStats([...hard, ...calm, at(-600, 70), at(5000, 70)], NOW, NOW + 700e3);
  assert.equal(s.max, 160);
  assert.equal(s.n, 22);
  // 10 × 60 s à 100, 12 × 5 s à 160 → (600 × 100 + 60 × 160) / 660 ≈ 105
  assert.equal(s.avg, Math.round((600 * 100 + 60 * 160) / 660));
  assert.equal(hrStats([at(0, 100), at(5, 110)], NOW, NOW + 60e3), null, "trop peu de mesures");
});
