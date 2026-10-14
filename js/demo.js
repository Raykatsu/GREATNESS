// Démonstration d'un exercice pour les débutants, à la demande (petit bouton ▶) : animation en grand,
// étape en cours écrite en direct, ralenti, mise en place, respiration, points clés et erreurs à éviter.
import { EXERCISES, EQUIP } from "./data.js";
import { patternOf } from "./motion.js";
import { figure, bodyMap, muscleNames } from "./body.js";
import { moveOf, sayOf, viewLabel, effortOf, fastOf } from "./moves.js";
import { phaseAt, stageAt } from "./anim.js";
import { camFor, openCam } from "./cam.js";
import { openVideoCoach, VIDEO } from "./videocoach.js";
import { $, $$, esc, I, sheet } from "./ui.js";

// Pour chaque type de mouvement. Le mouvement va de la position A à la position B (« go ») puis revient (« back ») ;
// la phase où l'on pousse ou tire (on souffle) vient de effortOf (moves.js).
const GUIDE = {
  squat: { setup: "Pieds largeur d'épaules, pointes légèrement ouvertes, abdos serrés.", go: "Descends en poussant les hanches en arrière, genoux dans l'axe des pieds.", back: "Remonte en poussant fort dans le sol, buste droit.",
    mistakes: ["Genoux qui rentrent vers l'intérieur", "Talons qui décollent du sol", "Dos qui s'arrondit en bas"] },
  lunge: { setup: "Debout, pieds largeur de hanches, regard devant toi.", go: "Fais un grand pas et descends jusqu'à frôler le sol avec le genou arrière.", back: "Pousse sur le talon avant pour revenir.",
    mistakes: ["Genou avant qui part vers l'intérieur", "Buste trop penché en avant", "Pas trop court"] },
  legext: { setup: "Assis, dos contre le dossier, rouleau sur le bas des tibias.", go: "Tends les jambes jusqu'en haut, sans à-coup.", back: "Redescends lentement en contrôlant.",
    mistakes: ["Lancer la charge avec de l'élan", "Fesses qui décollent du siège"] },
  legcurl: { setup: "Rouleau juste au-dessus des talons, hanches bien collées au banc.", go: "Ramène les talons vers les fesses.", back: "Allonge les jambes lentement.",
    mistakes: ["Hanches qui se soulèvent", "Redescendre trop vite"] },
  hinge: { setup: "Pieds largeur de hanches, charge près des jambes, dos plat, épaules au-dessus de la barre.", go: "Penche le buste en poussant les fesses loin derrière, dos bien plat.", back: "Remonte en serrant les fessiers, hanches vers l'avant.",
    mistakes: ["Dos rond : le plus dangereux", "Charge qui s'éloigne des jambes", "Se cambrer en haut"] },
  bridge: { setup: "Haut du dos sur le banc (ou au sol), pieds à plat, tibias verticaux en haut.", go: "Monte les hanches jusqu'à aligner genoux, hanches et épaules.", back: "Redescends sans relâcher complètement.",
    mistakes: ["Cambrer le bas du dos au lieu de serrer les fessiers", "Pieds trop loin ou trop près"] },
  press_h: { setup: "Allongé, yeux sous la barre, omoplates serrées, pieds bien ancrés au sol.", go: "Descends la barre jusqu'au bas des pectoraux, coudes à environ 45°.", back: "Pousse la barre vers le haut.",
    mistakes: ["Coudes trop écartés : les épaules souffrent", "Fesses qui décollent du banc", "Barre qui rebondit sur la poitrine"] },
  pushup: { setup: "Mains un peu plus larges que les épaules, corps gainé de la tête aux pieds.", go: "Descends la poitrine près du sol, coudes vers l'arrière.", back: "Repousse le sol en gardant le corps bien droit.",
    mistakes: ["Hanches qui s'affaissent", "Fesses trop hautes", "Descente incomplète"] },
  dips: { setup: "Bras tendus sur les barres, épaules basses, buste légèrement penché.", go: "Descends jusqu'à ce que les bras forment un angle droit.", back: "Pousse pour remonter, sans verrouiller brutalement.",
    mistakes: ["Descendre trop bas : les épaules souffrent", "Épaules qui remontent vers les oreilles"] },
  press_v: { setup: "Charge à hauteur d'épaules, abdos et fessiers serrés.", go: "Pousse au-dessus de la tête, à la verticale.", back: "Redescends sous contrôle jusqu'aux épaules.",
    mistakes: ["Se cambrer en poussant", "Pousser devant soi au lieu de vers le haut"] },
  raise: { setup: "Debout, charges le long du corps, coudes légèrement fléchis.", go: "Monte les bras sur les côtés jusqu'à hauteur d'épaules.", back: "Redescends lentement.",
    mistakes: ["Prendre de l'élan avec le buste", "Monter plus haut que les épaules", "Hausser les épaules"] },
  fly: { setup: "Bras tendus devant la poitrine, coudes légèrement fléchis.", go: "Ouvre les bras en arc de cercle jusqu'à sentir l'étirement.", back: "Referme comme pour enlacer un arbre.",
    mistakes: ["Bras complètement tendus : les coudes souffrent", "Ouvrir trop loin"] },
  pull_v: { setup: "Mains un peu plus larges que les épaules, bras tendus, épaules basses.", go: "Tire en ramenant les coudes vers les côtes, poitrine vers la barre.", back: "Redescends lentement jusqu'aux bras tendus.",
    mistakes: ["Se balancer", "Amplitude incomplète", "Épaules qui remontent vers les oreilles"] },
  row: { setup: "Buste penché à environ 45°, dos plat, bras tendus.", go: "Tire vers le nombril en serrant les omoplates.", back: "Allonge les bras sous contrôle.",
    mistakes: ["Dos qui s'arrondit", "Tirer seulement avec les bras", "Se redresser pour tricher"] },
  curl: { setup: "Debout, coudes collés au corps, paumes vers l'avant.", go: "Plie les coudes pour monter la charge vers les épaules.", back: "Redescends lentement jusqu'aux bras presque tendus.",
    mistakes: ["Coudes qui avancent", "Balancer le buste", "Redescendre trop vite"] },
  tri_ext: { setup: "Coudes collés au corps, ils ne bougent pas.", go: "Tends les bras en gardant les coudes fixes.", back: "Reviens doucement jusqu'à l'angle droit.",
    mistakes: ["Coudes qui s'écartent", "Pousser avec le poids du corps"] },
  shrug: { setup: "Debout, charges le long du corps, bras tendus.", go: "Monte les épaules vers les oreilles.", back: "Redescends lentement.",
    mistakes: ["Rouler les épaules", "Plier les bras"] },
  calf: { setup: "Avant des pieds sur une marche, talons dans le vide.", go: "Monte sur la pointe des pieds le plus haut possible.", back: "Redescends lentement sous la marche.",
    mistakes: ["Rebondir en bas", "Amplitude trop courte"] },
  crunch: { setup: "Allongé, genoux pliés, mains sur les tempes sans tirer.", go: "Enroule le haut du dos en rapprochant les côtes du bassin.", back: "Redescends sans relâcher complètement.",
    mistakes: ["Tirer sur la nuque", "Utiliser l'élan"] },
  plank: { setup: "En appui sur les avant-bras, coudes sous les épaules.", go: "Tiens la position : corps droit de la tête aux talons.", back: "Respire calmement sans bouger.",
    mistakes: ["Hanches qui tombent", "Fesses trop hautes", "Bloquer sa respiration"] },
  cardio: { setup: "Debout, sur l'avant des pieds, bras relâchés.", go: "Saute en écartant bras et jambes.", back: "Reviens en position de départ.",
    mistakes: ["Atterrir sur les talons", "Partir trop vite et s'épuiser"] },
  stretch: { setup: "Mets-toi en place sans forcer.", go: "Va doucement vers l'étirement, jusqu'à une tension agréable.", back: "Reviens lentement.",
    mistakes: ["Forcer jusqu'à la douleur", "Faire des à-coups"] },
};
const fallback = GUIDE.stretch;

