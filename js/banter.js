// Le coach taquin (Réglages → Coach & sons → « Coach taquin ») : en langage familier, le coach te charrie gentiment sur
// ce que tu fais — calories, aliments « plaisir », sucre, eau, protéines, repos qui traîne, séance écourtée, sommeil,
// pesée, bilan de la semaine… Les piques visent tes choix, jamais ton corps ; rien sur la douleur ; quand tu manges trop
// peu, il te pousse à manger, jamais à te priver. Coupé par défaut. Ici, la logique pure (testée dans Node) : les
// répliques, la situation qui parle le plus, et la phrase prête à afficher ; l'affichage est dans food.js, live.js,
// app.js et review.js.
import { state } from "./store.js";
import { tr, isEn, LOC } from "./i18n.js";
import { DIRECTION, SPREAD, THRESH, CAP } from "./nutriadapt.js";

export const banterOn = () => state.profile?.banter === true;

// Répliques par situation. %n, %s : nombres ; %k : kilos ; %f : un aliment ; [[homme|femme|autre]] : accordé selon le
// profil (« Autre » : une tournure neutre). Traduites en anglais dans js/lang/en.js.
export const LINES = {
  // en sèche, objectif dépassé : l'excès est repris sur les 3 jours suivants (%n : excès, %s : kcal retirées par jour)
  overCut: [
    "Objectif explosé de %n kcal. Sanction : %s kcal de moins par jour pendant 3 jours, [[mon gourmand|ma gourmande|la gourmandise sur pattes]].",
    "Le frigo a gagné cette manche : %n kcal de trop. Je te reprends %s kcal par jour sur les 3 prochains jours.",
    "T'es pas [[censé|censée|censé·e]] sécher, toi ? Allez, %s kcal de moins par jour pendant 3 jours, sans discuter.",
    "Encore %n kcal au-dessus… Je te les fais rembourser : %s kcal par jour, 3 jours. Avec le sourire.",
    "Craquage détecté : %n kcal de trop. Rien de grave, mais je t'enlève %s kcal par jour sur les 3 prochains jours.",
  ],
  // en forme, objectif dépassé : la moitié de l'écart est lissée sur 3 jours
  overForme: [
    "Petit écart de %n kcal, rien de grave, [[champion|championne|la star]]. Je le lisse : %s kcal de moins par jour pendant 3 jours.",
    "Rab de %n kcal aujourd'hui. On équilibre en douceur : %s kcal de moins les 3 prochains jours.",
  ],
  // en prise de masse, objectif dépassé (rien n'est repris)
  overBulk: [
    "Pas mal, %n kcal de rab en prise de masse… tant que c'est pas que des chips, ça passe.",
    "On a dit prise de masse, pas prise de tout ce qui traîne dans les placards. Bon, %n kcal de plus, je te couvre.",
    "Avec %n kcal de plus, va t'entraîner pour que ça atterrisse au bon endroit.",
  ],
  // objectif dépassé, adaptation au jour le jour coupée
  overPlain: [
    "Objectif dépassé de %n kcal. Je dis rien… mais j'en pense pas moins.",
    "Hop, %n kcal au-dessus. Demain, on se tient à carreau ?",
  ],
  // aujourd'hui, l'objectif est baissé pour reprendre un excès des jours d'avant (%n : kcal en moins)
  compensating: [
    "Aujourd'hui, je t'ai retiré %n kcal pour éponger les jours d'avant. La gourmandise, ça se paie à crédit.",
    "Tu as %n kcal de moins aujourd'hui : c'est le remboursement de ton dernier craquage. Avec intérêts.",
  ],
  // aujourd'hui, l'objectif est monté pour rattraper un manque (prise de masse)
  catchUp: [
    "Tu as %n kcal de plus aujourd'hui : t'as pas assez mangé ces derniers jours, alors on rattrape. Ordre du coach.",
  ],
  // le soir, encore beaucoup à manger en prise de masse
  underGain: [
    "Il te reste %n kcal à manger : les muscles ne poussent pas avec de l'air et de la bonne volonté.",
    "Encore %n kcal à caser avant dodo. Riz, poulet, un bol de flocons d'avoine… hop, on n'en parle plus.",
    "Prise de masse, pas prise de pause. Il manque %n kcal dans ton assiette.",
  ],
  // le soir, encore beaucoup à manger (sèche ou forme) : on pousse à manger, jamais à se priver
  underCut: [
    "Il te reste %n kcal. Sécher, c'est pas jeûner : mange un vrai truc, l'ascète.",
    "Encore %n kcal de marge… t'as oublié de manger ou t'as une stratégie secrète ?",
  ],
  // un aliment « plaisir » noté (%f : son nom)
  junk: [
    "Tiens, %f ? Je note… et je juge un peu.",
    "Ah, %f. Le repas des champions… des champions du canapé.",
    "C'est noté pour %f. Mes yeux pleurent, mais c'est noté.",
    "Respect pour l'honnêteté : %f. Moins pour le choix.",
    "Je vois %f dans ton journal. On va dire que c'était pour la récup.",
    "Va pour %f… ça te coûtera une série de burpees imaginaires.",
  ],
  // un aliment noté tard le soir
  lateNight: [
    "Un petit creux à cette heure-là ? Le frigo te connaît par ton prénom maintenant.",
    "Repas de minuit noté. Même les gremlins ont des règles, tu sais.",
    "À cette heure-ci, c'est plus un repas, c'est une mission d'infiltration dans la cuisine.",
  ],
  // beaucoup de sucre dans la journée (%n : grammes)
  sugar: [
    "Déjà %n g de sucre aujourd'hui… tu prépares un concours de pâtisserie ?",
    "Avec %n g de sucre, ton pancréas a demandé à parler à ton manager.",
    "Ça fait %n g de sucre. Tu pourrais faire tourner une fête foraine avec ça.",
  ],
  // le soir, il manque des protéines (%n : grammes)
  lowProtein: [
    "Il manque %n g de protéines : tes muscles ont déposé un préavis de grève.",
    "Encore %n g de protéines à trouver avant dodo. Skyr, œufs, poulet… ce que tu veux, mais bouge.",
    "Tes protéines sont en vacances ? Il en manque %n g.",
  ],
  // l'après-midi, pas assez d'eau
  water: [
    "Hydratation de cactus détectée. Un grand verre d'eau, maintenant.",
    "Les plantes du salon boivent plus que toi aujourd'hui. Remédie à ça.",
    "Bois de l'eau. C'est gratuit, ça coule du robinet, et tes muscles en sont faits aux trois quarts.",
  ],
  // le soir, objectif tenu et protéines au rendez-vous
  onTarget: [
    "Pile dans l'objectif et protéines au taquet. J'ai rien à redire, c'est presque vexant.",
    "Journée nickel. Tu pourrais pas me laisser un petit écart à critiquer, au moins ?",
    "Calories carrées, protéines validées. Le coach est fier, mais le répète à personne.",
  ],
  // pesée : la tendance monte en sèche (%k : kilos par semaine)
  weightUpCut: [
    "La balance monte de %k kg par semaine… t'es pas [[censé|censée|censé·e]] maigrir, toi ?",
    "Tendance en hausse en pleine sèche. Soit c'est du muscle, soit c'est la raclette de dimanche. On sait tous les deux.",
    "Ta tendance monte. On a dit sèche, pas « je sèche les règles ».",
  ],
  // pesée : la tendance baisse en prise de masse (%k : kilos par semaine)
  weightDownBulk: [
    "Tu perds %k kg par semaine en prise de masse ? On veut construire, pas disparaître. Mange !",
    "Ta tendance baisse alors qu'on prend du muscle. Ton assiette et toi, faut qu'on parle.",
  ],
  // pesée : la tendance va dans le bon sens
  weightGood: [
    "La tendance va dans le bon sens. Continue et je vais devoir trouver autre chose à critiquer.",
    "La balance t'aime bien en ce moment. Profite, elle est pas toujours aussi sympa.",
  ],
  // séance : le repos est fini depuis plus d'une minute et la série ne vient pas
  restOver: [
    "Le repos est fini depuis un moment… tu scrolles ou tu t'entraînes ?",
    "Allô ? La barre t'attend. Elle commence à se sentir seule.",
    "Si tu te reposes encore, ça s'appelle une sieste. Debout !",
    "Le chrono a sonné. Les réseaux peuvent attendre, tes muscles non.",
  ],
  // séance : série jugée facile (%n : ressenti)
  easySet: [
    "Ressenti %n ? C'était un échauffement déguisé. Mets du poids, [[mon grand|ma grande|la star]] !",
    "Trop facile pour toi, ça. La prochaine fois, je charge la barre moi-même.",
    "Même pas une goutte de sueur ? On monte la charge.",
  ],
  // séance : série à fond (ressenti 10)
  maxSet: [
    "Ressenti 10 ! T'as vu la lumière au bout du tunnel ?",
    "Série à fond, respect. Respire, tu vas survivre… normalement.",
    "Dix sur dix ! Même les voisins ont entendu le grognement.",
  ],
  // séance : nouveau record
  pr: [
    "Nouveau record ! Préviens les voisins, ça va trembler.",
    "Record battu ! Je vais devoir mettre ta légende à jour.",
    "Record ! Tu fais ça pour impressionner le coach ? Ça marche.",
  ],
  // bilan de forme : mauvaise nuit
  checkinSleep: [
    "Nuit pourrie ? T'as regardé des vidéos de chats jusqu'à 2 h, avoue.",
    "Mal dormi… on y va mollo aujourd'hui. Mais ce soir, téléphone loin du lit.",
  ],
  // bilan de forme : grosses courbatures
  checkinSore: [
    "Courbatures de compétition ! La séance d'avant t'a laissé des souvenirs.",
    "Tu marches comme un pingouin ? T'inquiète, j'adapte.",
  ],
  // bilan de forme : énergie à plat
  checkinTired: [
    "Batterie à plat ? Un café, une bonne playlist, et on verra bien.",
  ],
  // bilan de forme : grosse forme
  checkinGreat: [
    "Super forme aujourd'hui ! Pas d'excuse, on envoie.",
    "Batterie pleine. Ce serait dommage de la gâcher, non ?",
  ],
  // fin de séance : avec des records
  endPr: [
    "Des records et une séance pliée : rentre doucement, ton ego déborde du sac de sport.",
    "Records battus ! Je vais devoir raconter ça aux autres coachs.",
  ],
  // fin de séance : arrêtée bien avant la fin
  endEarly: [
    "On s'arrête déjà ? La moitié de la séance, la moitié des gains. C'est mathématique.",
    "Séance écourtée… je dirai rien. Ah si : la prochaine fois, jusqu'au bout !",
  ],
  // fin de séance : très courte (%n : minutes)
  endShort: [
    "Seulement %n minutes ? C'était une séance ou une bande-annonce ?",
    "Séance express… on dira que c'était un HIIT.",
  ],
  // fin de séance : très longue (%n : minutes)
  endLong: [
    "Déjà %n minutes ! T'as fait des pauses café entre les séries ?",
    "Séance marathon… t'as dormi sur le banc ou quoi ?",
  ],
  // fin de séance : séance normale
  endGood: [
    "Séance validée. Le canapé t'attend, et pour une fois tu l'as mérité.",
    "Propre. Même moi, j'ai rien à redire.",
    "Fini ! Va manger tes protéines, et pas que des chips.",
  ],
  // accueil : plusieurs jours sans séance (%n : jours)
  comeback: [
    "Ça fait %n jours sans séance… le canapé a pris ta forme.",
    "Déjà %n jours ! Tes haltères ont lancé un avis de recherche.",
    "Te revoilà ! On fait comme si ces %n jours n'avaient jamais existé ?",
  ],
  // accueil : plusieurs jours d'affilée (%n : jours)
  streak: [
    "Série de %n jours, t'es une machine. Une machine qui transpire, mais une machine.",
    "Déjà %n jours d'affilée ! Même le coach est essoufflé.",
  ],
  // accueil : séance du jour faite
  doneToday: [
    "Mission faite. Tu peux te la raconter un peu, t'as le droit.",
    "Séance pliée. Maintenant : protéines et dodo, pas des séries télé jusqu'à 2 h.",
  ],
  // accueil : jour de repos
  restDay: [
    "Jour de repos : interdit de culpabiliser, autorisé de faire la sieste.",
    "Repos aujourd'hui. Les muscles poussent quand tu dors, pas quand tu scrolles.",
  ],
  // accueil : une séance à faire
  go: [
    "Ta séance t'attend. Elle va pas se faire toute seule, hein.",
    "Allez, on bouge ! Le canapé, c'est pas un programme d'entraînement.",
    "Debout ! Ta mission du jour est prête et elle a faim.",
  ],
  // accueil : tard le soir
  night: [
    "Encore debout ? Tes muscles poussent la nuit… à condition de dormir.",
  ],
  // bilan de la semaine : très bonne note (%n sur 100)
  weekGreat: [
    "Note de %n sur 100 ! Je vais devoir inventer des critiques.",
  ],
  // bilan de la semaine : note moyenne
  weekOk: [
    "Note de %n sur 100, pas mal… mais on sait tous les deux que tu peux mieux.",
  ],
  // bilan de la semaine : petite note
  weekBad: [
    "Note de %n sur 100… La semaine prochaine, on se reprend. Je te lâche pas.",
  ],
  // le coach taquin vient d'être activé
  hello: [
    "Mode taquin activé. Tu l'auras voulu.",
  ],
};

