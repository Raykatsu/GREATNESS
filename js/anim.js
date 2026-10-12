// Petit bonhomme animé qui montre le mouvement de chaque exercice.
import { EXERCISES } from "./data.js";
import { PATTERNS, patternOf } from "./motion.js";

const LIMBS = [["h", "n"], ["n", "p"], ["s", "e"], ["e", "w"], ["p", "k"], ["k", "f"], ["p", "k2"], ["k2", "f2"]];
const ease = t => 0.5 - Math.cos(t * Math.PI) / 2;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Renvoie le SVG (vide) ; mountAnims() l'anime ensuite.
export function animSvg(id, cls = "") {
  return `<svg class="ex-anim ${cls}" data-anim="${id}" viewBox="0 0 100 100" aria-label="Animation ${PATTERNS[patternOf(id)].name}"></svg>`;
}

function frame(pat, equip, t) {
  const a = pat.a, b = pat.b, pt = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const pa = a[k] || b[k], pb = b[k] || a[k];
    pt[k] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
  }
  const line = (p, q, c = "") => `<line class="${c}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`;
  let props = "";
  if (pat.bench) props += line(pat.bench[0], pat.bench[1], "prop");
  if (pat.bars) props += line(pat.bars[0], pat.bars[1], "prop");
  const w = pt.w;
  if (equip === "bar" || equip === "smith") props += `<line class="bar" x1="${w[0] - 14}" y1="${w[1]}" x2="${w[0] + 14}" y2="${w[1]}"/><circle class="plate" cx="${w[0] - 12}" cy="${w[1]}" r="5"/><circle class="plate" cx="${w[0] + 12}" cy="${w[1]}" r="5"/>`;
  else if (equip === "db" || equip === "kb") props += `<circle class="plate" cx="${w[0]}" cy="${w[1]}" r="3.6"/>`;
  else if (equip === "cable" || equip === "band") props += line(w, [pat.joint === "elbow" && w[1] < 40 ? w[0] : 92, w[1] < 40 ? 0 : 90], "cable");
  const limbs = LIMBS.filter(([p, q]) => pt[p] && pt[q]).map(([p, q]) => line(pt[p], pt[q])).join("");
  return `<line class="floor" x1="4" y1="93" x2="96" y2="93"/>${props}<g class="body">${limbs}</g><circle class="head" cx="${pt.h[0]}" cy="${pt.h[1]}" r="6"/>`;
}

let raf = null;
export function mountAnims(root = document) {
  const els = [...root.querySelectorAll("svg[data-anim]")];
  if (!els.length) return;
  for (const el of els) {
    const id = el.dataset.anim;
    el._pat = PATTERNS[patternOf(id)];
    el._equip = EXERCISES[id]?.equip;
    el.innerHTML = frame(el._pat, el._equip, 0);
  }
  if (reduced() || raf) return;
  const loop = now => {
    const live = [...document.querySelectorAll("svg[data-anim]")];
    if (!live.length) { raf = null; return; }
    // aller 1 s, pause, retour 1 s, pause : ~2,4 s
    const c = (now % 2400) / 2400;
    const t = c < 0.42 ? ease(c / 0.42) : c < 0.5 ? 1 : c < 0.92 ? 1 - ease((c - 0.5) / 0.42) : 0;
    for (const el of live) if (el._pat) el.innerHTML = frame(el._pat, el._equip, t);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
