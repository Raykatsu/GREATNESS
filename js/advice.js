// Conseils du coach avant, pendant et après la séance : calculés hors ligne d'après le profil (quiz d'accueil), la
// forme du jour, la séance prévue, la récupération, les repas notés et la mémoire du coach (gênes signalées).
// Aucun affichage ici (testé dans Node) : les écrans sont dans train.js (check-in) et live.js (repos, fin de séance).
import { EXERCISES } from "./data.js";
import { state, getProgram } from "./store.js";
import { patternOf } from "./motion.js";
import { recovery, musclesOf } from "./recovery.js";
import { MUSCLES } from "./body.js";
import { roles } from "./biomech.js";
import { targets, dayOf, dayKey, dayTotals, waterGoal } from "./nutrition.js";
import { dailyAdjust } from "./nutriadapt.js";
import { plannedTarget, readinessScore, readinessVerdict } from "./engine.js";
import { estimateMinutes, cycleInfo, isWorkout } from "./planner.js";

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const kg = v => String(v).replace(".", ",");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const list = names => (names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0] || "");
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/* ---------- Zones sensibles ---------- */
// Gênes signalées (quiz d'accueil, « retiens que j'ai mal au genou »…) → mouvements à surveiller et consigne
export const ZONES = {
  shoulder: { re: /epaule/, title: "Épaule sensible", pats: ["press_h", "press_v", "pushup", "dips", "raise", "fly", "pull_v"],
    tip: "échauffe la coiffe (rotations avec élastique), garde les coudes à 45° sur les développés et reste dans une amplitude sans douleur.",
    short: "coudes à 45°, amplitude sans douleur, et on arrête si ça pince." },
  back: { re: /\bdos\b|lombaire|lumbago|sciatique/, title: "Dos sensible", pats: ["squat", "hinge", "row", "press_v"],
    tip: "gaine avant chaque répétition (inspire, serre les abdos), garde le dos plat et ne cherche pas la charge maximale aujourd'hui.",
    short: "gaine avant chaque répétition et garde le dos plat." },
  knee: { re: /genou/, title: "Genou sensible", pats: ["squat", "lunge", "legext"],
    tip: "genoux dans l'axe des pieds, descends seulement tant que c'est sans douleur et évite les à-coups en bas du mouvement.",
    short: "genoux dans l'axe des pieds, sans à-coup en bas." },
  wrist: { re: /poignet/, title: "Poignet sensible", pats: ["press_h", "pushup", "press_v", "curl", "plank"],
    tip: "poignets droits dans l'axe de l'avant-bras ; les haltères ou les poignées neutres soulagent.",
    short: "poignets droits, dans l'axe de l'avant-bras." },
  elbow: { re: /coude/, title: "Coude sensible", pats: ["tri_ext", "curl", "press_h", "dips", "pull_v"],
    tip: "monte en charge progressivement, ne verrouille pas brutalement le bras et allège si ça tire.",
    short: "pas de verrouillage brutal, allège si ça tire." },
  neck: { re: /nuque|cervical|\bcou\b/, title: "Nuque sensible", pats: ["shrug", "press_v", "crunch", "plank"],
    tip: "regard neutre, menton légèrement rentré, et ne tire jamais sur la tête.",
    short: "regard neutre, menton légèrement rentré." },
  ankle: { re: /cheville|\bpied\b|achille/, title: "Cheville sensible", pats: ["squat", "lunge", "calf", "cardio"],
    tip: "échauffe-la (cercles, montées sur pointes), garde des appuis stables et évite les sauts aujourd'hui.",
    short: "appuis stables, pas de sauts aujourd'hui." },
};
const HURT = /\bmal\b|douleur|gene|prudence|bless|fragil|sensib|tendin|opere|operation|hernie|entorse|luxation/;

