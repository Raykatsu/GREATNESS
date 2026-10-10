// Bibliothèque d'exercices et programmes de base.
// type: "load" (charge en kg) ou "bw" (poids du corps, on progresse en reps)

export const EXERCISES = {
  bench:        { name: "Développé couché",        muscle: "Pectoraux", type: "load", step: 2.5, alts: ["db_bench", "pushup"] },
  db_bench:     { name: "Développé haltères",      muscle: "Pectoraux", type: "load", step: 2,   alts: ["bench", "pushup"] },
  incline:      { name: "Développé incliné",       muscle: "Pectoraux", type: "load", step: 2.5, alts: ["db_bench", "pushup"] },
  pushup:       { name: "Pompes",                  muscle: "Pectoraux", type: "bw",   step: 1,   alts: ["db_bench"] },
  dips:         { name: "Dips",                    muscle: "Triceps",   type: "bw",   step: 1,   alts: ["pushdown", "pushup"] },
  ohp:          { name: "Développé militaire",     muscle: "Épaules",   type: "load", step: 2.5, alts: ["db_press", "pike"] },
  db_press:     { name: "Développé épaules haltères", muscle: "Épaules", type: "load", step: 2, alts: ["ohp", "pike"] },
  pike:         { name: "Pompes piquées",          muscle: "Épaules",   type: "bw",   step: 1,   alts: ["db_press"] },
  lateral:      { name: "Élévations latérales",    muscle: "Épaules",   type: "load", step: 1,   alts: ["db_press"] },
  pushdown:     { name: "Extension triceps poulie", muscle: "Triceps",  type: "load", step: 2.5, alts: ["dips"] },
  pullup:       { name: "Tractions",               muscle: "Dos",       type: "bw",   step: 1,   alts: ["lat_pull", "row"] },
  lat_pull:     { name: "Tirage vertical",         muscle: "Dos",       type: "load", step: 2.5, alts: ["pullup", "row"] },
  row:          { name: "Rowing barre",            muscle: "Dos",       type: "load", step: 2.5, alts: ["db_row", "lat_pull"] },
  db_row:       { name: "Rowing haltère",          muscle: "Dos",       type: "load", step: 2,   alts: ["row", "lat_pull"] },
  curl:         { name: "Curl biceps",             muscle: "Biceps",    type: "load", step: 1,   alts: ["hammer"] },
  hammer:       { name: "Curl marteau",            muscle: "Biceps",    type: "load", step: 1,   alts: ["curl"] },
  squat:        { name: "Squat",                   muscle: "Jambes",    type: "load", step: 2.5, alts: ["goblet", "lunge"] },
  goblet:       { name: "Goblet squat",            muscle: "Jambes",    type: "load", step: 2,   alts: ["squat", "lunge"] },
  deadlift:     { name: "Soulevé de terre",        muscle: "Chaîne post.", type: "load", step: 5, alts: ["rdl", "hip_thrust"] },
  rdl:          { name: "Soulevé roumain",         muscle: "Ischios",   type: "load", step: 2.5, alts: ["hip_thrust", "deadlift"] },
  lunge:        { name: "Fentes",                  muscle: "Jambes",    type: "bw",   step: 1,   alts: ["goblet"] },
  hip_thrust:   { name: "Hip thrust",              muscle: "Fessiers",  type: "load", step: 2.5, alts: ["rdl"] },
  calf:         { name: "Mollets debout",          muscle: "Mollets",   type: "load", step: 2.5, alts: [] },
  plank:        { name: "Gainage (sec.)",          muscle: "Abdos",     type: "bw",   step: 5,   alts: ["hollow"] },
  hollow:       { name: "Hollow hold (sec.)",      muscle: "Abdos",     type: "bw",   step: 5,   alts: ["plank"] },
  burpee:       { name: "Burpees",                 muscle: "Cardio",    type: "bw",   step: 1,   alts: ["pushup"] },
};

// sets, reps [min,max], weight (kg de départ), rest (s), rpe cible
const ex = (id, sets, reps, weight, rest = 90, rpe = 8) => ({ id, sets, reps, weight, rest, rpe });

export const PROGRAMS = [
  {
    id: "push", name: "PUSH", tag: "Pecs · Épaules · Triceps", hue: "red",
    exercises: [ex("bench", 4, [6, 8], 60, 150), ex("ohp", 3, [8, 10], 35, 120), ex("incline", 3, [8, 12], 45),
                ex("lateral", 3, [12, 15], 8, 60), ex("pushdown", 3, [10, 12], 20, 60), ex("dips", 2, [8, 15], 0, 75)],
  },
  {
    id: "pull", name: "PULL", tag: "Dos · Biceps", hue: "blue",
    exercises: [ex("pullup", 4, [5, 10], 0, 150), ex("row", 4, [8, 10], 50, 120), ex("lat_pull", 3, [10, 12], 45),
                ex("db_row", 3, [10, 12], 22, 75), ex("curl", 3, [10, 12], 12, 60), ex("hammer", 2, [12, 15], 10, 60)],
  },
  {
    id: "legs", name: "LEGS", tag: "Quadris · Ischios · Fessiers", hue: "red",
    exercises: [ex("squat", 4, [5, 8], 70, 180), ex("rdl", 3, [8, 10], 60, 120), ex("lunge", 3, [10, 12], 0, 90),
                ex("hip_thrust", 3, [10, 12], 60, 90), ex("calf", 4, [12, 15], 40, 60), ex("plank", 3, [30, 60], 0, 45)],
  },
  {
    id: "full", name: "FULL BODY", tag: "Corps complet · 45 min", hue: "blue",
    exercises: [ex("squat", 3, [6, 8], 60, 150), ex("bench", 3, [6, 8], 55, 120), ex("row", 3, [8, 10], 45),
                ex("ohp", 2, [8, 10], 30), ex("rdl", 2, [8, 10], 50), ex("hollow", 2, [20, 40], 0, 45)],
  },
  {
    id: "home", name: "HOME / NO GEAR", tag: "Poids du corps · Partout", hue: "purple",
    exercises: [ex("pushup", 4, [10, 20], 0, 60), ex("lunge", 3, [12, 16], 0, 60), ex("pike", 3, [6, 12], 0, 60),
                ex("burpee", 3, [8, 12], 0, 75, 8.5), ex("plank", 3, [40, 75], 0, 45)],
  },
];

// Rangs : petit clin d'œil au parcours d'un certain héros de Queens.
export const RANKS = [
  { xp: 0,     name: "Étudiant de Midtown" },
  { xp: 500,   name: "Piqûre radioactive" },
  { xp: 1500,  name: "Sauveur du quartier" },
  { xp: 3500,  name: "Tisseur de toile" },
  { xp: 7000,  name: "Spider-Man" },
  { xp: 12000, name: "Iron Spider" },
  { xp: 20000, name: "Maître du Spider-Verse" },
];

export const QUOTES = [
  "Un grand pouvoir implique de grandes responsabilités.",
  "Chacun peut porter le masque. Toi aussi.",
  "Ce qui fait de toi un héros, c'est de te relever. À chaque fois.",
  "Fais confiance à ton instinct. Ton sens d'araignée ne ment pas.",
  "Le quartier compte sur toi. Ton corps aussi.",
  "Un saut de foi : c'est tout ce qu'il faut.",
];
