// Le récap de fin de séance : les muscles que tu viens de travailler, éclairés sur le corps (la planche tout de suite,
// puis le corps 3D qui tourne quand l'appareil le permet, live.js). Séries par muscle comme l'équilibre musculaire
// (balance.js) : un muscle principal compte pour 1, un muscle qui aide pour ½, le cardio pour un tiers environ, les
// étirements pas du tout. Logique pure, testée dans Node.
import { musclesOf, kindOf } from "./recovery.js";
import { MUSCLES } from "./body.js";

export function sessionMuscles(sets = []) {
  const out = {};
  for (const set of sets) {
    const k = kindOf(set.exId);
    if (!k) continue;
    const { p, s } = musclesOf(set.exId);
    for (const m of p) if (MUSCLES[m]) out[m] = (out[m] || 0) + k;
    for (const m of s) if (MUSCLES[m]) out[m] = (out[m] || 0) + 0.5 * k;
  }
  for (const m in out) out[m] = Math.round(out[m] * 10) / 10;
  return out;
}

// À partir de 3 séries, le muscle est « très sollicité » (couleur principale), en dessous « sollicité »
export const HARD = 3;
export const workedClass = mus => m => (mus[m] >= HARD ? "mus p" : mus[m] > 0 ? "mus s" : "mz");

// Les muscles les plus travaillés, du plus au moins
export const topMuscles = (mus, n = 4) => Object.entries(mus).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([id, sets]) => ({ id, name: MUSCLES[id], sets }));