// Consignes du type de mouvement, précisées pour l'exercice (moves.js)
export const guideOf = id => ({ ...(GUIDE[patternOf(id)] || fallback), ...sayOf(id), effort: effortOf(id) });

// Respiration : on souffle pendant l'effort
function breathing(g, id) {
  if (g.steps) return patternOf(id) === "cardio" ? "Respire en rythme, sans bloquer : souffle fort quand l'effort monte." : "Respire calmement et régulièrement, sans bloquer.";
  if (!g.effort) return patternOf(id) === "stretch" ? "Respire lentement ; expire en allant un peu plus loin." : "Respire calmement et régulièrement, sans bloquer.";
  return g.effort === "go" ? "Souffle pendant que tu pousses ou tires (étape 1), inspire en revenant (étape 2)." : "Inspire en descendant (étape 1), souffle en remontant (étape 2).";
}
const names = ids => esc(muscleNames(ids).join(", "));
// Analyse vidéo : exercices de force et au poids du corps (pas le cardio ni les étirements)
const videoFor = ex => !["cardio", "stretch"].includes(patternOf(ex.id)) && ex.muscle !== "Cardio" && ex.muscle !== "Mobilité";

// Petit bouton à placer à côté d'un exercice
export const demoBtn = (id, cls = "") => (EXERCISES[id] && !EXERCISES[id].custom
  ? `<button type="button" class="demo-btn ${cls}" data-demo="${esc(id)}" aria-label="Voir la démo : ${esc(EXERCISES[id].name)}">${I.play}<span>Démo</span></button>` : "");

