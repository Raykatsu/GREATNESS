// Le cerveau local du coach : répond aux questions et analyse les séances,
// sans connexion et sans IA payante, à partir des vraies données de l'utilisateur.
import { EXERCISES, GOALS } from "./data.js";
import { getProgram, allPrograms } from "./store.js";
import { state, weekStats, exerciseHistory, streak, rankInfo, e1rm, exName } from "./store.js";
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
import { todaysMission } from "./planner.js";
import { nutritionContext, foodFacts } from "./nutrition.js";
import { memoryContext } from "./memory.js";
import { recoveryContext, recoveryAnswer } from "./recovery.js";
import { ivSummary } from "./intervals.js";
import { goalsContext } from "./goals.js";
import { healthContext } from "./health.js";
import { actionsGuide } from "./aiact.js";
import { current as coach, coachName, coachPersona } from "./chars/index.js";
import { LOC, isEn, tr } from "./i18n.js";

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString(LOC());

// Trouve un exercice cité dans la question (nom complet ou mots-clés).
const ALIASES = {
  bench: ["couche", "bench", "dc"], squat: ["squat"], deadlift: ["souleve de terre", "deadlift", "sdt"], ohp: ["militaire", "overhead"],
  pullup: ["traction", "pull up", "pullup"], row: ["rowing"], curl: ["curl", "biceps"], pushdown: ["triceps"], hip_thrust: ["hip thrust", "fessier"],
  pushup: ["pompe"], dips: ["dips"], lateral: ["elevation", "laterale", "epaule"], plank: ["gainage", "planche"], lunge: ["fente"], rdl: ["roumain", "ischio"],
  leg_press: ["presse"], calf: ["mollet"], burpee: ["burpee"],
};
export function findExercise(q) {
  const t = norm(q);
  for (const [id, ex] of Object.entries(EXERCISES)) if (t.includes(norm(ex.name)) || (isEn() && t.includes(norm(tr(ex.name))))) return id;
  for (const [id, keys] of Object.entries(ALIASES)) if (keys.some(k => t.includes(k))) return id;
  return null;
}

function exerciseAdvice(id) {
  const ex = EXERCISES[id];
  const hist = exerciseHistory(id);
  const lines = [`**${ex.name}** (${ex.muscle})`, ...ex.cues.map(c => `• ${c}`)];
  if (hist.length) {
    const last = hist[hist.length - 1];
    const first = hist[0];
    if (ex.type === "load") {
      lines.push(`\nTa dernière fois : meilleure série ${last.top.weight} kg × ${last.top.reps} (1RM estimé ${Math.round(last.e1rm)} kg).`);
      if (hist.length > 1) {
        const d = last.e1rm - first.e1rm;
        lines.push(d > 0 ? `Depuis le début : +${Math.round(d)} kg sur ton 1RM estimé. Ça avance.` : `Pas de progrès net depuis ${hist.length} séances : on va jouer sur les reps avant d'ajouter du poids.`);
      }
      const l = state.lifts[id];
      if (l) lines.push(`Prochaine cible : ${l.reps >= 8 ? `${l.weight + ex.step} kg` : `${l.weight} kg pour ${l.reps + 1} reps`}.`);
    } else {
      lines.push(`\nTon record : ${state.lifts[id]?.bestReps || last.top.reps}${ex.type === "time" ? " s" : " reps"}. Vise +1 ${ex.type === "time" ? "à +5 s" : "rep"} par séance.`);
    }
  } else {
    lines.push("\nTu ne l'as pas encore fait : commence léger, technique d'abord, et je calibre la charge dès la première série.");
  }
  if (ex.alts.length) lines.push(`Alternatives : ${ex.alts.map(exName).join(", ")}.`);
  return lines.join("\n");
}

