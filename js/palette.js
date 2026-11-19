// Les couleurs d'une pochette d'album, pour habiller l'app : les teintes présentes (regroupées), puis un thème lisible
// (accent vif pour les boutons, deuxième accent pour les dégradés, couleur d'ambiance pour le fond). Une pochette en
// noir et blanc n'impose pas d'accent : l'app garde sa couleur, seule l'ambiance change. Sans DOM : testé dans Node
// avec des pixels de synthèse (musictheme.js lit les pixels d'une vraie pochette).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// RVB 0-255 → TSL (teinte 0-360, saturation et luminosité 0-1)
export function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255));
}
export const hex = c => `#${c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
// luminance relative et contraste (WCAG 2)
export function lum(c) {
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Les teintes d'une image (pixels RVBA à plat) : chaque pixel rejoint la teinte la plus proche (écart < 40), sinon
// en crée une ; de la plus présente à la moins présente, avec leur part de l'image (p)
export function swatches(px) {
  const bins = new Map();
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue; // transparent
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const b = bins.get(k) || [0, 0, 0, 0];
    b[0] += px[i]; b[1] += px[i + 1]; b[2] += px[i + 2]; b[3]++;
    bins.set(k, b);
  }
  const groups = [];
  for (const [r, g, b, n] of [...bins.values()].sort((x, y) => y[3] - x[3])) {
    const c = [r / n, g / n, b / n], near = groups.find(x => dist(x.c, c) < 40);
    if (near) { const t = near.n + n; near.c = near.c.map((v, i) => (v * near.n + c[i] * n) / t); near.n = t; }
    else if (groups.length < 16) groups.push({ c, n });
  }
  const total = groups.reduce((s, x) => s + x.n, 0) || 1;
  return groups.map(x => ({ c: x.c.map(Math.round), p: x.n / total, hsl: hsl(x.c) })).sort((a, b) => b.p - a.p);
}

// Éclat d'une teinte : saturée, ni trop sombre ni trop claire
const vivid = ([, s, l]) => s * (1 - Math.min(1, Math.abs(l - 0.5) * 1.6));

// Thème tiré des teintes : accent (boutons, liens), accent2 (fin des dégradés), ambiance (lueur du fond) ;
// null si l'image est vide. neutral : pochette sans couleur franche (l'app garde son accent)
export function themeFrom(sw) {
  if (!sw?.length) return null;
  const cands = sw.filter(x => x.p >= 0.015);
  const score = x => vivid(x.hsl) * Math.pow(x.p, 0.3);
  const best = [...cands].sort((a, b) => score(b) - score(a))[0] || sw[0];
  const neutral = vivid(best.hsl) < 0.16;
  // accent utilisable en bouton : saturé, luminosité moyenne (le CSS en tire un texte lisible, --accent-ink)
  const [h, s] = best.hsl;
  const acc = rgb(h, clamp(s, 0.55, 0.92), clamp(best.hsl[2], 0.44, 0.58));
  // deuxième accent : une autre teinte vive de la pochette, sinon le même ton, plus sombre
  const other = cands.filter(x => x !== best && vivid(x.hsl) >= 0.14 && hueGap(x.hsl[0], h) >= 25).sort((a, b) => score(b) - score(a))[0];
  const acc2 = other ? rgb(other.hsl[0], clamp(other.hsl[1], 0.5, 0.9), clamp(other.hsl[2], 0.3, 0.45)) : rgb(h, clamp(s, 0.55, 0.92), 0.32);
  // ambiance : la teinte dominante, assourdie (une lueur de fond, jamais criarde)
  const dom = sw[0].hsl, amb = rgb(dom[0], Math.min(dom[1], 0.7), clamp(dom[2], 0.18, 0.42));
  const dom2 = (sw[1] || sw[0]).hsl, amb2 = rgb(dom2[0], Math.min(dom2[1], 0.7), clamp(dom2[2], 0.18, 0.42));
  // ton de la pochette (pour l'ambiance, vibe.js) : claire, vive, chaude (parts pondérées par la surface)
  const r2 = v => Math.round(v * 100) / 100;
  const tone = {
    light: r2(sw.reduce((s, x) => s + x.p * x.hsl[2], 0)),
    vivid: r2(sw.reduce((s, x) => s + x.p * vivid(x.hsl), 0)),
    warm: r2(sw.reduce((s, x) => s + x.p * vivid(x.hsl), 0) ? sw.reduce((s, x) => s + x.p * vivid(x.hsl) * (x.hsl[0] < 75 || x.hsl[0] > 290 ? 1 : 0), 0) / sw.reduce((s, x) => s + x.p * vivid(x.hsl), 0) : 0.5),
  };
  return { neutral, accent: hex(acc), accent2: hex(acc2), ambient: amb.join(", "), ambient2: amb2.join(", "), dark: lum(sw[0].c) < 0.18, tone };
}

// Raccourci : pixels → thème
export const paletteOf = px => themeFrom(swatches(px));