const hash = s => { let h = 5381; for (const c of String(s)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h; };
const last = {};
// Une réplique de la situation : la même toute la journée si `seed` est donné (rien ne change d'un rendu à l'autre),
// sinon au hasard, jamais deux fois de suite la même
export function pickLine(kind, seed, rnd = Math.random) {
  const list = LINES[kind];
  if (!list?.length) return "";
  let i = seed != null ? hash(`${kind}|${seed}`) % list.length : Math.floor(rnd() * list.length);
  if (seed == null && list.length > 1 && i === last[kind]) i = (i + 1) % list.length;
  last[kind] = i;
  return list[i];
}

// Remplit une réplique : accord (m, f, sinon neutre), valeurs, espaces fines de la typographie française
export function fillLine(tpl, vals = {}, sex = "") {
  const g = sex === "m" ? 0 : sex === "f" ? 1 : 2;
  const fmt = v => (typeof v === "number" ? v.toLocaleString(LOC(), { maximumFractionDigits: 1 }) : String(v ?? ""));
  const s = String(tpl).replace(/\[\[([^\]]+)\]\]/g, (_, o) => { const opts = o.split("|"); return opts[Math.min(g, opts.length - 1)]; })
    .replace(/%([nskf])/g, (_, k) => fmt(vals[k]));
  return isEn() ? s : s.replace(/ ([?!:;»])/g, " $1");
}