// « J'ai fait 4×5 au bench à 100 kg à l'échec » : on lit la performance et on conseille la suite.
export function parsePerf(q) {
  const t = norm(q).replace(/,/g, ".").replace(/×/g, "x");
  const sr = t.match(/(\d{1,2})\s*(?:x|\*|series?\s*(?:de|x))\s*(\d{1,3})\b/);
  const reps = sr ? +sr[2] : +(t.match(/(\d{1,3})\s*(?:reps?|repetitions?)\b/)?.[1] || 0);
  const sets = sr ? +sr[1] : +(t.match(/(\d{1,2})\s*series?\b/)?.[1] || 0);
  const w = t.match(/(\d{1,3}(?:\.\d+)?)\s*(?:kg|kilos?)\b/) || t.match(/\b(?:a|avec)\s+(\d{2,3}(?:\.\d+)?)\b/);
  const weight = w ? +w[1] : 0;
  const rpeNum = t.match(/(?:rpe|@)\s*(\d+(?:\.\d)?)/);
  const rpe = rpeNum ? Math.min(10, +rpeNum[1])
    : /echec|a fond|\bmax\b|plus rien|j.?en pouvais plus/.test(t) ? 10
    : /tres dur|super dur|hyper dur|galere/.test(t) ? 9.5
    : /\bdur\b|difficile|limite/.test(t) ? 9
    : /facile|tranquille|leger|large/.test(t) ? 7 : null;
  if (!reps && !weight) return null;
  return { sets, reps, weight, rpe };
}

function perfAdvice(id, perf) {
  const ex = EXERCISES[id];
  const g = state.profile.goal;
  const { sets, reps, weight, rpe } = perf;
  const step = ex.step || 2.5;
  const lines = [];
  const desc = `${sets ? sets + "×" : ""}${reps || "?"}${weight ? ` à ${String(weight).replace(".", ",")} kg` : ""}`;
  if (weight && reps) {
    const rir = rpe ? 10 - rpe : 2;
    const est = weight * (1 + (reps + rir) / 30);
    const best = state.lifts[id]?.best || 0;
    lines.push(`**${ex.name} : ${desc}${rpe === 10 ? " à l'échec" : ""}**, soit un 1RM estimé d'environ **${Math.round(est)} kg**${best ? (est > best + 0.5 ? ` (ton ancien record était ${Math.round(best)} kg : **nouveau record** !)` : ` (ton record estimé : ${Math.round(best)} kg)`) : ""}.`);
  } else lines.push(`**${ex.name} : ${desc}.**`);
  const next = n => String(n).replace(".", ",");
  if (rpe === 10) {
    lines.push(`• Aller à l'échec sur toutes les séries fatigue énormément (surtout au ${ex.name.toLowerCase()}) pour très peu de gain en plus.`);
    lines.push(`• Prochaine séance : garde **${next(weight)} kg** et arrête chaque série **1 à 2 reps avant l'échec** (RPE 8–9). Si tu n'arrives plus à ${reps} reps propres, passe à ${sets || 4}×${Math.max(1, reps - 1)}.`);
    lines.push(`• Quand ${sets || 4}×${reps} passe proprement avec 1–2 reps en réserve : **+${next(step)} kg**.`);
  } else if (rpe && rpe >= 9) {
    lines.push(`• C'était très dur : reste à **${next(weight)} kg** la prochaine fois et vise les mêmes reps avec un peu plus de marge, puis +${next(step)} kg.`);
  } else if (rpe && rpe <= 7) {
    lines.push(`• Il te restait de la marge : la prochaine fois, passe à **${next(weight + step)} kg**${reps ? ` pour ${sets || 4}×${reps}` : ""}.`);
  } else if (weight) {
    lines.push(`• Prochaine séance : **${next(weight)} kg** pour ${sets || 4}×${reps + 1}, puis **${next(weight + step)} kg** quand c'est validé (double progression).`);
  }
  if (g === "muscle" && reps && reps < 6) lines.push("• Pour la prise de muscle, alterne avec des séries de 6 à 10 reps (un peu plus léger) : plus de volume, moins de fatigue nerveuse.");
  if (g === "force" && reps > 6) lines.push("• Pour la force, reviens vers 3 à 6 reps avec plus de charge.");
  if (g === "seche") lines.push("• En sèche, l'objectif est de **garder tes charges** : c'est le signal qui protège tes muscles. Évite l'échec, la récupération est plus lente en déficit.");
  if (id === "bench") lines.push("• Pour débloquer ton développé couché : triceps (barre au front, dips), développé incliné haltères, et omoplates bien serrées sur le banc.");
  lines.push("• Récupération : 2 à 3 min de repos entre les séries lourdes, protéines et sommeil.");
  return lines.join("\n");
}

