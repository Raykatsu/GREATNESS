// Petits outils d'interface partagés.
import { coachFace } from "./chars/index.js";
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Texte riche minimal : **gras** et retours à la ligne.
export const md = s => esc(s)
  .replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")                       // titres
  .replace(/^\s*[*-]\s+/gm, "• ")                                   // listes
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")                            // gras
  .replace(/(^|[\s(«])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?:;»]|$)/gm, "$1<i>$2</i>") // italique
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>'); // liens
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
export const fmtNum = n => Math.round(n).toLocaleString("fr-FR");

const ic = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const I = {
  chev: ic('<path d="m9 6 6 6-6 6"/>'),
  back: ic('<path d="m15 6-6 6 6 6"/>'),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: ic('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  minus: ic('<path d="M5 12h14"/>'),
  up: ic('<path d="m6 15 6-6 6 6"/>'),
  down: ic('<path d="m6 9 6 6 6-6"/>'),
  trash: ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  play: ic('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  flame: ic('<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 3 2.5 3C11 9 11 6 12 3z"/>'),
  bolt: ic('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
  trophy: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>'),
  info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
  swap: ic('<path d="M7 4 4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7"/>'),
  skip: ic('<path d="m5 5 8 7-8 7zM17 5v14"/>'),
  undo: ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  more: ic('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  sound: ic('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  mute: ic('<path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6"/>'),
  send: ic('<path d="M4 12 20 4l-6 16-3-7z"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  heart: ic('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  moon: ic('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  alert: ic('<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>'),
  sparkle: ic('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  camera: ic('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  eye: ic('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  video: ic('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3z"/>'),
  refresh: ic('<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>'),
};
// Visage du coach choisi (avatar utilisé partout dans l'app).
// Visage du coach actuel (« cur-face » : remplacé en place quand on change de coach).
export const spider = (cls = "") => coachFace(cls ? "cur-face " + cls : "cur-face");

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Toast : pilule au-dessus de la barre d'onglets. Un nouveau message remplace proprement le précédent ;
// la durée s'allonge un peu pour les messages longs ; un toucher le ferme.
let toastT;
export function toast(msg, ms = 2400) {
  const t = $("#toast");
  if (!t) return;
  const showing = t.classList.contains("show");
  t.textContent = msg;
  if (showing && !reduceMotion()) { t.classList.remove("swap"); void t.offsetWidth; t.classList.add("swap"); }
  t.classList.add("show");
  t.onclick = () => { clearTimeout(toastT); t.classList.remove("show", "swap"); };
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show", "swap"), Math.max(ms, 1200 + String(msg).length * 40));
}

// Feuille qui monte du bas. Renvoie { el, close }.
// Montée en ressort, fond qui s'assombrit en fondu, glisser vers le bas pour fermer (suit le doigt,
// tient compte de la vitesse), Échap pour fermer, la page dessous ne défile pas (voir CSS).
export function sheet(html, { onClose, z } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  if (z) wrap.style.zIndex = z;
  wrap.innerHTML = `<div class="sheet-bd"></div><div class="sheet" role="dialog" aria-modal="true" tabindex="0"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(wrap);
  const bd = wrap.firstElementChild, s = wrap.lastElementChild;
  let closed = false;
  const onKey = e => { if (e.key === "Escape" && [...document.querySelectorAll(".sheet-wrap:not(.closing)")].pop() === wrap) close(); };
  const close = (flung = false) => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    s.style.transition = bd.style.transition = "none";
    if (flung === true) wrap.classList.add("flung");
    wrap.classList.add("closing");
    let gone = false;
    const done = () => { if (!gone) { gone = true; wrap.remove(); } };
    if (reduceMotion()) done();
    else { s.addEventListener("animationend", e => e.target === s && done()); setTimeout(done, 300); }
    onClose?.();
  };
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target === bd) close(); });
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => { if (!s.contains(document.activeElement)) s.focus({ preventScroll: true }); });

  // glisser vers le bas pour fermer : la feuille suit le doigt (une écriture par image), le fond s'éclaircit
  let y0 = null, x0 = 0, dy = 0, h = 1, dragging = false, lastY = 0, lastT = 0, vel = 0, raf = 0;
  const paint = () => { raf = 0; s.style.transform = `translate3d(0, ${dy}px, 0)`; bd.style.opacity = String(Math.max(0, 1 - dy / h)); };
  s.addEventListener("touchstart", e => {
    y0 = null;
    if (closed || e.touches.length > 1) return;
    if (s.scrollTop > 0 && !e.target.closest(".grab")) return;
    y0 = lastY = e.touches[0].clientY; x0 = e.touches[0].clientX; lastT = e.timeStamp; dy = vel = 0; dragging = false;
  }, { passive: true });
  s.addEventListener("touchmove", e => {
    if (y0 === null) return;
    const y = e.touches[0].clientY, d = y - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (!dragging) {
      if (dx > Math.abs(d) || d < 0 || s.scrollTop > 0) { if (Math.abs(d) > 4 || dx > 4) y0 = null; return; }
      if (e.cancelable) e.preventDefault(); // vers le bas, en haut du contenu : c'est la feuille qui bouge
      if (d < 6) return;
      dragging = true; y0 = y; h = s.offsetHeight || 1;
      s.getAnimations?.().forEach(a => a.cancel());
      s.style.transition = bd.style.transition = "none";
      s.classList.add("dragging");
    }
    if (e.cancelable) e.preventDefault(); // la feuille bouge, pas son contenu
    dy = Math.max(0, y - y0);
    const dt = e.timeStamp - lastT;
    if (dt > 0) vel = 0.75 * ((y - lastY) / dt) + 0.25 * vel;
    lastY = y; lastT = e.timeStamp;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: false });
  const end = () => {
    if (y0 === null || !dragging) { y0 = null; return; }
    y0 = null; dragging = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    s.classList.remove("dragging");
    if (dy > Math.min(150, h * 0.33) || (vel > 0.55 && dy > 24)) return close(vel > 0.55);
    // retour en ressort
    s.style.transition = "transform var(--dur-5) var(--spring-soft)";
    bd.style.transition = "opacity var(--dur-3) var(--ease-out)";
    s.style.transform = ""; bd.style.opacity = "";
  };
  s.addEventListener("touchend", end);
  s.addEventListener("touchcancel", end);
  return { el: s, close };
}

export function confirmSheet(title, text, okLabel = "Confirmer", danger = false) {
  return new Promise(res => {
    const sh = sheet(`<h2 class="h2">${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="grid2 mt"><button class="btn btn-soft" data-r="0">Annuler</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-r="1">${esc(okLabel)}</button></div>`,
      { onClose: () => res(false), z: 80 });
    $$("[data-r]", sh.el).forEach(b => b.onclick = () => { const v = b.dataset.r === "1"; res(v); sh.close(); });
  });
}

export function ring(pct, label, size = 64) {
  const C = 2 * Math.PI * 27;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 64 64"><circle class="t" cx="32" cy="32" r="27"/>
    <circle class="b" cx="32" cy="32" r="27" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - pct)}"/></svg><div class="c">${label}</div></div>`;
}
export function animateRings(root = document) {
  requestAnimationFrame(() => setTimeout(() => $$(".ring .b", root).forEach(b => (b.style.strokeDashoffset = b.dataset.off)), 60));
}