// Zones à ménager, d'après la mémoire du coach
export function sensitiveZones(st = state) {
  const texts = (st.memory || []).map(m => norm(m.text)).filter(t => HURT.test(t));
  return Object.keys(ZONES).filter(z => texts.some(t => ZONES[z].re.test(t)));
}
const zoneOf = (exId, zones) => zones.find(z => ZONES[z].pats.includes(patternOf(exId)));

/* ---------- Respiration et tempo ---------- */
const BREATH = {
  push: "Inspire en descendant, souffle en poussant.",
  pull: "Souffle en tirant, inspire en revenant.",
  legs: "Inspire et gaine en haut, descends, puis souffle en remontant.",
  core: "Souffle en enroulant le buste, inspire au retour.",
  hold: "Respire lentement par le ventre, sans relâcher le gainage.",
  cardio: "Respiration régulière : inspire par le nez, souffle par la bouche.",
  stretch: "Respire lentement et relâche un peu plus à chaque expiration.",
};
const FAMILY = { press_h: "push", press_v: "push", pushup: "push", dips: "push", tri_ext: "push", fly: "push",
  pull_v: "pull", row: "pull", curl: "pull", shrug: "pull", raise: "pull",
  squat: "legs", lunge: "legs", hinge: "legs", bridge: "legs", legext: "legs", legcurl: "legs", calf: "legs",
  crunch: "core", plank: "hold", cardio: "cardio", stretch: "stretch" };
const HEAVY = new Set(["squat", "hinge", "press_h", "press_v", "row"]);
export const breathing = exId => BREATH[FAMILY[patternOf(exId)] || "stretch"];

const TEMPO = {
  force: "Descente contrôlée, montée explosive, gainage verrouillé du début à la fin.",
  muscle: "Descente en 2 à 3 secondes, sans rebond en bas : c'est elle qui construit le muscle.",
  seche: "Même charge que d'habitude et repos stricts : le rythme fait le travail.",
  forme: "Mouvement fluide et régulier, sur toute l'amplitude.",
};
const GOAL_TIP = {
  force: "La qualité prime : prends tes repos complets sur les deux premiers exercices et garde chaque répétition explosive.",
  muscle: "Contrôle la descente (2 à 3 secondes) et finis tes dernières séries à 1 ou 2 répétitions de l'échec.",
  seche: "Garde tes charges habituelles : c'est le signal qui protège tes muscles pendant le déficit.",
  forme: "Rythme régulier et respiration fluide : tu dois finir en forme, pas vidé.",
};
const FOCUS = { pecs: ["Pectoraux"], dos: ["Dos"], epaules: ["Épaules"], bras: ["Biceps", "Triceps"], abdos: ["Abdos"],
  jambes: ["Quadriceps", "Ischios", "Mollets"], fessiers: ["Fessiers"] };
const FOCUS_NAME = { pecs: "Pecs", dos: "Dos", epaules: "Épaules", bras: "Bras", abdos: "Abdos", jambes: "Jambes", fessiers: "Fessiers" };

// L'eau est-elle suivie ? (au moins un verre noté sur les 7 derniers jours)
function tracksWater(st, now) {
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() - i); if ((dayOf(st, dayKey(d)).water || 0) > 0) return true; }
  return false;
}
const litres = glasses => kg(Math.round((glasses || 0) * 25) / 100);

