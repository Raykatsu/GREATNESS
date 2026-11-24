// Le coach agit sur toute l'app : l'IA en ligne termine sa réponse par des blocs ```action {…}``` que l'app applique
// tout de suite (on annule d'un geste) ; une simple suggestion (« confirm ») ou une suppression devient un bouton à
// valider. Tout se règle en parlant : calories et macros, plan de repas, journal, eau, pesée, profil, réglages,
// coach, séances, programme de la semaine, objectifs chiffrés, mémoire, écrans. Ici : la consigne donnée à l'IA (avec
// l'état de l'app), la lecture des blocs, leur exécution (sans affichage : les effets d'écran sont rendus à coach.js)
// et l'annulation (les données touchées sont gardées avant).
import { EXERCISES, GOALS } from "./data.js";
import { state, allPrograms, tombstone } from "./store.js";
import { addItem, removeItem, updateItem, setWater, dayKey, shiftKey, dayOf, targets, refFood, matchFood, MEALS, ACTIVITY } from "./nutrition.js";
import { addMemory, removeMemory } from "./memory.js";
import { norm } from "./foods.js";
import { DIETS, localPlan, fromAiPlan, fitDay, planOk, shoppingList, totalsOf } from "./mealplan.js";
import { RATES, weeklyUpdate } from "./adaptive.js";
import { newGoal, currentLevel, activeGoals, kindOf } from "./goals.js";
import { planDayIndex } from "./nutriadapt.js";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MEAL_IDS = { breakfast: 1, lunch: 1, dinner: 1, snack: 1 };
const ACCENTS = ["rouge", "bleu", "violet", "vert", "orange", "rose", "jaune", "cyan"];
const SCREENS = { home: "#/", train: "#/train", create: "#/create", progress: "#/progress", food: "#/food", coach: "#/coach", profile: "#/profile" };
// réglages oui / non (Moi → Réglages)
const SWITCHES = { voice: "Les consignes vocales", sound: "Les sons", mascot: "Le coach animé", banter: "Le coach taquin", plateTips: "L'avis sur tes repas",
  deload: "Les cycles avec semaine allégée", restAlert: "L'alerte de fin de repos" };

// Chaque action : les données qu'elle touche (gardées pour pouvoir annuler) ; « confirm » : toujours à valider d'un geste
const foodKeys = a => [`food/${dayFor(a)}`, "foodRecent", "deleted"];
const SPEC = {
  create_program: { keys: ["customPrograms", "weekPlan"] },
  edit_program: { keys: ["customPrograms", "weekPlan"] },
  delete_program: { keys: ["customPrograms", "weekPlan", "deleted"], confirm: true },
  week_plan: { keys: ["weekPlan"] },
  regen_week: { keys: ["weekPlan"] },
  set_goal: { keys: ["profile", "weekPlan"] },
  set_weight: { keys: ["lifts"] },
  add_goal: { keys: ["goals"] },
  start_session: { keys: [] },
  set_nutrition: { keys: ["profile", "mealPlan"] },
  meal_plan: { keys: ["mealPlan", "profile"] },
  edit_plan: { keys: ["mealPlan"] },
  log_food: { keys: foodKeys },
  remove_food: { keys: foodKeys },
  edit_food: { keys: foodKeys },
  water: { keys: foodKeys },
  log_weight: { keys: ["body", "profile"] },
  set_profile: { keys: ["profile", "weekPlan"] },
  set_setting: { keys: ["profile"] },
  set_coach: { keys: ["profile"] },
  remember: { keys: ["memory", "deleted"] },
  forget: { keys: ["memory", "deleted"] },
  open: { keys: [] },
};
const TYPES = new Set(Object.keys(SPEC));
export const ACTION_TYPES = [...TYPES];

const PROGRAM_ASK = /(seance|programme|routine|entrainement|planning|semaine|cree|creer|fais[ -]moi|propose|exercice|circuit|split|workout|objectif|remplace|ajoute|enleve|retire)/;

