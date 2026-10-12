// Le coach agit sur l'app : il comprend des demandes en français
// (« crée une séance pecs de 45 min », « mets Legs le mercredi », « passe l'app en bleu »…)
// et les exécute. Fonctionne sans IA ; l'IA locale ou Claude répondent au reste.
import { EXERCISES, GOALS } from "./data.js";
import { state, save, allPrograms, getProgram, tombstone } from "./store.js";
import { generateWeekPlan, ensureWeekPlan, generateSession, GROUPS } from "./planner.js";
import { findExercise } from "./brain.js";

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/* ---------- Apparence ---------- */
export const ACCENTS = {
  rouge: ["#e8283b", "#b8101f"], bleu: ["#3b6cf6", "#2449c4"], violet: ["#8b5cf6", "#6d28d9"], vert: ["#22c55e", "#15803d"],
  orange: ["#f97316", "#c2410c"], rose: ["#ec4899", "#be185d"], jaune: ["#eab308", "#a16207"], cyan: ["#06b6d4", "#0e7490"],
};
export const MODES = { dark: "Sombre", oled: "Noir", light: "Clair" };
export const ZOOMS = [1, 1.1, 1.2];

export function applyAppearance(p = state.profile) {
  const root = document.documentElement;
  const [c, c2] = ACCENTS[p.accent] || ACCENTS.rouge;
  const rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).join(", ");
  root.style.setProperty("--red", c);
  root.style.setProperty("--red-2", c2);
  root.style.setProperty("--red-soft", `rgba(${rgb}, .13)`);
  root.style.setProperty("--accent-rgb", rgb);
  root.style.setProperty("--zoom", p.zoom || 1);
  root.dataset.mode = p.mode || "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.mode === "light" ? "#f4f4f8" : p.mode === "oled" ? "#000000" : "#09090d");
}

/* ---------- Reconnaissance ---------- */
const COLOR_WORDS = { rouge: "rouge", bleu: "bleu", violet: "violet", mauve: "violet", vert: "vert", orange: "orange", rose: "rose", jaune: "jaune", dore: "jaune", cyan: "cyan", turquoise: "cyan" };
const PROGRAM_KEYS = [
  [/\bpush\b/, "push"], [/\bpull\b/, "pull"], [/\blegs?\b|jambes/, "legs"], [/full ?body|corps complet/, "full_a"], [/haut du corps|\bupper\b/, "upper"],
  [/bas du corps|\blower\b/, "lower"], [/\bbras\b/, "arms"], [/fessiers?/, "glutes"], [/abdos|gainage/, "core"], [/hiit|cardio/, "hiit"],
  [/mal (au|du|de) dos|lombaires?/, "care_back"], [/nuque|\bcou\b|torticolis/, "care_neck"], [/mal (aux|au) genou|genoux sensibles/, "care_knee"],
  [/mal (aux|a l) epaule|epaules sensibles/, "care_shoulder"], [/poignets?|coudes?/, "care_wrist"], [/hanches? raides?/, "care_hips"],
  [/echauffement|echauffer/, "warmup_full"], [/retour au calme|apres (la )?seance/, "cooldown"], [/grand ecart/, "flex_split"], [/souplesse/, "flex_full"],
  [/reveil|ce matin|au lever/, "wake_up"],
  [/mobilite|etirement|stretch/, "mobility"], [/maison/, "home_full"], [/halteres/, "home_db"],
];

export function findProgram(t) {
  const progs = allPrograms().slice().sort((a, b) => b.name.length - a.name.length);
  const byName = progs.find(p => t.includes(norm(p.name)));
  if (byName) return byName;
  const hit = PROGRAM_KEYS.find(([re]) => re.test(t));
  return hit ? getProgram(hit[1]) : null;
}

function groupsIn(t) {
  const g = [];
  const add = (re, ...keys) => { if (re.test(t)) g.push(...keys); };
  add(/pecs?\b|pectoraux|torse|poitrine|\bchest\b/, "pecs");
  add(/\bdos\b|\bback\b|dorsaux/, "dos");
  add(/epaules?|deltoides?/, "epaules");
  add(/\bbras\b/, "biceps", "triceps");
  add(/biceps/, "biceps");
  add(/triceps/, "triceps");
  add(/jambes?|cuisses?|quadri|\blegs?\b/, "jambes");
  add(/fessiers?|\bfesses?\b|glutes?/, "fessiers");
  add(/abdos?|gainage|\bcore\b|ventre/, "abdos");
  add(/cardio|hiit|endurance|bruler/, "cardio");
  add(/mobilite|etirements?|souplesse/, "mobilite");
  add(/full ?body|corps complet|tout le corps/, "full");
  add(/haut du corps|\bupper\b/, "haut");
  add(/bas du corps|\blower\b/, "bas");
  add(/\bpush\b/, "push");
  add(/\bpull\b/, "pull");
  return [...new Set(g)];
}