const INTENTS = [
  { re: /(\bmal\b|douleur|blesse|tendin|genou|epaule qui|dos qui)/, fn: () =>
    `Si ça fait mal, on arrête l'exercice qui déclenche la douleur : même ${coachName()} ne s'entraîne pas blessé.\n• Douleur vive, gonflement ou qui dure plus de quelques jours → kiné ou médecin.\n• Sinon : 48 h de repos sur la zone, puis reprise légère sans douleur.\n• En séance, coche « Douleur » : j'arrête l'exercice et je te propose une alternative.\n• Pour les raideurs : Séances → **Soulager** (dos, nuque, épaules, genoux, hanches, poignets), des séances douces à faire sans douleur. Dis-moi par exemple « lance mal de dos ».` },
  { re: /(proteine|manger|nutrition|repas|aliment|regime|calorie)/, fn: () => {
    const bw = state.profile.bodyweight, g = state.profile.goal;
    const p = Math.round(bw * (g === "seche" ? 2 : 1.8));
    const kcal = g === "seche" ? "un léger déficit (environ 300 à 400 kcal de moins que ta maintenance)" : g === "muscle" ? "un léger surplus (environ 200 à 300 kcal de plus que ta maintenance)" : "ta maintenance";
    return `Pour ${bw} kg et l'objectif « ${GOALS[g].name} » :\n• Protéines : ~${p} g par jour, réparties sur 3 à 4 repas (viande, poisson, œufs, skyr, légumineuses).\n• Énergie : ${kcal}.\n• Après la séance : 25 à 40 g de protéines + des glucides (riz, pâtes, fruits) dans les 2 h.\n• Bois 2 à 3 L d'eau, plus les jours d'entraînement.`; } },
  { re: /(dormi|sommeil|dormir|fatigue|epuise|creve)/, fn: () =>
    `Le sommeil, c'est là que tu construis le muscle.\n• Vise 7 à 9 h, à heures régulières.\n• Pas d'écran 30 min avant, chambre fraîche et sombre.\n• Mal dormi ? Fais quand même le check-in avant la séance : j'allège automatiquement les charges.${weekStats().count >= 5 ? "\nTu as déjà fait " + weekStats().count + " séances cette semaine : une journée off ne te fera que du bien." : ""}` },
  { re: /(echauff|warm)/, fn: () =>
    "Échauffement en 5 à 8 minutes :\n1. 2 à 3 min de cardio léger (corde, jumping jacks).\n2. Mobilité des articulations du jour (épaules, hanches).\n3. Séries de montée sur le premier exercice : 8 reps à 50 %, 4 reps à 75 %.\nJe te rappelle les charges d'échauffement au début de chaque séance." },
  { re: /(plateau|stagne|bloque|progresse plus|progresse pas)/, fn: () => {
    const stuck = Object.keys(state.lifts).filter(id => { const h = exerciseHistory(id); return h.length >= 3 && h[h.length - 1].e1rm <= h[h.length - 3].e1rm; });
    return `Pour casser un plateau :\n• Dors et mange assez (surtout les protéines).\n• Reste 2 à 3 séances sur la même charge en ajoutant des reps avant de monter.\n• Change de variante 4 à 6 semaines (ex. haltères au lieu de barre).\n• Fais une semaine plus légère toutes les 6 à 8 semaines.${stuck.length ? "\nChez toi, ça stagne sur : " + stuck.map(exName).join(", ") + "." : ""}`; } },
  { re: /(seche|perdre|maigrir|gras|poids perdu)/, fn: () =>
    "Pour sécher sans perdre de muscle :\n• Garde des charges lourdes : c'est le signal pour conserver le muscle.\n• Léger déficit calorique, protéines élevées (~2 g/kg).\n• Ajoute 1 à 2 séances HIIT ou 8 000 à 10 000 pas par jour.\n• Passe ton objectif sur « Sèche » dans Profil : j'adapte reps et repos." },
  { re: /(masse|grossir|prendre du muscle|hypertroph|volume)/, fn: () =>
    "Pour prendre du muscle :\n• 10 à 20 séries par muscle et par semaine.\n• Reps entre 6 et 15, proche de l'échec (ressenti 8 à 9).\n• Léger surplus calorique, ~1,8 g de protéines par kilo.\n• Patience : environ 0,5 à 1 kg de muscle par mois pour un débutant, moins ensuite." },
  { re: /(cardio|courir|course|endurance|souffle)/, fn: () =>
    "Le cardio complète bien la muscu :\n• 2 séances par semaine suffisent (HIIT 20 min ou footing 30 min).\n• Fais-le après la muscu ou un autre jour, pas avant les jambes.\n• Les séances « HIIT express » et « Corde & gainage » sont dans l'onglet Séances." },
  { re: /(recupere|recuperation|courbatur|muscles? (fatigue|pret|repose)|quels? muscles?|quoi travailler)/, fn: () => recoveryAnswer(state.sessions) },
  { re: /(etire|mobilite|souplesse|stretch|courbature)/, fn: () =>
    "Mobilité et courbatures :\n• Les courbatures sont normales après une nouveauté ; elles diminuent en 2 à 3 jours.\n• Bouger doucement aide plus que rester immobile.\n• La séance « Mobilité » (15 min) est parfaite les jours off ; je la place le dimanche dans ton programme." },
  { re: /(creatine|complement|whey|supplement|bcaa)/, fn: () =>
    "Compléments, version simple :\n• Whey : pratique pour atteindre tes protéines, pas obligatoire.\n• Créatine monohydrate : le complément le plus étudié pour la force (3 à 5 g par jour). Demande l'avis d'un professionnel de santé si tu as un doute.\n• Le reste (BCAA, brûleurs…) : inutile si l'alimentation est correcte." },
  { re: /(combien de series|combien de reps|repetition|rpe|ressenti)/, fn: () =>
    "Le ressenti (RPE) mesure la difficulté de la série :\n• 6 = facile, il te restait 4 reps ou plus.\n• 8 = dur, il en restait 2.\n• 10 = échec, impossible d'en faire une de plus.\nJe vise 7 à 9 selon l'exercice. Après chaque série, je monte la charge si c'était trop facile et je la baisse si tu étais trop loin de la cible." },
  { re: /(repos|jour off|recuper|combien de fois|frequence)/, fn: () =>
    `Récupération :\n• 48 h entre deux séances du même muscle.\n• Entre les séries : 2 à 3 min sur les gros mouvements, 60 à 90 s sur les petits (je les règle pour toi).\n• Ton programme : ${state.profile.days} séances par semaine. Tu peux le changer dans Profil.` },
  { re: /(stat|bilan|analyse|resume|progres|record)/, fn: () => {
    const w = weekStats(), pw = weekStats(1), r = rankInfo();
    const top = Object.entries(state.lifts).filter(([id]) => EXERCISES[id]?.type === "load").sort((a, b) => b[1].best - a[1].best).slice(0, 3);
    if (!state.sessions.length) return "Pas encore de séance enregistrée. Lance ta première mission depuis l'Accueil et je te ferai un vrai bilan.";
    const diff = pw.volume ? Math.round(((w.volume - pw.volume) / pw.volume) * 100) : null;
    return `Cette semaine : ${w.count} séance(s), ${fmt(w.volume)} kg soulevés, ${w.minutes} min${diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff} % vs semaine dernière)` : ""}.\nSérie en cours : ${streak()} jour(s). Rang : ${r.rank.name} (${r.xp} XP).${top.length ? "\nTes meilleurs 1RM estimés : " + top.map(([id, l]) => `${exName(id)} ${Math.round(l.best)} kg`).join(", ") + "." : ""}`; },
    actions: [{ label: "Voir mes progrès", route: "#/progress" }] },
  { re: /(programme|planning|semaine|organis|quel jour|aujourd)/, fn: () => {
    const m = todaysMission();
    return `Aujourd'hui : ${m.rest ? "récupération active (Mobilité)" : m.program.name}${m.doneToday ? " (déjà faite, bravo)" : ""}.\nTon programme de la semaine est sur l'Accueil : touche un jour pour changer sa séance, ou régénère-le dans Profil selon ton objectif et tes jours dispo.`; },
    actions: [{ label: "Voir mon programme", route: "#/" }] },
  { re: /(motiv|flemme|envie|pas le courage|demotiv)/, fn: () => pick([
    "Ta seule mission aujourd'hui, c'est de commencer. Fais l'échauffement et la première série. Ensuite, on voit.",
    "Même les jours sans, une séance courte vaut mieux que zéro. Prends « Abdos & gainage » (20 min) et je m'occupe du reste.",
    `Tu as déjà ${state.sessions.length} séance(s) au compteur. Le toi de dans 3 mois te remerciera pour celle-là.`]) },
  { re: /(debut|commence|novice|premiere fois)/, fn: () =>
    "Bienvenue ! Pour bien démarrer :\n• 3 séances par semaine (Full body A/B ou Push/Pull/Legs).\n• Charges légères les 2 premières semaines : la technique d'abord.\n• Note honnêtement ton ressenti après chaque série, je m'occupe d'ajuster.\n• La régularité compte plus que l'intensité." },
  { re: /(bonjour|salut|hello|coucou|\byo\b)/, fn: () => `Salut ${state.profile.name || "toi"} ! Ici ${coachName()}, ton coach. Demande-moi ce que tu veux : technique, nutrition, programme, bilan…` },
  { re: /(merci|top|genial|cool)/, fn: () => pick([`Avec plaisir. ${coachName()}, toujours dans ton coin.`, "Toujours là pour toi. Allez, au boulot !"]) },
];

export function answer(q) {
  const t = norm(q);
  // « Combien de calories dans… » : valeurs d'un aliment de la base (ou appris grâce à l'IA)
  const facts = foodFacts(q, state);
  if (facts) return { text: facts, matched: true, actions: [{ label: "Noter un repas", route: "#/food" }] };
  const exId = findExercise(q);
  const intent = INTENTS.find(i => i.re.test(t));
  // Une question technique sur un exercice précis l'emporte (sauf douleur).
  const perf = exId && EXERCISES[exId]?.type === "load" ? parsePerf(q) : null;
  if (perf && !/\bmal\b|douleur|blesse/.test(t)) return { text: perfAdvice(exId, perf), matched: true };
  if (exId && (!intent || !/\bmal\b|douleur|blesse/.test(t))) {
    return { text: exerciseAdvice(exId), matched: true };
  }
  if (intent) return { text: intent.fn(), actions: intent.actions, matched: true };
  return {
    matched: false,
    text: "Je n'ai pas bien compris, mais je peux t'aider sur : la technique d'un exercice (ex. « squat »), la nutrition, le sommeil, les plateaux, ton programme ou ton bilan de la semaine.",
    actions: [{ label: "Mon bilan", ask: "Fais mon bilan" }, { label: "Nutrition", ask: "Que manger ?" }, { label: "Technique squat", ask: "Comment bien faire le squat ?" }],
  };
}

// Débrief détaillé de fin de séance.
export function debrief(sum) {
  const lines = [];
  const avgRpe = sum.sets.length ? sum.sets.reduce((a, s) => a + s.rpe, 0) / sum.sets.length : 0;
  const up = sum.compare.filter(c => c.delta !== null && c.delta > 0.01);
  const down = sum.compare.filter(c => c.delta !== null && c.delta < -0.01);
  if (sum.prs.length) lines.push(`${sum.prs.length} record${sum.prs.length > 1 ? "s" : ""} battu${sum.prs.length > 1 ? "s" : ""} : ${sum.prs.map(exName).join(", ")}. Énorme.`);
  if (up.length) lines.push(`En progrès sur ${up.map(c => c.name).join(", ")}.`);
  if (down.length) lines.push(`Un peu en dessous sur ${down.map(c => c.name).join(", ")} : normal si tu étais fatigué, on vise mieux la prochaine fois.`);
  if (avgRpe >= 9) lines.push("Intensité très haute : dors bien et mange suffisamment de protéines ce soir.");
  else if (avgRpe && avgRpe <= 7) lines.push("Séance confortable : je monterai les charges la prochaine fois.");
  else if (avgRpe) lines.push("Intensité idéale, pile dans la zone de progression.");
  if (sum.cut) lines.push("J'ai allégé la fin à cause de la fatigue : la récupération passe en priorité.");
  if (!lines.length) lines.push("Séance enregistrée. Chaque mission compte.");
  return lines.join(" ");
}

// Petites phrases du coach quand il se balade à l'écran.
export function idleTip(route) {
  const m = todaysMission();
  const common = [
    "Touche-moi si tu as une question !",
    "Hydrate-toi, même les héros ont soif.",
    `Objectif du moment : ${GOALS[state.profile.goal].name}.`,
    "La régularité, c'est mon super-pouvoir préféré.",
  ];
  const byRoute = {
    home: m.doneToday ? ["Séance du jour faite. Repos bien mérité !", "Demain, on remet ça."] : [`Aujourd'hui : ${m.program.name}. On y va ?`, "Ta mission t'attend juste là."],
    train: ["Choisis une séance, ou crée la tienne avec le bouton +.", "Envie de changer ? Essaie une séance que tu n'as jamais faite."],
    progress: state.sessions.length ? ["Touche un exercice pour voir ta courbe.", `${state.sessions.length} séances au compteur, bravo.`] : ["Ta première séance remplira cette page."],
    coach: ["Pose-moi n'importe quelle question."],
    profile: ["Change ton objectif ici, j'adapte tout."],
  };
  return pick([...(byRoute[route] || []), ...common]);
}