// Un seul écouteur pour tous les boutons Démo de la page (et des feuilles)
let wired = false;
export function wireDemos() {
  if (wired || typeof document === "undefined") return;
  wired = true;
  document.addEventListener("click", e => {
    const b = e.target.closest?.("[data-demo]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    openDemo(b.dataset.demo);
  }, true);
}

export function openDemo(id) {
  const ex = EXERCISES[id];
  if (!ex) return;
  const move = moveOf(id), g = guideOf(id), fast = fastOf(id), view = viewLabel(move), mus = move.mus || {};
  // étapes : aller (1) et retour (2), ou les phases d'un mouvement en boucle (course, sauts…)
  const steps = move.loop ? (g.steps || [[0, g.go]]).map(([at, t], i) => [String(i), t, at]) : [["go", g.go], ["back", g.back]];
  const sh = sheet(`<div class="demo">
    <div class="demo-stage"><svg class="demo-anim" role="img" aria-label="Démo animée : ${esc(ex.name)}"></svg>
      ${view ? `<span class="demo-view">${esc(view)}</span>` : ""}
      <div class="demo-phase" aria-live="polite"></div></div>
    <div class="demo-ctrl"><button class="icon-btn" id="dm-play" aria-label="Pause">${PAUSE}</button>
      <div class="seg" id="dm-speed" style="--n:2"><button data-s="0.5">Ralenti</button><button data-s="1" class="on">Normal</button></div></div>
    <div class="eyebrow mt">${esc(ex.muscle)} · ${esc(EQUIP[ex.equip] || "")}</div>
    <h2 class="h2" style="margin-top:2px">${esc(ex.name)}</h2>
    ${mus.p?.length ? `<div class="demo-mus">${bodyMap(mus)}<div class="dm-leg">
      <div><i class="lg p"></i><span><b>Travaille surtout</b>${names(mus.p)}</span></div>
      ${mus.s?.length ? `<div><i class="lg s"></i><span><b>Aide aussi</b>${names(mus.s)}</span></div>` : ""}</div></div>` : ""}
    ${camFor({ ...ex, id }) ? `<button class="demo-cam" id="dm-cam">${I.camera}<span><b>Vérifier ma technique</b><small>La caméra corrige ta posture en direct</small></span>${I.chev}</button>` : ""}
    ${videoFor({ ...ex, id }) ? `<button class="demo-cam" id="dm-video">${VIDEO}<span><b>Analyse vidéo par l'IA</b><small>Filme une série : l'IA te dit quoi corriger, image à l'appui</small></span>${I.chev}</button>` : ""}
    <h3 class="demo-h">Mise en place</h3><p>${esc(g.setup)}</p>
    <h3 class="demo-h">Le mouvement</h3>
    <ol class="demo-steps">${steps.map(([k, t], i) => `<li data-step="${k}"><span class="tnum">${i + 1}</span>${esc(t)}</li>`).join("")}</ol>
    <h3 class="demo-h">Respiration</h3><p>${esc(breathing(g, id))}</p>
    ${ex.cues?.length ? `<h3 class="demo-h">Les points clés</h3><ul class="demo-list ok">${ex.cues.map(c => `<li>${I.check}${esc(c)}</li>`).join("")}</ul>` : ""}
    <h3 class="demo-h">Erreurs à éviter</h3><ul class="demo-list ko">${g.mistakes.map(c => `<li>${I.x}${esc(c)}</li>`).join("")}</ul>
    ${ex.alts?.length ? `<p class="small muted mt">Variante plus simple ou sans le matériel : ${ex.alts.filter(a => EXERCISES[a]).map(a => `<button class="link" data-demo="${esc(a)}">${esc(EXERCISES[a].name)}</button>`).join(", ")}.</p>` : ""}
    <p class="xs muted mt">Commence léger : la technique d'abord, la charge ensuite.</p>
  </div>`, { z: 85, onClose: () => { closed = true; cancelAnimationFrame(raf); } });
  const svgEl = $(".demo-anim", sh.el), phase = $(".demo-phase", sh.el);
  const draw = figure(svgEl, move, { big: true });
  // un aller-retour en 3,2 s (6,4 s au ralenti) ; une boucle un peu plus lente que dans les vignettes
  const cyc = move.loop ? (move.dur || 1600) * 1.25 : 3200;
  let closed = false, raf = 0, speed = 1, playing = true, t0 = performance.now(), offset = 0, lastLabel = "";
  const label = (c, p) => {
    if (move.loop) { let i = 0; while (i < steps.length - 1 && p >= steps[i + 1][2]) i++; return [steps[i][0], steps.length > 1 ? `${i + 1} · ${steps[i][1]}` : steps[i][1]]; }
    const st = stageAt(c, fast);
    return st === "go" ? ["go", `1 · ${g.go}`] : st === "hold" ? ["hold", g.effort ? "Pause" : "Tiens la position"] : st === "back" ? ["back", `2 · ${g.back}`] : ["start", "Position de départ"];
  };
  const frame = now => {
    if (closed || !sh.el.isConnected) return;
    const c = ((offset + (playing ? (now - t0) : 0) * speed) % cyc) / cyc, p = phaseAt(move, c, fast);
    draw(p);
    const [k, txt] = label(c, p);
    if (txt !== lastLabel) {
      lastLabel = txt;
      phase.textContent = txt;
      $$(".demo-steps li", sh.el).forEach(li => li.classList.toggle("on", li.dataset.step === k));
    }
    if (playing) raf = requestAnimationFrame(frame);
  };
  const reduced = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const setPlaying = on => {
    const now = performance.now();
    if (!on) offset += (now - t0) * speed; else t0 = now;
    playing = on;
    $("#dm-play", sh.el).innerHTML = on ? PAUSE : I.play;
    $("#dm-play", sh.el).setAttribute("aria-label", on ? "Pause" : "Lecture");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };
  $("#dm-play", sh.el).onclick = () => setPlaying(!playing);
  $("#dm-cam", sh.el)?.addEventListener("click", () => { setPlaying(false); openCam({ ...ex, id }, { practice: true }); });
  $("#dm-video", sh.el)?.addEventListener("click", () => { setPlaying(false); openVideoCoach({ ...ex, id }); });
  $$("#dm-speed button", sh.el).forEach(b => b.onclick = () => {
    const now = performance.now();
    offset += (now - t0) * speed; t0 = now; speed = +b.dataset.s;
    $$("#dm-speed button", sh.el).forEach(x => x.classList.toggle("on", x === b));
  });
  if (reduced) { playing = false; offset = 0.3 * cyc; $("#dm-play", sh.el).innerHTML = I.play; }
  raf = requestAnimationFrame(frame);
}

const PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>`;