const equipIn = t => (/sans materiel|poids du corps|maison|chez moi|a la maison/.test(t) ? "home" : /halteres?/.test(t) ? "db" : /salle|machines?|barre/.test(t) ? "gym" : null);
const minutesIn = t => { const m = t.match(/(\d{1,3})\s*(min|minutes|mn)\b/); if (m) return +m[1]; const h = t.match(/(\d)\s*h(eure)?s?\b/); return h ? +h[1] * 60 : null; };
const dayIn = t => DAYS.findIndex(d => new RegExp(`\\b${d}\\b`).test(t));
const ON = /\b(active|activer|allume|remets?|rallume|reactive|mets?)\b/;
const OFF = /\b(desactive|desactiver|coupe|couper|enleve|eteins|retire|arrete|cache|supprime|vire)\b/;

export function parseCommand(text) {
  const t = norm(text);
  if (t.length > 220) return null;
  const isQuestion = /^(comment|pourquoi|quel|quelle|quels|est-ce|est ce|combien|c est quoi|qu est)/.test(t);

  // Apparence
  const color = Object.keys(COLOR_WORDS).find(w => new RegExp(`\\b${w}\\b`).test(t));
  if (color && /(couleur|theme|accent|app|site|appli|interface|en\s+\w+$|mets|passe|change)/.test(t) && !isQuestion) return { type: "accent", value: COLOR_WORDS[color] };
  if (/(mode|theme|fond|affichage|app|site)/.test(t) && /\b(clair|blanc|jour)\b/.test(t) && !isQuestion) return { type: "mode", value: "light" };
  if (/(mode|theme|fond|affichage)/.test(t) && /\b(oled|tout noir|noir)\b/.test(t) && !isQuestion) return { type: "mode", value: "oled" };
  if (/(mode|theme|fond|affichage)/.test(t) && /\b(sombre|nuit|dark)\b/.test(t) && !isQuestion) return { type: "mode", value: "dark" };
  if (/(texte|ecriture|police|caracteres|taille)/.test(t)) {
    if (/(plus grand|agrandi|grossi|plus gros|grand|gros)/.test(t)) return { type: "zoom", value: "up" };
    if (/(plus petit|reduis|diminue|normal|petit)/.test(t)) return { type: "zoom", value: "down" };
  }

  // Interrupteurs
  const target = /\bvoix|vocal|parle\b/.test(t) ? "voice" : /\bsons?\b|bips?\b/.test(t) ? "sound" : /spider|mascotte|bonhomme|personnage|araignee/.test(t) ? "mascot" : null;
  if (target && !isQuestion) {
    if (OFF.test(t)) return { type: "toggle", target, value: false };
    if (ON.test(t)) return { type: "toggle", target, value: true };
  }

  // Objectif
  if (/(objectif|\bbut\b)/.test(t) && !isQuestion) {
    const goal = /force|fort|lourd/.test(t) ? "force" : /muscle|masse|hypertroph|prise|volume|gonfl/.test(t) ? "muscle" : /seche|secher|perdre|maigrir|gras|poids/.test(t) ? "seche" : /forme|sante|entretien/.test(t) ? "forme" : null;
    if (goal) return { type: "goal", value: goal };
  }

  // Nombre de séances par semaine
  const days = t.match(/(\d)\s*(seances?|jours?|fois|entrainements?)\s*(par|\/|a la|dans la)\s*semaine/);
  if (days && /(passe|mets|met|change|veux|voudrais|fais|programme|planning|prevois|regle)/.test(t) && !isQuestion) return { type: "days", value: Math.min(6, Math.max(2, +days[1])) };

  // Matériel
  if (/(je m entraine|m entrainer|entrainement|materiel|je vais)/.test(t) && equipIn(t) && /(maintenant|desormais|plus|change|passe|mets|vais)/.test(t) && !/seance/.test(t)) return { type: "equipment", value: equipIn(t) };

  // Création de séance
  const asks = /((peux|pourrais|pourras)[- ]tu|tu (peux|pourrais|pourras)) (me |m )?(faire|creer|generer|preparer|construire|proposer)/.test(t);
  if ((asks || (!isQuestion && /\b(cree|creer|crees|fais|fait|genere|generer|construis|prepare|propose|donne|invente|compose|concocte)\b/.test(t))) && /(seance|entrainement|workout|circuit|routine|training)/.test(t) && !/programme de la semaine|planning/.test(t)) {
    const name = text.match(/(?:appel[ée]e?|nomm[ée]e?|intitul[ée]e?)\s+[«"']?([^»"']{2,40})/i)?.[1]?.trim();
    return { type: "create", groups: groupsIn(t), minutes: minutesIn(t) || 45, equipment: equipIn(t), day: dayIn(t), name };
  }

  // Ajouter un exercice à une séance perso
  if (/\b(ajoute|rajoute|mets?)\b/.test(t) && /(seance|dans|a ma)/.test(t)) {
    const ex = findExercise(text);
    const p = state.customPrograms.slice().sort((a, b) => b.name.length - a.name.length).find(x => t.includes(norm(x.name)));
    if (ex && p) return { type: "addex", exercise: ex, program: p.id };
  }

  // Supprimer une séance perso
  if (/\b(supprime|efface|enleve)\b/.test(t) && /seance/.test(t)) {
    const p = state.customPrograms.slice().sort((a, b) => b.name.length - a.name.length).find(x => t.includes(norm(x.name)));
    if (p) return { type: "delete", program: p.id };
  }

  // Programme de la semaine
  if (/(regenere|refais|nouveau|genere|cree|recree|refait|reinitialise)/.test(t) && /(programme|planning)/.test(t) && dayIn(t) < 0) return { type: "regen" };
  const d = dayIn(t);
  if (d >= 0 && !isQuestion) {
    if (/\b(repos|rien|off|libre|pause)\b/.test(t)) return { type: "plan", day: d, program: null };
    const p = findProgram(t);
    if (p && /\b(mets?|place|programme|planifie|change|remplace|fais|veux|ajoute|prevois)\b/.test(t)) return { type: "plan", day: d, program: p.id };
  }

  // Lancer une séance
  if (/\b(lance|lancer|commence|commencer|demarre|demarrer|go)\b/.test(t)) {
    if (/(du jour|mission|aujourd)/.test(t)) return { type: "start", program: "today" };
    if (/libre/.test(t)) return { type: "start", program: "free" };
    const p = findProgram(t);
    if (p) return { type: "start", program: p.id };
  }

  // Navigation
  if (/\b(ouvre|va|aller|montre|affiche|emmene|amene)\b/.test(t)) {
    const tab = /progres|stat|record|historique|calendrier/.test(t) ? "progress" : /profil|reglage|parametre|compte/.test(t) ? "profile" : /creer|atelier|mes seances/.test(t) ? "create" : /seances|bibliotheque|programmes/.test(t) ? "train" : /accueil|maison|home/.test(t) ? "" : null;
    if (tab !== null) return { type: "nav", tab };
  }
  return null;
}

/* ---------- Exécution ---------- */
const P = () => state.profile;

export function runCommand(cmd) {
  const p = P();
  switch (cmd.type) {
    case "accent": p.accent = cmd.value; save(); applyAppearance(); return { text: `C'est fait : l'app passe en **${cmd.value}**. Tu peux aussi choisir la couleur dans Profil → Apparence.`, mood: "party" };
    case "mode": p.mode = cmd.value; save(); applyAppearance(); return { text: `Affichage **${({ dark: "sombre", oled: "noir intégral", light: "clair" })[cmd.value]}** activé.`, mood: "happy" };
    case "zoom": {
      const i = ZOOMS.indexOf(p.zoom || 1);
      p.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + (cmd.value === "up" ? 1 : -1)))];
      save(); applyAppearance();
      return { text: p.zoom > 1 ? `Texte agrandi (${Math.round(p.zoom * 100)} %).` : "Texte remis à la taille normale." };
    }
    case "toggle": {
      p[cmd.target] = cmd.value; save();
      if (cmd.target === "mascot") window.dispatchEvent(new CustomEvent("greatness:mascot", { detail: cmd.value }));
      const what = { voice: "Les consignes vocales", sound: "Les sons", mascot: "Spider-Man animé" }[cmd.target];
      return { text: `${what} : **${cmd.value ? "activé" : "désactivé"}**.` };
    }
    case "goal": p.goal = cmd.value; save(); return { text: `Objectif changé : **${GOALS[cmd.value].name}**. J'adapte les répétitions et les repos de toutes tes séances.`, actions: [{ label: "Voir l'accueil", route: "#/" }], mood: "happy" };
    case "days": p.days = cmd.value; state.weekPlan = generateWeekPlan(); save(); return { text: `Programme refait pour **${cmd.value} séances par semaine**.\n${planText()}`, actions: [{ label: "Voir ma semaine", route: "#/" }], mood: "happy" };
    case "equipment": p.equipment = cmd.value; state.weekPlan = generateWeekPlan(); save(); return { text: `Noté : entraînement **${({ gym: "en salle", db: "avec haltères", home: "sans matériel" })[cmd.value]}**. Programme adapté :\n${planText()}`, actions: [{ label: "Voir ma semaine", route: "#/" }] };
    case "regen": state.weekPlan = generateWeekPlan(); save(); return { text: `Nouveau programme de la semaine :\n${planText()}`, actions: [{ label: "Voir ma semaine", route: "#/" }], mood: "happy" };
    case "plan": {
      const plan = ensureWeekPlan();
      if (cmd.program) plan[cmd.day] = cmd.program; else delete plan[cmd.day];
      save();
      return { text: `**${cap(DAYS[cmd.day])}** : ${cmd.program ? getProgram(cmd.program).name : "repos"}. C'est noté dans ton programme.`, actions: [{ label: "Voir ma semaine", route: "#/" }] };
    }
    case "create": {
      const s = generateSession({ groups: cmd.groups.length ? cmd.groups : ["full"], minutes: cmd.minutes, equipment: cmd.equipment || p.equipment, name: cmd.name });
      const prog = { id: "c" + Date.now(), accent: Math.random() < 0.5 ? "red" : "blue", ...s };
      state.customPrograms.push(prog);
      if (cmd.day >= 0) ensureWeekPlan()[cmd.day] = prog.id;
      save();
      const list = prog.exercises.map(e => `• ${EXERCISES[e.id].name} — ${e.sets} × ${e.reps[0]}–${e.reps[1]}${EXERCISES[e.id].type === "time" ? " s" : ""}`).join("\n");
      return {
        text: `Séance **${prog.name}** créée et enregistrée dans « Mes séances »${cmd.day >= 0 ? `, prévue le **${DAYS[cmd.day]}**` : ""} :\n${list}`,
        actions: [{ label: "Commencer", start: prog.id }, { label: "Modifier", route: `#/create?edit=${prog.id}` }], mood: "party",
      };
    }
    case "addex": {
      const prog = state.customPrograms.find(x => x.id === cmd.program);
      const e = EXERCISES[cmd.exercise];
      prog.exercises.push({ id: cmd.exercise, sets: 3, reps: e.type === "time" ? [30, 45] : GOALS[p.goal].accReps, weight: state.lifts[cmd.exercise]?.weight || 0, rest: 75, rpe: 8 });
      save();
      return { text: `**${e.name}** ajouté à « ${prog.name} » (3 séries).`, actions: [{ label: "Modifier la séance", route: `#/create?edit=${prog.id}` }] };
    }
    case "delete": {
      const prog = state.customPrograms.find(x => x.id === cmd.program);
      state.customPrograms = state.customPrograms.filter(x => x.id !== cmd.program);
      tombstone("programs", cmd.program);
      Object.keys(state.weekPlan || {}).forEach(k => { if (state.weekPlan[k] === cmd.program) delete state.weekPlan[k]; });
      save();
      return { text: `Séance « ${prog.name} » supprimée.` };
    }
    case "start": return { text: "C'est parti ! J'ouvre la séance.", actions: [{ label: "Ouvrir", start: cmd.program }], auto: { start: cmd.program } };
    case "nav": return { text: "J'y vais !", auto: { route: `#/${cmd.tab}` } };
  }
  return null;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function planText() {
  const plan = state.weekPlan || {};
  return DAYS.map((d, i) => `• ${cap(d)} : ${plan[i] ? getProgram(plan[i])?.name : "repos"}`).join("\n");
}

export const COMMAND_EXAMPLES = [
  "Crée une séance pecs triceps de 45 min",
  "Crée une séance jambes sans matériel pour samedi",
  "Mets Legs le mercredi",
  "Passe à 4 séances par semaine",
  "Change mon objectif en sèche",
  "Passe l'app en bleu",
  "Mode clair",
  "Agrandis le texte",
  "Désactive la voix",
  "Lance la séance du jour",
];
