// Bibliothèque d'exercices, programmes et petits clins d'œil.
// type : "load" (charge en kg), "bw" (poids du corps, en reps), "time" (en secondes)
// equip : "gym" (salle), "db" (haltères), "bw" (rien)

const E = (name, muscle, type, equip, step, cues, alts = []) => ({ name, muscle, type, equip, step, cues, alts });

export const EXERCISES = {
  // Pectoraux
  bench:       E("Développé couché", "Pectoraux", "load", "gym", 2.5, ["Omoplates serrées et basses, pieds ancrés.", "Barre au bas des pecs, coudes à 45°.", "Descente contrôlée, poussée explosive."], ["db_bench", "pushup"]),
  incline:     E("Développé incliné barre", "Pectoraux", "load", "gym", 2.5, ["Banc à 30°, pas plus.", "Barre vers le haut des pecs.", "Garde les omoplates serrées."], ["incline_db", "pushup"]),
  db_bench:    E("Développé haltères", "Pectoraux", "load", "db", 2, ["Haltères alignés avec le bas des pecs.", "Grande amplitude, étire en bas.", "Rapproche sans cogner en haut."], ["bench", "pushup"]),
  incline_db:  E("Développé incliné haltères", "Pectoraux", "load", "db", 2, ["Banc à 30°.", "Coudes légèrement rentrés.", "Contrôle la descente."], ["incline", "pushup"]),
  fly:         E("Écartés poulie", "Pectoraux", "load", "gym", 2.5, ["Coudes légèrement fléchis et fixes.", "Imagine serrer un gros arbre.", "Pause d'une seconde, mains jointes."], ["db_fly"]),
  db_fly:      E("Écartés haltères", "Pectoraux", "load", "db", 1, ["Bras légèrement fléchis.", "Descends jusqu'à l'étirement, pas plus."], ["fly"]),
  pushup:      E("Pompes", "Pectoraux", "bw", "bw", 1, ["Corps gainé, une planche du talon à la tête.", "Poitrine au sol, coudes à 45°.", "Pousse le sol loin de toi."], ["db_bench"]),
  dips:        E("Dips", "Triceps", "bw", "gym", 1, ["Épaules basses, loin des oreilles.", "Descends jusqu'à 90° aux coudes.", "Buste légèrement penché pour les pecs."], ["bench_dips", "pushdown"]),
  // Épaules
  ohp:         E("Développé militaire", "Épaules", "load", "gym", 2.5, ["Fessiers et abdos serrés, ne cambre pas.", "La barre passe près du visage.", "Tête vers l'avant en haut du mouvement."], ["db_press", "pike"]),
  db_press:    E("Développé épaules haltères", "Épaules", "load", "db", 2, ["Assis, dos calé.", "Coudes légèrement devant.", "Monte sans verrouiller brutalement."], ["ohp", "pike"]),
  lateral:     E("Élévations latérales", "Épaules", "load", "db", 1, ["Monte avec les coudes, pas les mains.", "Arrête à hauteur d'épaules.", "Descente lente, pas d'élan."], ["cable_lateral"]),
  cable_lateral: E("Élévations latérales poulie", "Épaules", "load", "gym", 1.25, ["Tension constante.", "Coude légèrement fléchi."], ["lateral"]),
  rear_delt:   E("Oiseau haltères", "Épaules", "load", "db", 1, ["Buste penché, dos plat.", "Ouvre les bras en arc, pense « coudes vers l'extérieur »."], ["face_pull"]),
  face_pull:   E("Face pull", "Épaules", "load", "gym", 2.5, ["Tire la corde vers le front.", "Écarte les mains en fin de mouvement.", "Excellent pour la santé des épaules."], ["rear_delt"]),
  pike:        E("Pompes piquées", "Épaules", "bw", "bw", 1, ["Hanches hautes, forme un V inversé.", "La tête descend devant les mains."], ["db_press"]),
  // Triceps
  pushdown:    E("Extension triceps poulie", "Triceps", "load", "gym", 2.5, ["Coudes collés au corps.", "Verrouille en bas, une seconde."], ["overhead_ext", "diamond"]),
  overhead_ext: E("Extension nuque haltère", "Triceps", "load", "db", 1, ["Coudes pointés vers le plafond.", "Grand étirement derrière la tête."], ["pushdown", "skull"]),
  skull:       E("Barre au front", "Triceps", "load", "gym", 2.5, ["Coudes fixes.", "Descends derrière le front, contrôle."], ["overhead_ext"]),
  diamond:     E("Pompes diamant", "Triceps", "bw", "bw", 1, ["Mains en losange sous la poitrine.", "Coudes le long du corps."], ["bench_dips"]),
  bench_dips:  E("Dips sur banc", "Triceps", "bw", "bw", 1, ["Fesses près du banc.", "Descends à 90°, pousse avec les triceps."], ["diamond"]),
  // Dos
  pullup:      E("Tractions", "Dos", "bw", "gym", 1, ["Pars bras tendus, épaules engagées.", "Tire les coudes vers les poches.", "Menton au-dessus de la barre, sans élan."], ["lat_pull", "inverted_row"]),
  chinup:      E("Tractions supination", "Dos", "bw", "gym", 1, ["Paumes vers toi.", "Poitrine vers la barre."], ["pullup", "lat_pull"]),
  lat_pull:    E("Tirage vertical", "Dos", "load", "gym", 2.5, ["Poitrine haute, léger recul du buste.", "Barre vers le haut des pecs.", "Contrôle la remontée."], ["pullup", "db_row"]),
  row:         E("Rowing barre", "Dos", "load", "gym", 2.5, ["Buste à 45°, dos plat.", "Tire vers le nombril.", "Serre les omoplates en haut."], ["db_row", "cable_row"]),
  db_row:      E("Rowing haltère", "Dos", "load", "db", 2, ["Main et genou sur le banc.", "Tire le coude vers la hanche.", "Pas de rotation du buste."], ["row", "inverted_row"]),
  cable_row:   E("Tirage horizontal", "Dos", "load", "gym", 2.5, ["Dos droit, poitrine sortie.", "Tire vers le ventre, omoplates serrées."], ["row", "db_row"]),
  inverted_row: E("Rowing inversé", "Dos", "bw", "bw", 1, ["Corps gainé comme une planche.", "Poitrine vers la barre ou la table."], ["db_row"]),
  superman:    E("Superman", "Lombaires", "time", "bw", 5, ["Allongé sur le ventre, lève bras et jambes.", "Regard vers le sol."], []),
  deadlift:    E("Soulevé de terre", "Chaîne post.", "load", "gym", 5, ["Barre au-dessus du milieu du pied.", "Dos neutre, poitrine fière.", "Pousse le sol, hanches et épaules montent ensemble."], ["rdl", "hip_thrust"]),
  // Biceps
  curl:        E("Curl haltères", "Biceps", "load", "db", 1, ["Coudes collés au corps.", "Tourne les paumes vers le haut en montant.", "Descente en 3 secondes."], ["hammer", "barbell_curl"]),
  barbell_curl: E("Curl barre", "Biceps", "load", "gym", 2.5, ["Pas d'élan du dos.", "Serre fort en haut."], ["curl"]),
  hammer:      E("Curl marteau", "Biceps", "load", "db", 1, ["Prise neutre, pouces vers le haut.", "Coudes fixes."], ["curl"]),
  preacher:    E("Curl pupitre", "Biceps", "load", "gym", 2.5, ["Bras bien calés sur le pupitre.", "Ne lâche pas en bas."], ["curl"]),
  // Jambes
  squat:       E("Squat", "Quadriceps", "load", "gym", 2.5, ["Pieds largeur d'épaules, pointes légèrement ouvertes.", "Genoux dans l'axe des pieds.", "Descends sous la parallèle si ta mobilité le permet."], ["goblet", "leg_press"]),
  front_squat: E("Squat avant", "Quadriceps", "load", "gym", 2.5, ["Coudes hauts.", "Buste le plus droit possible."], ["squat", "goblet"]),
  leg_press:   E("Presse à cuisses", "Quadriceps", "load", "gym", 5, ["Bas du dos collé au dossier.", "Ne verrouille pas les genoux en haut."], ["squat", "goblet"]),
  goblet:      E("Goblet squat", "Quadriceps", "load", "db", 2, ["Haltère contre la poitrine.", "Coudes entre les genoux en bas."], ["squat", "air_squat"]),
  air_squat:   E("Squat au poids du corps", "Quadriceps", "bw", "bw", 1, ["Bras devant pour l'équilibre.", "Talons au sol."], ["goblet"]),
  jump_squat:  E("Squats sautés", "Quadriceps", "bw", "bw", 1, ["Réception souple, genoux fléchis.", "Explose vers le haut."], ["air_squat"]),
  lunge:       E("Fentes", "Quadriceps", "bw", "bw", 1, ["Grand pas, genou arrière frôle le sol.", "Buste droit."], ["bulgarian", "goblet"]),
  bulgarian:   E("Fentes bulgares", "Quadriceps", "load", "db", 2, ["Pied arrière sur le banc.", "Descends droit, genou avant stable."], ["lunge"]),
  step_up:     E("Montées sur banc", "Fessiers", "bw", "bw", 1, ["Pousse avec le talon du pied sur le banc.", "Ne t'aide pas avec la jambe arrière."], ["lunge"]),
  leg_ext:     E("Leg extension", "Quadriceps", "load", "gym", 2.5, ["Pause d'une seconde en haut.", "Descente lente."], ["goblet"]),
  leg_curl:    E("Leg curl", "Ischios", "load", "gym", 2.5, ["Hanches collées au banc.", "Contrôle la remontée."], ["rdl", "glute_bridge"]),
  rdl:         E("Soulevé de terre roumain", "Ischios", "load", "gym", 2.5, ["Hanches en arrière, genoux légèrement fléchis.", "Barre collée aux cuisses.", "Sens l'étirement des ischios."], ["db_rdl", "leg_curl"]),
  db_rdl:      E("Soulevé roumain haltères", "Ischios", "load", "db", 2, ["Dos plat, hanches en arrière.", "Haltères près des jambes."], ["rdl", "glute_bridge"]),
  hip_thrust:  E("Hip thrust", "Fessiers", "load", "gym", 2.5, ["Haut du dos sur le banc.", "Menton rentré, bassin en rétroversion.", "Serre les fessiers une seconde en haut."], ["glute_bridge"]),
  glute_bridge: E("Pont fessier", "Fessiers", "bw", "bw", 1, ["Pieds proches des fesses.", "Pousse avec les talons, serre en haut."], ["hip_thrust"]),
  calf:        E("Mollets debout", "Mollets", "load", "gym", 2.5, ["Amplitude complète.", "Pause en haut et en bas."], ["calf_bw"]),
  calf_bw:     E("Mollets sur marche", "Mollets", "bw", "bw", 1, ["Talons dans le vide.", "Monte au maximum, descends lentement."], ["calf"]),
  wall_sit:    E("Chaise contre le mur", "Quadriceps", "time", "bw", 5, ["Cuisses parallèles au sol.", "Dos plaqué au mur."], ["air_squat"]),
  // Abdos
  plank:       E("Gainage", "Abdos", "time", "bw", 5, ["Fessiers serrés, bassin neutre.", "Respire court et régulier."], ["hollow"]),
  side_plank:  E("Gainage latéral", "Abdos", "time", "bw", 5, ["Corps aligné, hanches hautes.", "Épaule au-dessus du coude."], ["plank"]),
  hollow:      E("Hollow hold", "Abdos", "time", "bw", 5, ["Bas du dos plaqué au sol.", "Bras et jambes tendus, proches du sol."], ["plank"]),
  crunch:      E("Crunchs", "Abdos", "bw", "bw", 1, ["Enroule le buste, ne tire pas sur la nuque.", "Expire en montant."], ["leg_raise"]),
  leg_raise:   E("Relevés de jambes", "Abdos", "bw", "bw", 1, ["Bas du dos collé au sol.", "Descente lente."], ["crunch"]),
  russian_twist: E("Russian twist", "Abdos", "bw", "bw", 2, ["Buste incliné, dos droit.", "Tourne avec les épaules, pas que les bras."], ["crunch"]),
  // Cardio
  burpee:      E("Burpees", "Cardio", "bw", "bw", 1, ["Rythme régulier.", "Poitrine au sol, saut en haut."], ["jumping_jack"]),
  jumping_jack: E("Jumping jacks", "Cardio", "time", "bw", 5, ["Reste léger sur les pointes.", "Respire."], ["high_knees"]),
  high_knees:  E("Montées de genoux", "Cardio", "time", "bw", 5, ["Genoux à hauteur de hanches.", "Bras actifs."], ["jumping_jack"]),
  mountain:    E("Mountain climbers", "Cardio", "time", "bw", 5, ["Épaules au-dessus des mains.", "Hanches basses, genoux vers la poitrine."], ["high_knees"]),
  jump_rope:   E("Corde à sauter", "Cardio", "time", "bw", 10, ["Petits sauts, poignets qui tournent.", "Coudes près du corps."], ["jumping_jack"]),
  // Mobilité
  cat_cow:     E("Chat-vache", "Mobilité", "time", "bw", 10, ["Enroule puis creuse le dos lentement.", "Synchronise avec la respiration."], []),
  worlds_greatest: E("World's greatest stretch", "Mobilité", "time", "bw", 10, ["Fente, coude vers le sol puis rotation vers le ciel.", "Alterne les côtés."], []),
  hip_flexor:  E("Étirement fléchisseurs de hanche", "Mobilité", "time", "bw", 10, ["Genou au sol, pousse le bassin vers l'avant.", "Serre le fessier de la jambe arrière."], []),
  pigeon:      E("Posture du pigeon", "Mobilité", "time", "bw", 10, ["Respire dans l'étirement.", "Hanches bien face au sol."], []),
  hamstring:   E("Étirement ischios", "Mobilité", "time", "bw", 10, ["Dos plat, penche-toi depuis les hanches.", "Pas de rebond."], []),
  thoracic:    E("Rotations thoraciques", "Mobilité", "time", "bw", 10, ["À quatre pattes, main derrière la tête.", "Ouvre le coude vers le plafond."], []),
  child_pose:  E("Posture de l'enfant", "Mobilité", "time", "bw", 10, ["Fesses vers les talons, bras devant.", "Relâche les épaules, respire."], []),
};