/* ---------- La consigne donnée à l'IA en ligne ---------- */
export function actionsGuide(question = "") {
  const names = PROGRAM_ASK.test(norm(question))
    ? `\nNoms exacts des exercices de l'app (create_program, edit_program, add_goal) : ${Object.values(EXERCISES).filter(e => !e.custom).map(e => e.name).join(", ")}.` : "";
  return `### Agir dans l'app
Tu peux modifier TOUTE l'app toi-même. Quand l'athlète demande un changement (ou accepte ta proposition), fais-le : termine ta réponse par un ou plusieurs blocs exactement de cette forme :
\`\`\`action
{"type": "…"}
\`\`\`
L'app les applique tout de suite et l'athlète peut annuler d'un geste. Ne lui demande jamais de faire la modification lui-même ni de t'envoyer une phrase : agis. Dis en une phrase ce que tu as changé. Si ce n'est qu'une idée de ta part, non demandée, ajoute "confirm": true (l'app affiche un bouton à valider). Les suppressions sont toujours à valider. JSON valide, blocs à la toute fin de la réponse.
Actions :
Nutrition
- set_nutrition, objectifs du jour : {"type":"set_nutrition","kcal":2000} ; changer de X kcal : {"type":"set_nutrition","delta":-300} ; macros : {"type":"set_nutrition","protein":160,"carbs":220,"fat":70} ; revenir au calcul de l'app : {"type":"set_nutrition","auto":true}. Autres clés possibles : "adaptive" (calories adaptatives, true/false), "dailyAdapt" (compensation des écarts sur 3 jours), "rate" (kg par semaine, de -1 à 0.5), "goalWeight" (poids visé en kg). Le plan de repas suit tout seul.
- meal_plan, nouveau plan de repas composé par l'app à ses calories : {"type":"meal_plan","days":3,"diet":["vegetarien"],"prefs":"pas de poisson"} (régimes : ${DIETS.map(d => d.id).join(", ")}). Pour des plats précis, écris les repas toi-même : {"type":"meal_plan","plan":[{"meals":[{"meal":"breakfast","name":"Porridge","items":[{"name":"Flocons d'avoine","grams":60,"kcal":222,"protein":8,"carbs":35,"fat":4}]}]}]}. "kcal" : seulement si l'athlète veut d'autres calories que son objectif.
- edit_plan, modifier le plan existant (jours numérotés à partir de 1) : {"type":"edit_plan","op":"replace_meal","day":2,"meal":"dinner","name":"Saumon et riz","items":[{"name":"Saumon","grams":125},{"name":"Riz blanc cuit","grams":150}]} ; {"type":"edit_plan","op":"swap_food","from":"Saumon","to":"Blanc de poulet"} ; {"type":"edit_plan","op":"remove_food","food":"Huile d'olive"} ; {"type":"edit_plan","op":"add_food","day":1,"meal":"snack","items":[{"name":"Pomme","grams":150}]} ; {"type":"edit_plan","op":"fit","kcal":1900} (toutes les quantités recalées). L'app recale toujours les calories de chaque jour sur l'objectif.
- log_food, noter un repas : {"type":"log_food","meal":"breakfast|lunch|dinner|snack","items":[{"name":"Poulet","grams":150,"kcal":248,"protein":46,"carbs":0,"fat":5}]} ; remove_food, retirer du journal : {"type":"remove_food","name":"Coca","meal":"lunch","day":"today|yesterday"} ("all": true pour tous) ; edit_food, changer une quantité : {"type":"edit_food","name":"Riz","grams":150}
- water, eau du jour en verres de 250 ml : {"type":"water","glasses":8} ou {"type":"water","add":2} ; log_weight, pesée du jour : {"type":"log_weight","kg":78.4}
Entraînement
- create_program, créer une séance : {"type":"create_program","name":"Jambes 45 min","exercises":[{"name":"Squat","sets":4,"reps":"6-8","rest":150},{"name":"Fente","sets":3,"reps":"10-12","rest":90}]}
- edit_program, modifier une séance : {"type":"edit_program","program":"Push","add":[{"name":"Dips","sets":3,"reps":"8-10"}],"remove":["Écarté"],"replace":[{"from":"Squat","to":"Presse à cuisses"}],"rename":"Push lourd"} (une séance de l'app devient sa version perso) ; delete_program : {"type":"delete_program","program":"Ma séance"}
- week_plan, programme de la semaine : {"type":"week_plan","days":{"lundi":"Push","mercredi":"Pull","vendredi":"Legs","dimanche":"repos"}} ; regen_week, le refaire : {"type":"regen_week"}
- set_goal : {"type":"set_goal","goal":"force|muscle|seche|forme","days":4} ; set_weight, charge de la prochaine séance : {"type":"set_weight","exercise":"Développé couché","weight":82.5}
- add_goal, objectif chiffré sur plusieurs semaines : {"type":"add_goal","exercise":"Squat","target":140,"weeks":10} ; start_session : {"type":"start_session","program":"today|free|Push"}
Profil et réglages
- set_profile : {"type":"set_profile","bodyweight":78,"height":180,"age":28,"sex":"m|f","activity":"sed|light|mod|high","experience":"debutant|intermediaire|avance","minutes":60,"equipment":"gym|db|home","days":4,"name":"Ray"}
- set_setting : {"type":"set_setting","setting":"…","value":…} ; settings : ${Object.keys(SWITCHES).join(", ")} (true/false), accent (${ACCENTS.join("|")}), mode (dark|oled|light), zoom (1|1.1|1.2), remindAt ("18:30"), remindBefore (0|15|30|60), lang (fr|en)
- set_coach, changer de personnage : {"type":"set_coach","coach":"Mochi"}
Mémoire et écrans
- remember, retenir une info durable (blessure, matériel, goût, contrainte) dès qu'il la donne, sans demander : {"type":"remember","fact":"Genou droit sensible : éviter les sauts"} ; forget : {"type":"forget","fact":"genou"}
- open, ouvrir un écran : {"type":"open","screen":"home|train|create|progress|food|plan|shopping|learn|coach|profile|guide"}

### État de l'app
${appState()}${names}`;
}

// Ce qui est réglé aujourd'hui, pour que l'IA sache quoi modifier
export function appState() {
  const p = state.profile || {}, n = p.nutri || {}, t = targets(p), yes = v => (v ? "oui" : "non");
  const lines = [`- Objectifs nutrition : ${t.kcal} kcal, ${t.p} g de protéines, ${t.c} g de glucides, ${t.f} g de lipides par jour (${t.custom ? "fixés par l'athlète" : t.adaptive ? "calories adaptatives" : "calcul de l'app"})${n.rate != null ? `, rythme ${n.rate} kg/semaine` : ""}${n.goalWeight ? `, poids visé ${n.goalWeight} kg` : ""}, compensation des écarts : ${yes(n.dailyAdapt !== false)}${(p.diet || []).length ? `, régime : ${p.diet.join(", ")}` : ""}.`];
  const plan = state.mealPlan;
  if (planOk(plan)) {
    const today = planDayIndex(plan);
    lines.push(`- Plan de repas (${plan.source === "ai" ? "composé par l'IA" : "composé par l'app"}, ${plan.kcal} kcal visées) :${plan.days.map((d, i) => `\n  J${i + 1}${i === today ? " (aujourd'hui)" : ""} : ${d.meals.map(m => `${m.meal} « ${m.name} » (${m.items.map(x => `${x.name} ${Math.round(x.g)} g`).join(", ")})`).join(" ; ")} = ${Math.round(totalsOf(d.meals.flatMap(m => m.items)).k)} kcal`).join("")}`);
  } else lines.push("- Plan de repas : aucun.");
  const day = dayOf(state, dayKey());
  lines.push(`- Journal d'aujourd'hui : ${day.items?.length ? MEALS.map(m => { const l = day.items.filter(x => x.meal === m.id); return l.length ? `${m.id} : ${l.map(x => `${x.name} ${Math.round(x.g)} g`).join(", ")}` : ""; }).filter(Boolean).join(" ; ") : "vide"} ; eau : ${day.water || 0} verre(s).`);
  lines.push(`- Réglages : ${Object.keys(SWITCHES).map(k => `${k} ${yes(k === "deload" || k === "restAlert" || k === "plateTips" ? p[k] !== false : k === "banter" ? p[k] === true : p[k])}`).join(", ")}, accent ${p.accent || "rouge"}, mode ${p.mode || "dark"}, zoom ${p.zoom || 1}, rappel de séance ${p.remindAt || "18:00"} (${p.remindBefore ?? 15} min avant), coach ${p.coach || "alex"}.`);
  const goals = activeGoals(state);
  if (goals.length) lines.push(`- Objectifs chiffrés en cours : ${goals.map(g => `${EXERCISES[g.exId]?.name || g.exId} → ${g.target}`).join(", ")}.`);
  return lines.join("\n");
}

