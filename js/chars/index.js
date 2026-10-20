// Registre des coachs animés : tous des personnages originaux de l'app.
// Alex (./base.js) est chargée d'office (coach par défaut) ; les autres familles arrivent à la demande
// par import dynamique (./salle.js, ./sports.js, ./nature.js, ./zen.js, ./compagnons.js, chacun
// « export default [ ...personnages ] »). Un fichier absent ou invalide est simplement ignoré.
// Le format d'un personnage est décrit en tête de ./kit.js.
import alex from "./base.js";
import { state, save } from "../store.js";
import { costumeOf } from "../costumes.js";
import { wornCostume } from "../story.js";

export const GROUPS = ["Salle", "Sports", "Nature", "Zen", "Compagnons"];
const FILES = { "Salle": "./salle.js", "Sports": "./sports.js", "Nature": "./nature.js", "Zen": "./zen.js", "Compagnons": "./compagnons.js" };
export const TRAVELS = { fly: "Vole", hop: "Sautille", dash: "Fonce", walk: "Marche", roll: "Roule" };
const TRAILS = ["none", "sparks", "hearts", "stars", "smoke", "bubbles", "leaves", "aura", "snow"];
// Anciens coachs (avant les personnages originaux) → le nouveau coach le plus proche
export const LEGACY = {
  spider: "alex", knight: "moussa", nova: "sofia", titan: "manu", captain: "alex", amazon: "awa", harley: "fatou",
  ninja: "yuki", saiyan: "kenji", pirate: "diego", moon: "priya", pika: "braise",
  kitty: "mochi", panda: "paco", bunny: "axo", penguin: "flocon", hamster: "pepite",
  shiba: "pepite", fox: "braise", blackcat: "mochi", frog: "axo", bear: "flocon",
};
const PARTS = ["legL", "legR", "armL", "armR", "torso", "head"];
const LINES = ["hello", "tap", "pr", "rest", "sleep"];

const pick = a => a[Math.floor(Math.random() * a.length)];
const hasDom = () => typeof document !== "undefined" && typeof document.createElementNS === "function";

/* ---------- Validation ---------- */
function validate(c, group) {
  const bad = why => { console.warn(`[coachs] « ${c?.name || c?.id || "?"} » ignoré : ${why}`); return null; };
  if (!c || typeof c !== "object") return bad("ce n'est pas un objet");
  if (typeof c.id !== "string" || !/^[a-z][a-z0-9_-]{1,31}$/.test(c.id)) return bad("id invalide");
  if (byId.has(c.id)) return bad("id déjà utilisé");
  if (typeof c.name !== "string" || !c.name.trim()) return bad("nom manquant");
  for (const k of PARTS) if (typeof c[k] !== "string" || !c[k].trim()) return bad(`calque « ${k} » manquant`);
  if (!/sp-eyeL/.test(c.head) || !/sp-eyeR/.test(c.head)) console.warn(`[coachs] ${c.id} : yeux (sp-eyeL / sp-eyeR) introuvables, pas de clignement`);
  const travel = TRAVELS[c.travel] ? c.travel : "walk";
  const color = typeof c.fx?.color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.fx.color) ? c.fx.color : "#e8283b";
  const lines = {};
  for (const k of LINES) lines[k] = Array.isArray(c.lines?.[k]) ? c.lines[k].filter(s => typeof s === "string" && s.trim()) : [];
  return Object.freeze({
    ...c,
    group: GROUPS.includes(c.group) ? c.group : group,
    bio: typeof c.bio === "string" ? c.bio : "",
    persona: typeof c.persona === "string" ? c.persona : "",
    travel,
    climb: !!c.climb && travel !== "roll",
    fx: Object.freeze({ color, trail: TRAILS.includes(c.fx?.trail) ? c.fx.trail : "none" }),
    defs: typeof c.defs === "string" ? c.defs : "",
    back: typeof c.back === "string" ? c.back : "",
    css: typeof c.css === "string" ? c.css : "",
    lines: Object.freeze(lines),
  });
}

/* ---------- Catalogue ---------- */
const byId = new Map();
const base = validate(alex, "Salle");
byId.set(base.id, base);

// « Aucun personnage » : coach neutre (un simple badge) quand on masque les personnages.
// Il n'est pas dans la galerie comme les autres : il remplace le coach choisi tant que profile.mascot === false.
const BOLT = "M31.6 6.2 22.4 18.4h6.1l-2.2 10.4 9.5-13.2h-6.3z";
const NONE = Object.freeze({
  ...validate({
    id: "none", name: "Coach", group: "Salle", travel: "walk", fx: { color: "#e8283b", trail: "none" },
    bio: "Sans personnage : l'app reste sobre, ton coach te répond toujours.",
    persona: "Coach sportif expert, précis et bienveillant, au ton direct et motivant, sans jeu de rôle ni personnage.",
    defs: `<linearGradient id="none-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d5e"/><stop offset="1" stop-color="#b8101f"/></linearGradient>`,
    legL: "<g/>", legR: "<g/>", armL: "<g/>", armR: "<g/>", torso: "<g/>",
    head: `<circle cx="30" cy="17.5" r="12.5" fill="url(#none-bg)"/><path d="${BOLT}" fill="#fff"/><g class="sp-eyes"><g class="sp-eyeL"/><g class="sp-eyeR"/></g>`,
  }, "Salle"),
});
export const charsOn = () => state.profile?.mascot !== false;
let list = [base];
const status = Object.fromEntries(GROUPS.map(g => [g, "idle"])); // idle | loading | ok | missing
const pending = {};

