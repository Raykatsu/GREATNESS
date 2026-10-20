// Boîte à dessin des coachs. Tous les personnages de l'app sont des créations originales.
//
// FORMAT D'UN PERSONNAGE — repère SVG 60 × 80 (viewBox "0 0 60 80"), vue de face, sol à y = 78. Le moteur
// (js/mascot.js) assemble les calques dans cet ordre :
//   <g class="sp-body"> back · legL · legR · armL · torso · armR (+ haltère auto à la main) · head · zzz </g>
// et les fait pivoter autour de points FIXES (ne pas les déplacer) :
//   armL : épaule (20, 30) → main ≈ (14.3, 49.5)      armR : épaule (40, 30) → main ≈ (45.7, 49.5)
//   legL : hanche (26, 48) → pied ≈ (23, 76)          legR : hanche (34, 48) → pied ≈ (37, 76)
//   head : cou (30, 26), tête centrée ≈ (30, 14) ; une grosse tête peut aller de x 8 à 52 et y -10 à 28
//   body : (30, 76) (respiration, atterrissage)
// La tête contient <g class="sp-eyes"> avec un élément class="sp-eyeL" et un class="sp-eyeR" (clignement,
// humeurs). Elle sert aussi d'avatar, recadrée seule (cadre `faceBox`) : elle doit être lisible seule.
// Les id de dégradés / découpes DOIVENT commencer par `${id}-` (plusieurs coachs s'affichent ensemble).
// `css` (facultatif) : petites animations propres au personnage, sélecteurs préfixés par `.ch-${id}`.
//
// Champs : id, name, group, bio (1 phrase), persona (voix pour l'IA),
//   travel : "fly" (vole) | "hop" (sautille) | "dash" (fonce) | "walk" (marche) | "roll" (roule : fauteuil, planche)
//   climb : true s'il grimpe aux murs et au plafond
//   fx : { color, trail } — trail : "none" | "sparks" | "hearts" | "stars" | "smoke" | "bubbles" | "leaves" | "aura" | "snow"
//   defs, back?, legL, legR, armL, armR, torso, head, css?, faceBox?
//   lines : { hello: [], tap: [], pr: [], rest: [], sleep: [] } — courtes répliques, dans le ton du personnage
//
// Les humains se décrivent avec `person({ … })` : peau, silhouette, coiffure, visage, tenue, accessoires.
// Les créatures (./compagnons.js) se dessinent à la main avec les mêmes petits outils.

export const r2 = n => Math.round(n * 100) / 100;
// symétrie gauche / droite autour de x = 30
export const X = (s, x) => (s === "L" ? r2(x) : r2(60 - x));
// miroir d'un tracé (commandes M L C Q S T Z en coordonnées absolues)
export const mir = d => {
  let i = 0;
  return d.replace(/[A-Za-z]|-?\d*\.?\d+/g, t => {
    if (/[A-Za-z]/.test(t)) { i = 0; return t; }
    return i++ % 2 === 0 ? String(r2(60 - +t)) : t;
  });
};

