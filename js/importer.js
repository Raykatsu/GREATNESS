// Import de l'historique d'une autre app (Strong, Hevy, Fitbod, MyFitnessPal, sauvegarde GREATNESS) et export de
// tes données (sauvegarde complète, séances en CSV lisible par les autres apps, journal alimentaire en CSV).
// Les exercices anglais sont reconnus (« Bench Press (Barbell) » → Développé couché) ; un exercice inconnu devient un
// exercice perso, pour ne rien perdre. Réimporter le même fichier ne crée pas de doublon. Logique pure, testée.
import { EXERCISES } from "./data.js";
import { e1rm } from "./store.js";

const fold = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const r1 = v => Math.round(v * 10) / 10;
const LB = 0.45359237;

/* ---------- CSV ---------- */
// Texte CSV → { headers, rows: [{ colonne: valeur }] } ; séparateur deviné (, ; ou tabulation), guillemets gérés
export function parseCSV(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] || "";
  const sep = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const out = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(x => x.trim())) out.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim())) out.push(row);
  const headers = (out.shift() || []).map(h => h.trim());
  return { headers, rows: out.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}
const num = v => { const m = String(v ?? "").replace(/[\s ]/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? +m[0] : 0; };
const col = (row, ...names) => { for (const n of names) for (const k of Object.keys(row)) if (fold(k) === fold(n)) return row[k]; return ""; };

// Quel fichier ? strong, hevy, fitbod, mfp (journal alimentaire), weight (pesées), greatness (sauvegarde JSON)
export function detectFormat(headers = []) {
  const h = new Set(headers.map(fold));
  if (h.has("exercise name") && h.has("set order")) return "strong";
  if (h.has("exercise title") && h.has("set index")) return "hevy";
  if (h.has("exercise") && h.has("reps") && [...h].some(x => x.startsWith("weight"))) return "fitbod";
  if (h.has("meal") && h.has("calories")) return "mfp";
  if (h.has("date") && (h.has("weight") || h.has("poids") || [...h].some(x => /^(weight|poids)/.test(x)))) return "weight";
  return null;
}

/* ---------- Dates et durées ---------- */
const MONTHS = { jan: 0, janv: 0, feb: 1, fev: 1, fevr: 1, mar: 2, mars: 2, apr: 3, avr: 3, may: 4, mai: 4, jun: 5, juin: 5, jul: 6, juil: 6, aug: 7, aou: 7, aout: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
// « 2024-03-15 18:30:00 », « 2024-03-15T18:30:00Z », « 2024-03-15 18:30:00 +0000 », « 15 Mar 2024, 18:30 », « 15/03/2024 »
export function parseDate(s) {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const [, y, mo, d, h = 12, mi = 0, se = 0, z] = m;
    if (z) return Date.parse(`${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${mi}:${String(se).padStart(2, "0")}${z.toUpperCase() === "Z" ? "Z" : z.replace(/^([+-]\d{2}):?(\d{2})$/, "$1:$2")}`);
    return new Date(+y, +mo - 1, +d, +h, +mi, +se).getTime();
  }
  m = fold(t).match(/^(\d{1,2}) ([a-z]+) (\d{4})(?: (\d{1,2}) (\d{2}))?/);
  if (m && MONTHS[m[2]] != null) return new Date(+m[3], MONTHS[m[2]], +m[1], +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    let [d, mo] = [+m[1], +m[2]];
    if (mo > 12) [d, mo] = [mo, d]; // format américain MM/JJ
    return new Date(+m[3], mo - 1, d, +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  }
  const p = Date.parse(t);
  return Number.isFinite(p) ? p : null;
}
// « 1h 5m », « 45m », « 1:05:00 », « 3600 » → secondes
export function parseDuration(s) {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t) return 0;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(+t);
  const hms = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] != null ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3] : +hms[1] * 60 + +hms[2];
  let sec = 0;
  for (const [, v, u] of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|min|m|s)/g)) sec += num(v) * (u === "h" ? 3600 : u === "s" ? 1 : 60);
  return Math.round(sec);
}

