// Tes séances dans Apple Santé (app iPhone reliée à Santé) : le type d'entraînement, l'énergie active estimée et pas
// de doublon quand ta montre a déjà enregistré l'entraînement. Énergie active = (MET − 1) × poids × durée, avec les MET
// du Compendium des activités physiques (Ainsworth et al., 2011) : musculation 5, intervalles 8, cardio 7, mobilité et
// étirements 2,5 ; le « − 1 » retire la dépense de repos, déjà comptée par Santé. Logique pure, testée dans Node.
export const METS = { strength: 5, hiit: 8, cardio: 7, mobility: 2.5 };

// Le type d'entraînement d'une séance (séance d'intervalles, cardio, mobilité ou étirements, sinon musculation)
export function workoutKind(program = {}, session = {}) {
  if (session.iv || program.iv) return "hiit";
  if (program.cat === "cardio") return "cardio";
  if (["mobility", "stretch", "care"].includes(program.cat)) return "mobility";
  return "strength";
}

// Énergie active estimée (kcal)
export function activeKcal({ minutes = 0, weight = 75, kind = "strength" } = {}) {
  const met = METS[kind] ?? METS.strength;
  return Math.max(0, Math.round((met - 1) * (+weight || 75) * (Math.max(0, minutes) / 60)));
}

// Un entraînement d'une autre app (ta montre) recouvre au moins la moitié de la séance : on ne l'enregistre pas deux fois
export function coveredBy(workouts = [], from, to) {
  const len = to - from;
  return len > 0 && workouts.some(w => {
    if (!w || /greatness/i.test(`${w.sourceName || ""} ${w.sourceId || ""}`)) return false;
    const s = Date.parse(w.startDate), e = Date.parse(w.endDate);
    return Number.isFinite(s) && Number.isFinite(e) && Math.min(e, to) - Math.max(s, from) >= len / 2;
  });
}