/* ---------- Contexte pour l'IA locale ---------- */
// La personnalité suit le coach choisi (Alex par défaut).
const system = (online = false) => `Tu es ${coachName()}, le coach sportif de l'app GREATNESS. Ta personnalité : ${coachPersona() || "drôle, bienveillant et motivant"}
Garde ta voix de personnage, mais reste toujours un coach sérieux, juste et bienveillant.
Tu tutoies et tu réponds toujours en français, de façon claire, juste et utile.
Tu peux répondre à toutes les questions : entraînement, technique, programmes, nutrition, sommeil, récupération, motivation, et aussi n'importe quel autre sujet de la vie courante.
Pour tout ce qui touche au sport, appuie-toi sur les données réelles de l'athlète ci-dessous et cite ses chiffres quand c'est utile.
Style : ${online ? "direct, précis et structuré. Adapte la longueur à la question : quelques phrases pour une question simple ; pour un programme, une analyse de séance ou une explication, développe avec des titres courts (###), des puces et des chiffres précis (séries, reps, charges en kg, RPE, repos, grammes). Pas de tableaux (l'app ne les affiche pas) : préfère des listes. Pas de généralités ni de remplissage : chaque phrase doit servir." : "direct et concret. 3 à 8 phrases ou une courte liste à puces, sauf si on te demande un programme ou une explication détaillée."} Une petite touche de ton personnage (${coachName()}) de temps en temps, sans en abuser. Mets en **gras** les points clés.
Sécurité : en cas de douleur ou de blessure, conseille d'arrêter l'exercice et de consulter un professionnel ; ne pose pas de diagnostic médical ; ne donne jamais de dosage de médicament ni de produit dopant. Si tu ne sais pas, dis-le simplement.
L'app exécute automatiquement certaines demandes : créer une séance, modifier le programme de la semaine, l'objectif, la couleur de l'app, le mode clair, la taille du texte, la voix… Si l'utilisateur veut une modification de ce genre, donne-lui la phrase exacte à envoyer, par exemple : « Crée une séance dos de 45 min », « Mets Legs le mercredi », « Passe l'app en bleu », « Mode clair », « Agrandis le texte ».`;