/* ---------- Exercices ---------- */
// Nom anglais (sans le matériel) → exercice, ou par matériel (bar, db, cable, machine, smith, kb, band, bw, ez ; _ par défaut)
const EN = {
  "bench press": { bar: "bench", db: "db_bench", smith: "smith_bench", machine: "chest_press", _: "bench" },
  "incline bench press": { bar: "incline", db: "incline_db", smith: "smith_incline", machine: "incline_machine", _: "incline" },
  "decline bench press": "decline", "chest press": "chest_press", "incline chest press": "incline_machine", "close grip bench press": "close_grip",
  "chest fly": { db: "db_fly", machine: "pec_deck", _: "fly" }, "fly": { db: "db_fly", machine: "pec_deck", _: "fly" }, "cable crossover": "fly",
  "low cable fly": "low_fly", "pec deck": "pec_deck", "butterfly": "pec_deck", "pullover": "pullover",
  "push up": "pushup", "incline push up": "incline_pushup", "decline push up": "decline_pushup", "diamond push up": "diamond", "pike push up": "pike",
  "overhead press": { db: "db_press", smith: "smith_ohp", machine: "shoulder_machine", kb: "kb_press", _: "ohp" },
  "shoulder press": { bar: "ohp", smith: "smith_ohp", machine: "shoulder_machine", kb: "kb_press", _: "db_press" },
  "military press": "ohp", "strict press": "ohp", "arnold press": "arnold",
  "lateral raise": { cable: "cable_lateral", machine: "lateral_machine", _: "lateral" }, "front raise": "front_raise",
  "reverse fly": { machine: "reverse_pec_deck", _: "rear_delt" }, "rear delt fly": { machine: "reverse_pec_deck", _: "rear_delt" }, "rear delt reverse fly": { machine: "reverse_pec_deck", _: "rear_delt" },
  "face pull": "face_pull", "upright row": "upright_row", "shrug": { bar: "bar_shrug", _: "shrug" },
  "dip": "dips", "triceps dip": { machine: "dip_machine", _: "dips" }, "chest dip": "dips", "bench dip": "bench_dips",
  "triceps pushdown": "pushdown", "triceps rope pushdown": "rope_pushdown", "rope pushdown": "rope_pushdown",
  "triceps extension": { cable: "cable_overhead", _: "overhead_ext" }, "overhead triceps extension": { cable: "cable_overhead", _: "overhead_ext" },
  "skullcrusher": "skull", "skull crusher": "skull", "lying triceps extension": "skull", "triceps kickback": "kickback",
  "deadlift": "deadlift", "conventional deadlift": "deadlift", "romanian deadlift": { db: "db_rdl", _: "rdl" }, "stiff leg deadlift": { db: "db_rdl", _: "rdl" }, "sumo deadlift": "sumo_deadlift",
  "pull up": "pullup", "chin up": "chinup", "assisted pull up": "assisted_pullup", "lat pulldown": "lat_pull", "close grip lat pulldown": "close_pulldown",
  "bent over row": { db: "db_row", _: "row" }, "barbell row": "row", "pendlay row": "row", "row": { db: "db_row", cable: "cable_row", machine: "machine_row", _: "row" },
  "t bar row": "tbar_row", "seated cable row": "cable_row", "seated row": { machine: "machine_row", _: "cable_row" }, "cable row": "cable_row",
  "one arm row": "db_row", "chest supported row": "chest_row", "straight arm pulldown": "straight_pulldown", "inverted row": "inverted_row",
  "back extension": "back_ext", "hyperextension": "back_ext", "superman": "superman",
  "bicep curl": { bar: "barbell_curl", ez: "ez_curl", cable: "cable_curl", band: "band_curl", _: "curl" }, "curl": { bar: "barbell_curl", ez: "ez_curl", cable: "cable_curl", band: "band_curl", _: "curl" },
  "ez bar curl": "ez_curl", "hammer curl": "hammer", "incline curl": "incline_curl", "concentration curl": "concentration", "spider curl": "spider_curl",
  "preacher curl": "preacher", "wrist curl": "wrist_curl", "farmers walk": "farmer", "farmer walk": "farmer", "farmer carry": "farmer",
  "squat": { smith: "smith_squat", db: "goblet", bw: "air_squat", _: "squat" }, "back squat": "squat", "front squat": "front_squat", "hack squat": "hack_squat",
  "leg press": "leg_press", "goblet squat": { kb: "kb_goblet", _: "goblet" }, "lunge": { db: "db_lunge", bar: "db_lunge", _: "lunge" }, "walking lunge": "walking_lunge",
  "bulgarian split squat": "bulgarian", "split squat": "bulgarian", "leg extension": "leg_ext", "air squat": "air_squat", "bodyweight squat": "air_squat",
  "jump squat": "jump_squat", "wall sit": "wall_sit", "good morning": "good_morning", "lying leg curl": "leg_curl", "leg curl": "leg_curl", "seated leg curl": "seated_leg_curl",
  "nordic hamstring curl": "nordic", "nordic curl": "nordic", "hip thrust": { machine: "glute_machine", _: "hip_thrust" }, "glute bridge": "glute_bridge",
  "kettlebell swing": "kb_swing", "glute kickback": "cable_kickback", "hip abduction": "abductor", "hip adduction": "adductor", "step up": "step_up",
  "standing calf raise": "calf", "calf raise": { bw: "calf_bw", _: "calf" }, "seated calf raise": "seated_calf", "calf press": "press_calf",
  "plank": "plank", "side plank": "side_plank", "hollow hold": "hollow", "hanging leg raise": "hanging_raise", "leg raise": "leg_raise", "lying leg raise": "leg_raise",
  "cable crunch": "cable_crunch", "ab wheel": "ab_wheel", "ab wheel rollout": "ab_wheel", "crunch": "crunch", "bicycle crunch": "bicycle", "dead bug": "dead_bug",
  "russian twist": "russian_twist", "pallof press": "pallof", "burpee": "burpee", "box jump": "box_jump", "jumping jack": "jumping_jack", "high knees": "high_knees",
  "mountain climber": "mountain", "jump rope": "jump_rope", "battle rope": "battle_rope", "running": "treadmill", "treadmill": "treadmill", "run": "treadmill",
  "cycling": "bike", "stationary bike": "bike", "bike": "bike", "rowing machine": "rower", "rowing": "rower", "rower": "rower", "elliptical": "elliptical",
  "elliptical trainer": "elliptical", "stair climber": "stairs", "stairmaster": "stairs", "dead hang": "dead_hang", "bird dog": "bird_dog",
};
const EQUIP = [["smith machine", "smith"], ["smith", "smith"], ["barbell", "bar"], ["ez bar", "ez"], ["ez", "ez"], ["dumbbell", "db"], ["db", "db"], ["cable", "cable"],
  ["machine", "machine"], ["kettlebell", "kb"], ["band", "band"], ["bodyweight", "bw"], ["weighted", ""], ["assisted", ""]];