/* ---------- Avant la séance ---------- */
// readiness : { sleep, energy, soreness } du check-in. Renvoie les conseils les plus utiles, du plus important au moins important.
export function preTips(program, readiness, { now = new Date(), st = state, max = 4 } = {}) {
  const p = st.profile || {}, out = [];
  const tip = (k, icon, title, text) => out.push({ k, icon, title, text });
  const exs = (program?.exercises || []).filter(e => EXERCISES[e.id]);
  const { sleep = 4, energy = 3, soreness = 2 } = readiness || {};
  if (!program || !isWorkout(program)) {
    if (program?.free) tip("free", "bolt", "Séance libre", "Commence par ton plus gros exercice tant que tu es frais, puis enchaîne vers les plus petits muscles.");
    else tip("soft", "heart", "Tout en douceur", "Aucune douleur ne doit apparaître : va jusqu'à sentir l'étirement, pas plus loin, et respire lentement.");
    if (soreness >= 4) tip("sore", "flame", "Courbatures marquées", "Insiste sur les zones raides, sans forcer : le mouvement doux accélère la récupération.");
    return out.slice(0, max);
  }
  const deload = cycleInfo(now.getTime()).deload;
  const main = exs.find(e => EXERCISES[e.id].type === "load") || exs[0];
  const mainName = main ? EXERCISES[main.id].name : "";

  // 1. zones sensibles concernées par la séance
  const zones = sensitiveZones(st);
  for (const z of zones.slice(0, 2)) {
    const hit = exs.filter(e => ZONES[z].pats.includes(patternOf(e.id))).map(e => EXERCISES[e.id].name);
    if (hit.length) tip("zone", "alert", ZONES[z].title, `Sur ${list(hit.slice(0, 2))} : ${ZONES[z].tip}`);
  }
  // 2. forme du jour
  if (soreness >= 4) tip("sore", "flame", "Courbatures marquées", "Ajoute 5 minutes d'échauffement en douceur sur les zones raides. Si un mouvement tire trop, réduis l'amplitude plutôt que de forcer.");
  else if (sleep <= 2) tip("sleep", "moon", "Nuit courte", "Échauffe-toi un peu plus longtemps, garde 2 répétitions en réserve sur chaque série et oublie les records aujourd'hui.");
  else if (energy <= 2) tip("energy", "bolt", "Batterie faible", "Une collation rapide (banane, compote) 15 à 30 minutes avant t'aidera. Fais les deux premiers exercices, puis écoute tes sensations.");
  else if (!deload && main && readinessScore({ sleep, energy, soreness }) >= 0.8) tip("green", "bolt", "Feu vert", `Tu es en forme : c'est le jour pour aller chercher une répétition ou quelques kilos de plus sur ${mainName}.`);
  if (deload) tip("deload", "moon", "Semaine allégée", "Charges et volume réduits, c'est voulu : soigne ta technique et sors de la séance plus frais qu'en arrivant.");
  // 3. montée en charge sur le premier exercice
  if (main && EXERCISES[main.id].type === "load" && !main.ramp && !main.scheme) {
    const step = EXERCISES[main.id].step || 2.5, r = v => Math.max(0, Math.round(v / step) * step);
    const f = Math.min(readinessVerdict(readinessScore({ sleep, energy, soreness })).factor, deload ? 0.88 : 2);
    const w = r(plannedTarget(main).weight * f);
    if (w >= 30) tip("ramp", "flame", "Montée en charge", `${mainName} : 8 répétitions à ${kg(r(w * 0.5))} kg, puis 4 à ${kg(r(w * 0.75))} kg, avant ta première série à ${kg(w)} kg.`);
    else tip("ramp", "flame", "Échauffement", `2 à 3 minutes pour faire monter la température, puis une série légère de ${mainName} avant de commencer.`);
  } else if (main) tip("ramp", "flame", "Échauffement", "3 à 5 minutes pour faire monter la température (corde, montées de genoux, rotations des articulations), puis une première série facile.");
  // 4. carburant et eau, d'après ce qui est noté aujourd'hui
  const day = dayOf(st, dayKey(now)), t = dailyAdjust(st, now), h = now.getHours(), eaten = dayTotals(day), goalGlasses = waterGoal(t, true); // objectif du jour, corrigé des jours d'avant
  if (day.items?.length && h >= 14 && eaten.k < t.kcal * 0.35) tip("fuel", "flame", "Peu mangé aujourd'hui", `${Math.round(eaten.k)} kcal notées sur ${t.kcal} : prends une collation avec des glucides et un peu de protéines avant de commencer, sinon l'énergie va manquer.`);
  if (h >= 12 && tracksWater(st, now) && (day.water || 0) < goalGlasses * 0.35) tip("water", "info", "Hydrate-toi", `Seulement ${litres(day.water)} L bus aujourd'hui : bois un grand verre maintenant et garde ta gourde à portée.`);
  // 5. zone prioritaire du quiz
  const focus = (p.focus || []).filter(f => exs.some(e => FOCUS[f]?.includes(EXERCISES[e.id].muscle)));
  if (focus.length) tip("focus", "sparkle", "Ta zone prioritaire", `Aujourd'hui tu travailles une zone prioritaire (${list(focus.map(f => FOCUS_NAME[f]))}) : garde ta meilleure concentration pour ces exercices et soigne chaque répétition.`);
  // 6. point technique du premier exercice
  const cue = main && EXERCISES[main.id].cues?.[0];
  if (cue) tip("cue", "info", `Point clé · ${mainName}`, cue);
  // 7. niveau et objectif
  if (p.experience === "debutant") tip("level", "sparkle", "Technique d'abord", "Une charge que tu maîtrises sur toute l'amplitude vaut mieux qu'une charge lourde mal faite. Les kilos viendront vite.");
  else if (GOAL_TIP[p.goal] && !deload) tip("goal", "sparkle", "Ton objectif", GOAL_TIP[p.goal]);
  // 8. heure de la séance
  if (h < 8) tip("early", "clock", "Séance matinale", "Le corps est plus raide au réveil : prolonge l'échauffement de 2 à 3 minutes.");
  else if (h >= 21) tip("late", "clock", "Séance tardive", "Garde 10 minutes de retour au calme à la fin : tu t'endormiras plus facilement.");
  // 9. temps disponible (quiz)
  const est = estimateMinutes(program);
  if (+p.minutes > 0 && est > +p.minutes + 10) tip("time", "clock", "Séance un peu longue", `Environ ${est} minutes prévues pour ${p.minutes} disponibles : si le temps manque, demande « Plus le temps » au coach, il passe en version express.`);
  if (!tracksWater(st, now)) tip("water", "info", "Hydratation", "Garde ta gourde à portée : quelques gorgées entre les séries, surtout si la séance dépasse 45 minutes.");
  return out.slice(0, max);
}

