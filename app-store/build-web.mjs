// Copie l'app web (la même que le site) dans www/, que Capacitor embarque dans l'app iPhone.
// Le service worker n'est pas copié : dans l'app, tout est déjà sur le téléphone.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, ".."), out = path.join(here, "www");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ["index.html", "manifest.webmanifest", "css", "js", "assets"]) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
const count = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`www/ prêt : ${count(out)} fichiers.`);