export function athleteContext({ full = false } = {}) {
  const p = state.profile;
  const w = weekStats();
  const plan = state.weekPlan || {};
  const lifts = Object.entries(state.lifts).filter(([id]) => EXERCISES[id])
    .sort((a, b) => (b[1].date || 0) - (a[1].date || 0)).slice(0, full ? 40 : 10)
    .map(([id, l]) => EXERCISES[id].type === "load" ? `${exName(id)} : dernière ${l.weight} kg × ${l.reps}, 1RM estimé ${Math.round(l.best)} kg` : `${exName(id)} : record ${l.bestReps}${EXERCISES[id].type === "time" ? " s" : " reps"}`);
  const recent = state.sessions.slice(full ? -15 : -5).reverse().map(s => {
    const by = {};
    s.sets.forEach(x => (by[x.name] ||= []).push(x.weight ? `${x.weight}×${x.reps}@${x.rpe}` : `${x.reps}@${x.rpe}`));
    const day = new Date(s.date).toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" });
    if (s.iv) return `- ${day} : ${s.name}, ${Math.round(s.durationSec / 60)} min, ${ivSummary(s)}.`;
    return `- ${day} : ${s.name}, ${Math.round(s.durationSec / 60)} min, ${s.volume} kg. ${Object.entries(by).map(([n, a]) => `${n} ${a.join(" ")}`).join(" ; ")}`;
  });
  return [
    `Aujourd'hui : ${new Date().toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
    `Athlète : ${p.name || "inconnu"}, ${p.bodyweight} kg, objectif « ${GOALS[p.goal].name} », ${p.days} séances/semaine, matériel : ${{ gym: "salle", db: "haltères", home: "sans matériel" }[p.equipment]}.`,
    `Programme de la semaine : ${DAYS.map((d, i) => `${d} ${plan[i] ? getProgram(plan[i])?.name : "repos"}`).join(", ")}.`,
    `Cette semaine : ${w.count} séance(s), ${w.volume} kg, ${w.minutes} min. Série en cours : ${streak()} jour(s). Rang : ${rankInfo().rank.name}.`,
    lifts.length ? `Performances :\n- ${lifts.join("\n- ")}` : "Pas encore de performances enregistrées.",
    recent.length ? `Dernières séances :\n${recent.join("\n")}` : "Aucune séance enregistrée pour l'instant.",
    `Séances disponibles dans l'app : ${allPrograms().map(x => x.name).join(", ")}.`,
    recoveryContext(state.sessions),
    healthContext(state.health?.days),
    goalsContext(state),
    nutritionContext(state),
    memoryContext(state),
    ...(full ? fullExtras() : []),
  ].filter(Boolean).join("\n");
}

