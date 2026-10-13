// Petites démos animées (mur des records…) : le même corps dessiné que la démo en grand (body.js).
// Le SVG est construit une seule fois ; chaque image ne fait que mettre à jour des attributs,
// et seules les animations visibles à l'écran tournent.
import { EXERCISES } from "./data.js";
import { figure } from "./body.js";
import { moveOf } from "./moves.js";

const ease = t => 0.5 - Math.cos(t * Math.PI) / 2;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const attr = s => String(s).replace(/[&"<>]/g, c => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);

// Renvoie le SVG (vide) ; mountAnims() le dessine et l'anime ensuite.
export function animSvg(id, cls = "") {
  return `<svg class="ex-anim ${cls}" data-anim="${attr(id)}" viewBox="0 0 100 100" role="img" aria-label="Démo : ${attr(EXERCISES[id]?.name || id)}"></svg>`;
}

// Durée d'un cycle (ms) et position du mouvement à l'instant c (0 → 1) :
// aller, pause, retour, pause ; ou en boucle pour la course, les sauts, la marche…
export const cycleOf = (move, base = 2400) => (move.loop ? move.dur || 1600 : base);
export function phaseAt(move, c) {
  if (move.loop) return c;
  return c < 0.42 ? ease(c / 0.42) : c < 0.5 ? 1 : c < 0.92 ? 1 - ease((c - 0.5) / 0.42) : 0;
}

const visible = new Set();
let raf = null, io = null;
function loop(now) {
  for (const svg of visible) if (!svg.isConnected) visible.delete(svg);
  if (!visible.size || document.hidden) { raf = null; return; }
  for (const svg of visible) { const cyc = cycleOf(svg._move); svg._draw(phaseAt(svg._move, (now % cyc) / cyc)); }
  raf = requestAnimationFrame(loop);
}
const kick = () => { if (!raf && visible.size && !document.hidden) raf = requestAnimationFrame(loop); };
if (typeof document !== "undefined") document.addEventListener("visibilitychange", kick);

export function mountAnims(root = document) {
  const els = [...root.querySelectorAll("svg[data-anim]")].filter(s => !s._draw);
  if (!els.length) return;
  for (const svg of els) {
    svg._move = moveOf(svg.dataset.anim);
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
