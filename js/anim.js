// Petites démos animées (mur des records…) : le même corps dessiné que la démo en grand (body.js).
// Le SVG est construit une seule fois ; chaque image ne fait que mettre à jour des attributs,
// et seules les animations visibles à l'écran tournent.
import { EXERCISES } from "./data.js";
import { figure } from "./body.js";
import { moveOf, fastOf } from "./moves.js";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const attr = s => String(s).replace(/[&"<>]/g, c => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);

// Renvoie le SVG (vide) ; mountAnims() le dessine et l'anime ensuite.
export function animSvg(id, cls = "") {
  return `<svg class="ex-anim ${cls}" data-anim="${attr(id)}" viewBox="0 0 100 100" role="img" aria-label="Démo : ${attr(EXERCISES[id]?.name || id)}"></svg>`;
}

// Durée d'un cycle (ms) et position du mouvement à l'instant c (0 → 1) :
// aller, pause, retour, pause ; ou en boucle pour la course, les sauts, la marche…
// Tempo d'une vraie répétition : la phase d'effort (fast : « go » ou « back ») est plus rapide que la phase freinée,
// et chaque phase démarre et s'arrête en douceur (courbes de body.js). [fin de l'aller, fin de la pause, fin du retour]
export const cycleOf = (move, base = 2400) => (move.loop ? move.dur || 1600 : base);
const TEMPO = { go: [0.3, 0.42, 0.88], back: [0.44, 0.52, 0.82], none: [0.36, 0.6, 0.94] };
export const tempoOf = fast => TEMPO[fast] || TEMPO.none;
export function phaseAt(move, c, fast) {
  if (move.loop) return c;
  const [a, b, d] = tempoOf(fast);
  return c < a ? c / a : c < b ? 1 : c < d ? 1 - (c - b) / (d - b) : 0;
}
// Étape de la répétition à l'instant c : aller, pause, retour, position de départ
export function stageAt(c, fast) {
  const [a, b, d] = tempoOf(fast);
  return c < a ? "go" : c < b ? "hold" : c < d ? "back" : "start";
}

const visible = new Set();
let raf = null, io = null;
function loop(now) {
  for (const svg of visible) if (!svg.isConnected) visible.delete(svg);
  if (!visible.size || document.hidden) { raf = null; return; }
  for (const svg of visible) { const cyc = cycleOf(svg._move); svg._draw(phaseAt(svg._move, (now % cyc) / cyc, svg._fast)); }
  raf = requestAnimationFrame(loop);
}
const kick = () => { if (!raf && visible.size && !document.hidden) raf = requestAnimationFrame(loop); };
if (typeof document !== "undefined") document.addEventListener("visibilitychange", kick);

export function mountAnims(root = document) {
  const els = [...root.querySelectorAll("svg[data-anim]")].filter(s => !s._draw);
  if (!els.length) return;
  for (const svg of els) {
    svg._move = moveOf(svg.dataset.anim);
    svg._fast = fastOf(svg.dataset.anim);
    svg._draw = figure(svg, svg._move);
    svg._draw(svg._move.loop ? 0.25 : 0.5);
  }
  if (reduced()) return;
  if (typeof IntersectionObserver !== "function") { els.forEach(s => visible.add(s)); kick(); return; }
  io ||= new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting && e.target.isConnected) visible.add(e.target);
      else { visible.delete(e.target); if (!e.target.isConnected) io.unobserve(e.target); }
    }
    kick();
  });
  els.forEach(s => io.observe(s));
}