const FR = () => Object.fromEntries(Object.entries(EXERCISES).map(([id, e]) => [fold(e.name), id]));
const sing = s => s.split(" ").map(w => (w.length > 3 && w.endsWith("s") && !/ss$/.test(w) ? w.slice(0, -1) : w)).join(" ");
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return d[b.length];
}
// Nom d'un exercice dans une autre app → identifiant GREATNESS (null si inconnu)
export function matchExercise(raw) {
  const full = fold(raw);
  if (!full) return null;
  const fr = FR();
  if (fr[full]) return fr[full];
  // matériel entre parenthèses ou en tête : « Bench Press (Barbell) », « Dumbbell Bench Press »
  let equip = "", base = fold(String(raw).replace(/\(([^)]*)\)/g, (_, x) => { const e = EQUIP.find(([k]) => fold(x).includes(k)); if (e && !equip) equip = e[1]; return " "; }));
  const pick = e => (typeof e === "string" ? e : e[equip] ?? e._ ?? null);
  const find = b => {
    if (/assist/.test(full) && EN[`assisted ${b}`]) return pick(EN[`assisted ${b}`]);
    for (const x of [b, sing(b), b.replace(/s$/, "")]) if (EN[x]) return pick(EN[x]);
    return fr[b] || fr[sing(b)];
  };
  // le nom entier d'abord (« Cable Crunch », « Kettlebell Swing »), puis sans le matériel en tête
  let hit = find(base);
  if (hit) return hit;
  for (const [k, v] of EQUIP) if (base.startsWith(k + " ")) { if (!equip) equip = v; base = base.slice(k.length + 1); hit = find(base); if (hit) return hit; break; }
  // approché (fautes, variantes) : un seul candidat assez proche
  if (base.length >= 6) {
    let best = null, bd = 3;
    for (const k of [...Object.keys(EN), ...Object.keys(fr)]) { const dd = lev(sing(base), k); if (dd < bd) { bd = dd; best = k; } }
    if (best && bd <= (best.length >= 10 ? 2 : 1)) return EN[best] ? pick(EN[best]) : fr[best];
  }
  return null;
}
const MUSCLE_RULES = [[/chest|bench|fly|pec|push ?up|pectoraux|developpe couche/, "Pectoraux"], [/shoulder|overhead|lateral|delt|military|epaule/, "Épaules"],
  [/curl|bicep/, "Biceps"], [/tricep|pushdown|skull|extension triceps/, "Triceps"], [/row|pull|lat|back|chin|dos/, "Dos"], [/calf|mollet/, "Mollets"],
  [/glute|hip|thrust|fessier/, "Fessiers"], [/deadlift|hamstring|rdl|leg curl|ischio/, "Ischios"], [/squat|leg|lunge|quad|step|fente|cuisse/, "Quadriceps"],
  [/ab|crunch|plank|core|oblique|gainage|abdo/, "Abdos"], [/run|bike|cycl|row(ing)? machine|cardio|walk|swim|course|velo|rameur|elliptic/, "Cardio"], [/stretch|yoga|mobil|etirement/, "Mobilité"]];
