// Biomécanique : pour chaque mouvement, le rôle de chaque muscle (agoniste, antagoniste, synergiste, stabilisateur)
// et une explication « comment ça marche ». L'agoniste et les synergistes viennent des muscles de la démo (p / s) ;
// on ajoute ici l'antagoniste (qui s'étire et freine) et les stabilisateurs (qui gainent), par type de mouvement.
import { EXERCISES } from "./data.js";
import { patternOf } from "./motion.js";
import { moveOf } from "./moves.js";

// Par pattern : anta (antagonistes), stab (stabilisateurs), how (la mécanique en une phrase).
const BIOMECH = {
  press_h: { anta: ["lats", "biceps"], stab: ["abs", "forearms"], how: "Poussée horizontale : à la montée (concentrique) les pectoraux rapprochent les bras et les triceps tendent les coudes ; à la descente (excentrique) tu freines la charge, pectoraux étirés." },
  press_v: { anta: ["lats"], stab: ["abs", "lowerback"], how: "Poussée au-dessus de la tête : les épaules lèvent la charge et les triceps tendent les coudes ; le gainage empêche de cambrer le dos." },
  pushup: { anta: ["lats", "biceps"], stab: ["abs", "lowerback", "glutes"], how: "Pompe : la même poussée que le développé, mais c'est ton corps la charge ; le gainage garde le corps en planche." },
  dips: { anta: ["lats", "biceps"], stab: ["abs"], how: "Tu pousses ton corps vers le haut : pectoraux et triceps travaillent ; penché en avant pour plus de pectoraux, droit pour plus de triceps." },
  fly: { anta: ["lats"], stab: ["delts", "forearms"], how: "Écartés : bras presque tendus et coudes fixes ; seuls les pectoraux rapprochent les mains (adduction de l'épaule)." },
  pull_v: { anta: ["pecs", "delts"], stab: ["abs"], how: "Tirage vertical : les dorsaux ramènent les bras vers le bas (c'est le dos qui mène, pas les bras) ; les biceps fléchissent les coudes." },
  row: { anta: ["pecs"], stab: ["lowerback", "abs"], how: "Tirage horizontal : les dorsaux tirent les coudes vers l'arrière, omoplates serrées ; le bas du dos tient la posture." },
  shrug: { anta: [], stab: ["forearms"], how: "Haussement d'épaules : les trapèzes élèvent les épaules à la verticale, sans rouler." },
  curl: { anta: ["triceps"], stab: ["abs"], how: "Flexion du coude : le biceps se raccourcit en montant (concentrique) ; à la descente le triceps étiré contrôle la charge (excentrique). Coude fixe." },
  tri_ext: { anta: ["biceps"], stab: ["abs"], how: "Extension du coude : le triceps tend le bras ; le coude reste en place, seul l'avant-bras bouge." },
  raise: { anta: ["lats"], stab: ["traps", "abs"], how: "Élévations : les deltoïdes lèvent les bras ; monte sans élan, à hauteur d'épaule." },
  squat: { anta: ["hipflex"], stab: ["abs", "lowerback"], how: "Flexion puis extension des hanches et des genoux : à la descente quadriceps et fessiers freinent (excentrique), à la remontée ils poussent (concentrique) ; le gainage protège le dos." },
  hinge: { anta: ["hipflex"], stab: ["abs", "lowerback"], how: "Charnière de hanche : le bassin part en arrière, fessiers et ischios s'étirent puis tirent le buste à la verticale ; dos gainé et plat." },
  lunge: { anta: ["hipflex"], stab: ["abs", "abductors"], how: "Fente : la jambe avant (quadriceps, fessier) encaisse puis pousse ; l'équilibre vient des muscles de la hanche." },
  legext: { anta: ["hams"], stab: ["abs"], how: "Extension du genou, assis : le quadriceps tend la jambe ; mouvement isolé, sans à-coup en haut." },
  legcurl: { anta: ["quads"], stab: ["glutes"], how: "Flexion du genou : les ischio-jambiers ramènent le talon vers les fessiers ; contrôle la descente." },
  bridge: { anta: ["hipflex"], stab: ["abs", "lowerback"], how: "Extension de hanche : les fessiers poussent le bassin vers le haut et serrent en fin de mouvement ; c'est la hanche qui monte, pas le bas du dos." },
  calf: { anta: [], stab: [], how: "Extension de la cheville : tu montes sur la pointe des pieds (mollets), grande amplitude, pause en haut." },
  crunch: { anta: ["lowerback"], stab: [], how: "Flexion du tronc : les abdominaux enroulent les côtes vers le bassin ; c'est court, sans tirer sur la nuque." },
  plank: { anta: [], stab: ["glutes", "obliques"], how: "Gainage : les muscles du tronc tiennent sans bouger (isométrique) pour garder le corps droit ; tout l'intérêt est de ne pas bouger." },
};

const uniq = (arr, taken) => arr.filter((m, i) => arr.indexOf(m) === i && !taken.has(m));

// Les 4 rôles d'un exercice (ou null si ce n'est pas un mouvement de force : étirement, cardio…)
export function roles(exId) {
  const b = BIOMECH[patternOf(exId)];
  if (!b) return null;
  const mus = moveOf(exId).mus || {};
  const agonist = (mus.p || []).slice();
  const taken = new Set(agonist);
  const synergist = uniq(mus.s || [], taken);
  synergist.forEach(m => taken.add(m));
  const antagonist = uniq(b.anta, taken);
  antagonist.forEach(m => taken.add(m));
  const stabil = uniq(b.stab, taken);
  return { agonist, synergist, antagonist, stabil, how: b.how };
}

// Classe de couleur d'un muscle selon son rôle (pour la planche d'anatomie)
export function roleClass(r) {
  const a = new Set(r.agonist), sy = new Set(r.synergist), an = new Set(r.antagonist), st = new Set(r.stabil);
  return m => (a.has(m) ? "mus p" : sy.has(m) ? "mus s" : st.has(m) ? "mus st" : an.has(m) ? "mus an" : "mz");
}

// Activation de l'agoniste au fil du mouvement (0 → 1) : forte à l'effort, plus basse au retour.
// c : avancement du cycle (0 → 1) ; stage : "go" (effort) / "hold" / "back" (retour) / "start".
export function activation(stage, p, loop, c) {
  if (loop) return 0.45 + 0.55 * Math.abs(Math.sin(c * Math.PI * 2));
  return stage === "hold" ? 1 : stage === "go" ? 0.55 + 0.45 * p : stage === "back" ? 0.35 + 0.3 * (1 - p) : 0.3;
}