// sets, reps [min,max] (secondes si type "time"), poids de départ, repos (s), RPE cible
const x = (id, sets, reps, weight = 0, rest = 90, rpe = 8) => ({ id, sets, reps, weight, rest, rpe });

export const CATEGORIES = [
  { id: "all", name: "Tout" },
  { id: "gym", name: "Salle" },
  { id: "home", name: "Maison" },
  { id: "cardio", name: "Cardio" },
  { id: "mobility", name: "Mobilité" },
  { id: "custom", name: "Mes séances" },
];

export const PROGRAMS = [
  { id: "push", name: "Push", tag: "Pecs · Épaules · Triceps", cat: "gym", accent: "red",
    exercises: [x("bench", 4, [6, 8], 60, 150), x("ohp", 3, [8, 10], 35, 120), x("incline_db", 3, [8, 12], 22), x("lateral", 3, [12, 15], 8, 60), x("pushdown", 3, [10, 12], 20, 60), x("dips", 2, [8, 15], 0, 75)] },
  { id: "pull", name: "Pull", tag: "Dos · Biceps", cat: "gym", accent: "blue",
    exercises: [x("pullup", 4, [5, 10], 0, 150), x("row", 4, [8, 10], 50, 120), x("lat_pull", 3, [10, 12], 45), x("face_pull", 3, [12, 15], 15, 60), x("curl", 3, [10, 12], 12, 60), x("hammer", 2, [12, 15], 10, 60)] },
  { id: "legs", name: "Legs", tag: "Quadris · Ischios · Fessiers", cat: "gym", accent: "red",
    exercises: [x("squat", 4, [5, 8], 70, 180), x("rdl", 3, [8, 10], 60, 120), x("bulgarian", 3, [8, 12], 14), x("leg_curl", 3, [10, 12], 30, 75), x("calf", 4, [12, 15], 40, 60), x("plank", 3, [30, 60], 0, 45)] },
  { id: "push_b", name: "Push · Volume", tag: "Pecs · Épaules · Triceps · hypertrophie", cat: "gym", accent: "red",
    exercises: [x("incline", 4, [8, 10], 50, 120), x("db_bench", 3, [10, 12], 24), x("db_press", 3, [10, 12], 18), x("fly", 3, [12, 15], 12, 60), x("cable_lateral", 3, [12, 15], 5, 60), x("overhead_ext", 3, [10, 12], 14, 60)] },
  { id: "pull_b", name: "Pull · Volume", tag: "Dos · Biceps · hypertrophie", cat: "gym", accent: "blue",
    exercises: [x("chinup", 3, [6, 10], 0, 120), x("cable_row", 4, [10, 12], 45), x("db_row", 3, [10, 12], 24), x("rear_delt", 3, [12, 15], 6, 60), x("barbell_curl", 3, [8, 12], 25, 60), x("preacher", 2, [10, 12], 20, 60)] },
  { id: "legs_b", name: "Legs · Volume", tag: "Jambes · hypertrophie", cat: "gym", accent: "red",
    exercises: [x("leg_press", 4, [10, 12], 120, 120), x("front_squat", 3, [6, 8], 50, 150), x("hip_thrust", 3, [10, 12], 60), x("leg_ext", 3, [12, 15], 30, 60), x("leg_curl", 3, [12, 15], 30, 60), x("calf", 3, [15, 20], 40, 60)] },
  { id: "upper", name: "Haut du corps", tag: "Upper · force", cat: "gym", accent: "blue",
    exercises: [x("bench", 4, [5, 8], 60, 150), x("row", 4, [6, 10], 50, 120), x("ohp", 3, [6, 10], 35, 120), x("lat_pull", 3, [8, 12], 45), x("curl", 2, [10, 12], 12, 60), x("pushdown", 2, [10, 12], 20, 60)] },
  { id: "lower", name: "Bas du corps", tag: "Lower · force", cat: "gym", accent: "red",
    exercises: [x("squat", 4, [5, 8], 70, 180), x("deadlift", 3, [4, 6], 90, 180), x("bulgarian", 3, [8, 10], 14), x("leg_curl", 3, [10, 12], 30, 75), x("calf", 3, [12, 15], 40, 60)] },
  { id: "upper_b", name: "Haut du corps · B", tag: "Upper · volume", cat: "gym", accent: "blue",
    exercises: [x("incline_db", 4, [8, 12], 22), x("cable_row", 4, [10, 12], 45), x("db_press", 3, [10, 12], 18), x("pullup", 3, [6, 10], 0, 120), x("lateral", 3, [12, 15], 8, 60), x("hammer", 3, [10, 12], 12, 60)] },
  { id: "lower_b", name: "Bas du corps · B", tag: "Lower · volume", cat: "gym", accent: "red",
    exercises: [x("leg_press", 4, [10, 12], 120, 120), x("rdl", 3, [8, 10], 60, 120), x("hip_thrust", 3, [10, 12], 60), x("leg_ext", 3, [12, 15], 30, 60), x("hollow", 3, [20, 40], 0, 45)] },
  { id: "full_a", name: "Full body A", tag: "Corps complet · 45 min", cat: "gym", accent: "blue",
    exercises: [x("squat", 3, [6, 8], 60, 150), x("bench", 3, [6, 8], 55, 120), x("row", 3, [8, 10], 45), x("ohp", 2, [8, 10], 30), x("rdl", 2, [8, 10], 50), x("plank", 2, [30, 60], 0, 45)] },
  { id: "full_b", name: "Full body B", tag: "Corps complet · 45 min", cat: "gym", accent: "red",
    exercises: [x("deadlift", 3, [4, 6], 80, 180), x("incline_db", 3, [8, 12], 20), x("pullup", 3, [5, 10], 0, 120), x("goblet", 3, [10, 12], 20), x("lateral", 2, [12, 15], 8, 60), x("hollow", 2, [20, 40], 0, 45)] },
  { id: "arms", name: "Bras", tag: "Biceps · Triceps", cat: "gym", accent: "blue",
    exercises: [x("barbell_curl", 3, [8, 12], 25, 75), x("skull", 3, [8, 12], 20, 75), x("hammer", 3, [10, 12], 12, 60), x("pushdown", 3, [10, 15], 20, 60), x("preacher", 2, [10, 12], 20, 60), x("diamond", 2, [8, 15], 0, 60)] },
  { id: "glutes", name: "Fessiers", tag: "Fessiers · Ischios", cat: "gym", accent: "red",
    exercises: [x("hip_thrust", 4, [8, 12], 60, 120), x("rdl", 3, [8, 10], 50, 120), x("bulgarian", 3, [10, 12], 12), x("step_up", 3, [10, 12], 0, 60), x("glute_bridge", 2, [15, 20], 0, 45)] },
  { id: "core", name: "Abdos & gainage", tag: "Sangle abdominale · 20 min", cat: "home", accent: "blue",
    exercises: [x("plank", 3, [30, 60], 0, 45, 7), x("crunch", 3, [15, 20], 0, 45, 7), x("leg_raise", 3, [10, 15], 0, 45, 7), x("side_plank", 2, [20, 40], 0, 30, 7), x("russian_twist", 3, [20, 30], 0, 45, 7), x("hollow", 2, [20, 40], 0, 45, 7)] },
  { id: "home_full", name: "Maison · Full body", tag: "Aucun matériel", cat: "home", accent: "red",
    exercises: [x("pushup", 4, [10, 20], 0, 60), x("air_squat", 4, [15, 25], 0, 60), x("inverted_row", 3, [8, 12], 0, 60), x("lunge", 3, [10, 14], 0, 60), x("pike", 3, [6, 12], 0, 60), x("plank", 3, [40, 75], 0, 45)] },
  { id: "home_upper", name: "Maison · Haut", tag: "Aucun matériel", cat: "home", accent: "blue",
    exercises: [x("pushup", 4, [10, 20], 0, 60), x("pike", 3, [6, 12], 0, 60), x("inverted_row", 4, [8, 12], 0, 60), x("diamond", 3, [8, 15], 0, 60), x("bench_dips", 3, [10, 15], 0, 60), x("superman", 2, [20, 40], 0, 45, 7)] },
  { id: "home_lower", name: "Maison · Bas", tag: "Aucun matériel", cat: "home", accent: "red",
    exercises: [x("air_squat", 4, [15, 25], 0, 60), x("lunge", 3, [10, 14], 0, 60), x("glute_bridge", 3, [15, 20], 0, 45), x("step_up", 3, [10, 12], 0, 60), x("wall_sit", 2, [30, 60], 0, 60), x("calf_bw", 3, [15, 25], 0, 45)] },
  { id: "home_db", name: "Maison · Haltères", tag: "Une paire d'haltères", cat: "home", accent: "blue",
    exercises: [x("goblet", 4, [8, 12], 20, 90), x("db_bench", 3, [8, 12], 20), x("db_row", 3, [10, 12], 20), x("db_press", 3, [8, 12], 14), x("db_rdl", 3, [10, 12], 20), x("curl", 2, [10, 12], 10, 60)] },
  { id: "hiit", name: "HIIT express", tag: "Cardio · 20 min", cat: "cardio", accent: "red",
    exercises: [x("jumping_jack", 3, [30, 45], 0, 20, 7), x("burpee", 3, [8, 12], 0, 30, 8), x("mountain", 3, [30, 40], 0, 20, 8), x("jump_squat", 3, [10, 15], 0, 30, 8), x("high_knees", 3, [30, 40], 0, 20, 8)] },
  { id: "cardio_rope", name: "Corde & gainage", tag: "Cardio · 25 min", cat: "cardio", accent: "blue",
    exercises: [x("jump_rope", 5, [60, 90], 0, 45, 7), x("mountain", 3, [30, 45], 0, 30, 8), x("plank", 3, [40, 60], 0, 30, 7), x("burpee", 2, [10, 15], 0, 45, 8)] },
  { id: "mobility", name: "Mobilité", tag: "Récupération active · 15 min", cat: "mobility", accent: "blue", simple: true,
    exercises: [x("cat_cow", 1, [45, 60], 0, 10, 5), x("worlds_greatest", 2, [40, 60], 0, 10, 5), x("hip_flexor", 2, [40, 60], 0, 10, 5), x("pigeon", 2, [45, 60], 0, 10, 5), x("thoracic", 2, [30, 45], 0, 10, 5), x("hamstring", 2, [40, 60], 0, 10, 5), x("child_pose", 1, [60, 90], 0, 10, 5)] },
];