const order = c => GROUPS.indexOf(c.group);
function sortList() {
  const pos = new Map(list.map((c, i) => [c.id, i]));
  list = list.slice().sort((a, b) => (a.id === base.id ? -1 : b.id === base.id ? 1 : order(a) - order(b) || pos.get(a.id) - pos.get(b.id)));
}

export function loadGroup(g) {
  if (!FILES[g]) return Promise.resolve([]);
  if (pending[g]) return pending[g];
  status[g] = "loading";
  pending[g] = import(FILES[g])
    .then(m => {
      const raw = Array.isArray(m.default) ? m.default : m.default ? [m.default] : [];
      const added = [];
      for (const c of raw) { const v = validate(c, g); if (v) { byId.set(v.id, v); list.push(v); added.push(v); } }
      sortList();
      status[g] = "ok";
      return added;
    })
    .catch(err => { console.warn(`[coachs] univers « ${g} » indisponible :`, err?.message || err); status[g] = "missing"; return []; })
    .finally(() => emit("sync"));
  return pending[g];
}

let allP = null;
export function loadAll() {
  allP ||= Promise.all(GROUPS.map(loadGroup)).then(() => list.slice());
  return allP;
}

export const all = () => list.slice();
export const byIdGet = id => byId.get(id) || byId.get(LEGACY[id]);
export const groupStatus = g => status[g];
export const current = () => (charsOn() ? byIdGet(state.profile?.coach) || base : NONE);
export const none = () => NONE;
export const coachName = () => current().name;
export const coachPersona = () => current().persona;
export function coachLine(kind, c = current()) {
  const l = c.lines?.[kind];
  return l?.length ? pick(l) : "";
}

/* ---------- Changement de coach ---------- */
const subs = new Set();
let shown = base.id;
// Prévient les abonnés si le coach effectif a changé (choix, connexion, univers enfin chargé).
function emit(why) {
  const c = current();
  if (c.id === shown && why !== "costume") return;
  shown = c.id;
  subs.forEach(fn => { try { fn(c, why); } catch (e) { console.warn(e); } });
}
export const sync = () => emit("sync");
// Nouveau costume : tous les dessins du coach se mettent à jour
export const refreshLook = () => emit("costume");
export function onCoachChange(fn) { subs.add(fn); return () => subs.delete(fn); }

export async function setCoach(id) {
  if (id === "none") return setCharsOn(false), NONE;
  let c = byIdGet(id);
  if (!c) { await loadAll(); c = byIdGet(id); }
  if (!c) return null;
  const was = charsOn();
  if (state.profile.coach !== c.id || !was) { state.profile.coach = c.id; state.profile.mascot = true; save(); }
  emit("set");
  return c;
}

// Afficher ou masquer les personnages (mascotte, visages) ; le choix suit le compte et l'appareil.
export function setCharsOn(on) {
  if (charsOn() !== on) { state.profile.mascot = on; save(); }
  try { localStorage.setItem("greatness.chars", on ? "on" : "off"); } catch { /* mode privé */ }
  emit("set");
}

/* ---------- Rendu SVG ---------- */
const DB = '<g class="sp-db"><rect x="39.5" y="48.6" width="12.4" height="1.9" rx=".9" fill="#9aa0ad"/><rect x="38" y="45.6" width="3" height="7.8" rx="1" fill="#2b2f3a"/><rect x="50.4" y="45.6" width="3" height="7.8" rx="1" fill="#2b2f3a"/></g>';
const ZZZ = '<g class="sp-zzz" fill="#cfd6ff" font-family="Outfit, sans-serif" font-weight="800"><text x="40" y="6" font-size="6">z</text><text x="45" y="0" font-size="8">z</text><text x="51" y="-7" font-size="10">Z</text></g>';

// Chaque dessin reçoit ses propres id (plusieurs coachs, ou le même plusieurs fois, coexistent).
// Le préfixe commence par « sp » : la copie faite par l'onglet Coach les renomme correctement.
let uid = 0;
const rx = id => id.replace(/[-]/g, "\\-");
function scope(html, c, u) {
  return html.replace(new RegExp(`(\\bid="|url\\(['"]?#|href="#)(${rx(c.id)}-)`, "g"), `$1${u}$2`);
}

const injected = new Set();
export function ensureCss(c) {
  if (!c.css || injected.has(c.id) || !hasDom()) return;
  injected.add(c.id);
  const st = document.createElement("style");
  st.dataset.coachCss = c.id;
  st.textContent = c.css;
  document.head.appendChild(st);
}