// La pique d'une situation dans la langue de l'app (déjà traduite : à afficher sans retraduire), "" si coupé
export function quip(kind, vals = {}, { seed, force = false } = {}) {
  if (!force && !banterOn()) return "";
  const tpl = pickLine(kind, seed);
  return tpl ? fillLine(tr(tpl), vals, state.profile?.sex) : "";
}
// { kind, vals } → la pique (ou "")
export const quipOf = (sit, opts) => (sit ? quip(sit.kind, sit.vals, opts) : "");

/* ---------- Les situations ---------- */
// Aliments « plaisir » repérés à leur nom (français ou anglais), pour une pique au moment de les noter
const JUNK = /\b(pizzas?|burgers?|hamburgers?|cheeseburgers?|big ?mac|mc ?do|kebabs?|tacos|frites|fries|chips|crisps|nuggets?|hot[- ]?dogs?|sodas?|coca|coke|pepsi|fanta|sprite|red ?bull|bonbons?|candy|candies|haribo|nutella|p[aâ]te à tartiner|glaces?|ice ?cream|g[aâ]teaux?|cakes?|cookies?|brownies?|donuts?|doughnuts?|beignets?|croissants?|pains? au chocolat|chocolatines?|viennoiseries?|gaufres?|waffles?|bi[eè]res?|beers?|vodka|whisky|rhum|cocktails?|mojitos?|raclette|fondue|tiramisu|churros|milk ?shakes?|kinder|twix|snickers)\b/i;
const LIGHT = /\b(z[ée]ro|light|sans sucres?|sugar[- ]free|diet)\b/i;
export const isJunk = name => JUNK.test(String(name || "")) && !LIGHT.test(String(name || ""));
// tard le soir (23 h → 4 h)
export const isLate = h => h >= 23 || h < 4;