// Rangs : petit clin d'œil au parcours d'un certain héros de Queens.
export const RANKS = [
  { xp: 0,     name: "Étudiant de Midtown" },
  { xp: 500,   name: "Piqûre radioactive" },
  { xp: 1500,  name: "Héros du quartier" },
  { xp: 3500,  name: "Tisseur de toile" },
  { xp: 7000,  name: "Spider-Man" },
  { xp: 12000, name: "Iron Spider" },
  { xp: 20000, name: "Légende du Spider-Verse" },
];

export const QUOTES = [
  "Un grand pouvoir implique de grandes responsabilités.",
  "Ce qui fait un héros, c'est de se relever. À chaque fois.",
  "Le quartier compte sur toi. Ton corps aussi.",
  "Un saut de foi, c'est tout ce qu'il faut.",
  "La régularité bat le talent quand le talent ne s'entraîne pas.",
  "Petit à petit, l'araignée tisse sa toile.",
];

export const GOALS = {
  force:  { name: "Force",           mainReps: [4, 6],   accReps: [8, 10],  mainRest: 180, accRest: 90, rpe: 8 },
  muscle: { name: "Prise de muscle", mainReps: [6, 10],  accReps: [10, 15], mainRest: 120, accRest: 75, rpe: 8 },
  seche:  { name: "Sèche",           mainReps: [8, 12],  accReps: [12, 15], mainRest: 90,  accRest: 45, rpe: 8 },
  forme:  { name: "Forme générale",  mainReps: [8, 12],  accReps: [10, 15], mainRest: 90,  accRest: 60, rpe: 7 },
};