/* ---------- Pendant la séance ---------- */
// Conseil affiché pendant le repos, pour la série qui arrive. n : séries déjà faites (fait tourner les conseils) ;
// lastRpe : ressenti de la série qui vient d'être validée ; half : on vient de passer la moitié de la séance.
export function restTip(ex, { n = 0, lastRpe = 0, half = false, st = state } = {}) {
  if (!ex) return "";
  if (half) return "Mi-séance : bois quelques gorgées et relâche les épaules. La deuxième moitié se joue sur la technique.";
  if (lastRpe >= 9.5) return "Série très dure : respire lentement (4 secondes à l'inspiration, 6 à l'expiration) pour faire redescendre le cœur avant de repartir.";
  const zone = zoneOf(ex.id, sensitiveZones(st));
  const cues = ex.cues?.length ? ex.cues : EXERCISES[ex.id]?.cues || [];
  const pool = [
    breathing(ex.id),
    cues.length ? `Rappel technique : ${cues[n % cues.length]}` : "",
    zone ? `${ZONES[zone].title} : ${ZONES[zone].short}` : "",
    ex.type === "time" ? "" : TEMPO[st.profile?.goal] || TEMPO.forme,
    "Hydrate-toi : deux ou trois gorgées suffisent.",
    cues.length > 1 ? `Rappel technique : ${cues[(n + 1) % cues.length]}` : "",
  ].filter(Boolean);
  return pool[n % pool.length];
}