/* ---------- Couleurs ---------- */
const rgb = h => { let s = h.slice(1); if (s.length === 3) s = [...s].map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
const hex = a => "#" + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * k)); };
export const dark = (c, k = 0.4) => mix(c, "#1c1016", k);
export const light = (c, k = 0.3) => mix(c, "#ffffff", k);
const lum = c => { const [r, g, b] = rgb(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
// contour : la couleur assombrie (ou un peu éclaircie pour les couleurs très sombres, lisibles sur fond sombre)
export const ink = c => (lum(c) < 0.11 ? light(c, 0.2) : dark(c, 0.56));

// Peaux, du plus clair au plus foncé (1 → 8)
export const SKIN = ["#ffe0cb", "#f5c9a3", "#e6ad80", "#d0935c", "#b47443", "#8f552d", "#6c3d21", "#4b2915"];
export const HAIR = {
  black: "#231d22", brown: "#4b2d1b", chestnut: "#7b4623", auburn: "#a3402a", ginger: "#d0682c", blond: "#e9c46a",
  platinum: "#f2e6c4", grey: "#a9a5a6", white: "#efece8", teal: "#2fb7aa", pink: "#ff83b5", violet: "#8d6cf0", blue: "#4f7ff0",
};

/* ---------- Petits outils ---------- */
export const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
export const rad = (id, a, b, cx = 0.42, cy = 0.36, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
export const line = (d, c, w, extra = "") => `<path d="${d}" stroke="${c}" stroke-width="${r2(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
// bande à bouts droits (rayures de chaussettes, genouillères, revers)
export const flat = (d, c, w, extra = "") => `<path d="${d}" stroke="${c}" stroke-width="${r2(w)}" fill="none" stroke-linecap="butt"${extra}/>`;
export const shape = (d, f, ol, w = 0.8, extra = "") => `<path d="${d}" fill="${f}"${ol ? ` stroke="${ol}" stroke-width="${r2(w)}" stroke-linejoin="round"` : ""}${extra}/>`;
export const dot = (x, y, r, f, extra = "") => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${f}"${extra}/>`;
const pt = p => `${r2(p[0])} ${r2(p[1])}`;

// Contour « nuage » (boucles, afro, fourrure, pompon) : n bosses autour d'une ellipse
export function cloud(cx, cy, rx, ry, n = 12, bump = 0.16, a0 = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    if (!i) { d = `M${r2(x)} ${r2(y)}`; continue; }
    const m = a0 + ((i - 0.5) / n) * Math.PI * 2, k = 1 + bump;
    d += ` Q${r2(cx + rx * k * Math.cos(m))} ${r2(cy + ry * k * Math.sin(m))} ${r2(x)} ${r2(y)}`;
  }
  return d + " Z";
}

// Membres : courbes quadratiques fixes (épaule → main, hanche → pied) et leurs morceaux (manche, short, chaussette…)
export const ARM = s => [[X(s, 20), 30], [X(s, 16.3), 39.2], [X(s, 14.7), 47.6]];
export const LEG = s => [[X(s, 26), 48], [X(s, 25.5), 61], [X(s, 24.1), 71.4]];
const at = (P, t) => [0, 1].map(i => (1 - t) ** 2 * P[0][i] + 2 * (1 - t) * t * P[1][i] + t * t * P[2][i]);
const ctl = (P, u, v) => [0, 1].map(i => (1 - u) * (1 - v) * P[0][i] + ((1 - u) * v + u * (1 - v)) * P[1][i] + u * v * P[2][i]);
export const seg = (P, t0 = 0, t1 = 1) => `M${pt(at(P, t0))} Q${pt(ctl(P, t0, t1))} ${pt(at(P, t1))}`;
export const handAt = s => [X(s, 14.4), 49.3];

// Œil brillant : iris sombre (teinté), deux reflets ; paupière et cils facultatifs
export function eye(cls, cx, cy, { rx = 1.85, ry = 2.35, color = "#2a1a14", iris, lid, lash, side = "L" } = {}) {
  const k = side === "L" ? -1 : 1;
  let s = `<g class="${cls}"><ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${color}"/>`;
  if (iris) s += `<ellipse cx="${r2(cx)}" cy="${r2(cy + ry * 0.22)}" rx="${r2(rx * 0.66)}" ry="${r2(ry * 0.6)}" fill="${iris}" opacity=".9"/><ellipse cx="${r2(cx)}" cy="${r2(cy + ry * 0.24)}" rx="${r2(rx * 0.32)}" ry="${r2(ry * 0.32)}" fill="${color}"/>`;
  s += dot(cx - rx * 0.3, cy - ry * 0.36, rx * 0.42, "#fff") + dot(cx + rx * 0.36, cy + ry * 0.4, rx * 0.2, "#fff", ' opacity=".8"');
  if (lid) s += `<path d="M${r2(cx - rx * 1.3)} ${r2(cy - ry * 1.25)} L${r2(cx + rx * 1.3)} ${r2(cy - ry * 1.25)} L${r2(cx + rx * 1.3)} ${r2(cy - ry * 0.18)} Q${r2(cx)} ${r2(cy - ry * 0.62)} ${r2(cx - rx * 1.3)} ${r2(cy - ry * 0.18)} Z" fill="${lid}"/>` +
    line(`M${r2(cx - rx * 1.15)} ${r2(cy - ry * 0.2)} Q${r2(cx)} ${r2(cy - ry * 0.62)} ${r2(cx + rx * 1.15)} ${r2(cy - ry * 0.2)}`, color, 0.6);
  if (lash) s += line(`M${r2(cx + k * rx * 0.75)} ${r2(cy - ry * 0.72)} l${r2(k * 1.15)} ${r2(-0.75)} M${r2(cx + k * rx * 0.98)} ${r2(cy - ry * 0.28)} l${r2(k * 1.05)} ${r2(-0.32)}`, color, 0.55);
  return s + "</g>";
}
export const eyePair = (dx, cy, o = {}) => `<g class="sp-eyes">${eye("sp-eyeL", 30 - dx, cy, { ...o, side: "L" })}${eye("sp-eyeR", 30 + dx, cy, { ...o, side: "R" })}</g>`;

// Poids du corps : demi-largeurs (épaules, taille, hanches), ventre, épaisseur des membres
const BUILDS = {
  slim: { sw: 10.8, ww: 8.3, hw: 9.4, belly: 0, arm: 4.7, leg: 5.9 },
  fit: { sw: 11.8, ww: 9, hw: 10.1, belly: 0, arm: 5.2, leg: 6.5 },
  strong: { sw: 13.4, ww: 9.4, hw: 10.4, belly: 0, arm: 6.3, leg: 7.3 },
  big: { sw: 13.6, ww: 12.6, hw: 11.8, belly: 2.6, arm: 6.6, leg: 8.2 },
  curvy: { sw: 11, ww: 8.8, hw: 11.6, belly: 0, arm: 5.1, leg: 7 },
};
// Silhouette du buste (cou → hanches), à fond plat légèrement creusé entre les jambes
function silhouette({ sw, ww, hw, belly }) {
  const L = x => r2(30 - x), R = x => r2(30 + x);
  const b1 = belly ? belly * 0.7 : -0.4, b2 = belly ? belly * 1.2 : 0.2;
  return `M${L(5.6)} 24.8 L${R(5.6)} 24.8 C${R(sw - 1.8)} 25 ${R(sw + 0.3)} 26.8 ${R(sw)} 30.4 ` +
    `C${R(sw + b1)} 35 ${R(ww + b2)} 39.6 ${R(ww)} 43.8 C${R(ww - 0.1)} 46.6 ${R(hw)} 48.6 ${R(hw)} 51.4 ` +
    `Q${R(5)} 52.8 30 50.9 Q${L(5)} 52.8 ${L(hw)} 51.4 ` +
    `C${L(hw)} 48.6 ${L(ww - 0.1)} 46.6 ${L(ww)} 43.8 C${L(ww + b2)} 39.6 ${L(sw + b1)} 35 ${L(sw)} 30.4 ` +
    `C${L(sw + 0.3)} 26.8 ${L(sw - 1.8)} 25 ${L(5.6)} 24.8 Z`;
}

/* ---------- Visage ---------- */
// Les têtes des humains sont dessinées dans le repère standard puis agrandies de 12 % autour du cou (30, 26) :
// les accessoires de costume (repère standard) reçoivent la même transformation (index.js).
export const HEAD_T = "matrix(1.12 0 0 1.12 -3.6 -3.12)";
const big = ([x, y, w]) => [r2(1.12 * x - 3.6), r2(1.12 * y - 3.12), r2(1.12 * w), r2(1.12 * w)];
const FACE = "M18 14.2 C18 6.4 23.4 2.2 30 2.2 C36.6 2.2 42 6.4 42 14.2 C42 21.6 37 26.6 30 26.6 C23 26.6 18 21.6 18 14.2 Z";
const EAR = "M18.7 12.4 C16.3 11.5 15 13.3 15.4 15.6 C15.8 17.9 17.3 19.2 19 18.5 Z";
const BROWS = {
  soft: ["M22.3 11.7 Q24.7 10.4 27.1 11.4", 0.95],
  bold: ["M22 11.9 Q24.6 10.1 27.3 11.2", 1.55],
  focus: ["M22.1 10.9 Q24.9 10.7 27.3 12", 1.3],
  up: ["M22.4 11 Q24.7 9.4 27 10.5", 1.05],
  thick: ["M21.8 12 Q24.6 9.9 27.6 11.3", 2],
};
const MOUTH = {
  smile: c => line("M27.2 21.1 Q30 23.6 32.8 21.1", c, 0.95),
  calm: c => line("M28.3 21.6 Q30 22.7 31.7 21.6", c, 0.9),
  smirk: c => line("M27.5 21.7 Q30.6 23 33 20.7", c, 0.95),
  grin: () => `<path d="M26.8 20.9 Q30 21.8 33.2 20.9 Q32.8 25 30 25 Q27.2 25 26.8 20.9 Z" fill="#6a2220"/><path d="M27.3 21.2 Q30 21.9 32.7 21.2 L32.5 22 Q30 22.6 27.5 22 Z" fill="#fff"/><ellipse cx="30" cy="24" rx="1.7" ry=".8" fill="#ec7a74"/>`,
  open: () => `<ellipse cx="30" cy="22.4" rx="1.9" ry="1.6" fill="#6a2220"/><ellipse cx="30" cy="23.3" rx="1.2" ry=".6" fill="#ec7a74"/>`,
};
const BEARD = {
  full: "M18.2 15.2 C18.2 22.4 22.8 28 30 28 C37.2 28 41.8 22.4 41.8 15.2 C41 17.6 39.8 19.8 37.8 21 C35.6 20.2 33 19.7 30 19.8 C27 19.7 24.4 20.2 22.2 21 C20.2 19.8 19 17.6 18.2 15.2 Z",
  short: "M18.4 16 C18.8 22.4 23.2 27 30 27 C36.8 27 41.2 22.4 41.6 16 C40.6 18 39.4 19.8 37.6 20.8 C35.4 20.3 32.8 20 30 20 C27.2 20 24.6 20.3 22.4 20.8 C20.6 19.8 19.4 18 18.4 16 Z",
  goatee: "M26.6 23 C27 25.8 28.4 27.2 30 27.2 C31.6 27.2 33 25.8 33.4 23 C32.2 23.8 31.2 24.1 30 24.1 C28.8 24.1 27.8 23.8 26.6 23 Z",
};
const STACHE = "M26.2 20.8 C27.4 19.3 29 19.4 30 20.1 C31 19.4 32.6 19.3 33.8 20.8 C32.4 21.3 31.2 21.3 30 20.9 C28.8 21.3 27.6 21.3 26.2 20.8 Z";
const STACHE_BIG = "M25 21.6 C25.6 19 28.4 18.8 30 20 C31.6 18.8 34.4 19 35 21.6 C33.4 22.2 31.6 21.9 30 21.2 C28.4 21.9 26.6 22.2 25 21.6 Z";

/* ---------- Coiffures : { back (derrière le visage), front (devant), ears (oreilles visibles), top (haut, pour l'avatar) } ---------- */
const CAP = "M17.4 15.4 C16.4 6.2 21.8 0.6 30 0.6 C38.2 0.6 43.6 6.2 42.6 15.4"; // arc du haut de crâne, gauche → droite
const shine = c => line("M21.8 5.8 Q25.6 2.6 30.6 2.4", light(c, 0.5), 1, ' opacity=".5"');
function hairStyle(style, c, o) {
  const fill = `url(#${o.id}-hair)`, ol = ink(c), H = (d, extra = "") => shape(d, fill, ol, 0.7, extra);
  const grooves = (ds, op = 0.4) => line(ds, dark(c, 0.35), 0.5, ` opacity="${op}"`);
  switch (style) {
    case "bald": return { back: "", front: `<ellipse cx="25.6" cy="5.8" rx="3.4" ry="1.5" fill="#fff" opacity=".28" transform="rotate(-18 25.6 5.8)"/>`, ears: true, top: 2.2 };
    case "receding": {
      const side = "M17.3 17.2 C16.5 12.4 17.6 8.4 20.6 6.6 C21.8 6.2 22.4 7 22.1 8.2 C20.6 9.8 20 12.6 20.3 15.8 C19.4 16.2 18.4 16.6 17.3 17.2 Z";
      return { back: "", front: H(side) + H(mir(side)) + `<ellipse cx="26" cy="5.6" rx="3.4" ry="1.5" fill="#fff" opacity=".3" transform="rotate(-18 26 5.6)"/>`, ears: true, top: 2.2 };
    }
    case "short": return { back: "", front: H(`${CAP} C41.8 13 41.2 11.6 40.2 10.4 C36.8 11 33.4 9.8 31.4 7.6 C29.2 9.8 24.4 11.2 20.6 10.6 C19.2 11.8 18 13.4 17.4 15.4 Z`) + shine(c), ears: true, top: 0.6 };
    case "messy": return { back: "", front: H("M17.4 15.4 C16.4 7.4 19.6 2.6 23.6 1.2 L24.4 -1.8 L26.8 0.4 L29.6 -2.2 L31.4 0.2 L34.8 -1.4 L35.2 1.4 C40 3 43.6 7.6 42.6 15.4 C41.8 13 41 11.4 39.8 10 C36.6 11.4 32.8 10.8 30.6 8.2 C28.4 10.6 24 11.4 20.6 10.6 C19.2 11.8 18 13.4 17.4 15.4 Z") + shine(c), ears: true, top: -2.2 };
    case "spiky": return { back: "", front: H("M17.4 15 C16.6 9 18.2 4.6 21.4 2.6 L19.4 -1.8 L24.4 0.4 L25.4 -4 L29 -0.4 L31.6 -4.6 L33.8 -0.2 L37.8 -3 L37.8 1.8 L42.6 0.6 L40.6 4.6 C42.8 7.4 43.4 10.8 42.6 15 C41.6 12.8 40.6 11.2 39.4 10.2 L37.6 11.2 L36.6 8.8 L33.6 10.6 L32.2 8 L29.4 10.2 L27.6 7.8 L25 10.4 L23.6 8.4 L21.6 10.8 C19.6 11.8 18.2 13.2 17.4 15 Z") + shine(c), ears: true, top: -4.6 };
    case "curly": return { back: "", front: H(cloud(30, 4.4, 13, 6, 13, 0.24)) + H(cloud(18.2, 11.2, 2.1, 2.6, 6, 0.3)) + H(cloud(41.8, 11.2, 2.1, 2.6, 6, 0.3)) + shine(c), ears: true, top: -3 };
    case "undercut": return { back: "", front: shape("M17.6 16 C16.8 9 19 4.4 23 2.6 L37 2.6 C41 4.4 43.2 9 42.4 16 C41.6 13 40.6 10.6 39.2 9.4 L20.8 9.4 C19.4 10.6 18.4 13 17.6 16 Z", c, null, 0, ' opacity=".45"') + H(cloud(30, 3.2, 10.4, 5, 11, 0.24)) + shine(c), ears: true, top: -3 };
    case "twa": return { back: "", front: H(cloud(30, 6.4, 12.8, 6.6, 17, 0.09)) + grooves("M23.6 4.6 l.6 .6 M27.4 3 l.5 .7 M32 3 l.5 .7 M36 4.4 l.6 .6", 0.5), ears: true, top: -0.9 };
    case "afro": return { back: H(cloud(30, 8.6, 16.6, 15.2, 18, 0.1)), front: H(cloud(30, 3.8, 13.4, 6.2, 13, 0.2)) + shine(c), ears: false, top: -8.2 };
    case "puff": {
      const front = "M17.6 14.8 C16.8 6 22 1 30 1 C38 1 43.2 6 42.4 14.8 C41.6 11.8 40.4 9.6 38.4 8.4 Q34.4 6.4 30 6.4 Q25.6 6.4 21.6 8.4 C19.6 9.6 18.4 11.8 17.6 14.8 Z";
      return { back: H(cloud(30, -3.4, 7.8, 5.8, 13, 0.18)), front: H(front) + grooves("M23.8 7.4 Q25.4 3.6 28.4 1.8 M30 6.4 L30 1.4 M36.2 7.4 Q34.6 3.6 31.6 1.8") + shine(c), ears: true, top: -10.2 };
    }
    case "hightop": {
      const fade = "M17.6 16.6 C17 12.4 17.6 9.4 19.4 7.6 L20.4 11.4 C19.4 12.8 18.6 14.4 17.6 16.6 Z";
      let topEdge = "";
      for (let i = 0; i < 8; i++) { const x0 = 21 + i * 2.25; topEdge += ` Q${r2(x0 + 1.12)} ${i % 2 ? -5.4 : -5.9} ${r2(x0 + 2.25)} -4.3`; }
      return { back: "", front: shape(fade, c, null, 0, ' opacity=".55"') + shape(mir(fade), c, null, 0, ' opacity=".55"') +
        H(`M18.8 11.4 C18.4 7.4 18.6 2.4 19.6 -0.8 Q20 -4.2 21 -4.3${topEdge} Q40 -4.2 40.4 -0.8 C41.4 2.4 41.6 7.4 41.2 11.4 C40.6 9.8 39.6 8.8 38 8.4 Q34 7.4 30 7.4 Q26 7.4 22 8.4 C20.4 8.8 19.4 9.8 18.8 11.4 Z`) +
        line("M22 -1.6 Q26.2 -3 30.8 -2.9", light(c, 0.5), 1, ' opacity=".45"') + grooves("M23 2.4 l.6 .5 M26.6 1.4 l.6 .5 M30.4 1.8 l.6 .5 M34.2 1.4 l.6 .5 M37.4 2.4 l.6 .5", 0.6), ears: true, top: -5.9 };
    }
    case "bun": case "topknot": {
      const front = style === "bun" ? "M17.4 15 C16.6 6 22 0.8 30 0.8 C38 0.8 43.4 6 42.6 15 C42 11.6 40.4 8.8 37.6 7.4 Q33.2 5.6 30.6 2.6 L29.4 2.6 Q26.8 5.6 22.4 7.4 C19.6 8.8 18 11.6 17.4 15 Z"
        : "M17.6 14.8 C16.8 6 22 1 30 1 C38 1 43.2 6 42.4 14.8 C41.6 11.8 40.4 9.6 38.4 8.4 Q34.4 6.4 30 6.4 Q25.6 6.4 21.6 8.4 C19.6 9.6 18.4 11.8 17.6 14.8 Z";
      const r = style === "bun" ? 4.8 : 3.8, cy = style === "bun" ? -2.2 : -1.6;
      return { back: `<circle cx="30" cy="${cy}" r="${r}" fill="${fill}" stroke="${ol}" stroke-width=".7"/>` + line(`M${r2(30 - r * 0.62)} ${r2(cy - r * 0.2)} Q30 ${r2(cy - r * 0.9)} ${r2(30 + r * 0.62)} ${r2(cy - r * 0.2)}`, light(c, 0.45), 0.8, ' opacity=".5"'),
        front: H(front) + (style === "topknot" ? grooves("M23.8 7.4 Q25.4 3.6 28.4 1.8 M36.2 7.4 Q34.6 3.6 31.6 1.8") : shine(c)) + `<rect x="${r2(30 - r * 0.55)}" y="${r2(cy + r * 0.62)}" width="${r2(r * 1.1)}" height="1.5" rx=".75" fill="${o.tie || dark(c, 0.3)}"/>`,
        ears: true, top: r2(cy - r) };
    }
    case "locsbun": {
      const front = "M17.6 14.8 C16.8 6 22 1 30 1 C38 1 43.2 6 42.4 14.8 C41.6 11.8 40.4 9.6 38.4 8.4 Q34.4 6.4 30 6.4 Q25.6 6.4 21.6 8.4 C19.6 9.6 18.4 11.8 17.6 14.8 Z";
      let bun = "";
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, x = 30 + Math.cos(a) * 3.6, y = -3.2 + Math.sin(a) * 2.6; bun += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="2.6" ry="1.5" transform="rotate(${r2((a * 180) / Math.PI + 90)} ${r2(x)} ${r2(y)})" fill="${fill}" stroke="${ol}" stroke-width=".6"/>`; }
      return { back: bun + dot(30, -3.2, 2.2, fill), front: H(front) + grooves("M22 8.6 Q24 4.4 27.6 2 M26 7 Q27.4 3.6 29.2 1.6 M34 7 Q32.6 3.6 30.8 1.6 M38 8.6 Q36 4.4 32.4 2", 0.55), ears: true, top: -7 };
    }
    case "ponytail": {
      const front = "M17.4 15.4 C16.4 6 22 0.6 30 0.6 C38 0.6 43.6 6 42.6 15.4 C41.8 12.4 40.8 10.4 39.2 9 C34.6 9.2 28.2 7.4 25.4 4.2 C24.8 7 22.4 9.4 19.8 10.2 C18.6 11.6 17.8 13.2 17.4 15.4 Z";
      const tail = "M36.4 2.4 C44.4 -1.6 50.2 4.2 48.8 12.8 C48.2 17.6 46.2 21.8 43.8 24.4 C44.8 19.2 44.2 13.4 40.2 8.8 C38.8 7.2 37.4 5.6 36.4 2.4 Z";
      return { back: `<g class="kit-tail">${H(tail)}${grooves("M40.4 4.6 Q46 7.6 45.6 17.4")}</g>`, front: H(front) + shine(c) + `<ellipse cx="37.4" cy="3.4" rx="1.9" ry="1.5" fill="${o.tie || "#ff4d6d"}"/>`, ears: true, top: -0.8, tail: [37.2, 3.2] };
    }
    case "braids": {
      const front = "M17.6 14.8 C16.8 6 22 1 30 1 C38 1 43.2 6 42.4 14.8 C41.6 11.8 40.4 9.6 38.4 8.4 Q34.4 6.4 30 6.4 Q25.6 6.4 21.6 8.4 C19.6 9.6 18.4 11.8 17.6 14.8 Z";
      const b = ["M36 0 C44 1 47.8 8 47.2 17 C46.8 23 46.2 27.6 47 31.6", "M35.2 1.4 C42 3.6 44.8 10 44.2 18.4 C43.8 24 43 28.4 43.6 32.4", "M36.8 -0.6 C46.4 -0.6 50.6 6.6 50.2 15 C50 20.6 49.6 24.8 50.4 28.6"];
      const braids = b.map(d => line(d, ol, 3) + line(d, c, 2.1) + line(d, light(c, 0.3), 0.5, ' stroke-dasharray=".9 1.3" opacity=".7"')).join("");
      const ends = [[47, 31.6], [43.6, 32.4], [50.4, 28.6]].map(([x, y]) => `<rect x="${r2(x - 1.3)}" y="${r2(y - 1.4)}" width="2.6" height="2" rx=".8" fill="#f2c14e" stroke="#a87b18" stroke-width=".4"/>`).join("");
      return { back: `<g class="kit-tail">${braids}${ends}</g>`, front: H(front) + grooves("M22.6 8.2 Q24 4.4 27.4 2 M26.2 6.8 Q27.4 3.6 29.2 1.6 M30 6.4 L30 1.2 M33.8 6.8 Q32.6 3.6 30.8 1.6 M37.4 8.2 Q36 4.4 32.6 2", 0.55) + dot(36.2, 1.2, 2.2, "#f2c14e", ` stroke="#a87b18" stroke-width=".45"`), ears: true, top: -1.2, tail: [36, 1] };
    }
    case "boxbraids": {
      const front = "M17.6 14.8 C16.8 6 22 1 30 1 C38 1 43.2 6 42.4 14.8 C41.6 11.8 40.4 9.6 38.4 8.4 Q34.4 6.4 30 6.4 Q25.6 6.4 21.6 8.4 C19.6 9.6 18.4 11.8 17.6 14.8 Z";
      const one = (d, end) => line(d, ol, 3.1) + line(d, fill, 2.2) + line(d, light(c, 0.32), 0.5, ' stroke-dasharray=".9 1.2" opacity=".75"') +
        `<rect x="${r2(end[0] - 1.35)}" y="${r2(end[1] - 1.2)}" width="2.7" height="2" rx=".8" fill="${o.tie || "#f2c14e"}" stroke="${dark(o.tie || "#f2c14e", 0.4)}" stroke-width=".4"/>`;
      const side = [["M20.6 6.4 C16.8 9.4 15.6 15 15.8 22 C16 27 16.4 31 16 35", [16, 35]], ["M22.4 6 C19.2 9.6 18.4 15.2 18.4 21.6 C18.4 26 18.8 29.6 18.6 33", [18.6, 33]], ["M19.2 8 C15.4 11.6 13.6 17.2 13.6 23.4 C13.6 27.4 14 30.4 13.4 33.4", [13.4, 33.4]]];
      const back = side.map(([d, e]) => one(d, e) + one(mir(d), [r2(60 - e[0]), e[1]])).join("");
      return { back, front: H(front) + grooves("M22.6 8.2 Q24 4.4 27.4 2 M26.2 6.8 Q27.4 3.6 29.2 1.6 M30 6.4 L30 1.2 M33.8 6.8 Q32.6 3.6 30.8 1.6 M37.4 8.2 Q36 4.4 32.6 2", 0.55) + shine(c), ears: false, top: 0.6 };
    }
    case "sidebraid": {
      const front = "M17.4 15 C16.6 6 22 0.8 30 0.8 C38 0.8 43.4 6 42.6 15 C42 11.6 40.4 8.8 37.6 7.4 Q33.2 5.6 30.6 2.6 L29.4 2.6 Q26.8 5.6 22.4 7.4 C19.6 8.8 18 11.6 17.4 15 Z";
      let braid = "";
      for (let i = 0; i < 7; i++) { const t = i / 6, x = 19.2 - t * 1.8 + Math.sin(t * 3) * 0.6, y = 17.2 + t * 17; braid += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(2.5 - t * 0.5)}" ry="2" fill="${fill}" stroke="${ol}" stroke-width=".6" transform="rotate(${i % 2 ? 18 : -18} ${r2(x)} ${r2(y)})"/>`; }
      return { back: "", front: H(front) + shine(c), over: `<g class="kit-braid">${braid}<rect x="15.6" y="35" width="3.4" height="1.6" rx=".8" fill="${o.tie || "#ff5a5f"}"/>${line("M16 38.4 L15.2 40.6 M17.4 38.6 L17.4 41 M18.6 38.4 L19.4 40.4", fill, 1.2)}</g>`, ears: true, top: 0.8 };
    }
    case "bob": return {
      back: H("M16.4 23 C14.6 12.4 18.4 0.8 30 0.8 C41.6 0.8 45.4 12.4 43.6 23 C42.4 24.2 40.8 24.2 39.8 23 L39.4 18 L20.6 18 L20.2 23 C19.2 24.2 17.6 24.2 16.4 23 Z"),
      front: H("M18.2 12.4 C17.8 4.4 22.8 1.4 30 1.4 C37.2 1.4 42.2 4.4 41.8 12.4 C41 11.2 40.2 10.4 39.2 10.2 L37.6 10.9 L36 9.8 L33.8 10.6 L31.8 9.6 L29.6 10.5 L27.4 9.6 L25.2 10.5 L23.2 9.6 L21.2 10.5 C20 10.4 19 11.4 18.2 12.4 Z") + shine(c), ears: false, top: 0.8,
    };
    case "long": case "wavy": {
      const curtain = style === "long" ? "M18.6 9 C15.2 14 14.6 22.4 15.2 30.4 C15.4 33.4 16.8 35.8 19 36.4 C19.4 31.4 20.2 26.4 21.4 22.8 C20 18.4 19.4 13.6 18.6 9 Z"
        : "M18.6 9 C15.4 13.6 14.8 19 16 23.4 C14.8 25.6 15.4 28.4 17.4 29.6 C17.4 31.4 18.6 32.6 20.2 32.6 C19.8 29.4 20.8 26.6 21.6 24 C20.4 19.4 19.6 14 18.6 9 Z";
      return { back: H(curtain) + H(mir(curtain)), front: H("M17.6 16 C16.6 6.4 22 0.8 30 0.8 C38 0.8 43.4 6.4 42.4 16 C41.4 12.6 39.6 9.6 36.8 8 Q33 6 30.4 3 L29.6 3 Q27 6 23.2 8 C20.4 9.6 18.6 12.6 17.6 16 Z") + shine(c), ears: false, top: 0.8 };
    }
    default: return { back: "", front: "", ears: true, top: 2.2 };
  }
}

/* ---------- Couvre-chefs : dessinés par-dessus la coiffure ---------- */
function hatStyle(h, o) {
  const c = h.color, c2 = h.color2 || dark(c, 0.25), ol = ink(c), S = (d, f = c) => shape(d, f, ol, 0.7);
  switch (h.style) {
    case "headband": return { over: S("M17.6 10.4 Q30 4 42.4 10.4 L42.6 13.4 Q30 7.2 17.4 13.4 Z") + line("M18.4 10.8 Q30 4.9 41.6 10.8", light(c, 0.45), 0.6, ' opacity=".7"'), top: null };
    case "bandana": return {
      over: S("M17.4 10.6 Q30 3.6 42.6 10.6 L42.8 13.6 Q30 7 17.2 13.6 Z") + [22, 26.4, 30.6, 35, 39].map((x, i) => dot(x, 9.8 - Math.sin((x - 17) / 26 * Math.PI) * 2.6 + (i % 2) * 0.4, 0.55, "#fff", ' opacity=".8"')).join("") +
        S("M41.6 11.4 L46.4 9.4 L45.6 12.2 Z M41.8 12.4 L46.2 14.6 L43.2 15.4 Z", c2), top: null,
    };
    case "cap": return {
      over: S("M17.6 11 C17.2 3 22.8 -1.2 30 -1.2 C37.2 -1.2 42.8 3 42.4 11 Q30 8.6 17.6 11 Z") + line("M30 -1.2 L30 9.2", dark(c, 0.3), 0.5, ' opacity=".6"') + dot(30, -1, 1.1, c2) +
        (h.logo ? `<path d="${h.logo}" fill="${h.logoColor || "#fff"}"/>` : "") +
        S("M16.6 10.8 Q30 7.8 43.4 10.8 Q45 12.6 43.8 13.8 Q30 10.8 16.2 13.8 Q15 12.6 16.6 10.8 Z", c2), top: -2.2,
    };
    case "capback": return {
      over: S("M17.6 11 C17.2 3 22.8 -1.2 30 -1.2 C37.2 -1.2 42.8 3 42.4 11 Q30 8.6 17.6 11 Z") + S("M33.4 -0.4 Q40.6 -3.4 46 0.4 Q42 1.4 38.6 2.6 Z", c2) +
        `<path d="M26.6 10.4 Q30 6.4 33.4 10.4 Z" fill="${o.hairColor}"/>` + line("M26.4 10.6 Q30 6.2 33.6 10.6", c2, 0.9), top: -2.6,
    };
    case "beanie": return {
      over: S("M17.2 11.6 C16.6 1.6 22.4 -2.6 30 -2.6 C37.6 -2.6 43.4 1.6 42.8 11.6 Z") + S("M16.6 9.6 Q30 6.4 43.4 9.6 L43.6 13 Q30 9.8 16.4 13 Z", c2) +
        line("M20 9.6 L20 12.2 M23.4 8.8 L23.4 11.4 M26.8 8.4 L26.8 11 M30.2 8.2 L30.2 10.8 M33.6 8.4 L33.6 11 M37 8.8 L37 11.4 M40.4 9.6 L40.4 12.2", dark(c2, 0.3), 0.45, ' opacity=".6"') +
        shape(cloud(30, -4.4, 3.4, 3.1, 9, 0.3), h.pom || "#fff", ink(h.pom || "#d8d8e0"), 0.6), top: -8,
    };
    case "bucket": return { over: S("M20.4 6.4 C20.6 -0.4 24.6 -2.6 30 -2.6 C35.4 -2.6 39.4 -0.4 39.6 6.4 Z") + S("M14.6 11 Q17.4 5.4 30 5.2 Q42.6 5.4 45.4 11 Q38 9.2 30 9.2 Q22 9.2 14.6 11 Z", c2) + line("M20.6 5.4 Q30 3.4 39.4 5.4", c2, 0.9), top: -2.6 };
    case "helmet": return {
      over: S("M16.8 12 C16 3.4 22 -2.6 30 -2.6 C38 -2.6 44 3.4 43.2 12 C41.4 10 39 9 36.4 9.2 Q30 7 23.6 9.2 C21 9 18.6 10 16.8 12 Z") +
        S("M24.4 -1.6 Q27 -0.4 27.6 4.4 L25.6 5 Q24.6 1.4 22.6 0.2 Z M35.6 -1.6 Q33 -0.4 32.4 4.4 L34.4 5 Q35.4 1.4 37.4 0.2 Z M29 -2.4 L31 -2.4 L31 4 L29 4 Z", "#1f2430") +
        line("M19.6 12 Q20.4 20 26.6 25.2 M40.4 12 Q39.6 20 33.4 25.2", "#1f2430", 0.6) +
        (h.shades ? `<path d="M20.8 6.4 Q25 5 29.2 6.6 L28.6 9 Q25 10 21.4 8.6 Z M39.2 6.4 Q35 5 30.8 6.6 L31.4 9 Q35 10 38.6 8.6 Z" fill="#20283a" stroke="#0e1320" stroke-width=".5"/>` + line("M22.4 6.6 L24.6 6.2 M33.4 6.2 L35.6 6.6", "#fff", 0.5, ' opacity=".6"') : ""), top: -2.6,
    };
    case "swimcap": return {
      over: S("M17.8 12 C17 3.4 22.6 0 30 0 C37.4 0 43 3.4 42.2 12 Q30 7.4 17.8 12 Z") + line("M20 4.6 Q24.4 1.4 30 1.4", light(c, 0.5), 1, ' opacity=".5"') +
        line("M18 7.8 Q30 3.6 42 7.8", "#22314d", 0.9) +
        `<ellipse cx="24.4" cy="6.4" rx="3.1" ry="2.2" fill="#3fc5f0" stroke="#22314d" stroke-width=".8"/><ellipse cx="35.6" cy="6.4" rx="3.1" ry="2.2" fill="#3fc5f0" stroke="#22314d" stroke-width=".8"/>` +
        line("M23.2 5.6 L24.6 5 M34.4 5.6 L35.8 5", "#fff", 0.6, ' opacity=".8"'), top: 0,
    };
    case "turban": return {
      over: S("M18.4 12.6 C16.8 4.2 21.8 -4.4 30 -4.6 C38.2 -4.4 43.2 4.2 41.6 12.6 C38.8 9.6 34.6 8.2 30 8.4 C25.4 8.2 21.2 9.6 18.4 12.6 Z") +
        line("M19.6 9.4 C24 3.2 31 -0.4 39 -1.6 M19 5.6 C23.6 0 30 -2.8 36.6 -3.4 M41 8.8 C37.6 4.6 33.6 2.8 29.6 2.2", dark(c, 0.3), 0.6, ' opacity=".55"') +
        S("M30 8.6 L27.6 2.6 Q30 0.8 32.4 2.6 Z", c2), top: -4.6,
    };
    case "hijab": return {
      over: `<path d="M30 -1.2 C38.8 -1.2 44.8 5.6 44.6 14.6 C44.4 21 42.2 26 39.6 29.2 C41.6 30.2 43 31.6 43.8 33.4 Q30 37.6 16.2 33.4 C17 31.6 18.4 30.2 20.4 29.2 C17.8 26 15.6 21 15.4 14.6 C15.2 5.6 21.2 -1.2 30 -1.2 Z M30 4.2 C24.6 4.2 21 8.2 21 14.4 C21 20.8 24.8 25.4 30 25.4 C35.2 25.4 39 20.8 39 14.4 C39 8.2 35.4 4.2 30 4.2 Z" fill="url(#${o.id}-hat)" fill-rule="evenodd" stroke="${ol}" stroke-width=".7" stroke-linejoin="round"/>` +
        line("M21.6 6.8 Q30 2.6 38.4 6.8", light(c, 0.35), 0.7, ' opacity=".6"') + line("M22.8 29.4 Q30 31.8 37.2 29.4 M24.6 32.4 Q30 34 35.4 32.4", dark(c, 0.25), 0.55, ' opacity=".6"'), top: -1.2, hijab: true,
    };
    default: return { over: "", top: null };
  }
}

/* ---------- Tenues ---------- */
// Haut : { style, color, color2, number, sleeve } — styles : tee, vneck, tank, bra, crop, jacket, hoodie, vest, jersey,
// bball, rugby, long, tunic, gi, swim, polo, singlet, puffer, cycling, rash
const SLEEVE = { tee: 0.42, vneck: 0.42, jersey: 0.44, rugby: 0.46, polo: 0.4, cycling: 0.42, jacket: 1, hoodie: 1, long: 1, tunic: 1, puffer: 1, rash: 1, gi: 0.7 };
const SKIN_TOPS = new Set(["tank", "bra", "crop", "bball", "swim", "singlet", "vest"]);

function topSvg(t, o) {
  const id = o.id, c = t.color, c2 = t.color2 || "#ffffff", F = `url(#${id}-top)`, olT = ink(c), b = o.build;
  const L = x => r2(30 - x), R = x => r2(30 + x);
  const P = (d, f = F) => `<path d="${d}" fill="${f}"/>`;
  const sw = b.sw + 2.2;
  let s = "";
  const numberTxt = n => `<text x="30" y="${t.numY || 41}" text-anchor="middle" font-family="Outfit, Arial, sans-serif" font-weight="900" font-size="${t.numSize || 8.4}" fill="${c2}" stroke="${dark(c, 0.35)}" stroke-width=".35" paint-order="stroke">${n}</text>`;
  const strapTop = (inner, outer, drop) => `M${L(outer)} 24 L${L(inner)} 24 Q30 ${drop} ${R(inner)} 24 L${R(outer)} 24`;
  switch (t.style) {
    case "tank": case "bball": case "singlet": case "vest": case "swim": {
      const inner = t.style === "singlet" ? 3.8 : 3.4, outer = t.style === "singlet" ? 5.6 : t.style === "vest" ? 7.2 : 5.8, drop = t.style === "swim" ? 31 : 30.2;
      const arm = t.style === "bball" ? 31.2 : t.style === "vest" ? 32.6 : 33.8;
      s += P(`${strapTop(inner, outer, drop)} Q${R(outer + 1)} ${arm - 2} ${R(sw)} ${arm + 1.2} L${R(sw)} 62 L${L(sw)} 62 L${L(sw)} ${arm + 1.2} Q${L(outer + 1)} ${arm - 2} ${L(outer)} 24 Z`);
      if (t.style === "bball") s += line(`M${L(inner)} 24.2 Q30 ${drop} ${R(inner)} 24.2 M${L(outer)} 24.2 Q${L(outer + 1)} ${arm - 2} ${L(sw)} ${arm + 1.2} M${R(outer)} 24.2 Q${R(outer + 1)} ${arm - 2} ${R(sw)} ${arm + 1.2}`, c2, 1.1);
      if (t.style === "vest") s += `<path d="M22.6 26.6 Q22 22.4 26 21.6 L34 21.6 Q38 22.4 37.4 26.6 Q30 29.4 22.6 26.6 Z" fill="${dark(c, 0.18)}"/>` + line("M28.4 27.4 L28 33.4 M31.6 27.4 L32 33.4", c2, 0.6) + `<path d="M23.4 38.6 L36.6 38.6 L37.6 44.2 L22.4 44.2 Z" fill="${dark(c, 0.1)}" stroke="${dark(c, 0.3)}" stroke-width=".5"/>`;
      if (t.style === "swim" && t.stripe !== false) s += P(`M${R(sw)} 33 L${R(sw)} 38 L${L(sw)} 47 L${L(sw)} 42 Z`, c2);
      if (t.number) s += numberTxt(t.number);
      break;
    }
    case "bra": case "crop": {
      const bottom = t.style === "crop" ? 40.6 : 38.4;
      s += P(`M${L(5.8)} 24 L${L(3.6)} 24 Q30 29.4 ${R(3.6)} 24 L${R(5.8)} 24 Q${R(6.8)} 30.6 ${R(sw)} 32.4 L${R(sw)} ${bottom} Q30 ${bottom + 2} ${L(sw)} ${bottom} L${L(sw)} 32.4 Q${L(6.8)} 30.6 ${L(5.8)} 24 Z`);
      s += P(`M${L(sw)} ${bottom - 1.8} Q30 ${bottom + 0.2} ${R(sw)} ${bottom - 1.8} L${R(sw)} ${bottom} Q30 ${bottom + 2} ${L(sw)} ${bottom} Z`, t.color2 || dark(c, 0.25));
      s += `<ellipse cx="30" cy="${r2(bottom + 4.6)}" rx=".45" ry=".75" fill="${dark(o.skin, 0.3)}"/>`; // nombril
      if (o.abs) s += line(`M30 ${r2(bottom + 1.6)} L30 ${r2(bottom + 3.6)} M27.4 ${r2(bottom + 2.6)} Q28.6 ${r2(bottom + 2.2)} 29 ${r2(bottom + 3)} M32.6 ${r2(bottom + 2.6)} Q31.4 ${r2(bottom + 2.2)} 31 ${r2(bottom + 3)}`, dark(o.skin, 0.22), 0.5, ' opacity=".7"');
      break;
    }
    default: {
      s += `<rect x="10" y="20" width="40" height="44" fill="${F}"/>`;
      const neck = { vneck: "M25.6 24 L30 30.4 L34.4 24 Z", jersey: "M25.6 24 L30 30.4 L34.4 24 Z", gi: "M25.6 24 L30 32.4 L34.4 24 Z", polo: "M26 24 L30 28.4 L34 24 Z", jacket: "", puffer: "", cycling: "M26.4 24 Q30 27.2 33.6 24 Z" }[t.style] ?? "M25.4 24 Q30 29 34.6 24 Z";
      if (neck) s += `<path d="${neck}" fill="${o.skinFill}"/>`;
      if (t.style === "tee" || t.style === "long" || t.style === "tunic" || t.style === "rash" || t.style === "hoodie") s += line("M25.4 24.2 Q30 29 34.6 24.2", dark(c, 0.28), 0.9);
      if (t.style === "vneck" || t.style === "jersey") s += line("M25.6 24.2 L30 30.4 L34.4 24.2", t.style === "jersey" ? c2 : dark(c, 0.28), t.style === "jersey" ? 1.4 : 0.9);
      if (t.style === "jersey" && t.sides !== false) s += P(`M${L(sw)} 31 L${L(b.sw - 2.6)} 31.6 L${L(b.ww - 1.4)} 46 L${L(sw)} 46 Z M${R(sw)} 31 L${R(b.sw - 2.6)} 31.6 L${R(b.ww - 1.4)} 46 L${R(sw)} 46 Z`, t.color2);
      if (t.style === "rugby") s += [31.4, 37.4, 43.4].map(y => `<rect x="10" y="${y}" width="40" height="3" fill="${c2}"/>`).join("") + `<path d="M25.2 24 L28.6 27.6 L30 26.4 L31.4 27.6 L34.8 24 Z" fill="#fff"/>` + line("M25.2 24.2 L28.6 27.6 L30 26.4 L31.4 27.6 L34.8 24.2", dark(c, 0.3), 0.6);
      if (t.style === "jacket") s += P(`M${L(sw)} 20 L${R(sw)} 20 L${R(sw)} 31.2 Q30 34.6 ${L(sw)} 31.2 Z`, t.yoke || c2) + line(`M${L(sw)} 31.4 Q30 34.8 ${R(sw)} 31.4`, t.piping || "#fff", 0.8) +
        `<path d="M25.6 23.6 Q30 25.6 34.4 23.6 L34 27.4 Q30 29.6 26 27.4 Z" fill="${t.collar || dark(c, 0.15)}" stroke="${olT}" stroke-width=".5"/>` + line("M30 27.8 L30 45", dark(c, 0.45), 0.6) + `<rect x="29.3" y="30.4" width="1.4" height="2.6" rx=".5" fill="#d9dbe3"/>`;
      if (t.style === "hoodie") s += `<path d="M22.6 26.6 Q22 22.4 26 21.6 L34 21.6 Q38 22.4 37.4 26.6 Q30 29.6 22.6 26.6 Z" fill="${dark(c, 0.16)}"/>` + `<path d="M25.4 24 Q30 29 34.6 24 Z" fill="${o.skinFill}"/>` +
        line("M28.2 27.6 L27.8 33.4 M31.8 27.6 L32.2 33.4", t.color2 || "#fff", 0.6) + `<path d="M23.6 38.4 L36.4 38.4 L37.4 44.4 L22.6 44.4 Z" fill="${dark(c, 0.08)}" stroke="${dark(c, 0.3)}" stroke-width=".5"/>`;
      if (t.style === "gi") s += P("M33.4 23.8 L36.6 23.8 L27.6 44.6 L24.2 44.6 Z", t.color2 || "#e9ecf2") + P("M23.4 23.8 L26.6 23.8 L31.6 33.8 L30.2 36.8 Z", t.color2 || "#e9ecf2") + line("M33.4 23.8 L24.2 44.6 M36.6 23.8 L27.6 44.6 M23.4 23.8 L30.2 36.8", "#b9bfcc", 0.45);
      if (t.style === "polo") s += `<path d="M25.4 23.6 L30 28.4 L27.6 29.4 L24.4 25.4 Z M34.6 23.6 L30 28.4 L32.4 29.4 L35.6 25.4 Z" fill="${t.color2 || light(c, 0.85)}" stroke="${olT}" stroke-width=".45"/>` + `<rect x="29.2" y="28.4" width="1.6" height="5.2" rx=".5" fill="${dark(c, 0.1)}"/>` + dot(30, 30, 0.45, "#fff") + dot(30, 32, 0.45, "#fff");
      if (t.style === "puffer") s += line(`M${L(sw)} 31.8 Q30 34.4 ${R(sw)} 31.8 M${L(sw)} 37.2 Q30 39.8 ${R(sw)} 37.2 M${L(sw)} 42.4 Q30 45 ${R(sw)} 42.4`, dark(c, 0.3), 0.7, ' opacity=".7"') +
        (t.color2 ? P(`M${L(sw)} 32.4 Q30 35 ${R(sw)} 32.4 L${R(sw)} 36.6 Q30 39.2 ${L(sw)} 36.6 Z`, t.color2) : "") +
        `<path d="M25 23.2 Q30 25.4 35 23.2 L34.6 28 Q30 30.2 25.4 28 Z" fill="${dark(c, 0.12)}" stroke="${olT}" stroke-width=".5"/>` + line("M30 28.4 L30 45", dark(c, 0.45), 0.6);
      if (t.style === "cycling") s += P(`M${L(sw)} 31.6 Q30 33.6 ${R(sw)} 31.6 L${R(sw)} 36.6 Q30 38.6 ${L(sw)} 36.6 Z`, c2) + (t.color3 ? P(`M${L(sw)} 36.6 Q30 38.6 ${R(sw)} 36.6 L${R(sw)} 38 Q30 40 ${L(sw)} 38 Z`, t.color3) : "") + line("M30 26.4 L30 44", dark(c, 0.4), 0.55);
      if (t.style === "rash") s += P(`M${L(sw)} 30.6 L${R(sw)} 30.6 L${R(sw)} 33.4 L${L(sw)} 33.4 Z`, c2) + line("M30 25.6 L30 30.4", dark(c, 0.35), 0.5);
      if (t.style === "tunic") s += line(`M${L(b.hw + 1)} 50.6 Q30 52.4 ${R(b.hw + 1)} 50.6`, dark(c, 0.3), 0.6);
      if (t.number) s += numberTxt(t.number);
      if (t.print === "smiley") s += dot(30, 37.4, 3.6, "#ffd23f", ` stroke="${dark("#ffd23f", 0.4)}" stroke-width=".4"`) + dot(28.7, 36.6, 0.45, "#3a2a10") + dot(31.3, 36.6, 0.45, "#3a2a10") + line("M28.2 38.2 Q30 39.8 31.8 38.2", "#3a2a10", 0.5);
      if (t.print === "heart") s += `<path d="M30 40.8 C26.8 38.6 26.6 35.6 28.4 35 Q29.4 34.7 30 35.8 Q30.6 34.7 31.6 35 C33.4 35.6 33.2 38.6 30 40.8 Z" fill="${c2}"/>`;
      if (t.print === "bolt") s += `<path d="M31.6 33 L27.4 38.6 L30.2 38.6 L28.6 42.6 L33 36.8 L30.2 36.8 Z" fill="${c2}"/>`;
      if (t.print === "wave") s += line("M25.4 37.4 Q27 35.6 28.6 37.4 T31.8 37.4 T35 37.4", c2, 1);
      if (t.print === "mountain") s += `<path d="M24.6 40.4 L28.4 34.6 L30.4 37.4 L31.8 35.6 L35.4 40.4 Z" fill="${c2}"/>`;
      if (t.print === "star") s += `<path d="m30 33.4 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="${c2}"/>`;
    }
  }
  return s;
}

// Bas : { style: shorts | leggings | joggers | pants | skirt | none, color, color2 }
function bottomTorso(bt, o) {
  if (!bt || bt.style === "none") return "";
  const F = `url(#${o.id}-bot)`, c = bt.color;
  let s = `<rect x="10" y="${o.waist}" width="40" height="22" fill="${F}"/>`;
  s += `<rect x="10" y="${o.waist}" width="40" height="1.7" fill="${bt.color2 || dark(c, 0.22)}"/>`;
  if (bt.style === "joggers") s += line(`M29 ${r2(o.waist + 1.6)} L28.6 ${r2(o.waist + 4)} M31 ${r2(o.waist + 1.6)} L31.4 ${r2(o.waist + 4)}`, "#fff", 0.5, ' opacity=".9"');
  if (bt.stripe) s += `<rect x="${r2(30 - o.build.hw - 1)}" y="${o.waist}" width="1.1" height="10" fill="${bt.stripe}"/><rect x="${r2(30 + o.build.hw - 0.1)}" y="${o.waist}" width="1.1" height="10" fill="${bt.stripe}"/>`;
  return s;
}

/* ---------- Membres ---------- */
function armSvg(s, o) {
  const P = ARM(s), w = o.build.arm, sl = o.sleeve, skin = o.skinFill, ol = o.skinOl;
  let g = line(seg(P), sl === 1 ? o.topOl : ol, w + 1.3);
  if (sl < 1) g += line(seg(P, Math.max(0, sl - 0.06)), skin, w);
  if (sl > 0) g += line(seg(P, 0, sl), o.topOl, w + (sl === 1 ? 1.3 : 2.4)) + line(seg(P, 0, sl), `url(#${o.id}-top)`, w + (sl === 1 ? 0 : 1.2));
  if (sl === 1 && o.cuff) g += flat(seg(P, 0.88, 0.97), o.cuff, w + 0.4);
  if (o.armStripe) g += line(seg(P, 0.06, sl === 1 ? 0.88 : sl), o.armStripe, 0.7, ` transform="translate(${s === "L" ? -w * 0.36 : w * 0.36} 0)"`);
  if (o.tattoo && s === "L") g += line(seg(P, 0.5, 0.58), dark(o.skin, 0.55), w * 0.9, ' stroke-dasharray=".7 .5" opacity=".75"');
  if (o.band) g += line(seg(P, 0.86, 0.95), o.band, w + 0.9) + line(seg(P, 0.86, 0.95), light(o.band, 0.3), 0.5, ' opacity=".7"');
  if (o.wraps) g += line(seg(P, 0.84, 0.99), o.wraps, w + 0.6) + line(seg(P, 0.88, 0.95), dark(o.wraps, 0.3), 0.35, ' opacity=".6"');
  if (o.vitiligo && sl < 0.7) g += line(seg(P, 0.7, 0.82), o.vitiligo, w * 0.55, ' opacity=".9"');
  const [hx, hy] = handAt(s);
  if (o.gloves === "boxing") {
    g += line(seg(P, 0.8, 0.97), o.gloveCol2 || "#fff", w + 1.2);
    g += `<path d="M${X(s, 11.2)} 48.6 C${X(s, 10.2)} 52.6 ${X(s, 12.6)} 55.4 ${X(s, 15.4)} 55.2 C${X(s, 18.4)} 55 ${X(s, 19.4)} 52.2 ${X(s, 18.6)} 48.6 C${X(s, 18)} 45.8 ${X(s, 12.2)} 45.6 ${X(s, 11.2)} 48.6 Z" fill="${o.gloveCol}" stroke="${ink(o.gloveCol)}" stroke-width=".8"/>` +
      line(`M${X(s, 12.6)} 49.4 Q${X(s, 13.6)} 47.4 ${X(s, 15.6)} 47.4`, "#fff", 0.7, ' opacity=".55"') + line(`M${X(s, 17.6)} 50.2 Q${X(s, 18.4)} 52.6 ${X(s, 16.8)} 53.8`, dark(o.gloveCol, 0.3), 0.6, ' opacity=".7"');
  } else {
    const hc = o.gloves || skin, hol = o.gloves ? ink(o.gloves) : ol;
    g += dot(hx, hy, w * 0.5 + 0.35, hc, ` stroke="${hol}" stroke-width=".8"`);
    if (o.vitiligo && !o.gloves && s === "R") g += dot(hx + 0.6, hy - 0.4, w * 0.24, o.vitiligo);
  }
  if (o.handItem?.[s]) g += o.handItem[s];
  return g;
}

function shoeSvg(s, o) {
  const sh = o.shoes || {}, c = sh.color || "#f2f3f7", sole = sh.sole || "#ffffff", ol = ink(c);
  const Xs = x => X(s, x);
  if (sh.style === "bare") return `<path d="M${Xs(19.4)} 77.4 C${Xs(19.2)} 74.8 ${Xs(20.8)} 73.2 ${Xs(23.4)} 73.2 C${Xs(25.8)} 73.2 ${Xs(27.2)} 74.6 ${Xs(27.2)} 76.6 C${Xs(27.2)} 77.6 ${Xs(26.6)} 78 ${Xs(25.8)} 78 L${Xs(20.2)} 78 C${Xs(19.8)} 78 ${Xs(19.4)} 77.8 ${Xs(19.4)} 77.4 Z" fill="${o.skinFill}" stroke="${o.skinOl}" stroke-width=".8"/>` +
    line(`M${Xs(21)} 76.4 L${Xs(21)} 77.6 M${Xs(22.6)} 76.2 L${Xs(22.6)} 77.6`, o.skinOl, 0.4, ' opacity=".6"');
  const tall = sh.style === "high" || sh.style === "boot";
  const top = tall ? 70 : 72.8;
  let g = `<path d="M${Xs(18.8)} 77.6 C${Xs(18.6)} 74.6 ${Xs(20.4)} ${top} ${Xs(23.4)} ${top} C${Xs(26.2)} ${top} ${Xs(27.8)} 74.4 ${Xs(27.8)} 76.6 L${Xs(27.8)} 77.2 C${Xs(27.8)} 77.8 ${Xs(27.4)} 78.2 ${Xs(26.8)} 78.2 L${Xs(19.6)} 78.2 C${Xs(19.2)} 78.2 ${Xs(18.8)} 78 ${Xs(18.8)} 77.6 Z" fill="${c}" stroke="${ol}" stroke-width=".8"/>`;
  if (sh.style === "boot") g += line(`M${Xs(21.6)} 71.6 L${Xs(25)} 72.4 M${Xs(21.4)} 73.4 L${Xs(25.2)} 74.2`, sh.lace || "#e8d6a8", 0.55);
  g += `<path d="M${Xs(18.9)} 76.7 L${Xs(27.8)} 76.7 L${Xs(27.8)} 77.2 C${Xs(27.8)} 77.8 ${Xs(27.4)} 78.2 ${Xs(26.8)} 78.2 L${Xs(19.6)} 78.2 C${Xs(19.2)} 78.2 ${Xs(18.8)} 78 ${Xs(18.9)} 76.7 Z" fill="${sole}" stroke="${ol}" stroke-width=".5"/>`;
  if (sh.accent) g += line(`M${Xs(20.6)} 75.6 Q${Xs(23.4)} 74.2 ${Xs(26.6)} 75.8`, sh.accent, 0.9);
  if (sh.style === "cleat") g += [20.4, 23.2, 26].map(x => `<rect x="${r2(Xs(x) - 0.6)}" y="78.1" width="1.2" height="1" rx=".3" fill="${ink(sole)}"/>`).join("");
  if (sh.style === "spike") g += [20.6, 23, 25.6].map(x => `<path d="M${r2(Xs(x) - 0.5)} 78.1 L${Xs(x)} 79.2 L${r2(Xs(x) + 0.5)} 78.1 Z" fill="#9aa1ad"/>`).join("");
  g += line(`M${Xs(20.6)} ${top + 1.8} Q${Xs(22.4)} ${top + 0.8} ${Xs(24.6)} ${top + 0.9}`, "#fff", 0.6, ' opacity=".55"');
  return g;
}

function legSvg(s, o) {
  const P = LEG(s), w = o.build.leg, bt = o.bottom || {}, ol = o.skinOl;
  const full = ["leggings", "joggers", "pants"].includes(bt.style), F = `url(#${o.id}-bot)`, bol = ink(bt.color || "#000");
  if (o.seated) {
    const [hx] = P[0], kx = X(s, 25.2), fx = X(s, 24.8);
    const thigh = `M${hx} 47.6 Q${r2((hx + kx) / 2)} 51.6 ${kx} 55.6`, shin = `M${kx} 56 L${fx} 68.6`;
    let g = line(thigh, full ? bol : ol, w + 3.2) + line(thigh, full ? F : o.skinFill, w + 1.9);
    g += line(shin, full ? bol : ol, w + 1.3) + line(shin, full ? F : o.skinFill, w);
    if (bt.style === "shorts") g += line(thigh, bol, w + 3.4) + line(thigh, F, w + 2.2);
    return g + `<g transform="translate(${s === "L" ? 1.6 : -1.6} -7.4)">${shoeSvg(s, o)}</g>`;
  }
  let g = line(seg(P), full ? bol : ol, w + 1.3);
  g += line(seg(P), full ? F : o.skinFill, w + (bt.style === "joggers" || bt.style === "pants" ? 0.6 : 0));
  if (bt.style === "joggers") g += flat(seg(P, 0.86, 0.98), dark(bt.color, 0.22), w + 0.9);
  if (bt.stripe && full) g += line(seg(P, 0.02, 0.9), bt.stripe, 0.8, ` transform="translate(${s === "L" ? -w * 0.38 : w * 0.38} 0)"`);
  if (!full && bt.style && bt.style !== "none") {
    const t = bt.style === "skirt" ? 0.3 : bt.short || 0.38;
    g += line(seg(P, 0, t), bol, w + 2.6) + line(seg(P, 0, t), F, w + 1.4);
    if (bt.stripe) g += line(seg(P, 0.02, t - 0.02), bt.stripe, 0.8, ` transform="translate(${s === "L" ? -(w + 1.2) * 0.4 : (w + 1.2) * 0.4} 0)"`);
  }
  if (o.knee) g += flat(seg(P, 0.42, 0.62), ink(o.knee), w + 1.6) + flat(seg(P, 0.425, 0.615), o.knee, w + 0.6);
  if (o.socks && !full) g += line(seg(P, o.socksHigh ? 0.62 : 0.8, 1), ink(o.socks), w + 1.3) + line(seg(P, o.socksHigh ? 0.62 : 0.8, 1), o.socks, w + 0.2) + (o.socksStripe ? flat(seg(P, o.socksHigh ? 0.65 : 0.82, o.socksHigh ? 0.69 : 0.86), o.socksStripe, w + 0.3) : "");
  if (o.harness) g += flat(seg(P, 0.2, 0.25), o.harness, w + 1.2);
  if (o.blade === s) {
    // prothèse de course : emboîture puis lame en carbone en forme de « C »
    const k = at(P, 0.58), x = k[0], y = k[1];
    const blade = s === "L" ? `M${r2(x)} ${r2(y + 3)} C${r2(x - 0.4)} ${r2(y + 9)} ${r2(x + 3.2)} ${r2(y + 9.6)} ${r2(x + 3.6)} ${r2(y + 12.6)} C${r2(x + 4)} ${r2(y + 15.2)} ${r2(x + 1.6)} ${r2(y + 16.6)} ${r2(x - 2.2)} ${r2(y + 16.6)}`
      : `M${r2(x)} ${r2(y + 3)} C${r2(x + 0.4)} ${r2(y + 9)} ${r2(x - 3.2)} ${r2(y + 9.6)} ${r2(x - 3.6)} ${r2(y + 12.6)} C${r2(x - 4)} ${r2(y + 15.2)} ${r2(x - 1.6)} ${r2(y + 16.6)} ${r2(x + 2.2)} ${r2(y + 16.6)}`;
    g = line(seg(P, 0, 0.6), ol, w + 1.3) + line(seg(P, 0, 0.6), o.skinFill, w);
    if (!full && bt.style) g += line(seg(P, 0, bt.short || 0.38), bol, w + 2.6) + line(seg(P, 0, bt.short || 0.38), F, w + 1.4);
    g += `<rect x="${r2(x - w * 0.62)}" y="${r2(y - 1.6)}" width="${r2(w * 1.24)}" height="5.2" rx="1.6" fill="#c9ced8" stroke="#5b6170" stroke-width=".7"/>` +
      line(blade, "#141821", 3.4) + line(blade, "#2c3240", 2.2) + line(blade, "#7c8597", 0.5, ' opacity=".8"') +
      `<path d="M${r2(x + (s === "L" ? -3.4 : 3.4))} ${r2(y + 16)} l${s === "L" ? 3.6 : -3.6} 0 l0 1.4 l${s === "L" ? -3.8 : 3.8} 0 Z" fill="#141821"/>`;
    return g;
  }
  return g + shoeSvg(s, o);
}

// Chaussure seule (créatures en baskets)
export const sneaker = (s, shoes) => shoeSvg(s, { shoes, skinFill: "#000", skinOl: "#000" });

/* ---------- Un humain complet ---------- */
// o : { id, name, group, bio, persona, travel, climb, fx, lines,
//       skin (1 → 8 ou couleur), build (slim | fit | strong | big | curvy),
//       hair: { style, color }, beard: { style, color }, brows, eyes: { iris, lash, lid }, mouth,
//       face: { freckles, wrinkles, vitiligo, blush, glasses: { style, color }, earrings: { style, color } },
//       hat: { style, color, color2 }, top: { style, color, color2, number, print }, bottom: { style, color, color2, stripe },
//       shoes: { style, color, sole, accent }, socks, extras: […], gloves, band, wraps, knee, blade, seated, chair, board, back }
export function person(o) {
  const id = o.id, b = BUILDS[o.build || "fit"];
  const skin = typeof o.skin === "number" ? SKIN[o.skin - 1] : o.skin;
  const hairC = HAIR[o.hair?.color] || o.hair?.color || HAIR.black;
  const top = o.top || { style: "tee", color: "#e8283b" }, bottom = o.bottom || { style: "shorts", color: "#2a2f3d" };
  const face = o.face || {}, ex = new Set(o.extras || []);
  const sil = silhouette(b);
  const ctx = {
    id, build: b, skin, skinFill: `url(#${id}-skin)`, skinOl: ink(skin), top, bottom, topOl: ink(top.color),
    sleeve: top.sleeve ?? (SKIN_TOPS.has(top.style) ? 0 : SLEEVE[top.style] ?? 0.42), cuff: top.cuff, armStripe: top.armStripe,
    gloves: o.gloves?.style === "boxing" ? "boxing" : o.gloves?.color, gloveCol: o.gloves?.color, gloveCol2: o.gloves?.color2,
    band: o.band, wraps: o.wraps, knee: o.knee, socks: o.socks, socksHigh: o.socksHigh, socksStripe: o.socksStripe, shoes: o.shoes,
    blade: o.blade, seated: !!o.seated, harness: ex.has("harness") ? "#ff7a2f" : null, tattoo: ex.has("tattoo"), handItem: o.handItem,
    vitiligo: face.vitiligo ? mix(skin, "#fff2e6", 0.62) : null, abs: o.abs, waist: top.style === "tunic" ? 60 : 44.4,
  };
  const hair = hairStyle(o.hair?.style || "short", hairC, { id, tie: o.hair?.tie });
  const hat = o.hat ? hatStyle(o.hat, { id, hairColor: hairC }) : { over: "", top: null };

  const defs = rad(`${id}-skin`, light(skin, 0.1), dark(skin, 0.06), 0.4, 0.34, 0.8) +
    rad(`${id}-face`, light(skin, 0.12), dark(skin, 0.05), 0.42, 0.36, 0.72) +
    lin(`${id}-top`, light(top.color, 0.08), dark(top.color, 0.14)) +
    lin(`${id}-bot`, light(bottom.color || "#333", 0.05), dark(bottom.color || "#333", 0.16)) +
    lin(`${id}-hair`, light(hairC, 0.14), dark(hairC, 0.08)) +
    (o.hat ? lin(`${id}-hat`, light(o.hat.color, 0.08), dark(o.hat.color, 0.12)) : "") +
    `<clipPath id="${id}-tc"><path d="${sil}"/></clipPath>` + (o.defs || "");

  /* --- buste --- */
  let torso = `<rect x="26.8" y="19" width="6.4" height="8" rx="2.2" fill="url(#${id}-skin)" stroke="${ink(skin)}" stroke-width=".7"/>`;
  torso += `<g clip-path="url(#${id}-tc)"><rect x="10" y="20" width="40" height="44" fill="url(#${id}-skin)"/>${topSvg(top, ctx)}${bottomTorso(top.style === "swim" ? null : bottom, ctx)}` +
    (o.harness || ex.has("harness") ? `<path d="M10 44.6 L50 44.6 L50 46.6 L10 46.6 Z" fill="#ff7a2f"/>${line("M26 46.6 L24.6 50.4 M34 46.6 L35.4 50.4", "#ff7a2f", 1.2)}` : "") +
    `<rect x="${r2(30 + b.sw - 3.4)}" y="20" width="8" height="44" fill="#000" opacity=".07"/></g>`;
  torso += `<path d="${sil}" fill="none" stroke="${SKIN_TOPS.has(top.style) ? ink(skin) : ink(top.color)}" stroke-width=".85" stroke-linejoin="round"/>`;
  if (ex.has("belt")) torso += `<path d="M${r2(30 - b.ww - 0.8)} 40.8 L${r2(30 + b.ww + 0.8)} 40.8 L${r2(30 + b.ww + 0.6)} 46.2 L${r2(30 - b.ww - 0.6)} 46.2 Z" fill="#8a4b23" stroke="#4a230d" stroke-width=".7"/><rect x="27.2" y="41.6" width="5.6" height="3.8" rx=".6" fill="none" stroke="#d6d9e2" stroke-width="1"/>` + line(`M${r2(30 - b.ww)} 42 L${r2(30 + b.ww)} 42 M${r2(30 - b.ww)} 45 L${r2(30 + b.ww)} 45`, "#b8743f", 0.4, ' opacity=".6" stroke-dasharray="1 .8"');
  if (ex.has("gibelt")) torso += `<path d="M${r2(30 - b.ww - 0.6)} 42.8 Q30 44.2 ${r2(30 + b.ww + 0.6)} 42.8 L${r2(30 + b.ww + 0.5)} 45.4 Q30 46.8 ${r2(30 - b.ww - 0.5)} 45.4 Z" fill="${o.beltColor || "#1d1f26"}"/>` +
    `<path d="M29.2 44.4 L26.6 51.2 L28.4 51.4 L30 45.6 Z M30.8 44.4 L33.4 51.2 L31.6 51.4 L30 45.6 Z" fill="${o.beltColor || "#1d1f26"}"/><rect x="28.4" y="42.8" width="3.2" height="3.4" rx=".8" fill="${dark(o.beltColor || "#1d1f26", 0.2)}"/>`;
  if (ex.has("whistle")) torso += line("M26.2 25.4 Q27.4 30.6 30 33.4 Q32.6 30.6 33.8 25.4", o.cord || "#ffffff", 0.6) + `<path d="M28.4 33.4 L31.8 33.4 Q33 33.4 33 34.6 L33 35.8 Q33 36.8 31.8 36.8 L29.2 36.8 Q27.6 36.8 27.6 35.2 Q27.6 33.4 28.4 33.4 Z" fill="#c9ced8" stroke="#5c6271" stroke-width=".5"/>` + dot(31.6, 35.1, 0.55, "#5c6271");
  if (ex.has("headphones")) torso += line("M22.6 28.4 Q22.4 33 30 33.6 Q37.6 33 37.4 28.4", "#2a2d38", 1.1) + `<rect x="20.2" y="26.6" width="4.2" height="5" rx="2" fill="${o.phones || "#ff5a5f"}" stroke="#2a2d38" stroke-width=".6"/><rect x="35.6" y="26.6" width="4.2" height="5" rx="2" fill="${o.phones || "#ff5a5f"}" stroke="#2a2d38" stroke-width=".6"/>`;
  if (ex.has("towel")) torso += `<path d="M22.4 25.2 Q26 24.2 27 26.8 L26.2 39.6 Q24 40.6 22.4 39.6 Z M37.6 25.2 Q34 24.2 33 26.8 L33.8 39.6 Q36 40.6 37.6 39.6 Z" fill="#f4f5f8" stroke="#a5aab8" stroke-width=".6"/>` + line("M22.8 37.6 L26.4 37.6 M33.6 37.6 L37.2 37.6", o.towelStripe || "#4f8df5", 0.8);
  if (ex.has("bib")) torso += `<rect x="25.2" y="34.2" width="9.6" height="7.4" rx=".8" fill="#fbfbfd" stroke="#9aa0ad" stroke-width=".5"/><text x="30" y="40" text-anchor="middle" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="4.6" fill="#1d2230">${o.bibNumber || "42"}</text>` + dot(25.9, 34.9, 0.35, "#9aa0ad") + dot(34.1, 34.9, 0.35, "#9aa0ad");
  if (ex.has("straps")) torso += `<path d="M22.6 25.4 L25.6 25 L25.4 41.6 L22.8 41.6 Z M37.4 25.4 L34.4 25 L34.6 41.6 L37.2 41.6 Z" fill="${o.packColor ? dark(o.packColor, 0.15) : "#3c4456"}" stroke="${ink(o.packColor || "#3c4456")}" stroke-width=".5"/>` + line("M25.4 35.4 L34.6 35.4", o.packColor ? dark(o.packColor, 0.15) : "#3c4456", 1);
  if (ex.has("chalk")) torso += `<path d="M37.8 45.4 L42.4 45.4 L42.8 51.4 Q40.1 52.6 37.4 51.4 Z" fill="#e94f37" stroke="#8a2414" stroke-width=".6"/>` + line("M37.6 46.4 L42.6 46.4", "#fff", 0.8);
  if (ex.has("medal")) torso += line("M26.6 25.5 L30 33 L33.4 25.5", "#3b6ff0", 1.6) + dot(30, 35.4, 3, "#f5c542", ' stroke="#b8860b" stroke-width=".7"');
  if (o.torsoExtra) torso += o.torsoExtra;

  /* --- tête --- */
  const ears = hair.ears && !hat.hijab;
  let head = hair.back;
  if (ears) {
    const ear = shape(EAR, `url(#${id}-skin)`, ink(skin), 0.75) + line("M17.6 14.2 C16.7 14.5 16.7 16.2 17.9 16.8", dark(skin, 0.28), 0.55);
    head += ear + `<g transform="translate(60 0) scale(-1 1)">${ear}</g>`;
  }
  head += shape(FACE, `url(#${id}-face)`, ink(skin), 0.8);
  if (face.vitiligo) head += `<path d="M33.6 9.6 C36.6 8.8 39.8 10.6 40 13.8 C40.2 16.4 38 17.8 35.8 17.2 C34.2 16.8 33.4 15.2 33.8 13.8 C32.6 12.8 32.4 10.6 33.6 9.6 Z M24.4 23.6 C26 22.6 28 23.4 28.4 24.8 C27 25.8 25.4 25.6 24.4 23.6 Z" fill="${ctx.vitiligo}"/>`;
  if (face.wrinkles) head += line("M19.8 14.2 L18.8 13.6 M19.8 15.6 L18.6 15.6 M40.2 14.2 L41.2 13.6 M40.2 15.6 L41.4 15.6 M26.6 8.6 Q30 7.8 33.4 8.6", dark(skin, 0.3), 0.45, ' opacity=".8"') + line("M22.8 18.6 Q24.6 19.4 26.4 18.6 M33.6 18.6 Q35.4 19.4 37.2 18.6", dark(skin, 0.22), 0.4, ' opacity=".7"');
  if (face.blush !== false) head += `<ellipse cx="21.7" cy="19.5" rx="2.1" ry="1.25" fill="${mix(skin, "#ff5d5d", 0.5)}" opacity="${o.skin >= 6 ? 0.4 : 0.42}"/><ellipse cx="38.3" cy="19.5" rx="2.1" ry="1.25" fill="${mix(skin, "#ff5d5d", 0.5)}" opacity="${o.skin >= 6 ? 0.4 : 0.42}"/>`;
  if (face.freckles) head += [[21.3, 18.2], [22.5, 18.9], [21.2, 19.9], [23.4, 18], [38.7, 18.2], [37.5, 18.9], [38.8, 19.9], [36.6, 18], [29.2, 17.8], [30.9, 17.9]].map(([x, y]) => dot(x, y, 0.32, dark(skin, 0.3), ' opacity=".75"')).join("");
  const beardC = HAIR[o.beard?.color] || o.beard?.color || hairC;
  if (o.beard?.style === "full" || o.beard?.style === "short") head += shape(BEARD[o.beard.style], o.beard.style === "short" ? beardC : `url(#${id}-beard)`, o.beard.style === "short" ? null : ink(beardC), 0.7, o.beard.style === "short" ? ' opacity=".42"' : "");
  head += line("M29.2 18.5 Q30 19.3 30.8 18.5", dark(skin, 0.32), 0.65); // nez
  head += (MOUTH[o.mouth || "smile"] || MOUTH.smile)(o.lips || dark(mix(skin, "#b3363a", 0.5), 0.25));
  if (o.beard?.style === "full" || o.beard?.style === "mustache" || o.beard?.style === "goatee") head += shape(o.beard.style === "mustache" ? STACHE_BIG : STACHE, `url(#${id}-beard)`, ink(beardC), 0.5);
  if (o.beard?.style === "goatee") head += shape(BEARD.goatee, `url(#${id}-beard)`, ink(beardC), 0.5);
  const browC = o.browColor || (["blond", "platinum", "white", "grey"].includes(o.hair?.color) ? dark(hairC, 0.32) : dark(hairC, 0.06));
  const eyeC = o.eyes?.color || "#2a1a14";
  head += eyePair(5.3, 15.3, { color: eyeC, iris: o.eyes?.iris, lash: o.eyes?.lash, lid: o.eyes?.lid ? skin : null, rx: o.eyes?.rx, ry: o.eyes?.ry });
  const [bd, bw] = BROWS[o.brows || "soft"];
  head += line(bd, browC, bw) + line(mir(bd), browC, bw);
  if (face.glasses) {
    const gc = face.glasses.color || "#2b2f3a";
    head += face.glasses.style === "square"
      ? `<rect x="21" y="12.6" width="7.4" height="5.6" rx="1.8" fill="#fff" fill-opacity=".14" stroke="${gc}" stroke-width=".85"/><rect x="31.6" y="12.6" width="7.4" height="5.6" rx="1.8" fill="#fff" fill-opacity=".14" stroke="${gc}" stroke-width=".85"/>`
      : `<circle cx="24.7" cy="15.4" r="3.4" fill="#fff" fill-opacity=".14" stroke="${gc}" stroke-width=".85"/><circle cx="35.3" cy="15.4" r="3.4" fill="#fff" fill-opacity=".14" stroke="${gc}" stroke-width=".85"/>`;
    head += line("M28.2 15 Q30 14.2 31.8 15 M21.2 14.6 L18.4 13.8 M38.8 14.6 L41.6 13.8", gc, 0.7) + line("M22.4 13.8 L23.6 12.9 M33 13.8 L34.2 12.9", "#fff", 0.5, ' opacity=".7"');
  }
  head += hair.front + (hair.over || "") + hat.over;
  if (face.earrings && !hat.hijab && ears) {
    const ec = face.earrings.color || "#f2c14e";
    head += face.earrings.style === "hoop" ? `<circle cx="17.6" cy="20.2" r="1.5" fill="none" stroke="${ec}" stroke-width=".6"/><circle cx="42.4" cy="20.2" r="1.5" fill="none" stroke="${ec}" stroke-width=".6"/>`
      : dot(17.6, 19.4, 0.6, ec) + dot(42.4, 19.4, 0.6, ec);
  }
  if (o.headExtra) head += o.headExtra;

  const beardDef = o.beard ? lin(`${id}-beard`, light(beardC, 0.12), dark(beardC, 0.1)) : "";
  const topY = Math.max(Math.min(hair.top, hat.top ?? 99, 2.2) - 1.4, -5.4), bottomY = o.beard?.style === "full" ? 29.2 : hat.hijab ? 30.6 : 28;
  const size = r2(Math.max(bottomY - topY, 26.6)), cx = 30;
  /* --- dans le dos : sac, planche, fauteuil… --- */
  let back = o.back || "";
  if (ex.has("backpack")) back += `<rect x="16.4" y="27" width="27.2" height="21" rx="5" fill="${o.packColor || "#3c4456"}" stroke="${ink(o.packColor || "#3c4456")}" stroke-width=".8"/>` + `<rect x="20.4" y="23.4" width="19.2" height="6" rx="3" fill="${dark(o.packColor || "#3c4456", 0.18)}"/>`;
  if (ex.has("mat")) { const m = o.matColor || "#8f6cf0"; back += `<g transform="rotate(-32 30 34)"><rect x="8.4" y="30.4" width="43.2" height="6.4" rx="3.2" fill="${m}" stroke="${ink(m)}" stroke-width=".7"/>` +
    `<ellipse cx="51.4" cy="33.6" rx="2.2" ry="3.2" fill="${light(m, 0.25)}" stroke="${ink(m)}" stroke-width=".6"/>${line("M51.4 33.6 m0 -1.6 a1.2 1.6 0 1 1 -1 1.4", ink(m), 0.45)}${line("M18 30.6 L18 36.6 M42 30.6 L42 36.6", "#2a2d38", 0.9)}</g>`; }
  if (o.board) back += boardSvg(o.board);
  if (o.chair) back += chairSvg(o.chair);

  const css = [o.css || "",
    hair.tail ? `@media (prefers-reduced-motion: no-preference) { .ch-${id} .kit-tail { transform-origin: ${hair.tail[0]}px ${hair.tail[1]}px; animation: kitSway 2.6s ease-in-out infinite; } }` : "",
    o.seated || o.board ? `.sp.ch-${id} .sp-legL, .sp.ch-${id} .sp-legR { animation: none !important; transform: none !important; }` : "",
  ].filter(Boolean).join("\n");

  return {
    id, name: o.name, group: o.group, bio: o.bio, persona: o.persona, travel: o.travel || "walk", climb: !!o.climb,
    fx: o.fx, lines: o.lines, aliases: o.aliases,
    defs: defs + beardDef, back,
    legL: legSvg("L", ctx), legR: legSvg("R", ctx), armL: armSvg("L", ctx), armR: armSvg("R", ctx),
    torso, head: `<g transform="${HEAD_T}">${head}</g>`, headT: HEAD_T, css, faceBox: big([r2(cx - size / 2), r2(topY), size]),
  };
}

// Planche de skate, vue de profil sous les pieds
function boardSvg(b) {
  const c = b.color || "#ff5a5f";
  return `<path d="M12.6 76.4 Q13 78.6 15.6 78.8 L44.4 78.8 Q47 78.6 47.4 76.4 Q46.6 77.4 44.6 77.4 L15.4 77.4 Q13.4 77.4 12.6 76.4 Z" fill="${c}" stroke="${ink(c)}" stroke-width=".7"/>` +
    `<rect x="17.6" y="78.8" width="5" height="1.2" fill="#9aa0ad"/><rect x="37.4" y="78.8" width="5" height="1.2" fill="#9aa0ad"/>` +
    `<circle cx="18.6" cy="80.8" r="1.6" fill="${b.wheels || "#ffd23f"}" stroke="#5b4a10" stroke-width=".5"/><circle cx="21.8" cy="80.8" r="1.6" fill="${b.wheels || "#ffd23f"}" stroke="#5b4a10" stroke-width=".5"/>` +
    `<circle cx="38.2" cy="80.8" r="1.6" fill="${b.wheels || "#ffd23f"}" stroke="#5b4a10" stroke-width=".5"/><circle cx="41.4" cy="80.8" r="1.6" fill="${b.wheels || "#ffd23f"}" stroke="#5b4a10" stroke-width=".5"/>`;
}

// Fauteuil de sport (roues inclinées, dossier, repose-pieds) : vu de face, derrière le corps
function chairSvg(ch) {
  const c = ch.color || "#2f6fed";
  const wheel = s => `<g transform="rotate(${s === "L" ? 11 : -11} ${X(s, 13.8)} 60)"><ellipse cx="${X(s, 13.8)}" cy="60" rx="4.2" ry="14.4" fill="#2a2d38" stroke="#121419" stroke-width=".8"/>` +
    `<ellipse cx="${X(s, 13.8)}" cy="60" rx="3" ry="12.2" fill="none" stroke="#d6dae3" stroke-width=".9"/><ellipse cx="${X(s, 13.8)}" cy="60" rx="1.3" ry="1.9" fill="${c}" stroke="#121419" stroke-width=".4"/>` +
    line(`M${X(s, 13.8)} 48.6 L${X(s, 13.8)} 71.4 M${X(s, 11.6)} 52 L${X(s, 16)} 68 M${X(s, 16)} 52 L${X(s, 11.6)} 68`, "#8b93a3", 0.35, ' opacity=".8"') + "</g>";
  return `<rect x="19.6" y="34" width="20.8" height="16" rx="3" fill="${dark(c, 0.25)}" stroke="${ink(c)}" stroke-width=".7"/>` +
    wheel("L") + wheel("R") +
    `<path d="M20.4 50.4 L39.6 50.4 L41.2 54 L18.8 54 Z" fill="${c}" stroke="${ink(c)}" stroke-width=".7"/>` +
    line("M22.6 54 L24.2 69.4 M37.4 54 L35.8 69.4", "#8b93a3", 1.1) + `<rect x="20.8" y="69.2" width="18.4" height="2" rx="1" fill="#2a2d38"/>` +
    `<circle cx="21.4" cy="74.6" r="1.6" fill="#2a2d38"/><circle cx="38.6" cy="74.6" r="1.6" fill="#2a2d38"/>`;
}
