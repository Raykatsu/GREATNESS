// Courbe nette : grille légère, aire en dégradé de l'accent, dernier point mis en avant.
// Options : time (abscisses selon la date réelle), marks (indices des points à mettre en avant, ex. records),
// trend (droite de tendance en pointillés).
let chartN = 0;
export function chart(pts, { unit = "", dec = 0, time = false, marks = null, trend = false, empty = "La courbe apparaîtra après 2 séances." } = {}) {
  if (pts.length < 2) return `<div class="empty" style="padding:20px">${empty}</div>`;
  const W = 320, H = 150, L = 30, R = 14, T = 22, B = 22;
  const ys = pts.map(p => p.y);
  const dMin = Math.min(...ys), dMax = Math.max(...ys);
  let min = dMin, max = dMax;
  const padY = (max - min) * 0.12 || Math.max(1, max * 0.05);
  min -= padY; max += padY;
  const span = max - min;
  const x0 = pts[0].x, xSpan = pts[pts.length - 1].x - x0 || 1;
  const X = i => L + (time ? (pts[i].x - x0) / xSpan : i / (pts.length - 1)) * (W - L - R);
  const Y = v => T + (1 - (v - min) / span) * (H - T - B);
  const xy = pts.map((p, i) => [X(i), Y(p.y)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fmtD = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const fmtV = v => (dec ? v.toFixed(dec).replace(".0", "").replace(".", ",") : Math.round(v));
  const grid = dMax - dMin > 0 ? [dMin, (dMin + dMax) / 2, dMax] : [dMin];
  const id = "cg" + ++chartN;
  const [lx, ly] = xy[xy.length - 1], last = pts[pts.length - 1].y;
  const lbl = `${fmtV(last)}${unit ? " " + unit : ""}`, lw = lbl.length * 6.4 + 14;
  const bx = Math.min(W - lw, Math.max(L, lx - lw / 2)), by = ly - 30 < 0 ? ly + 10 : ly - 30;
  let tr = "";
  if (trend && pts.length >= 3) {
    const f = linear(pts);
    const ya = Y(f.at(pts[0].x)), yb = Y(f.at(pts[pts.length - 1].x));
    tr = `<line class="tr" x1="${X(0).toFixed(1)}" y1="${ya.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${yb.toFixed(1)}"/>`;
  }
  const hot = new Set(marks || []);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution : de ${fmtV(pts[0].y)} à ${fmtV(last)} ${unit}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>
    ${grid.map(v => `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 8}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtV(v)}</text>`).join("")}
    <g class="plot"><path class="ar" fill="url(#${id})" d="${d} L${lx.toFixed(1)},${H - B} L${L},${H - B} Z"/>
    ${tr}<path class="ln" d="${d}"/>
    ${pts.length <= 40 ? xy.slice(0, -1).map(([x, y], i) => `<circle class="pt${hot.has(i) ? " pr" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hot.has(i) ? 3.6 : 2.6}"/>`).join("")
      : xy.slice(0, -1).filter((_, i) => hot.has(i)).map(([x, y]) => `<circle class="pt pr" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4"/>`).join("")}</g>
    <g class="last"><circle class="halo" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="9"/><circle class="pt now" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5"/>
      <rect class="tag" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${lw.toFixed(1)}" height="20" rx="10"/><text class="tag-t" x="${(bx + lw / 2).toFixed(1)}" y="${(by + 13.8).toFixed(1)}" text-anchor="middle">${lbl}</text></g>
    <text x="${L}" y="${H - 5}">${fmtD(pts[0].x)}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">${fmtD(pts[pts.length - 1].x)}</text>
  </svg>`;
}

// Droite des moindres carrés : at(x) et pente par jour
export function linear(pts) {
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const slope = den ? num / den : 0;
  return { at: x => my + slope * (x - mx), perDay: slope * 864e5 };
}