// L'onglet Repas : la pique qui parle le plus, d'après la journée. eaten / target : kcal mangées / objectif du jour ;
// delta : ajustement du jour (négatif : excès des jours d'avant repris) ; junk : noms des aliments « plaisir » du jour
export function foodSituation({ goal, adapt = true, target, eaten = 0, protein = 0, proteinTarget = 0, sugar = 0,
  water = 0, waterGoal = 0, junk = [], hour = 12, delta = 0 } = {}) {
  if (!target) return null;
  const over = Math.round(eaten - target), dir = DIRECTION[goal] || "both";
  const share = (gap, half) => Math.min(Math.round(Math.min(CAP, target * 0.15) / 10) * 10, Math.max(10, Math.round(gap / (half ? 2 : 1) / SPREAD / 10) * 10));
  if (over > THRESH) {
    if (!adapt) return { kind: "overPlain", vals: { n: over } };
    if (dir === "excess") return { kind: "overCut", vals: { n: over, s: share(over) } };
    if (dir === "both") return { kind: "overForme", vals: { n: over, s: share(over, true) } };
    return { kind: "overBulk", vals: { n: over } };
  }
  if (delta < 0 && hour < 14) return { kind: "compensating", vals: { n: -delta } };
  if (junk.length) return { kind: "junk", vals: { f: junk[0] } };
  if (sugar > 60) return { kind: "sugar", vals: { n: Math.round(sugar) } };
  if (hour >= 18 && proteinTarget && protein < proteinTarget * 0.7) return { kind: "lowProtein", vals: { n: Math.round(proteinTarget - protein) } };
  if (hour >= 16 && waterGoal && water < waterGoal / 2) return { kind: "water" };
  if (hour >= 20 && target - eaten > 500) return { kind: dir === "deficit" ? "underGain" : "underCut", vals: { n: Math.round(target - eaten) } };
  if (hour >= 19 && Math.abs(over) <= THRESH && protein >= proteinTarget * 0.9) return { kind: "onTarget" };
  if (delta > 0) return { kind: "catchUp", vals: { n: delta } };
  if (delta < 0) return { kind: "compensating", vals: { n: -delta } };
  return null;
}

