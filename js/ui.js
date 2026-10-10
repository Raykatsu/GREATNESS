// Petits outils d'interface partagés.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Texte riche minimal : **gras** et retours à la ligne.
export const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
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
  refresh: ic('<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>'),
};
export const spider = (cls = "") => `<svg class="${cls}" viewBox="0 0 64 64"><use href="#spider"/></svg>`;

let toastT;
export function toast(msg, ms = 2400) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), ms);
}

// Feuille qui monte du bas. Renvoie { el, close }.
export function sheet(html, { onClose, z } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  if (z) wrap.style.zIndex = z;
  wrap.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(wrap);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add("closing");
    setTimeout(() => wrap.remove(), 220);
    onClose?.();
  };
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  // glisser vers le bas pour fermer
  const s = wrap.firstElementChild;
  let y0 = null;
  s.addEventListener("touchstart", e => { if (s.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  s.addEventListener("touchmove", e => { if (y0 === null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) s.style.transform = `translateY(${dy}px)`; }, { passive: true });
  s.addEventListener("touchend", e => {
    if (y0 === null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy > 110) close(); else s.style.transform = "";
  });
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