// Version express : quand le temps manque, on garde les gros exercices et on raccourcit le reste.
// Modifie le plan de la séance en cours ; renvoie le nombre de séries retirées et les minutes gagnées (estimation).
export function expressPlan(plan, idx = 0) {
  let cut = 0, saved = 0;
  plan.forEach((e, i) => {
    if (e.status !== "todo" || e.scheme || e.ramp) return;
    const left = e.sets - e.done.length, keep = i < 2 ? Math.max(1, left - (left >= 3 ? 1 : 0)) : Math.min(left, e.done.length ? 1 : 2);
    const rest = Math.max(30, Math.round((e.rest * 0.75) / 5) * 5);
    saved += (left - keep) * (e.rest + 40) + keep * (e.rest - rest);
    cut += left - keep;
    e.sets = e.done.length + Math.max(i === idx ? 1 : 0, keep);
    e.rest = rest;
  });
  return { cut, minutes: Math.round(saved / 60) };
}

// Réponses immédiates (hors ligne) aux questions courantes pendant la séance
export function quickAnswer(kind, ex, { st = state, left = 0 } = {}) {
  const meta = EXERCISES[ex.id] || {}, cues = ex.cues?.length ? ex.cues : meta.cues || [], goal = st.profile?.goal;
  if (kind === "tech") {
    const how = roles(ex.id)?.how;
    return `**Technique · ${ex.name}**\n${cues.map(c => `• ${c}`).join("\n") || "• Mouvement lent et contrôlé, sur toute l'amplitude."}${how ? `\n\n${how}` : ""}`;
  }
  if (kind === "breath") return `**Respiration · ${ex.name}**\n${breathing(ex.id)}${HEAVY.has(patternOf(ex.id)) && ex.type === "load" ? "\nSur une série lourde : prends ton air et gaine avant de partir, puis souffle en fin d'effort. Ne reste jamais en apnée plusieurs répétitions de suite." : ""}`;
  if (kind === "tempo") return `**Tempo**\n${ex.type === "time" ? "Tiens la position sans bouger, en respirant calmement : la qualité compte plus que la durée." : TEMPO[goal] || TEMPO.forme}\nRepos conseillé sur cet exercice : **${ex.rest} s**.`;
  if (kind === "motiv") {
    const name = st.profile?.name ? `, ${st.profile.name}` : "";
    return left > 0 ? `Plus que **${left} exercice${left > 1 ? "s" : ""}**${name}. Tu as déjà fait le plus dur : une série à la fois, et tu repars avec la séance dans la poche.`
      : `Dernier exercice${name} ! C'est maintenant que tu fais la différence : des répétitions propres jusqu'au bout.`;
  }
  return "";
}

/* ---------- Après la séance ---------- */
const whenReady = hours => (hours < 20 ? `dans environ ${hours} h` : hours < 36 ? "demain" : `dans ${Math.round(hours / 24)} jours`);

// Prochaine séance prévue (pas la mobilité), à partir de demain : { name, when }
export function nextSession(st = state, now = new Date()) {
  const plan = st.weekPlan || {}, today = (now.getDay() + 6) % 7;
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7, id = plan[d], prog = id && id !== "mobility" ? getProgram(id) : null;
    if (prog) return { name: prog.name, when: i === 1 ? "demain" : DAYS[d], days: i };
  }
  return null;
}