// Pesée : le rythme de la tendance (kg par semaine, null s'il manque des pesées) face à l'objectif
export function weightSituation(goal, rate) {
  if (rate == null || !Number.isFinite(rate)) return null;
  const want = goal === "seche" ? -1 : goal === "muscle" || goal === "force" ? 1 : 0, k = Math.round(Math.abs(rate) * 10) / 10;
  if (want < 0 && rate > 0.15) return { kind: "weightUpCut", vals: { k } };
  if (want > 0 && rate < -0.15) return { kind: "weightDownBulk", vals: { k } };
  if (want && rate * want > 0.1) return { kind: "weightGood" };
  return null;
}

// Fin de séance : records, arrêtée tôt, très courte ou très longue
export function endSituation({ prs = 0, minutes = 0, done = 0, planned = 0 } = {}) {
  if (prs) return { kind: "endPr" };
  if (planned >= 4 && done < planned * 0.6) return { kind: "endEarly" };
  if (minutes < 20) return { kind: "endShort", vals: { n: Math.max(1, Math.round(minutes)) } };
  if (minutes > 100) return { kind: "endLong", vals: { n: Math.round(minutes) } };
  return { kind: "endGood" };
}

// Accueil : tard le soir, séance faite, retour après plusieurs jours, série de jours, repos, séance à faire
export function homeSituation({ doneToday = false, rest = false, daysOff = 0, streak = 0, hour = 12 } = {}) {
  if (isLate(hour)) return { kind: "night" };
  if (doneToday) return { kind: "doneToday" };
  if (daysOff >= 3) return { kind: "comeback", vals: { n: daysOff } };
  if (streak >= 3) return { kind: "streak", vals: { n: streak } };
  return { kind: rest ? "restDay" : "go" };
}

// Bilan de forme avant la séance (1 à 5 : sommeil, énergie ; courbatures de 1 « aucune » à 5 « partout »)
export function checkinSituation({ sleep = 3, energy = 3, soreness = 2 } = {}) {
  if (sleep <= 2) return { kind: "checkinSleep" };
  if (soreness >= 4) return { kind: "checkinSore" };
  if (energy <= 2) return { kind: "checkinTired" };
  if (sleep >= 4 && energy >= 4) return { kind: "checkinGreat" };
  return null;
}

// Bilan de la semaine (note sur 100)
export const weekSituation = score => ({ kind: score >= 85 ? "weekGreat" : score >= 60 ? "weekOk" : "weekBad", vals: { n: score } });

// Pour le coach IA : le ton demandé
export const banterStyle = () => (banterOn()
  ? "Ton demandé par l'utilisateur : familier et taquin. Tutoie-le, glisse de petites piques drôles et bienveillantes sur ses choix (repas, calories, séances manquées, repos qui s'éternisent), comme un pote coach. Jamais d'insulte ni de moquerie sur son corps ou son poids, aucune blague sur une douleur ou une blessure, et s'il mange trop peu, pousse-le à manger."
  : "");