// Compléments pour l'IA en ligne (plus de mémoire disponible que le modèle local).
function fullExtras() {
  const out = [];
  const total = state.sessions.length;
  if (total) {
    const first = state.sessions[0].date;
    const weeks = Math.max(1, (Date.now() - first) / (7 * 864e5));
    out.push(`Historique : ${total} séances depuis le ${new Date(first).toLocaleDateString(LOC())}, soit ${(total / weeks).toFixed(1)} par semaine en moyenne.`);
  }
  const body = (state.body || []).slice(-6);
  if (body.length) out.push(`Mensurations (les plus récentes en dernier) : ${body.map(b => `${new Date(b.date).toLocaleDateString(LOC())} ${[b.weight && b.weight + " kg", b.waist && "taille " + b.waist + " cm", b.chest && "poitrine " + b.chest + " cm", b.arm && "bras " + b.arm + " cm", b.thigh && "cuisse " + b.thigh + " cm"].filter(Boolean).join(", ")}`).join(" ; ")}.`);
  const notes = Object.entries(state.exNotes || {}).filter(([id]) => EXERCISES[id]).slice(0, 12);
  if (notes.length) out.push(`Notes de l'athlète sur ses exercices : ${notes.map(([id, n]) => `${exName(id)} : ${n}`).join(" ; ")}.`);
  const custom = state.customPrograms || [];
  if (custom.length) out.push(`Ses séances perso : ${custom.map(c => `${c.name} (${c.exercises.map(e => exName(e.id)).join(", ")})`).join(" ; ")}.`);
  const sessNotes = state.sessions.slice(-10).filter(x => x.note).map(x => `${new Date(x.date).toLocaleDateString(LOC())} : ${x.note}`);
  if (sessNotes.length) out.push(`Ses notes de séance : ${sessNotes.join(" ; ")}.`);
  return out;
}

// Messages pour l'IA en ligne : consignes + toutes les données utiles + conversation récente.
export function onlineMessages(history, question) {
  const local = answer(question);
  const notes = local.matched ? `\n\nRepères calculés par l'app pour cette question (chiffres fiables ; reformule, complète ou corrige si besoin, ne recopie pas) :\n${local.text}` : "";
  return {
    system: `${system(true)}\n\n### Données de l'athlète (à jour)\n${athleteContext({ full: true })}${notes}\n\n${actionsGuide(question)}`,
    messages: [...history.slice(-16).map(m => ({ role: m.role, content: m.content.slice(0, 2500) })), { role: "user", content: question }],
  };
}

// Messages pour le modèle local : consignes + données + historique récent.
export function llmMessages(history, question) {
  const local = answer(question);
  const notes = local.matched ? `\n\nNotes fiables du coach sur cette question (à utiliser, reformuler et compléter) :\n${local.text}` : "";
  return [
    { role: "system", content: `${system()}\n\n### Données de l'athlète\n${athleteContext()}${notes}` },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 900) })), // tient dans la mémoire courte des petits modèles
    { role: "user", content: question },
  ];
}