// Exercice inconnu → exercice perso (identifiant stable : réimporter ne le duplique pas)
export function customFor(raw, { load, time }) {
  const name = String(raw).replace(/\s+/g, " ").trim().slice(0, 60) || "Exercice importé";
  const f = fold(name), equip = /barbell|ez/.test(f) ? "bar" : /dumbbell/.test(f) ? "db" : /cable/.test(f) ? "cable" : /machine|smith/.test(f) ? "machine" : /kettlebell/.test(f) ? "kb" : /band/.test(f) ? "band" : load ? "machine" : "bw";
  const type = load ? "load" : time ? "time" : "bw";
  return { id: `imp_${f.replace(/ /g, "_").slice(0, 40)}`, ex: { name, muscle: MUSCLE_RULES.find(([re]) => re.test(f))?.[1] || (time ? "Cardio" : "Dos"), type, equip,
    step: type === "time" ? 5 : type === "bw" ? 1 : equip === "machine" ? 5 : equip === "db" ? 2 : 2.5, cues: ["Mouvement contrôlé, amplitude complète."], alts: [] } };
}

/* ---------- Séances ---------- */
// Lignes d'un export Strong / Hevy / Fitbod → séances GREATNESS ; unit : « kg » ou « lb » (charges converties en kg)
export function importWorkouts(rows, format, { unit = "kg" } = {}) {
  const groups = new Map(), names = new Map(), unknown = new Set();
  let skipped = 0;
  for (const r of rows) {
    let date, title, ex, w, reps, sec, rpe, dur = 0, note = "";
    if (format === "strong") {
      date = parseDate(col(r, "Date")); title = col(r, "Workout Name") || "Séance"; ex = col(r, "Exercise Name");
      w = num(col(r, "Weight", "Weight (kg)", "Weight (lbs)")); reps = num(col(r, "Reps")); sec = num(col(r, "Seconds")); rpe = num(col(r, "RPE"));
      dur = parseDuration(col(r, "Duration", "Workout Duration")); note = col(r, "Workout Notes");
      // unité par ligne (anciens exports), sinon colonne « Weight (lbs) », sinon celle choisie
      const wu = col(r, "Weight Unit");
      if (wu ? /lb/i.test(wu) : Object.keys(r).some(k => /lbs?\)/i.test(k)) || unit === "lb") w *= LB;
      // échauffement (W) et minuteur de repos : pas des séries de travail
      if (/^w$|warm|rest/i.test(col(r, "Set Order").trim())) { skipped++; continue; }
    } else if (format === "hevy") {
      date = parseDate(col(r, "start_time")); title = col(r, "title") || "Séance"; ex = col(r, "exercise_title");
      const kg = col(r, "weight_kg"), lbs = col(r, "weight_lbs");
      w = kg !== "" ? num(kg) : num(lbs) * (unit === "kg" ? LB : 1); reps = num(col(r, "reps")); sec = num(col(r, "duration_seconds")); rpe = num(col(r, "rpe"));
      const end = parseDate(col(r, "end_time")); dur = end && date ? Math.max(0, Math.round((end - date) / 1000)) : 0; note = col(r, "description");
      if (/warm/i.test(col(r, "set_type"))) { skipped++; continue; }
    } else if (format === "fitbod") {
      date = parseDate(col(r, "Date")); title = "Séance Fitbod"; ex = col(r, "Exercise");
      const lbs = Object.keys(r).some(k => /lb/i.test(k));
      w = num(col(r, "Weight(kg)", "Weight (kg)", "Weight(lbs)", "Weight (lbs)", "Weight")) * (lbs && unit === "kg" ? LB : 1); reps = num(col(r, "Reps")); sec = num(col(r, "Duration(s)", "Duration (s)", "Duration"));
      if (/true|1|yes/i.test(col(r, "isWarmup"))) { skipped++; continue; }
    } else return { sessions: [], custom: {}, unknown: [], skipped: rows.length };
    if (!date || !ex) { skipped++; continue; }
    if (w < 0 || reps < 0) { skipped++; continue; }
    if (!names.has(ex)) names.set(ex, matchExercise(ex));
    // une séance = même titre, même jour (Fitbod n'a pas de titre : le jour suffit)
    const day = new Date(date); day.setHours(0, 0, 0, 0);
    const key = format === "fitbod" ? `${day.getTime()}` : `${date}|${title}`;
    const g = groups.get(key) || { date, title, dur, note, sets: [] };
    g.date = Math.min(g.date, date); g.dur = Math.max(g.dur, dur);
    g.sets.push({ ex, w: r1(w), reps: Math.round(reps), sec: Math.round(sec), rpe: rpe > 0 ? Math.min(10, rpe) : null });
    groups.set(key, g);
  }
  // exercices inconnus → exercices perso (type d'après les séries : charge, temps ou poids du corps)
  const custom = {}, idOf = {};
  for (const [ex, id] of names) {
    if (id) { idOf[ex] = id; continue; }
    unknown.add(ex);
    const sets = [...groups.values()].flatMap(g => g.sets.filter(s => s.ex === ex));
    const c = customFor(ex, { load: sets.some(s => s.w > 0), time: sets.every(s => !s.reps && s.sec > 0) });
    custom[c.id] = c.ex; idOf[ex] = c.id;
  }
  const sessions = [...groups.values()].sort((a, b) => a.date - b.date).map(g => {
    const sets = g.sets.map(s => {
      const id = idOf[s.ex], meta = EXERCISES[id] || custom[id], time = meta?.type === "time";
      return { exId: id, name: meta?.name || s.ex, weight: meta?.type === "load" ? s.w : 0, reps: time ? s.sec || s.reps : s.reps, rpe: s.rpe ?? 8 };
    }).filter(s => s.reps > 0 || s.weight > 0);
    const volume = Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0));
    const durationSec = g.dur || Math.max(600, sets.length * 150);
    return { id: `imp-${format}-${g.date}-${fold(g.title).slice(0, 24).replace(/ /g, "-")}`, date: g.date, programId: "import", name: String(g.title).slice(0, 60),
      durationSec, volume, sets, prs: [], xp: Math.round(volume / 50 + sets.length * 12), imported: format, ...(g.note ? { note: String(g.note).slice(0, 300) } : {}) };
  }).filter(s => s.sets.length);
  return { sessions, custom, unknown: [...unknown], skipped };
}