// sum : le résumé de la séance (Session.summary()), déjà ajouté à l'historique
export function postTips(sum, { now = new Date(), st = state, max = 5 } = {}) {
  const p = st.profile || {}, out = [];
  const tip = (k, icon, title, text) => out.push({ k, icon, title, text });
  if (!sum?.sets?.length) return out;
  const prog = getProgram(sum.programId), mins = Math.round((sum.durationSec || 0) / 60);
  if (prog && !isWorkout(prog) && !prog.free) {
    tip("soft", "heart", "Bien joué", "Bois un verre d'eau et profite de la détente. Refais cette séance dès que tu te sens raide : la régularité fait la souplesse.");
    return out;
  }
  // 1. douleur signalée pendant la séance
  if (sum.pain?.length) tip("pain", "alert", "Douleur signalée", `Tu as arrêté ${list(sum.pain.map(id => EXERCISES[id]?.name || id))} à cause d'une douleur : repos de la zone 48 h, glace 10 à 15 minutes si c'est gonflé, et consulte un professionnel si ça dure ou si c'est vif.`);
  // 2. repas d'après-séance
  const bw = +p.bodyweight || 75, dose = clamp(Math.round((bw * 0.3) / 5) * 5, 20, 45);
  const day = dayOf(st, dayKey(now)), t = targets(p), eaten = dayTotals(day), left = Math.round(t.p - eaten.p);
  const extra = day.items?.length ? (left > 5 ? ` Il te reste ${left} g de protéines à manger aujourd'hui.` : " Tes protéines du jour sont déjà au rendez-vous.") : "";
  const byGoal = { seche: " En sèche, garde ce repas dans ton total de calories.", muscle: " C'est le repas le plus utile de ta journée pour construire du muscle." }[p.goal] || "";
  tip("food", "flame", "Recharge", `Dans les 2 heures : ${dose} g de protéines et des glucides (riz, pâtes, pain, fruits).${extra}${byGoal}`);
  // 3. eau
  const ml = Math.round((350 + mins * 5) / 50) * 50, goalGlasses = waterGoal(t, true);
  tip("water", "info", "Réhydrate-toi", `Bois environ ${ml} ml dans l'heure qui vient, par petites gorgées.${tracksWater(st, now) && (day.water || 0) < goalGlasses ? ` Tu en es à ${litres(day.water)} L sur ${litres(goalGlasses)} L aujourd'hui.` : ""}`);
  // 4. récupération des muscles travaillés
  const rec = recovery(st.sessions || [], now.getTime());
  const worked = [...new Set(sum.sets.flatMap(s => musclesOf(s.exId).p))].filter(m => rec[m]?.hours > 0).sort((a, b) => rec[b].hours - rec[a].hours);
  if (worked.length) tip("rec", "heart", "Récupération", `${list(worked.slice(0, 3).map(m => MUSCLES[m]))} : récupération complète ${whenReady(rec[worked[0]].hours)}. D'ici là, entraîne d'autres muscles ou repose-toi : c'est pendant la récupération que tu progresses.`);
  // 5. sommeil après une grosse séance
  const avgRpe = sum.sets.reduce((a, s) => a + (s.rpe || 0), 0) / sum.sets.length;
  if (avgRpe >= 8.8 || sum.fatigue >= 65 || sum.cut) tip("sleep", "moon", "Sommeil", "Grosse séance : vise 8 heures de sommeil cette nuit. C'est là que tes muscles se reconstruisent.");
  // 6. courbatures à prévoir
  const fresh = (sum.compare || []).filter(c => c.delta === null).map(c => c.name);
  if ((st.sessions || []).length <= 1) tip("doms", "flame", "Courbatures", "Première séance : des courbatures sous 24 à 48 h sont normales. Bouge doucement demain, elles passent plus vite.");
  else if (fresh.length) tip("doms", "flame", "Courbatures", `Nouveaux exercices (${list(fresh.slice(0, 2))}) : des courbatures sous 24 à 48 h sont normales. Bouge doucement demain, elles passent plus vite.`);
  // 7. la suite du programme
  const next = nextSession(st, now);
  if (next) tip("next", "play", "Au programme", `Prochaine séance : ${next.name}, ${next.when}.${next.days === 1 && worked.length ? " Si tu es encore courbaturé demain, le coach allégera tout seul." : ""}`);
  // 8. retour au calme
  tip("cool", "heart", "Retour au calme", "5 minutes de marche lente ou d'étirements légers font redescendre le rythme cardiaque et limitent les raideurs.");
  return out.slice(0, max);
}
