// Séries d'échauffement calculées : avant la première série de travail d'un mouvement chargé, une montée en charge
// arrondie au pas de l'exercice — la barre à vide pour les mouvements à la barre, puis 40, 60 et 80 % de la charge de
// travail, de moins en moins de répétitions. Elles préparent sans fatiguer : elles ne comptent pas dans la séance (ni
// volume, ni fatigue, ni record). Logique pure, testée dans Node ; live.js les affiche, engine.js les annonce.

export const BAR = 20; // barre olympique
const RAMP = [[0.4, 5], [0.6, 3], [0.8, 2]];

// La montée en charge vers `weight` : [{ weight, reps }] ; vide pour une charge trop légère (rien à préparer)
export function warmupSets(weight, { step = 2.5, equip = "bar" } = {}) {
  const bar = equip === "bar" ? BAR : 0, min = equip === "bar" || equip === "smith" ? 30 : 16;
  if (!(weight >= min)) return [];
  const round = w => Math.max(step, Math.round(w / step) * step);
  const out = bar && bar <= weight * 0.5 ? [{ weight: bar, reps: 10 }] : [];
  for (const [share, reps] of RAMP) {
    const w = round(weight * share);
    if (w >= weight || out.some(s => s.weight >= w)) continue; // trop près de la charge de travail ou du palier d'avant
    out.push({ weight: w, reps });
  }
  return out;
}
// Quels exercices s'échauffent : les mouvements à la barre (et au Smith) chargés, et le premier mouvement chargé de la
// séance ; pas les isolations aux poulies
export function needsWarmup(ex, i, plan) {
  if (ex?.type !== "load" || !(ex.weight > 0) || ex.equip === "cable" || ex.equip === "band") return false;
  if (ex.equip === "bar" || ex.equip === "smith") return true;
  return plan.findIndex(e => e.type === "load" && e.weight > 0 && e.equip !== "cable" && e.equip !== "band") === i;
}
const kg = w => String(w).replace(".", ",");
// En une phrase, pour le coach : « Échauffement : barre à vide × 10, 40 kg × 5, 60 kg × 3, 80 kg × 2. »
export const warmupText = sets => (sets.length ? `Échauffement : ${sets.map((s, i) => (i === 0 && s.weight === BAR ? `barre à vide × ${s.reps}` : `${kg(s.weight)} kg × ${s.reps}`)).join(", ")}.` : "");
