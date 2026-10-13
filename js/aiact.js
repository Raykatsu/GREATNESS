// Le coach agit sur l'app : l'IA en ligne termine sa réponse par des blocs ```action {…}``` que l'app
// transforme en boutons (créer une séance, programme de la semaine, objectif, charge, repas). « remember »
// s'applique tout seul. Ici : la consigne donnée à l'IA, la lecture des blocs et leur exécution (sans affichage).
import { EXERCISES, GOALS } from "./data.js";
import { state, allPrograms } from "./store.js";
import { addItem, dayKey } from "./nutrition.js";
import { addMemory } from "./memory.js";
import { norm } from "./foods.js";

const TYPES = new Set(["create_program", "week_plan", "set_goal", "set_weight", "log_food", "remember"]);
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MEAL_IDS = { breakfast: 1, lunch: 1, dinner: 1, snack: 1 };

const PROGRAM_ASK = /(seance|programme|routine|entrainement|planning|semaine|cree|creer|fais[ -]moi|propose|exercice|circuit|split|workout)/;

// Consigne ajoutée aux instructions de l'IA en ligne
export function actionsGuide(question = "") {
  const names = PROGRAM_ASK.test(norm(question))
    ? `\nNoms exacts des exercices de l'app (pour create_program) : ${Object.values(EXERCISES).filter(e => !e.custom).map(e => e.name).join(", ")}.` : "";
  return `### Agir dans l'app
Tu peux modifier l'app pour l'athlète : termine alors ta réponse par un ou plusieurs blocs exactement de cette forme (l'app les montre comme des boutons, l'athlète valide d'un geste) :
\`\`\`action
{"type": "…"}
\`\`\`
Actions possibles :
- create_program, créer une séance : {"type":"create_program","name":"Jambes 45 min","exercises":[{"name":"Squat","sets":4,"reps":"6-8","rest":150},{"name":"Fente","sets":3,"reps":"10-12","rest":90}]}
- week_plan, programme de la semaine : {"type":"week_plan","days":{"lundi":"Push","mercredi":"Pull","vendredi":"Legs","dimanche":"repos"}} (séances existantes, ou créées dans la même réponse)
- set_goal : {"type":"set_goal","goal":"force|muscle|seche|forme","days":4}
- set_weight, charge de départ à la prochaine séance : {"type":"set_weight","exercise":"Développé couché","weight":82.5}
- log_food, noter ce que l'athlète vient de manger : {"type":"log_food","meal":"breakfast|lunch|dinner|snack","items":[{"name":"Poulet","grams":150,"kcal":248,"protein":46,"carbs":0,"fat":5}]}
- remember, retenir une info durable sur l'athlète (blessure, douleur, matériel, préférence, contrainte, objectif précis) : {"type":"remember","fact":"Genou droit sensible : éviter les sauts"}
Propose une action seulement si l'athlète la demande ou si elle l'aide clairement. Pour remember, fais-le dès qu'il donne une info durable, sans le lui demander. JSON valide, blocs à la toute fin de la réponse.${names}`;
}

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

/* ---------- Exercices et séances désignés par leur nom ---------- */
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

const parseReps = (r, ex) => {
  if (Array.isArray(r) && r.length >= 2) return [Math.max(1, +r[0] || 1), Math.max(+r[0] || 1, +r[1] || 1)];
  const m = String(r ?? "").match(/(\d+)\s*(?:-|à|a|–)\s*(\d+)/), one = String(r ?? "").match(/\d+/);
  const def = ex.type === "time" ? [30, 45] : [8, 12];
  if (m) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
  if (one) return [+one[0], +one[0]];
  return def;
};
const clampN = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