/* ---------- Lecture des blocs ---------- */
// Sépare le texte affiché et les actions. Un bloc d'action mal formé est masqué, un bloc de code normal reste.
export function parseActions(raw = "") {
  const actions = [];
  let text = String(raw).replace(/```(action|json)?[ \t]*\n?([\s\S]*?)```/g, (m, lang, body) => {
    const t = body.trim();
    if (!/^[[{]/.test(t)) return m;
    try {
      const v = JSON.parse(t), list = (Array.isArray(v) ? v : [v]).filter(a => a && TYPES.has(a.type));
      if (!list.length) return lang === "action" ? "" : m;
      actions.push(...list);
      return "";
    } catch { return lang === "action" ? "" : m; }
  });
  const open = text.search(/```action/); // réponse coupée au milieu d'un bloc
  if (open >= 0) text = text.slice(0, open);
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), actions };
}
// Pendant le flux : on n'affiche pas le début d'un bloc d'action
export const streamText = raw => { const i = String(raw).search(/```(action|json)/); return i >= 0 ? raw.slice(0, i) : raw; };

// À valider d'un geste (suppression, ou simple suggestion de l'IA) plutôt qu'appliquée tout de suite
export const needsConfirm = a => !!(SPEC[a?.type]?.confirm || a?.confirm === true);

/* ---------- Annuler ---------- */
// Les données touchées par des actions, gardées telles quelles avant ; « food/2026-11-24 » : un seul jour du journal
export const actionKeys = a => { const k = SPEC[a?.type]?.keys || []; return typeof k === "function" ? k(a) : k; };
const getK = path => { const [a, b] = path.split("/"); return b ? state[a]?.[b] : state[a]; };
const setK = (path, v) => {
  const [a, b] = path.split("/");
  if (!b) { if (v === undefined) delete state[a]; else state[a] = v; return; }
  state[a] ||= {};
  if (v === undefined) delete state[a][b]; else state[a][b] = v;
};
export function snapshot(actions) {
  const keys = [...new Set(actions.flatMap(actionKeys))];
  return keys.map(k => [k, structuredClone(getK(k))]);
}
export function restore(snap) { for (const [k, v] of snap || []) setK(k, structuredClone(v)); }

/* ---------- Exercices, séances, aliments désignés par leur nom ---------- */
const STOP = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "en", "avec", "l", "d", "sur", "et"]);
const words = s => norm(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(w => w && !STOP.has(w)).map(w => (w.length > 3 ? w.replace(/s$/, "") : w));

export function resolveExercise(name) {
  if (!name) return null;
  if (EXERCISES[name]) return name;
  const q = words(name), nq = norm(name);
  let best = null, score = 0;
  for (const [id, e] of Object.entries(EXERCISES)) {
    if (norm(e.name) === nq) return id;
    const w = words(e.name), hit = q.filter(x => w.includes(x)).length;
    const s = hit / Math.max(q.length, w.length) + (norm(e.name).includes(nq) || nq.includes(norm(e.name)) ? 0.3 : 0);
    if (s > score) { score = s; best = id; }
  }
  return score >= 0.6 ? best : null;
}

export function resolveProgram(name) {
  const n = norm(name);
  if (!n || /^(repos|off|rien|libre|aucun)/.test(n)) return null;
  const progs = allPrograms();
  return progs.find(p => p.id === name) || progs.find(p => norm(p.name) === n) || progs.find(p => norm(p.name).includes(n) || n.includes(norm(p.name))) || null;
}

// Même aliment ? (« coca » ↔ « Coca-Cola », « riz » ↔ « Riz blanc cuit »)
const sameFood = (a, b) => { const x = norm(a).replace(/[^a-z0-9 ]/g, " ").trim(), y = norm(b).replace(/[^a-z0-9 ]/g, " ").trim(); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
// Un aliment proposé par l'IA, complété par la base quand elle ne donne pas les valeurs
function aiItem(x = {}) {
  const g = Math.max(0, Number(x.grams) || 0);
  if (+x.kcal > 0) return { name: String(x.name || "Aliment"), grams: g, kcal: +x.kcal, protein: +x.protein || 0, carbs: +x.carbs || 0, fat: +x.fat || 0 };
  const ref = refFood(x.name) || matchFood(x.name), m = g / 100;
  return ref ? { name: ref.name, grams: g, kcal: ref.per.k * m, protein: (ref.per.p || 0) * m, carbs: (ref.per.c || 0) * m, fat: (ref.per.f || 0) * m } : { name: String(x.name || "Aliment"), grams: g, kcal: 0 };
}
// Le jour du journal visé : aujourd'hui (défaut), hier, ou une date AAAA-MM-JJ
function dayFor(a = {}) {
  const d = norm(a.day || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return /hier|yesterday/.test(d) ? shiftKey(dayKey(), -1) : dayKey();
}

const parseReps = (r, ex) => {
  if (Array.isArray(r) && r.length >= 2) return [Math.max(1, +r[0] || 1), Math.max(+r[0] || 1, +r[1] || 1)];
  const m = String(r ?? "").match(/(\d+)\s*(?:-|à|a|–)\s*(\d+)/), one = String(r ?? "").match(/\d+/);
  const def = ex.type === "time" ? [30, 45] : [8, 12];
  if (m) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
  if (one) return [+one[0], +one[0]];
  return def;
};
const clampN = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
// un nombre, même écrit avec son unité ou à la française (« 2000 kcal », « −300 », « 78,4 kg »)
const num = v => {
  if (typeof v === "number") return v;
  const m = String(v ?? "").replace(/\u2212/g, "-").replace(/(\d)[\s\u202f\u00a0](?=\d{3}\b)/g, "$1").replace(",", ".").match(/[-+]?\d+(\.\d+)?/);
  return m ? +m[0] : NaN;
};
const has = v => Number.isFinite(num(v));
const bool = v => (typeof v === "boolean" ? v : /^(true|on|oui|yes|1|active|activé)$/i.test(String(v ?? "").trim()));
// Un exercice d'une séance, réglé à l'objectif de l'athlète
function exItem(x) {
  const id = resolveExercise(x.id || x.name);
  if (!id) return null;
  const ex = EXERCISES[id], g = GOALS[state.profile.goal] || GOALS.muscle;
  return { id, sets: clampN(x.sets, 1, 8, 3), reps: parseReps(x.reps, ex), weight: ex.type === "load" ? clampN(x.weight, 0, 500, state.lifts[id]?.weight || 0) : 0,
    rest: clampN(x.rest, 10, 300, g.accRest), rpe: clampN(x.rpe, 5, 10, g.rpe) };
}

/* ---------- Libellés (boutons à valider, et ce qui a été fait) ---------- */
export function describe(a) {
  switch (a.type) {
    case "create_program": return `Créer la séance « ${String(a.name || "Ma séance").slice(0, 40)} »`;
    case "edit_program": return `Modifier la séance « ${String(a.program || "").slice(0, 40)} »`;
    case "delete_program": return `Supprimer la séance « ${String(a.program || "").slice(0, 40)} »`;
    case "week_plan": return "Appliquer ce programme de la semaine";
    case "regen_week": return "Refaire le programme de la semaine";
    case "set_goal": return `Objectif : ${GOALS[a.goal]?.name || a.goal}${a.days ? `, ${a.days} séances/semaine` : ""}`;
    case "set_weight": return `${EXERCISES[resolveExercise(a.exercise)]?.name || a.exercise} : ${a.weight} kg à la prochaine séance`;
    case "add_goal": return `Objectif chiffré : ${EXERCISES[resolveExercise(a.exercise)]?.name || a.exercise} à ${a.target}`;
    case "start_session": return "Lancer la séance";
    case "set_nutrition": return a.auto ? "Objectifs nutrition : calcul de l'app" : has(a.kcal) ? `Objectif : ${Math.round(num(a.kcal))} kcal par jour` : has(a.delta) ? `Calories : ${num(a.delta) > 0 ? "+" : ""}${Math.round(num(a.delta))} kcal par jour` : "Mettre à jour tes objectifs nutrition";
    case "meal_plan": return "Nouveau plan de repas";
    case "edit_plan": return "Modifier le plan de repas";
    case "log_food": return `Noter ce repas (${Math.round((a.items || []).reduce((s, x) => s + (+x.kcal || 0), 0))} kcal)`;
    case "remove_food": return `Retirer du journal : ${String(a.name || a.meal || "").slice(0, 40)}`;
    case "edit_food": return `${String(a.name || "").slice(0, 40)} : ${a.grams} g`;
    case "water": return has(a.glasses) ? `Eau : ${num(a.glasses)} verres` : `Eau : +${has(a.add) ? num(a.add) : 1} verre(s)`;
    case "log_weight": return `Pesée : ${a.kg ?? a.weight} kg`;
    case "set_profile": return "Mettre à jour ton profil";
    case "set_setting": return `Réglage : ${SWITCHES[a.setting] || a.setting}`;
    case "set_coach": return `Coach : ${String(a.coach || "").slice(0, 30)}`;
    case "remember": return `Retenir : ${String(a.fact || "").slice(0, 80)}`;
    case "forget": return `Oublier : ${String(a.fact || "").slice(0, 80)}`;
    case "open": return "Ouvrir l'écran";
    default: return a.type;
  }
}

/* ---------- Exécution ---------- */
// Renvoie { ok, text, programId?, replan?, effects? } ; ne sauvegarde pas (l'appelant le fait). effects : ce que
// l'écran doit faire ensuite (appearance, mascot, coach, lang, route, start, open, guide).
export function applyAction(a, created = {}) {
  try { return run(a, created); } catch (e) { return { ok: false, text: `Pas fait : ${e.message || e}` }; }
}
function run(a, created) {
  const p = state.profile;
  switch (a.type) {
    case "remember": {
      const m = addMemory(state, a.fact, "ai");
      return m ? { ok: true, text: `Noté : ${m.text}` } : { ok: false, text: "Rien à retenir." };
    }
    case "forget": {
      const hits = (state.memory || []).filter(m => sameFood(m.text, a.fact || ""));
      hits.forEach(m => removeMemory(state, m.id));
      return hits.length ? { ok: true, text: `Oublié : ${hits.map(m => m.text).join(" ; ")}` } : { ok: false, text: "Rien de tel dans ce que je sais de toi." };
    }

    /* — Entraînement — */
    case "create_program": {
      const exercises = [], missing = [];
      for (const x of (Array.isArray(a.exercises) ? a.exercises : []).slice(0, 15)) { const e = exItem(x); if (e) exercises.push(e); else missing.push(x.name || x.id); }
      if (!exercises.length) return { ok: false, text: "Aucun exercice reconnu pour cette séance." };
      const prog = { id: "c" + Date.now() + Math.floor(Math.random() * 1000), name: String(a.name || "Séance du coach").slice(0, 40), tag: "Créée par le coach", accent: "red", exercises };
      state.customPrograms.push(prog);
      created[norm(prog.name)] = prog.id;
      return { ok: true, programId: prog.id, text: `Séance « ${prog.name} » créée (${exercises.length} exercices)${missing.length ? ` ; pas trouvé : ${missing.join(", ")}` : ""}.` };
    }
    case "edit_program": {
      let prog = (created[norm(a.program || "")] && state.customPrograms.find(x => x.id === created[norm(a.program)])) || resolveProgram(a.program);
      if (!prog) return { ok: false, text: `Séance « ${a.program || "?"} » introuvable.` };
      const own = state.customPrograms.find(x => x.id === prog.id), done = [], missing = [];
      // une séance de l'app devient ta version perso (l'originale reste dans la bibliothèque) ; ton programme la suit
      if (!own) {
        const copy = { ...structuredClone(prog), id: "c" + Date.now() + Math.floor(Math.random() * 1000), name: `${prog.name} (ma version)`.slice(0, 40), tag: "Modifiée par le coach" };
        state.customPrograms.push(copy);
        for (const [d, id] of Object.entries(state.weekPlan || {})) if (id === prog.id) state.weekPlan[d] = copy.id;
        prog = copy;
      } else prog = own;
      for (const r of (Array.isArray(a.replace) ? a.replace : []).slice(0, 10)) {
        const from = resolveExercise(r.from), to = resolveExercise(r.to), i = prog.exercises.findIndex(e => e.id === from);
        if (i < 0 || !to) { missing.push(r.from); continue; }
        const ex = EXERCISES[to];
        prog.exercises[i] = { ...prog.exercises[i], id: to, weight: ex.type === "load" ? state.lifts[to]?.weight || 0 : 0, ...(ex.type === "time" ? { reps: [30, 45] } : {}) };
        done.push(`${EXERCISES[from].name} → ${ex.name}`);
      }
      for (const name of (Array.isArray(a.remove) ? a.remove : a.remove ? [a.remove] : []).slice(0, 10)) {
        const id = resolveExercise(name), before = prog.exercises.length;
        prog.exercises = prog.exercises.filter(e => e.id !== id);
        if (prog.exercises.length < before) done.push(`− ${EXERCISES[id].name}`); else missing.push(name);
      }
      for (const x of (Array.isArray(a.add) ? a.add : []).slice(0, 10)) { const e = exItem(x); if (e) { prog.exercises.push(e); done.push(`+ ${EXERCISES[e.id].name}`); } else missing.push(x.name); }
      if (a.rename) { prog.name = String(a.rename).slice(0, 40); done.push(`nom : ${prog.name}`); }
      if (!done.length) return { ok: false, text: `Rien changé dans « ${prog.name} »${missing.length ? ` (pas trouvé : ${missing.join(", ")})` : ""}.` };
      return { ok: true, programId: prog.id, text: `Séance « ${prog.name} » : ${done.join(", ")}${missing.length ? ` ; pas trouvé : ${missing.join(", ")}` : ""}.` };
    }
    case "delete_program": {
      const prog = state.customPrograms.find(x => x.id === resolveProgram(a.program)?.id);
      if (!prog) return { ok: false, text: "Seules tes séances perso peuvent être supprimées." };
      state.customPrograms = state.customPrograms.filter(x => x.id !== prog.id);
      tombstone("programs", prog.id);
      Object.keys(state.weekPlan || {}).forEach(k => { if (state.weekPlan[k] === prog.id) delete state.weekPlan[k]; });
      return { ok: true, text: `Séance « ${prog.name} » supprimée.` };
    }
    case "week_plan": {
      const plan = {}, unknown = [];
      for (const [day, name] of Object.entries(a.days || {})) {
        const i = DAYS.indexOf(norm(day));
        if (i < 0) continue;
        const id = created[norm(name)] || resolveProgram(name)?.id;
        if (id) plan[i] = id;
        else if (!/^(repos|off|rien|aucun)/.test(norm(name))) unknown.push(name);
      }
      if (!Object.keys(plan).length) return { ok: false, text: "Programme de la semaine non reconnu." };
      state.weekPlan = plan;
      return { ok: true, text: `Programme de la semaine mis à jour (${Object.keys(plan).length} séances)${unknown.length ? ` ; inconnu : ${unknown.join(", ")}` : ""}.` };
    }
    case "regen_week": return { ok: true, replan: true, text: "Programme de la semaine refait." };
    case "set_goal": {
      if (!GOALS[a.goal]) return { ok: false, text: "Objectif inconnu." };
      p.goal = a.goal;
      if (a.days) p.days = clampN(a.days, 2, 6, p.days);
      return { ok: true, text: `Objectif : ${GOALS[a.goal].name}${a.days ? `, ${p.days} séances par semaine` : ""}.`, replan: !!a.days };
    }
    case "set_weight": {
      const id = resolveExercise(a.exercise), w = clampN(a.weight, 0, 500, NaN);
      if (!id || !Number.isFinite(w) || EXERCISES[id].type !== "load") return { ok: false, text: "Exercice ou charge non reconnus." };
      state.lifts[id] = { ...(state.lifts[id] || { weight: w, reps: 0, best: 0, bestReps: 0, date: Date.now() }), next: w };
      return { ok: true, text: `${EXERCISES[id].name} : ${w} kg à la prochaine séance.` };
    }
    case "add_goal": {
      const id = resolveExercise(a.exercise), target = num(a.target);
      if (!id || !(target > 0)) return { ok: false, text: "Exercice ou objectif non reconnus." };
      const base = has(a.base) ? num(a.base) : currentLevel(id);
      if (!(base > 0) || target <= base) return { ok: false, text: `Il me faut ton niveau actuel au ${EXERCISES[id].name}, plus bas que l'objectif.` };
      for (const g of activeGoals(state)) if (g.exId === id) { g.status = "abandoned"; g.at = Date.now(); }
      const g = newGoal({ exId: id, base, target, weeks: clampN(a.weeks, 4, 16, 10), perWeek: clampN(a.perWeek, 1, 3, 2) });
      (state.goals ||= []).push(g);
      const unit = { load: "kg", reps: "reps", time: "s" }[kindOf(id)];
      return { ok: true, text: `Objectif chiffré : ${EXERCISES[id].name}, de ${base} à ${target} ${unit} en ${g.weeks} semaines.`, effects: { route: "#/progress" } };
    }
    case "start_session": {
      const n = norm(a.program || "today"), id = /^(today|aujourd|du jour|mission)/.test(n) ? "today" : /^(free|libre)/.test(n) ? "free" : created[n] || resolveProgram(a.program)?.id;
      return id ? { ok: true, text: "Séance lancée.", effects: { start: id } } : { ok: false, text: `Séance « ${a.program} » introuvable.` };
    }

    /* — Nutrition — */
    case "set_nutrition": {
      const n = { ...(p.nutri || {}) }, before = targets(p), bw = +p.bodyweight || 75;
      let floored = false;
      if (a.auto) { n.custom = false; for (const k of ["kcal", "p", "c", "f"]) delete n[k]; }
      if (["kcal", "delta", "protein", "carbs", "fat"].some(k => has(a[k]))) {
        // jamais sous le métabolisme de base (ni 1 200 / 1 400 kcal) : en dessous, on perd du muscle et de l'énergie
        const floor = Math.round(Math.max(before.bmr, p.sex === "f" ? 1200 : 1400) / 10) * 10;
        const prot = has(a.protein) ? clampN(num(a.protein), 40, 400, before.p) : n.custom ? +n.p || before.p : before.p;
        let fat = has(a.fat) ? clampN(num(a.fat), 20, 300, before.f) : null, carbs = has(a.carbs) ? clampN(num(a.carbs), 20, 900, before.c) : null;
        let kcal = has(a.kcal) ? num(a.kcal) : has(a.delta) ? before.kcal + num(a.delta) : fat != null && carbs != null ? prot * 4 + carbs * 4 + fat * 9 : before.kcal;
        if (kcal < floor) { kcal = floor; floored = true; }
        kcal = Math.round(Math.min(6000, kcal) / 10) * 10;
        fat ??= Math.round(Math.max(bw * 0.7, (kcal * 0.27) / 9));
        carbs ??= Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4));
        Object.assign(n, { custom: true, kcal, p: prot, c: carbs, f: fat });
      }
      if (a.adaptive != null) { n.adaptive = bool(a.adaptive); if (n.adaptive) n.custom = false; }
      if (a.dailyAdapt != null) n.dailyAdapt = bool(a.dailyAdapt);
      if (has(a.rate)) n.rate = RATES.reduce((x, y) => (Math.abs(y - num(a.rate)) < Math.abs(x - num(a.rate)) ? y : x));
      if (has(a.goalWeight)) n.goalWeight = clampN(num(a.goalWeight), 35, 250, n.goalWeight);
      p.nutri = n;
      if (n.adaptive && !n.custom) weeklyUpdate(state, new Date(), { force: true });
      const t = targets(p), plan = planOk(state.mealPlan);
      if (plan) state.mealPlan = refitPlan(state.mealPlan, t); // le plan de repas suit les nouveaux objectifs
      return { ok: true, text: `Objectifs : ${t.kcal} kcal, ${t.p} g de protéines, ${t.c} g de glucides, ${t.f} g de lipides par jour${t.custom ? "" : " (calcul de l'app)"}.${floored ? ` Je ne descends pas plus bas que ${t.kcal} kcal : en dessous, tu perdrais du muscle et de l'énergie.` : ""}${plan ? " Ton plan de repas suit." : ""}` };
    }
    case "meal_plan": {
      const t0 = targets(p), t = { kcal: has(a.kcal) ? Math.round(clampN(num(a.kcal), 1200, 6000, t0.kcal)) : t0.kcal, p: has(a.protein) ? clampN(num(a.protein), 40, 400, t0.p) : t0.p };
      const diet = (Array.isArray(a.diet) ? a.diet : a.diet ? [a.diet] : p.diet || []).map(d => DIETS.find(x => x.id === norm(d).replace(/ /g, "_") || norm(x.name) === norm(d))?.id).filter(Boolean);
      const content = Array.isArray(a.plan) ? a.plan : Array.isArray(a.days) ? a.days : null;
      let days = null, tips = "";
      if (content) {
        const r = fromAiPlan({ days: content.slice(0, 7).map(d => ({ meals: (d?.meals || []).map(m => ({ ...m, items: (m.items || []).map(aiItem) })) })), tips: a.tips }, t);
        if (r.days.length) ({ days, tips } = r);
      }
      const source = days ? "ai" : "local";
      days ||= localPlan(t, { days: clampN(a.days, 1, 7, state.mealPlan?.days?.length || 3), diet, start: Math.floor(Math.random() * 7) });
      p.diet = diet;
      state.mealPlan = { id: Date.now().toString(36), at: Date.now(), source, diet, prefs: String(a.prefs || "").slice(0, 400), kcal: t.kcal, p: t.p,
        fixed: Math.abs(t.kcal - t0.kcal) > t0.kcal * 0.05, days, shopping: shoppingList(days), tips };
      return { ok: true, text: `Plan de repas : ${days.length} jour(s) à ${t.kcal} kcal et ${t.p} g de protéines par jour, liste de courses comprise.`, effects: { plan: true } };
    }
    case "edit_plan": return editPlan(a);
    case "log_food": {
      const meal = MEAL_IDS[a.meal] ? a.meal : "snack", key = dayFor(a);
      const items = (Array.isArray(a.items) ? a.items : []).slice(0, 20).filter(x => x && (+x.kcal > 0 || +x.grams > 0));
      for (const x of items) {
        const it = +x.kcal > 0 ? x : aiItem(x), g = clampN(it.grams, 1, 5000, 100), m = 100 / g;
        addItem(state, key, { name: String(it.name || "Aliment").slice(0, 60), per: { k: (+it.kcal || 0) * m, p: (+it.protein || 0) * m, c: (+it.carbs || 0) * m, f: (+it.fat || 0) * m }, src: "ai" }, { g, meal });
      }
      return items.length ? { ok: true, text: `${items.length} aliment(s) noté(s) dans ton journal.` } : { ok: false, text: "Rien à noter." };
    }
    case "remove_food": {
      if (!a.name && !a.meal) return { ok: false, text: "Dis-moi quoi retirer du journal." };
      const key = dayFor(a), items = dayOf(state, key).items || [];
      const hits = items.filter(x => (!MEAL_IDS[a.meal] || x.meal === a.meal) && (!a.name || sameFood(x.name, a.name)));
      if (!hits.length) return { ok: false, text: `Rien trouvé dans le journal${a.name ? ` pour « ${a.name} »` : ""}.` };
      const list = a.all || !a.name ? hits : [hits[hits.length - 1]]; // un nom : le dernier noté (ou tous avec « all »)
      list.forEach(x => removeItem(state, key, x.id));
      return { ok: true, text: `Retiré du journal : ${list.map(x => x.name).join(", ")}.` };
    }
    case "edit_food": {
      const key = dayFor(a), it = (dayOf(state, key).items || []).filter(x => sameFood(x.name, a.name || "")).at(-1);
      if (!it) return { ok: false, text: `« ${a.name || "?"} » n'est pas dans le journal.` };
      if (!has(a.grams) && !MEAL_IDS[a.meal]) return { ok: false, text: "Quelle quantité ?" };
      updateItem(state, key, it.id, { ...(has(a.grams) ? { g: clampN(num(a.grams), 1, 5000, it.g) } : {}), ...(MEAL_IDS[a.meal] ? { meal: a.meal } : {}) });
      return { ok: true, text: `${it.name} : ${Math.round(it.g)} g.` };
    }
    case "water": {
      const key = dayFor(a), cur = dayOf(state, key).water || 0;
      const n = has(a.glasses) ? num(a.glasses) : has(a.liters) ? num(a.liters) * 4 : cur + (has(a.add) ? num(a.add) : 1);
      setWater(state, key, n);
      const w = dayOf(state, key).water;
      return { ok: true, text: `Eau : ${w} verre(s), soit ${String(w / 4).replace(".", ",")} L.` };
    }
    case "log_weight": {
      const w = Math.round(num(a.kg ?? a.weight) * 10) / 10;
      if (!(w >= 30 && w <= 250)) return { ok: false, text: "Poids non reconnu." };
      state.body ||= [];
      const today = dayKey(), same = state.body.find(b => b.weight && dayKey(new Date(b.date)) === today);
      if (same) same.weight = w; else state.body.push({ date: Date.now(), weight: w });
      p.bodyweight = w;
      if (p.nutri?.adaptive && !p.nutri.adapt) weeklyUpdate(state, new Date(), { force: true });
      return { ok: true, text: `Pesée du jour : ${w} kg.` };
    }

    /* — Profil, réglages, coach, écrans — */
    case "set_profile": {
      const done = [];
      const setP = (k, v, label) => { if (v === undefined || v === null || Number.isNaN(v) || p[k] === v) return; p[k] = v; done.push(label); };
      if (a.name) setP("name", String(a.name).slice(0, 30), "prénom");
      if (has(a.bodyweight)) setP("bodyweight", clampN(num(a.bodyweight), 30, 250), "poids");
      if (has(a.height)) setP("height", Math.round(clampN(num(a.height), 120, 230)), "taille");
      if (has(a.age)) setP("age", Math.round(clampN(num(a.age), 12, 99)), "âge");
      if (a.sex) setP("sex", /^(m|h|homme|male|man)/i.test(a.sex) ? "m" : /^(f|femme|female|woman)/i.test(a.sex) ? "f" : "a", "sexe");
      if (ACTIVITY[a.activity]) setP("activity", a.activity, "activité");
      if (["debutant", "intermediaire", "avance"].includes(norm(a.experience || ""))) setP("experience", norm(a.experience), "niveau");
      if (has(a.minutes)) setP("minutes", Math.round(clampN(num(a.minutes), 15, 150)), "durée des séances");
      if (["gym", "db", "home"].includes(a.equipment)) setP("equipment", a.equipment, "matériel");
      if (has(a.days)) setP("days", Math.round(clampN(num(a.days), 2, 6)), "séances par semaine");
      if (Array.isArray(a.focus)) { p.focus = a.focus.map(String).slice(0, 5); done.push("zones à cibler"); }
      if (!done.length) return { ok: false, text: "Rien à changer dans ton profil." };
      return { ok: true, text: `Profil mis à jour : ${done.join(", ")}.`, replan: done.includes("séances par semaine") || done.includes("matériel") };
    }
    case "set_setting": {
      const k = a.setting, v = a.value;
      if (SWITCHES[k]) {
        const on = bool(v);
        p[k] = on;
        return { ok: true, text: `${SWITCHES[k]} : ${on ? "activé" : "désactivé"}.`, effects: k === "mascot" ? { mascot: on } : {} };
      }
      if (k === "accent") { const c = ACCENTS.find(x => x === norm(v || "")); if (!c) return { ok: false, text: "Couleur inconnue." }; p.accent = c; return { ok: true, text: `Couleur de l'app : ${c}.`, effects: { appearance: true } }; }
      if (k === "mode") {
        const m = { dark: "dark", sombre: "dark", nuit: "dark", oled: "oled", noir: "oled", light: "light", clair: "light", jour: "light" }[norm(v || "")];
        if (!m) return { ok: false, text: "Affichage inconnu." };
        p.mode = m;
        return { ok: true, text: `Affichage ${{ dark: "sombre", oled: "noir intégral", light: "clair" }[m]}.`, effects: { appearance: true } };
      }
      if (k === "zoom") { const z = [1, 1.1, 1.2].reduce((x, y) => (Math.abs(y - num(v)) < Math.abs(x - num(v)) ? y : x)); if (!has(v)) return { ok: false, text: "Taille inconnue." }; p.zoom = z; return { ok: true, text: `Taille du texte : ${Math.round(z * 100)} %.`, effects: { appearance: true } }; }
      if (k === "remindAt") { const m = String(v || "").match(/^(\d{1,2})[:h](\d{2})?$/); if (!m || +m[1] > 23) return { ok: false, text: "Heure non reconnue." }; p.remindAt = `${m[1].padStart(2, "0")}:${m[2] || "00"}`; return { ok: true, text: `Rappel de séance à ${p.remindAt}.` }; }
      if (k === "remindBefore") { p.remindBefore = [0, 15, 30, 60].reduce((x, y) => (Math.abs(y - num(v)) < Math.abs(x - num(v)) ? y : x)); return { ok: true, text: `Alerte ${p.remindBefore ? `${p.remindBefore} min avant` : "à l'heure"} de la séance.` }; }
      if (k === "lang") { const l = /^en/i.test(v || "") ? "en" : /^fr/i.test(v || "") ? "fr" : null; return l ? { ok: true, text: l === "en" ? "L'app passe en anglais." : "L'app passe en français.", effects: { lang: l } } : { ok: false, text: "Langue inconnue." }; }
      return { ok: false, text: `Réglage inconnu : ${k}.` };
    }
    case "set_coach": return a.coach ? { ok: true, text: `Nouveau coach : ${String(a.coach).slice(0, 30)}.`, effects: { coach: String(a.coach) } } : { ok: false, text: "Quel coach ?" };
    case "open": {
      const s = norm(a.screen || "");
      if (SCREENS[s]) return { ok: true, text: "J'ouvre l'écran.", effects: { route: SCREENS[s] } };
      if (["plan", "shopping", "learn", "guide"].includes(s)) return { ok: true, text: "J'ouvre l'écran.", effects: { open: s } };
      return { ok: false, text: "Écran inconnu." };
    }
  }
  return { ok: false, text: "Action inconnue." };
}

/* ---------- Le plan de repas ---------- */
// Le plan recalé sur les objectifs (ses calories à lui s'il a été demandé ainsi) ; les cases cochées des courses restent
function refitPlan(plan, t) {
  const days = plan.days.map(d => fitDay(d, t)), done = new Set((plan.shopping || []).filter(x => x.done).map(x => x.name));
  return { ...plan, days, kcal: t.kcal, p: t.p, fixed: false, shopping: shoppingList(days).map(x => (done.has(x.name) ? { ...x, done: true } : x)) };
}
const ORDER = ["breakfast", "lunch", "dinner", "snack"];
function editPlan(a) {
  const plan = state.mealPlan;
  if (!planOk(plan)) return { ok: false, text: "Pas encore de plan de repas : demande-moi d'en composer un." };
  const t0 = targets(state.profile), t = plan.fixed ? { kcal: plan.kcal, p: plan.p } : { kcal: t0.kcal, p: t0.p };
  const n = plan.days.length, today = Math.max(0, planDayIndex(plan));
  const di = has(a.day) ? clampN(Math.round(num(a.day)), 1, n, 1) - 1 : null;
  const days = structuredClone(plan.days), refit = new Set();
  const op = a.op || (a.items ? "replace_meal" : a.from ? "swap_food" : a.food ? "remove_food" : "fit");
  let what = "";
  if (op === "fit") {
    if (has(a.kcal)) t.kcal = Math.round(clampN(num(a.kcal), 1200, 6000, t.kcal));
    if (has(a.protein)) t.p = clampN(num(a.protein), 40, 400, t.p);
    days.forEach((_, i) => refit.add(i));
    what = `quantités recalées sur ${t.kcal} kcal par jour`;
  } else if (op === "replace_meal" || op === "add_meal" || op === "add_food") {
    const meal = MEAL_IDS[a.meal] ? a.meal : "snack", items = (a.items || []).slice(0, 8).map(aiItem).filter(x => x.grams > 0 && x.kcal > 0);
    if (!items.length) return { ok: false, text: "Aliments non reconnus." };
    const built = fromAiPlan({ days: [{ meals: [{ meal, name: a.name || "Repas", items, prep: a.prep, minutes: a.minutes }] }] }).days[0].meals[0];
    for (const i of di == null ? [today] : [di]) {
      const d = days[i], k = d.meals.findIndex(m => m.meal === meal);
      if (op === "add_food" && k >= 0) d.meals[k].items.push(...built.items);
      else if (op === "replace_meal" && k >= 0) d.meals[k] = built;
      else { d.meals.push(built); d.meals.sort((x, y) => ORDER.indexOf(x.meal) - ORDER.indexOf(y.meal)); }
      refit.add(i);
      what = op === "add_food" ? `ajouté au jour ${i + 1} : ${built.items.map(x => x.name).join(", ")}` : `jour ${i + 1}, ${MEALS.find(m => m.id === meal)?.name.toLowerCase()} : ${built.name}`;
    }
  } else if (op === "swap_food") {
    const to = aiItem({ name: a.to, grams: 100, kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat }), ref = refFood(to.name);
    if (!(to.kcal > 0)) return { ok: false, text: `« ${a.to || "?"} » : je ne connais pas ses valeurs.` };
    const per = ref ? ref.per : { k: to.kcal, p: to.protein, c: to.carbs, f: to.fat };
    let count = 0;
    days.forEach((d, i) => {
      if (di != null && i !== di) return;
      for (const m of d.meals) m.items = m.items.map(x => {
        if (!sameFood(x.name, a.from || "")) return x;
        count++; refit.add(i);
        // même énergie : la quantité suit (entre un tiers et trois fois l'ancienne)
        const g = x.per?.k > 0 && per.k > 0 ? Math.min(x.g * 3, Math.max(x.g / 3, (x.g * x.per.k) / per.k)) : x.g;
        return { name: ref?.name || String(a.to).slice(0, 60), g: Math.round(g / 5) * 5 || 5, per, ...(ref?.unit ? { unit: ref.unit } : {}) };
      });
    });
    if (!count) return { ok: false, text: `« ${a.from || "?"} » n'est pas dans le plan.` };
    what = `${a.from} → ${ref?.name || a.to} (${count} fois)`;
  } else if (op === "remove_food") {
    let count = 0;
    days.forEach((d, i) => {
      if (di != null && i !== di) return;
      for (const m of d.meals) { const before = m.items.length; m.items = m.items.filter(x => !sameFood(x.name, a.food || "")); if (m.items.length < before) { count += before - m.items.length; refit.add(i); } }
      d.meals = d.meals.filter(m => m.items.length);
    });
    if (!count) return { ok: false, text: `« ${a.food || "?"} » n'est pas dans le plan.` };
    what = `${a.food} retiré (${count} fois)`;
  } else return { ok: false, text: "Modification du plan inconnue." };
  if (days.some(d => !d.meals.length)) return { ok: false, text: "Un jour du plan serait vide : dis-moi par quoi le remplacer." };
  const next = days.map((d, i) => (refit.has(i) ? fitDay(d, t) : d)), done = new Set((plan.shopping || []).filter(x => x.done).map(x => x.name));
  state.mealPlan = { ...plan, days: next, kcal: t.kcal, p: t.p, fixed: Math.abs(t.kcal - t0.kcal) > t0.kcal * 0.05,
    shopping: shoppingList(next).map(x => (done.has(x.name) ? { ...x, done: true } : x)) };
  return { ok: true, text: `Plan de repas modifié : ${what}. Calories de chaque jour recalées sur ${t.kcal} kcal.`, effects: { plan: true } };
}