// Records et dernières charges recalculés d'après toutes les séances (on garde le meilleur des deux côtés)
export function rebuildLifts(sessions, lifts = {}) {
  const out = { ...lifts };
  for (const s of [...sessions].sort((a, b) => a.date - b.date)) {
    const by = new Map();
    for (const x of s.sets || []) if (x.exId) (by.get(x.exId) || by.set(x.exId, []).get(x.exId)).push(x);
    for (const [id, sets] of by) {
      const top = sets.reduce((b, x) => ((x.weight > 0 ? e1rm(x.weight, x.reps) : x.reps) > (b.weight > 0 ? e1rm(b.weight, b.reps) : b.reps) ? x : b), sets[0]);
      const prev = out[id];
      const best = Math.max(prev?.best || 0, ...sets.map(x => e1rm(x.weight, x.reps)));
      const bestReps = Math.max(prev?.bestReps || 0, ...sets.filter(x => !(x.weight > 0)).map(x => x.reps));
      out[id] = (prev?.date || 0) > s.date ? { ...prev, best, bestReps } : { ...prev, weight: top.weight, reps: top.reps, date: s.date, best, bestReps };
    }
  }
  return out;
}

/* ---------- Nutrition et pesées (MyFitnessPal) ---------- */
const MEAL = s => { const f = fold(s); return /break|petit/.test(f) ? "breakfast" : /lunch|dejeuner/.test(f) ? "lunch" : /dinner|diner|souper/.test(f) ? "dinner" : "snack"; };
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Résumé par repas de MyFitnessPal → entrées du journal (une par jour et par repas, valeurs du repas entier)
export function importFood(rows) {
  const days = {};
  let skipped = 0;
  for (const r of rows) {
    const t = parseDate(col(r, "Date")), k = num(col(r, "Calories"));
    if (!t || !(k > 0)) { skipped++; continue; }
    const meal = MEAL(col(r, "Meal", "Repas")), key = dayKey(t);
    const per = { k: r1(k), p: r1(num(col(r, "Protein (g)", "Protein", "Protéines (g)", "Protéines"))), c: r1(num(col(r, "Carbohydrates (g)", "Carbohydrates", "Glucides (g)", "Glucides"))),
      f: r1(num(col(r, "Fat (g)", "Fat", "Lipides (g)", "Lipides"))), fi: r1(num(col(r, "Fiber", "Fibres"))) };
    (days[key] ||= []).push({ id: `imp-mfp-${key}-${meal}-${(days[key] || []).length}`, name: `${{ breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snack: "Collation" }[meal]} (MyFitnessPal)`,
      per, g: 100, meal, src: "import", at: t });
  }
  return { days, skipped };
}
export function importWeights(rows, { unit = "kg" } = {}) {
  const out = [];
  for (const r of rows) {
    const t = parseDate(col(r, "Date")), lbs = unit === "lb" || Object.keys(r).some(k => /lb/i.test(k) && /weight|poids/i.test(k));
    let w = num(col(r, "Weight", "Poids", "Weight (kg)", "Weight (lbs)", "Poids (kg)"));
    if (lbs) w *= LB;
    if (t && w >= 25 && w <= 300) out.push({ date: t, weight: r1(w) });
  }
  return out;
}

