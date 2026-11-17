// Planche d'anatomie réaliste : deux rendus 3D (face, dos) du modèle anatomique libre BodyParts3D / Z-Anatomy
// (CC BY-SA), fabriqués hors de l'app par tools/anatomy (Blender). Le corps est en gris ; chaque groupe musculaire
// de l'app a son masque (ses parties visibles, vue par vue). Pour allumer un muscle, on superpose l'image « éclairée »
// (muscles gris clair) multipliée par la couleur du rôle et découpée par le masque : le relief et les fibres restent.
// bodyMap() garde son API et ses classes : mus p (principal), mus s (aide), mus st (stabilisateur), mus an
// (antagoniste), mus rc0 à rc3 (récupération), mz (non sollicité).
export const ANAT_DIR = "assets/anatomy/";
export const ANAT_VIEWS = ["front", "back"];
// Groupes musculaires de l'app (mêmes clés que MUSCLES dans body.js) : un masque par vue pour chacun
export const ANAT_GROUPS = ["pecs", "delts", "traps", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lowerback",
  "glutes", "quads", "hams", "adductors", "abductors", "calves", "hipflex"];
// Tous les fichiers de la planche, écorchés naturels compris (mis en cache hors ligne par sw.js)
export const ANAT_FILES = ANAT_VIEWS.flatMap(v => [v, `${v}-light`, `natural-${v}`, ...ANAT_GROUPS.map(g => `${v}-${g}`)]).map(f => `${ANAT_DIR}${f}.webp`);
// Crédit exigé par la licence du modèle
export const ANAT_CREDIT = "Anatomie 3D : BodyParts3D (Database Center for Life Science, CC BY-SA 2.1 JP) et Z-Anatomy (CC BY-SA 4.0)";

const COLOR = { p: "var(--mus1)", s: "var(--mus2)", st: "var(--mus-st)", an: "var(--mus-an)", rc0: "var(--rc0)", rc1: "var(--rc1)", rc2: "var(--rc2)", rc3: "var(--rc3)" };
const roleOf = c => { const t = String(c || "").split(" ")[1]; return t && COLOR[t] ? t : null; };

function figure(view, c, caption) {
  const layers = ANAT_GROUPS.map(m => {
    const k = roleOf(c(m));
    if (!k) return "";
    const mask = `url(${ANAT_DIR}${view}-${m}.webp)`;
    return `<i class="ar-l" data-m="${m}" style="background-color:${COLOR[k]};background-image:url(${ANAT_DIR}${view}-light.webp);-webkit-mask-image:${mask};mask-image:${mask}"></i>`;
  }).join("");
  return `<span class="ar-fig"><span class="ar-pic"><img src="${ANAT_DIR}${view}.webp" alt="" draggable="false" decoding="async"/>${layers}</span><em class="ar-cap">${caption}</em></span>`;
}

// mus : { p:[muscles principaux], s:[secondaires] }, ou cls : fonction libre (carte de récupération, rôles d'un mouvement)
export function bodyMap(mus = {}, { cls, label = "Muscles travaillés" } = {}) {
  const p = new Set(mus.p || []), s = new Set(mus.s || []);
  const c = cls || (m => (p.has(m) ? "mus p" : s.has(m) ? "mus s" : "mz"));
  return `<span class="body-map anat-map ar-map" role="img" aria-label="${label}">${figure("front", c, "Face")}${figure("back", c, "Dos")}</span>`;
}
