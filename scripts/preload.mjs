// Ajoute dans index.html la liste des modules chargés au démarrage (<link rel="modulepreload">) : le navigateur les
// télécharge tous en parallèle au lieu de les découvrir import par import (premier chargement bien plus rapide).
// À relancer après avoir ajouté ou retiré un import : node scripts/preload.mjs (un test vérifie que c'est à jour).
// --check : signale seulement si index.html n'est pas à jour.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT = /^\s*import\s+(?:[^"';]*?\s+from\s+)?["'](\.[^"']+)["']/gm;

// Modules importés au démarrage depuis js/app.js, du plus proche au plus lointain (les imports dynamiques restent à la demande)
export function startupModules(entry = "js/app.js") {
  const seen = new Set([entry]), queue = [entry];
  while (queue.length) {
    const f = queue.shift(), src = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of src.matchAll(IMPORT)) {
      const dep = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      if (!seen.has(dep)) { seen.add(dep); queue.push(dep); }
    }
  }
  return [...seen];
}

const START = "<!-- modulepreload:début -->", END = "<!-- modulepreload:fin -->";
export function withPreloads(html, mods) {
  const block = `${START}\n${mods.map(m => `  <link rel="modulepreload" href="${m}" />`).join("\n")}\n  ${END}`;
  if (html.includes(START)) return html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  return html.replace(/(\s*)<link rel="stylesheet"/, `$1${block}$1<link rel="stylesheet"`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(root, "index.html"), html = fs.readFileSync(file, "utf8"), mods = startupModules(), next = withPreloads(html, mods);
  if (process.argv.includes("--check")) { if (next !== html) { console.error("index.html pas à jour : lance node scripts/preload.mjs"); process.exit(1); } console.log(`À jour (${mods.length} modules).`); }
  else { fs.writeFileSync(file, next); console.log(`index.html : ${mods.length} modules préchargés.`); }
}
