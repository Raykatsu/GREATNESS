// Petit bonhomme animé qui montre le mouvement de chaque exercice.
// Le SVG est construit une seule fois ; chaque image ne fait que mettre à jour des attributs,
// et seules les animations visibles à l'écran tournent.
import { EXERCISES } from "./data.js";
import { PATTERNS, patternOf } from "./motion.js";

const NS = "http://www.w3.org/2000/svg";
const LIMBS = [["h", "n"], ["n", "p"], ["s", "e"], ["e", "w"], ["p", "k"], ["k", "f"], ["p", "k2"], ["k2", "f2"]];
const ease = t => 0.5 - Math.cos(t * Math.PI) / 2;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Renvoie le SVG (vide) ; mountAnims() l'anime ensuite.
export function animSvg(id, cls = "") {
  return `<svg class="ex-anim ${cls}" data-anim="${id}" viewBox="0 0 100 100" role="img" aria-label="Animation ${PATTERNS[patternOf(id)].name}"></svg>`;
}

const el = (tag, cls, parent) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute("class", cls); parent.appendChild(n); return n; };
const f2 = v => Math.round(v * 100) / 100;
const setLine = (l, p, q) => { l.setAttribute("x1", f2(p[0])); l.setAttribute("y1", f2(p[1])); l.setAttribute("x2", f2(q[0])); l.setAttribute("y2", f2(q[1])); };
const setDot = (c, x, y) => { c.setAttribute("cx", f2(x)); c.setAttribute("cy", f2(y)); };

function points(pat, t) {
  const a = pat.a, b = pat.b, pt = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const pa = a[k] || b[k], pb = b[k] || a[k];
    pt[k] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
  }
  return pt;
}

// Segments mis en couleur dans la démo : ceux qui travaillent (selon l'articulation suivie)
const FOCUS = { knee: ["p-k", "k-f", "p-k2", "k2-f2"], hip: ["n-p", "p-k"], elbow: ["s-e", "e-w"], shoulder: ["s-e", "e-w"] };

// Construit les éléments une fois et renvoie une fonction qui pose une image (t de 0 à 1).
export function build(svg, pat, equip, { focus = false } = {}) {
  svg.textContent = "";
  const pt0 = points(pat, 0);
  setLine(el("line", "floor", svg), [4, 93], [96, 93]);
  if (pat.bench) setLine(el("line", "prop", svg), pat.bench[0], pat.bench[1]);
  if (pat.bars) setLine(el("line", "prop", svg), pat.bars[0], pat.bars[1]);
  let bar = null, plates = [], cable = null;
  if (equip === "bar" || equip === "smith") { bar = el("line", "bar", svg); plates = [el("circle", "plate", svg), el("circle", "plate", svg)]; plates.forEach(p => p.setAttribute("r", 5)); }
  else if (equip === "db" || equip === "kb") { plates = [el("circle", "plate", svg)]; plates[0].setAttribute("r", 3.6); }
  else if (equip === "cable" || equip === "band") cable = el("line", "cable", svg);
  const g = el("g", "body", svg);
  const hot = new Set(focus ? FOCUS[pat.joint] || [] : []);
  const limbs = LIMBS.filter(([p, q]) => pt0[p] && pt0[q]).map(pair => [pair, el("line", hot.has(pair.join("-")) ? "hot" : "", g)]);
  const head = el("circle", "head", svg); head.setAttribute("r", 6);
  return t => {
    const pt = points(pat, t), w = pt.w;
    if (bar) { setLine(bar, [w[0] - 14, w[1]], [w[0] + 14, w[1]]); setDot(plates[0], w[0] - 12, w[1]); setDot(plates[1], w[0] + 12, w[1]); }
    else if (plates.length) setDot(plates[0], w[0], w[1]);
    else if (cable) setLine(cable, w, [pat.joint === "elbow" && w[1] < 40 ? w[0] : 92, w[1] < 40 ? 0 : 90]);
    for (const [[p, q], l] of limbs) setLine(l, pt[p], pt[q]);
    setDot(head, pt.h[0], pt.h[1]);
  };
}

const visible = new Set();
let raf = null, io = null;
function loop(now) {
  for (const svg of visible) if (!svg.isConnected) visible.delete(svg);
  if (!visible.size || document.hidden) { raf = null; return; }
  // aller 1 s, pause, retour 1 s, pause : ~2,4 s
  const c = (now % 2400) / 2400;
  const t = c < 0.42 ? ease(c / 0.42) : c < 0.5 ? 1 : c < 0.92 ? 1 - ease((c - 0.5) / 0.42) : 0;
  for (const svg of visible) svg._draw(t);
  raf = requestAnimationFrame(loop);
}
const kick = () => { if (!raf && visible.size && !document.hidden) raf = requestAnimationFrame(loop); };
if (typeof document !== "undefined") document.addEventListener("visibilitychange", kick);

export function mountAnims(root = document) {
  const els = [...root.querySelectorAll("svg[data-anim]")].filter(s => !s._draw);
  if (!els.length) return;
  for (const svg of els) {
    const id = svg.dataset.anim;
    svg._draw = build(svg, PATTERNS[patternOf(id)], EXERCISES[id]?.equip);
    svg._draw(0);
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