// Ajoute un import aux données : séances (sans doublon), exercices perso, records, journal, pesées.
// Renvoie ce qui a été ajouté.
export function applyImport(st, { sessions = [], custom = {}, days = {}, weights = [] } = {}) {
  const have = new Set((st.sessions || []).map(s => s.id));
  const near = (st.sessions || []).map(s => s.date);
  const fresh = sessions.filter(s => !have.has(s.id) && !near.some(d => Math.abs(d - s.date) < 60e3));
  st.customExercises = { ...custom, ...(st.customExercises || {}) };
  st.sessions = [...(st.sessions || []), ...fresh].sort((a, b) => a.date - b.date);
  st.lifts = rebuildLifts(fresh, st.lifts || {});
  let meals = 0;
  st.food ||= {};
  for (const [key, items] of Object.entries(days)) {
    const day = (st.food[key] ||= { items: [], water: 0, at: 0 });
    for (const it of items) if (!day.items.some(x => x.id === it.id)) { day.items.push(it); meals++; }
    day.at = Date.now();
  }
  st.body ||= [];
  const wd = new Set(st.body.filter(b => b.weight).map(b => dayKey(b.date)));
  let w = 0;
  for (const x of weights) if (!wd.has(dayKey(x.date))) { st.body.push(x); wd.add(dayKey(x.date)); w++; }
  st.body.sort((a, b) => a.date - b.date);
  return { sessions: fresh.length, dup: sessions.length - fresh.length, custom: Object.keys(custom).length, meals, weights: w };
}

