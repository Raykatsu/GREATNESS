// Planche d'anatomie dessinée : un corps de face et un de dos, muscle par muscle, avec le relief (sillons et stries).
// Le corps entier est en muscle gris (comme une planche d'anatomie) ; le muscle visé passe en rouge (principal) ou
// orange (secondaire). Tout est en SVG, hors ligne, sans image sous licence. bodyMap() garde l'API et les classes de
// l'ancienne silhouette (mus p / mus s / mz / mus rcN). Repère : chaque corps tient dans 120 de large sur 236 de haut,
// axe du corps en x = 60. Un muscle symétrique est dessiné à gauche (x ≤ 60) puis reflété autour de x = 60.
const MIRROR = "matrix(-1 0 0 1 120 0)";
const dup = inner => `${inner}<g transform="${MIRROR}">${inner}</g>`;

// Un membre = une capsule (rectangle à bouts ronds) entre deux points, d'épaisseur w
function limb(ax, ay, bx, by, w) {
  const L = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  return `<rect x="${(cx - L / 2).toFixed(1)}" y="${(cy - w / 2).toFixed(1)}" width="${L.toFixed(1)}" height="${w}" rx="${w / 2}" transform="rotate(${a.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
}

/* ---------- Base du corps (gris plein, formes simples et symétriques) ---------- */
const TORSO = "M31 46Q27 46 29 52L35 90Q37 99 45 100L75 100Q83 99 85 90L91 52Q93 46 89 46Z";
const PELVIS = "M44 98L76 98Q81 98 81 104L79 116Q77 126 60 126Q43 126 41 116L39 104Q39 98 44 98Z";
const NECK = "M53 31h14v8q-3 3-7 3t-7-3z";
const RIGHT = limb(84, 52, 93, 101, 16)        // bras (haut)
  + limb(93, 102, 95, 151, 12)                 // avant-bras
  + `<rect x="90" y="150" width="9.5" height="16" rx="4.5"/>` // main
  + limb(74, 123, 70, 178, 22)                 // cuisse
  + limb(69, 180, 68, 226, 14)                 // jambe
  + `<path d="M64 224q-3 6-2 9l14 0q1-4-2-9z"/>`; // pied
const BASE = `<circle cx="60" cy="19" r="13.5"/><path d="${NECK}"/><path d="${TORSO}"/><path d="${PELVIS}"/>${dup(RIGHT)}`;

/* ---------- Muscles ---------- */
const FRONT = [
  ["traps", true, ["M60 37C56 38 52 41 50 46C54 45 58 44 60 44Z"]],
  ["delts", true, ["M50 46C43 47 36 51 33 59C32 64 34 70 39 71C44 68 50 62 53 55C53 50 52 47 50 46Z"]],
  ["pecs", true, ["M59 47C51 47 42 50 39 56C37 62 39 69 45 72C51 74 56 72 59 67C60 61 60 53 59 47Z"]],
  ["biceps", true, ["M39 58C35 64 33 73 34 82C35 88 38 91 42 89C44 86 45 78 44 69C43 63 42 59 39 58Z"]],
  ["forearms", true, ["M34 94C31 101 30 112 31 123C32 130 35 134 39 132C41 129 41 120 40 110C39 102 37 96 34 94Z"]],
  ["abs", false, ["M54 70h12v7.5h-12z M54 79h12v7.5h-12z M54 88h12v7.5h-12z M55 97h10c0 6.5-2 11.5-5 14c-3-2.5-5-7.5-5-14z"]],
  ["obliques", true, ["M50 71C46 78 45 89 47 100C50 98 54 91 55 85L55 72Z"]],
  ["quads", true, ["M57 127C48 129 43 138 43 151C43 163 48 172 54 175C57 172 58 163 58 152C58 141 59 133 57 127Z"]],
  ["adductors", true, ["M59 130C53 134 51 145 52 156C53 164 56 169 59 170C60 157 60 141 59 130Z"]],
  ["calves", true, ["M54 183C48 190 46 203 48 216C51 219 56 218 57 215C58 202 58 190 57 183Z"]],
];
const BACK = [
  ["traps", false, ["M60 37C53 39 47 43 44 51C48 53 54 58 60 68C66 58 72 53 76 51C73 43 67 39 60 37Z"]],
  ["lats", true, ["M58 63C47 65 40 73 38 85C37 95 43 104 51 106C55 102 58 91 59 80C60 73 60 69 58 63Z"]],
  ["delts", true, ["M50 47C43 48 36 52 33 60C32 65 34 71 39 72C44 69 50 63 53 56C53 51 52 48 50 47Z"]],
  ["triceps", true, ["M39 59C35 65 33 74 34 83C35 89 38 92 42 90C44 87 45 79 44 70C43 64 42 60 39 59Z"]],
  ["forearms", true, ["M34 95C31 102 30 113 31 124C32 131 35 135 39 133C41 130 41 121 40 111C39 103 37 97 34 95Z"]],
  ["lowerback", false, ["M54 96C53 103 53 112 55 118L60 120L65 118C67 112 67 103 66 96Z"]],
  ["glutes", true, ["M56 117C47 118 41 125 41 135C41 145 47 151 54 150C57 149 58 141 58 133C58 125 58 120 56 117Z"]],
  ["hams", true, ["M57 160C48 162 44 173 44 186C44 196 48 202 53 201C56 197 58 185 58 174C59 166 58 164 57 160Z"]],
  ["calves", true, ["M54 199C48 206 46 219 48 231C51 234 56 233 57 230C58 217 58 206 57 199Z"]],
];
// Sillons sombres + stries : relief, toujours gris, dessinés par-dessus.
const GROOVE_F = ["M60 47V113", "M44 72C47 84 49 97 50 112", "M43 57C40 66 39 75 40 84",
  "M53 130C51 143 51 158 54 176", "M58 130C57 145 57 160 58 176", "M51 185C49 195 49 207 52 216"];
const GROOVE_B = ["M60 49V156", "M48 68C46 80 46 94 50 108", "M39 86C38 97 40 106 47 109",
  "M51 164C49 176 49 190 53 200", "M44 139C43 147 47 153 52 155", "M51 201C49 211 50 221 54 230"];
const RIM_F = ["M41 50C36 53 33 58 33 65", "M58 48C55 53 55 61 57 68"];
const RIM_B = ["M42 52C37 55 34 60 34 67", "M41 67C40 77 42 89 49 104"];

const paths = ds => ds.map(d => `<path d="${d}"/>`).join("");
const muscles = (list, c) => list.map(([m, s, ds]) =>
  `<g class="${c(m)}">${s ? dup(paths(ds)) : paths(ds)}</g>`).join("");
const strokes = (cls, list) => list.map(d => `<path class="${cls}" d="${d}"/><path class="${cls}" d="${d}" transform="${MIRROR}"/>`).join("");

function oneBody(list, grooves, rims, c, label) {
  return `<g class="anat"><g class="base">${BASE}</g>${muscles(list, c)}${strokes("rim", rims)}${strokes("gv", grooves)}<text x="60" y="244">${label}</text></g>`;
}

// mus : { p:[muscles principaux], s:[secondaires] }, ou cls : fonction libre (carte de récupération)
export function bodyMap(mus = {}, { cls, label = "Muscles travaillés" } = {}) {
  const p = new Set(mus.p || []), s = new Set(mus.s || []);
  const c = cls || (m => (p.has(m) ? "mus p" : s.has(m) ? "mus s" : "mz"));
  return `<svg class="body-map anat-map" viewBox="0 0 252 250" role="img" aria-label="${label}">
    <g transform="translate(2 3)">${oneBody(FRONT, GROOVE_F, RIM_F, c, "Face")}</g>
    <g transform="translate(134 3)">${oneBody(BACK, GROOVE_B, RIM_B, c, "Dos")}</g></svg>`;
}
