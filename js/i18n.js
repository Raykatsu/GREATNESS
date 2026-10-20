// Langue de l'app : français (la langue d'origine du code) ou anglais. En anglais, le dictionnaire js/lang/en.js
// (texte français du code → texte anglais, voir scripts/i18n.mjs) est appliqué à tout ce qui s'affiche, au fil des
// rendus (MutationObserver, avant l'affichage), ainsi qu'à la voix du coach et aux notifications. Ce que tape
// l'utilisateur et les réponses de l'IA (marqués translate="no") ne sont pas touchés.
const KEY = "greatness.lang";
let lang = "fr", dict = null, index = null;
// La version anglaise s'allume quand son dictionnaire (js/lang/en.js) est livré ; d'ici là, l'app reste en français.
export const EN_READY = false;

export const getLang = () => lang;
export const isEn = () => lang === "en";
export const LOC = () => (lang === "en" ? "en-US" : "fr-FR"); // dates et nombres
export const voiceLang = () => (lang === "en" ? "en-US" : "fr-FR");
// nombre décimal à afficher : 77,5 en français, 77.5 en anglais
export const dec = x => (lang === "en" ? String(x) : String(x).replace(".", ","));

// Langue choisie sur cet appareil, sinon celle du téléphone (français si elle est française, anglais sinon)
export function detectLang(stored = readStored(), nav = typeof navigator !== "undefined" ? (navigator.languages?.[0] || navigator.language || "fr") : "fr", ready = EN_READY) {
  if (!ready) return "fr";
  if (stored === "fr" || stored === "en") return stored;
  return String(nav).toLowerCase().startsWith("fr") ? "fr" : "en";
}
function readStored() { try { return localStorage.getItem(KEY); } catch { return null; } }

// Changer de langue : gardée sur l'appareil, l'app se recharge dans la nouvelle langue
export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* mode privé */ }
  location.reload();
}

/* ---------- Dictionnaire ---------- */
const WORD = /[\p{L}\p{N}]/u;
export function useDict(entries) {
  dict = new Map(Object.entries(entries));
  index = new Map();
  for (const k of dict.keys()) {
    const w = k.match(/^[\p{L}\p{N}]+/u)?.[0];
    if (!w) continue;
    if (!index.has(w)) index.set(w, []);
    index.get(w).push(k);
  }
  for (const list of index.values()) list.sort((a, b) => b.length - a.length); // le plus long d'abord
}

// Typographie anglaise : pas d'espace avant « : ; ! ? % », guillemets “ ”, virgule décimale → point,
// espace des milliers → virgule
export function polish(s) {
  return s.replace(/([^\s\d])[   ]+([:;!?])/g, "$1$2")
    .replace(/(\d)[   ]%/g, "$1%")
    .replace(/«[   ]*/g, "“").replace(/[   ]*»/g, "”")
    .replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2")
    .replace(/(\d)[  ](\d{3})(?!\d)/g, "$1,$2");
}

// Pluriel anglais d'un mot traduit (« tranches » absent du dictionnaire → « tranche » → « slice » → « slices »)
const plural = w => (/[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : /(s|x|z|ch|sh)$/i.test(w) ? w + "es" : w + "s");
const up = s => s.charAt(0).toUpperCase() + s.slice(1), low = s => s.charAt(0).toLowerCase() + s.slice(1);
// Un texte entier connu, tel quel ou avec sa première lettre en majuscule (certains conseils sont mis en minuscule)
function whole(c) {
  const e = dict.get(c);
  if (e !== undefined) return e;
  if (/^\p{Ll}/u.test(c)) { const u = dict.get(up(c)); if (u !== undefined) return low(u); }
  return undefined;
}
// Traduit un texte : en entier s'il est connu, sinon morceau par morceau (le plus long morceau connu à chaque mot)
export function tr(s) {
  if (!dict || !s) return s;
  const hasWord = /\p{L}/u.test(s);
  if (!hasWord) return /\d[, ]\d/.test(s) ? polish(s) : s;
  const c = s.trim(), exact = whole(c);
  if (exact !== undefined) return polish(s.replace(c, exact));
  let out = "", i = 0, changed = false;
  const n = s.length;
  while (i < n) {
    if (WORD.test(s[i]) && (i === 0 || !WORD.test(s[i - 1]))) {
      let j = i + 1;
      while (j < n && WORD.test(s[j])) j++;
      const w = s.slice(i, j);
      let hit = null, cap = false;
      for (const [key, c2] of [[w, false], [/^\p{Ll}/u.test(w) ? up(w) : null, true]]) {
        const cands = key && index.get(key);
        if (!cands) continue;
        for (const k of cands) {
          const k2 = c2 ? low(k) : k;
          if (!s.startsWith(k2, i)) continue;
          const after = s[i + k2.length];
          if (after && WORD.test(after) && WORD.test(k2[k2.length - 1])) continue; // mot entier seulement
          hit = k; cap = c2; break;
        }
        if (hit) break;
      }
      if (hit) { const e = dict.get(hit); out += cap ? low(e) : e; i += hit.length; changed = true; continue; }
      // pluriel d'un mot connu au singulier
      const sing = w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : null, e = sing ? dict.get(sing) ?? (/^\p{Ll}/u.test(sing) ? dict.get(up(sing)) : undefined) : undefined;
      if (typeof e === "string" && !/\s/.test(e)) { out += plural(/^\p{Ll}/u.test(sing) && dict.get(sing) === undefined ? low(e) : e); i = j; changed = true; continue; }
      out += w; i = j;
      continue;
    }
    out += s[i++];
  }
  return changed ? polish(out) : /\d[, ]\d/.test(s) ? polish(s) : s;
}

/* ---------- Écran ---------- */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const untouchable = el => !el || SKIP.has(el.tagName) || !!el.closest?.('[translate="no"]');
function fixText(node) {
  if (untouchable(node.parentElement)) return;
  const v = node.data, t = tr(v);
  if (t !== v) node.data = t;
}
function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const t = tr(v);
    if (t !== v) el.setAttribute(a, t);
  }
}
export function translateTree(root) {
  if (!dict || !root) return;
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || untouchable(root)) return;
  fixAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.getAttribute("translate") === "no") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeType === 3 ? fixText(n) : fixAttrs(n);
}
let observer = null;
function observe() {
  translateTree(document.documentElement);
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === "characterData") fixText(m.target);
      else if (m.type === "attributes") { if (!untouchable(m.target)) fixAttrs(m.target); }
      else m.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// Au démarrage, avant le premier écran (app.js l'attend)
export async function initLang() {
  lang = detectLang();
  if (typeof document === "undefined") return lang;
  document.documentElement.lang = lang;
  if (lang === "en") {
    try { useDict((await import("./lang/en.js")).default); observe(); }
    catch { lang = "fr"; document.documentElement.lang = "fr"; } // dictionnaire introuvable : l'app reste en français
  }
  return lang;
}

// Consigne pour l'IA (en ligne, locale ou Claude) : elle reçoit du contexte en français mais répond en anglais
export const aiLangNote = () => (lang === "en" ? "\n\nIMPORTANT: the user's app is set to English. Always answer in English (the data above may be in French)." : "");