/* ---------- Export ---------- */
const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const iso = t => { const d = new Date(t); return `${dayKey(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`; };
// Séances au format Strong (lisible par Hevy, Strong, tableurs…), charges en kg
export function sessionsCSV(sessions = []) {
  const lines = [["Date", "Workout Name", "Duration", "Exercise Name", "Set Order", "Weight", "Reps", "Distance", "Seconds", "Notes", "Workout Notes", "RPE"].join(",")];
  for (const s of sessions) {
    const order = {};
    for (const x of s.sets || []) {
      const time = EXERCISES[x.exId]?.type === "time";
      order[x.exId] = (order[x.exId] || 0) + 1;
      lines.push([iso(s.date), q(s.name), `${Math.round((s.durationSec || 0) / 60)}m`, q(x.name || EXERCISES[x.exId]?.name || x.exId), order[x.exId],
        x.weight || 0, time ? 0 : x.reps, 0, time ? x.reps : 0, "", q(s.note || ""), x.rpe ?? ""].join(","));
    }
  }
  return lines.join("\n");
}
export function foodCSV(food = {}) {
  const lines = [["Date", "Repas", "Aliment", "Quantité (g)", "Calories", "Protéines (g)", "Glucides (g)", "Lipides (g)"].join(",")];
  for (const key of Object.keys(food).sort()) for (const it of food[key].items || []) {
    const m = (it.g || 0) / 100, per = it.per || {};
    lines.push([key, it.meal, q(it.name), r1(it.g || 0), Math.round((per.k || 0) * m), r1((per.p || 0) * m), r1((per.c || 0) * m), r1((per.f || 0) * m)].join(","));
  }
  return lines.join("\n");
}
// Sauvegarde complète (sans la clé API ni l'adresse secrète d'Apple Santé, qui restent sur l'appareil et le compte)
export const backupJSON = st => JSON.stringify({ ...st, profile: { ...st.profile, aiKey: "" }, ...(st.health ? { health: { ...st.health, url: undefined } } : {}),
  exportedAt: Date.now(), app: "GREATNESS" }, null, 1);
