// Version anglaise : les textes de l'app (chaînes et morceaux de gabarits en français) extraits du code avec un vrai
// analyseur JavaScript, et comparés au dictionnaire js/lang/en.js. Au chargement en anglais, js/i18n.js traduit ces
// morceaux là où ils s'affichent (et dans la voix du coach).
//   node scripts/i18n.mjs                  → combien de textes, combien sans traduction
//   node scripts/i18n.mjs --missing f.json → écrit les textes sans traduction (à traduire)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// pas d'interface : l'IA locale, la config, le dictionnaire lui-même, les outils de développement
const SKIP_FILES = new Set(["js/lang/en.js", "js/config.js", "js/llm-worker.js", "js/version.js", "js/errors.js", "js/i18n.js"]);
// appels dont les chaînes sont du code (sélecteurs, clés, événements, adresses…)
const CODE_CALLS = new Set(["$", "$$", "querySelector", "querySelectorAll", "getElementById", "closest", "matches", "addEventListener", "removeEventListener",
  "add", "remove", "toggle", "contains", "setAttribute", "getAttribute", "removeAttribute", "hasAttribute", "getItem", "setItem", "removeItem", "fetch", "rpc",
  "friendCall", "import", "createElement", "setProperty", "getPropertyValue", "dispatchEvent", "plugin", "registerPlugin", "postMessage", "require", "load",
  "startsWith", "endsWith", "includes", "indexOf", "split", "join", "replace", "replaceAll", "match", "test", "padStart", "padEnd", "toLocaleString",
  "toLocaleDateString", "toLocaleTimeString", "Intl", "DateTimeFormat", "NumberFormat", "getContext", "toDataURL", "toBlob", "insertAdjacentHTML", "cpSync"]);
const FRENCH_WORDS = /\b(le|la|les|des|du|de|un|une|et|ou|pour|avec|sans|ton|ta|tes|mon|ma|mes|est|sur|pas|plus|au|aux|en|ce|cette|ces|il|elle|on|je|tu|nous|vous|qui|que|quoi|dans|par|son|sa|ses|leur|chaque|tout|tous|toute|toutes|déjà|encore|aussi|très|bien|fois|jour|jours|semaine|séance|séances|série|séries|repos|charge|objectif|minutes|secondes|kilos|exercice|exercices|restant|restants|restante|restantes)\b/i;

// Morceau de texte → sa forme de référence (espaces réduits, ponctuation de bord retirée)
export function core(s) {
  return String(s).replace(/&nbsp;| | /g, " ").replace(/\s+/g, " ").trim()
    .replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}.!?…)%]+$/u, "").trim();
}
// Est-ce du français à afficher ? (sinon : identifiant, classe CSS, code…)
export function isText(s) {
  if (!s || s.length < 2 || !/\p{L}/u.test(s)) return false;
  if (/;/.test(s) && /[\w-]+\s*:\s*[^;\s]+;/.test(s)) return false; // déclarations CSS (« color: red; »), pas la prose « ; »
  if (/[{}<>]|=>|(?<! )=|=(?! )|\bvar\(--|^https?:|^data:|^#|^\.[a-z]|^[\w-]+\/[\w./-]+$|\.(js|css|png|svg|json|html)$|\d+px\b|sans-serif|system-ui|rgba?\(|translate\(|cubic-bezier/i.test(s)) return false;
  if (/[à-ÿœæ«»]/i.test(s) || /\p{L}\(s\)/u.test(s)) return true; // accents, ou pluriel « exercice(s) »
  if (FRENCH_WORDS.test(s) && /\s/.test(s)) return true;
  // libellés : « Valider », « Mes séances », « Dos plat ! », « Presse pectoraux (machine) », « Maison · Bas »
  if (/^\p{Lu}[\p{Ll}'’-]{2,}([\s,·&/()+:%–!?.…-]+[\p{L}\p{N}'’-]+)*\)?\s?[.!?…]*$/u.test(s)) return true;
  // répliques criées : « BUUUT ! Nouveau record ! »
  if (/^\p{Lu}{2,}[\s!?.…]+\p{Lu}[\p{Ll}'’-]+([\s,!?.…]+[\p{L}'’-]+)*[\s!?.…]*$/u.test(s)) return true;
  return false;
}
// Petits mots collés à un nombre dans les gabarits (« ${n} jours », « ${a} sur ${b} ») : traduits eux aussi
export const NUMBER_WORDS = new Set(["jour", "jours", "temps", "compte", "seconde", "secondes", "minute", "minutes", "heure", "heures", "mois", "an", "ans",
  "perte", "vitesse", "sur", "fois", "semaine", "semaines", "rep", "reps", "kilos", "propre", "propres", "restantes", "restants", "environ",
  "aliment", "aliments", "portion", "portions", "tranche", "tranches", "verre", "verres", "bol", "bols", "pot", "pots", "part", "parts", "assiette", "assiettes",
  "tasse", "tasses", "poignée", "poignées", "sachet", "sachets", "boîte", "boîtes", "glucides", "lipides", "fibres", "sel", "courses", "facultatif", "points", "pts",
  "exercice", "exercices", "ami", "amis", "défi", "défis", "record", "records", "tour", "tours", "round", "rounds", "kg", "lb"]);