/* ---------- Libellés des boutons ---------- */
export function describe(a) {
  switch (a.type) {
    case "create_program": return `Créer la séance « ${String(a.name || "Ma séance").slice(0, 40)} »`;
    case "week_plan": return "Appliquer ce programme de la semaine";
    case "set_goal": return `Objectif : ${GOALS[a.goal]?.name || a.goal}${a.days ? `, ${a.days} séances/semaine` : ""}`;
    case "set_weight": return `${EXERCISES[resolveExercise(a.exercise)]?.name || a.exercise} : ${a.weight} kg à la prochaine séance`;
    case "log_food": return `Noter ce repas (${Math.round((a.items || []).reduce((s, x) => s + (+x.kcal || 0), 0))} kcal)`;
    case "remember": return `Retenir : ${String(a.fact || "").slice(0, 80)}`;
    default: return a.type;
  }
}

/* ---------- Exécution ---------- */
// Renvoie { ok, text, programId? } ; ne sauvegarde pas (l'appelant le fait).
export function applyAction(a, created = {}) {
  switch (a.type) {
    case "remember": {
      const m = addMemory(state, a.fact, "ai");
      return m ? { ok: true, text: `Noté : ${m.text}` } : { ok: false, text: "Rien à retenir." };
    }
    case "create_program": {
      const exercises = [], missing = [];
      for (const x of (Array.isArray(a.exercises) ? a.exercises : []).slice(0, 15)) {
        const id = resolveExercise(x.id || x.name);
        if (!id) { missing.push(x.name || x.id); continue; }
        const ex = EXERCISES[id], g = GOALS[state.profile.goal] || GOALS.muscle;
        exercises.push({
          id, sets: clampN(x.sets, 1, 8, 3), reps: parseReps(x.reps, ex),
          weight: ex.type === "load" ? clampN(x.weight, 0, 500, state.lifts[id]?.weight || 0) : 0,
          rest: clampN(x.rest, 10, 300, g.accRest), rpe: clampN(x.rpe, 5, 10, g.rpe),
        });
      }
      if (!exercises.length) return { ok: false, text: "Aucun exercice reconnu pour cette séance." };
      const prog = { id: "c" + Date.now() + Math.floor(Math.random() * 1000), name: String(a.name || "Séance du coach").slice(0, 40), tag: "Créée par le coach", accent: "red", exercises };
      state.customPrograms.push(prog);
      created[norm(prog.name)] = prog.id;
      return { ok: true, programId: prog.id, text: `Séance « ${prog.name} » créée (${exercises.length} exercices)${missing.length ? ` ; pas trouvé : ${missing.join(", ")}` : ""}.` };
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
    case "set_goal": {
      if (!GOALS[a.goal]) return { ok: false, text: "Objectif inconnu." };
      state.profile.goal = a.goal;
      if (a.days) state.profile.days = clampN(a.days, 2, 6, state.profile.days);
      return { ok: true, text: `Objectif : ${GOALS[a.goal].name}${a.days ? `, ${state.profile.days} séances par semaine` : ""}.`, replan: !!a.days };
    }
    case "set_weight": {
      const id = resolveExercise(a.exercise), w = clampN(a.weight, 0, 500, NaN);
      if (!id || !Number.isFinite(w) || EXERCISES[id].type !== "load") return { ok: false, text: "Exercice ou charge non reconnus." };
      state.lifts[id] = { ...(state.lifts[id] || { weight: w, reps: 0, best: 0, bestReps: 0, date: Date.now() }), next: w };
      return { ok: true, text: `${EXERCISES[id].name} : ${w} kg à la prochaine séance.` };
    }
    case "log_food": {
      const meal = MEAL_IDS[a.meal] ? a.meal : "snack", key = dayKey();
      const items = (Array.isArray(a.items) ? a.items : []).slice(0, 20).filter(x => x && (+x.kcal > 0 || +x.grams > 0));
      for (const x of items) {
        const g = clampN(x.grams, 1, 5000, 100), m = 100 / g;
        addItem(state, key, { name: String(x.name || "Aliment").slice(0, 60), per: { k: (+x.kcal || 0) * m, p: (+x.protein || 0) * m, c: (+x.carbs || 0) * m, f: (+x.fat || 0) * m }, src: "ai" }, { g, meal });
      }
      return items.length ? { ok: true, text: `${items.length} aliment(s) noté(s) dans ton journal.` } : { ok: false, text: "Rien à noter." };
    }
  }
  return { ok: false, text: "Action inconnue." };
}