// Costume porté (mode histoire) : celui du profil s'il a été gagné ; jamais sur le coach neutre
const wearing = (c, costume) => (c.id === "none" ? null : costumeOf(costume === undefined ? wornCostume(state) : costume));
const look = w => (w?.filter ? ` style="filter:${w.filter}"` : "");
// accessoire de tête (repère standard), agrandi comme la tête du personnage s'il le faut
const acc = (c, svg) => `<g class="sp-acc">${c.headT ? `<g transform="${c.headT}">${svg}</g>` : svg}</g>`;

// Personnage entier : <svg class="sp pose-… ch-…"> avec les calques dans l'ordre du format.
// costume : identifiant (aperçu), null (aucun), ou absent (celui que porte le coach)
export function figure(c = current(), { pose = "idle", cls = "", costume } = {}) {
  ensureCss(c);
  const u = `sp${++uid}-`, w = wearing(c, costume), back = (c.back || "") + (w?.back || "");
  const body = `<g class="sp-body"><g class="sp-char ch-${c.id}">${back ? `<g class="sp-back">${back}</g>` : ""}<g class="sp-legL">${c.legL}</g><g class="sp-legR">${c.legR}</g><g class="sp-armL">${c.armL}</g><g class="sp-torso">${c.torso}${w?.torso ? `<g class="sp-acc">${w.torso}</g>` : ""}</g><g class="sp-armR">${c.armR}${DB}</g><g class="sp-head">${c.head}${w?.head ? acc(c, w.head) : ""}</g></g>${ZZZ}</g>`;
  return `<svg class="sp pose-${pose} ch-${c.id}${cls ? " " + cls : ""}" viewBox="0 0 60 80" overflow="visible" aria-hidden="true"${look(w)}>${scope(`<defs>${c.defs}</defs>${body}`, c, u)}</svg>`;
}

// Cadrage carré de la tête seule (mesuré une fois par personnage).
const boxes = new Map();
let probe = null;
function faceBox(c) {
  if (boxes.has(c.id)) return boxes.get(c.id);
  let vb = "16 0 28 28";
  if (Array.isArray(c.faceBox) && c.faceBox.length === 4) vb = c.faceBox.join(" ");
  else if (hasDom() && document.body) {
    try {
      if (!probe) {
        probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        probe.setAttribute("aria-hidden", "true");
        probe.setAttribute("style", "position:absolute;left:-200px;top:0;width:60px;height:80px;visibility:hidden;pointer-events:none");
        document.body.appendChild(probe);
      }
      probe.innerHTML = `<g>${c.head.replace(/\bid="[^"]*"/g, "")}</g>`;
      const b = probe.firstChild.getBBox();
      probe.innerHTML = "";
      if (b.width > 2 && b.height > 2) {
        const size = Math.max(b.width, b.height) + 3.2;
        const r = n => Math.round(n * 100) / 100;
        vb = [r(b.x + b.width / 2 - size / 2), r(b.y + b.height / 2 - size / 2), r(size), r(size)].join(" ");
      }
    } catch { /* mesure impossible : cadrage par défaut */ }
  } else return vb; // pas de DOM : on ne mémorise pas
  boxes.set(c.id, vb);
  return vb;
}

// Visage du coach (avatar) : la tête seule, recadrée, avec ses dégradés.
export function coachFace(cls = "", c = current(), costume) {
  ensureCss(c);
  const u = `sp${++uid}-`, w = wearing(c, costume);
  return `<svg class="coach-face${cls ? " " + cls : ""}" viewBox="${faceBox(c)}" aria-hidden="true"${look(w)}>${scope(`<defs>${c.defs}</defs><g class="ch-${c.id}">${c.head}${w?.head ? acc(c, w.head) : ""}</g>`, c, u)}</svg>`;
}

// Couleur fx en "r, g, b" (pour rgba()).
export function fxRgb(c = current()) {
  let h = c.fx.color.slice(1);
  if (h.length === 3) h = [...h].map(x => x + x).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ");
}

// Recherche par nom (commandes du coach) : « alex », « le robot », « prends Mochi »…
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'.-]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["hello", "super", "mister", "monsieur", "madame", "petit", "petite", "grand", "grande", "captain", "capitaine", "coach", "the", "les", "des", "man", "girl", "boy", "kid", "baby", "bebe", "dark"]);
export function coachKeys(c) {
  const n = norm(c.name);
  const keys = new Set([n, n.replace(/ /g, ""), norm(c.id)]);
  n.split(" ").filter(w => w.length >= 4 && !STOP.has(w)).forEach(w => keys.add(w));
  if (Array.isArray(c.aliases)) c.aliases.forEach(a => keys.add(norm(a)));
  return [...keys].filter(k => k.length >= 3);
}
export function findCoach(text) {
  const t = ` ${norm(text)} `;
  let best = null;
  for (const c of list) for (const k of coachKeys(c)) {
    if (t.includes(` ${k} `) && (!best || k.length > best.len)) best = { c, len: k.length };
  }
  return best?.c || null;
}