const numberWord = s => NUMBER_WORDS.has(s) && s !== "kg" && s !== "lb";

// Textes d'un morceau de gabarit qui contient du HTML : texte entre les balises et attributs lisibles
// (un texte sur plusieurs lignes s'affiche ligne par ligne : une clé par ligne)
function pieces(raw) {
  if (!raw.includes("<") && !raw.includes(">")) return raw.split(/\n+/);
  const out = [];
  for (const m of raw.matchAll(/\b(?:placeholder|aria-label|title|alt|data-label)="([^"$]*)"/g)) out.push(m[1]);
  // texte hors balises (un morceau peut commencer ou finir au milieu d'une balise : on retire ces bouts)
  const text = raw.replace(/<[^>]*>/g, "\n").replace(/^[^<>]*>/, "\n").replace(/<[^<>]*$/, "\n");
  out.push(...text.split("\n"));
  return out;
}

// Textes sur plusieurs lignes vus pendant l'extraction : forme aplatie → texte d'origine (pour découper leurs traductions)
export const MULTI = new Map();
export function extract(code, file = "") {
  const found = new Map();
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }); }
  catch (e) { throw new Error(`${file} : ${e.message}`); }
  const add = (raw, tpl = false) => { if (/\n/.test(raw)) MULTI.set(core(raw), raw); for (const p of pieces(raw)) { const c = core(p); if (isText(c) || (tpl && numberWord(c))) found.set(c, (found.get(c) || 0) + 1); } };
  const isCode = ancestors => {
    const node = ancestors.at(-1), parent = ancestors.at(-2);
    if (!parent) return false;
    if (parent.type === "Property" && parent.key === node) return true;
    // voix des personnages pour l'IA (jamais affichée : l'IA reçoit une consigne de langue à part)
    if (parent.type === "Property" && (parent.key?.name || parent.key?.value) === "persona") return true;
    if (parent.type === "ImportDeclaration" || parent.type === "ExportNamedDeclaration" || parent.type === "ExportAllDeclaration" || parent.type === "ImportExpression") return true;
    if (parent.type === "MemberExpression" && parent.property === node) return true;
    if (parent.type === "BinaryExpression" && ["===", "!==", "==", "!=", "in"].includes(parent.operator)) return true;
    if (parent.type === "SwitchCase") return true;
    if (parent.type === "CallExpression" || parent.type === "NewExpression") {
      const c = parent.callee, name = c.type === "Identifier" ? c.name : c.type === "MemberExpression" && !c.computed ? c.property.name : "";
      if (CODE_CALLS.has(name)) return true;
    }
    return false;
  };
  walk.ancestor(ast, {
    Literal(node, _, ancestors) { if (typeof node.value === "string" && !isCode(ancestors)) add(node.value); },
    TemplateLiteral(node, _, ancestors) {
      const parent = ancestors.at(-2);
      if (parent?.type === "TaggedTemplateExpression" && parent.tag?.name === "String") return;
      if (isCode(ancestors)) return;
      for (const q of node.quasis) add(q.value.cooked ?? q.value.raw, node.quasis.length > 1);
    },
  });
  return found;
}

export function sourceFiles(root = ROOT) {
  const out = [];
  const visit = d => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
    const rel = `${d}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== "lang") visit(rel); }
    else if (e.name.endsWith(".js") && !SKIP_FILES.has(rel)) out.push(rel);
  } };
  visit("js");
  return out.sort();
}

// Tous les textes : { texte: [fichiers] }, plus ceux d'index.html
export function collect(root = ROOT) {
  const all = new Map();
  for (const f of sourceFiles(root)) for (const t of extract(fs.readFileSync(path.join(root, f), "utf8"), f).keys()) all.set(t, [...(all.get(t) || []), f]);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  for (const p of pieces(html)) { const c = core(p); if (isText(c)) all.set(c, [...(all.get(c) || []), "index.html"]); }
  return all;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = collect();
  let en = {};
  try { en = (await import(path.join(ROOT, "js/lang/en.js"))).default; } catch { /* pas encore de dictionnaire */ }
  const missing = [...all.keys()].filter(k => !(k in en)).sort();
  console.log(`${all.size} textes, ${all.size - missing.length} traduits, ${missing.length} sans traduction.`);
  const i = process.argv.indexOf("--missing");
  if (i > 0) {
    const out = Object.fromEntries(missing.map(k => [k, all.get(k).slice(0, 3)]));
    fs.writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 1));
    console.log(`Liste écrite : ${process.argv[i + 1]}`);
  }
  if (process.argv.includes("--check") && missing.length) process.exit(1);
}
