// Le mannequin qui danse (js/dance.js) : pieds au sol, enchaînement des pas selon le tempo, fondu sans à-coup d'un pas
// à l'autre, temps marqués, tempo tapé en rythme.
import test from "node:test";
import assert from "node:assert/strict";
import { danceQ, tapTempo, bandOf, beatPulse, SEQUENCE, MOVES, PHRASE, DEFAULT_BPM } from "../js/dance.js";
import { solveFront, FLOOR, L, FSTAND } from "../js/body.js";

const TEMPOS = [72, 100, 140];
const lowFoot = q => { const j = solveFront(q); return Math.max(j.AL[1], j.AR[1]) + L.ankle; };

test("pieds au sol : à chaque instant le pied le plus bas touche le sol, sauf en l'air pendant un saut", () => {
  let airborne = 0;
  for (const bpm of TEMPOS) {
    for (let beat = 0; beat < PHRASE * 8; beat += 0.07) {
      const { q, move } = danceQ(beat, bpm);
      const low = lowFoot(q);
      if (move === "jump" && FLOOR - low > 0.05) { airborne++; assert.ok(low < FLOOR, `${bpm} BPM, temps ${beat.toFixed(2)} : sous le sol`); continue; }
      assert.ok(Math.abs(low - FLOOR) < 1e-6, `${bpm} BPM, temps ${beat.toFixed(2)} (${move}) : pied à ${low.toFixed(3)} au lieu de ${FLOOR}`);
    }
  }
  assert.ok(airborne > 0, "les sauts décollent vraiment");
});

test("enchaînement : un pas toutes les 8 temps, choisi selon le tempo du morceau", () => {
  assert.deepEqual([bandOf(70), bandOf(89), bandOf(90), bandOf(100), bandOf(125), bandOf(126), bandOf(170)], ["slow", "slow", "mid", "mid", "mid", "fast", "fast"]);
  for (const [band, seq] of Object.entries(SEQUENCE)) {
    for (const name of seq) assert.ok(MOVES[name], `${band} : pas inconnu ${name}`);
    const bpm = { slow: 72, mid: 100, fast: 140 }[band];
    // chaque phrase de 8 temps a son pas, et la suite recommence après le dernier
    for (let k = 0; k < seq.length * 2; k++) assert.equal(danceQ(k * PHRASE + 3.5, bpm).move, seq[k % seq.length], `${band}, phrase ${k}`);
  }
  assert.ok(!SEQUENCE.slow.includes("jump") && SEQUENCE.fast.includes("jump"), "on ne saute que sur les morceaux rapides");
  assert.equal(danceQ(3.5).move, SEQUENCE[bandOf(DEFAULT_BPM)][0], "tempo inconnu : 100 BPM");
});

test("fondu : la pose ne saute pas quand le pas change (fin d'une phrase → début de la suivante)", () => {
  for (const bpm of TEMPOS) {
    for (let k = 1; k <= 8; k++) {
      const before = danceQ(k * PHRASE - 1e-4, bpm), after = danceQ(k * PHRASE + 1e-4, bpm);
      assert.notEqual(before.move, after.move);
      for (const key of Object.keys(FSTAND)) {
        assert.ok(Math.abs(before.q[key] - after.q[key]) < 0.2, `${bpm} BPM, ${before.move} → ${after.move} : ${key} passe de ${before.q[key].toFixed(2)} à ${after.q[key].toFixed(2)}`);
      }
    }
  }
});

test("mouvement fluide : d'une image à l'autre (30 par seconde), les angles bougent peu", () => {
  for (const bpm of TEMPOS) {
    const step = bpm / 60 / 30;
    let prev = danceQ(0, bpm);
    for (let beat = step; beat < PHRASE * 8; beat += step) {
      const cur = danceQ(beat, bpm);
      for (const key of ["armL", "armR", "elbowL", "elbowR", "kneeL", "kneeR", "legL", "legR", "lean", "head"]) {
        // la pose du culturiste « claque » sur le temps : un coup sec permis, rien de plus
        const max = cur.move === "flex" ? 16 : 12; // 12° par image : 360° par seconde, la vitesse d'un bras qui danse
        assert.ok(Math.abs(cur.q[key] - prev.q[key]) <= max, `${bpm} BPM, temps ${beat.toFixed(2)} (${cur.move}) : ${key} saute de ${(cur.q[key] - prev.q[key]).toFixed(1)}°`);
      }
      prev = cur;
    }
  }
});

test("poses plausibles : des nombres, bras et genoux dans leurs limites", () => {
  for (const bpm of TEMPOS) {
    for (let beat = 0; beat < PHRASE * 4; beat += 0.25) {
      const { q } = danceQ(beat, bpm);
      for (const [k, v] of Object.entries(q)) assert.ok(Number.isFinite(v), `${k} = ${v}`);
      assert.ok(!("hop" in q), "le saut est déjà appliqué à la hauteur du bassin");
      for (const k of ["armL", "armR"]) assert.ok(q[k] >= 0 && q[k] <= 175, `${k} = ${q[k]}`);
      for (const k of ["kneeL", "kneeR"]) assert.ok(q[k] >= 0 && q[k] <= 45, `${k} = ${q[k]}`);
    }
  }
});

test("temps marqués : le corps pulse sur chaque temps, la pose du culturiste se contracte sur les temps 1 et 5", () => {
  assert.equal(beatPulse(0), 1);
  assert.ok(beatPulse(0.5) < 0.1 && beatPulse(0.95) < 0.01 && beatPulse(-0.25) < beatPulse(0.75) + 1e-9);
  // groove (1re phrase à 100 BPM) : 1 sur le temps, presque rien juste avant le suivant
  assert.equal(danceQ(2, 100).move, "groove");
  assert.ok(Math.abs(danceQ(2, 100).act - 1) < 1e-9 && danceQ(2.95, 100).act < 0.02);
  // flex (4e phrase à 100 BPM) : contraction complète sur les temps 1 et 5, plus légère sur les autres
  const flexAt = b => danceQ(3 * PHRASE + b, 100);
  assert.equal(flexAt(0.5).move, "flex");
  assert.ok(flexAt(4).act > 0.99 && flexAt(1 + 1e-6).act < 0.65 && flexAt(1 + 1e-6).act > 0.55);
  assert.ok(flexAt(4).q.elbowL > flexAt(2.5).q.elbowL + 10, "les biceps se contractent sur le temps fort");
});

test("« Tape en rythme » : le tempo des derniers coups, s'ils sont réguliers", () => {
  const taps = (gap, n, t0 = 1000) => Array.from({ length: n }, (_, i) => t0 + i * gap);
  assert.deepEqual(tapTempo(taps(500, 6)), { bpm: 120, at: 3500 });
  assert.equal(tapTempo(taps(500, 3)), null, "trois coups ne suffisent pas");
  assert.equal(tapTempo([0, 500, 1000, 1900, 2400]), null, "irrégulier : on attend");
  assert.equal(tapTempo(taps(2000, 6)), null, "trop lent pour être un tempo");
  // petites imprécisions du doigt : tolérées
  const shaky = [0, 476, 1003, 1497, 2010, 2488];
  assert.ok(Math.abs(tapTempo(shaky).bpm - 120) <= 3, `${tapTempo(shaky)?.bpm}`);
  // seuls les 8 derniers coups comptent : un vieux rythme oublié
  assert.equal(tapTempo([...taps(800, 4, 0), ...taps(400, 8, 4000)]).bpm, 150);
  // les coups vers 0,6 s donnent 100 BPM
  assert.equal(tapTempo(taps(600, 5)).bpm, 100);
});
