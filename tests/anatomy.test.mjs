// Planche d'anatomie : rendus 3D (face, dos) + un masque par groupe musculaire. Le muscle demandé s'allume dans la
// couleur de son rôle ; les images existent, restent légères et sont mises en cache hors ligne ; le crédit est là.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bodyMap, MUSCLES } from "../js/body.js";
import { ANAT_GROUPS, ANAT_FILES, ANAT_CREDIT } from "../js/anatomy.js";

// Balises équilibrées (img est vide), attributs entre guillemets, aucun attribut en double.
function malformed(html) {
  const stack = [], re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (/[<>]/.test(html.slice(last, m.index))) return `texte invalide près de « ${html.slice(last, last + 40)} »`;
    last = re.lastIndex;
    const [, close, tag, attrs, self] = m, names = [...attrs.matchAll(/([\w:-]+)=/g)].map(a => a[1]);
    if (new Set(names).size !== names.length) return `attribut en double dans <${tag}>`;
    if (close) { if (stack.pop() !== tag) return `</${tag}> inattendu`; } else if (!self && tag !== "img") stack.push(tag);
  }
  if (/[<>]/.test(html.slice(last))) return "texte invalide à la fin";
  return stack.length ? `<${stack.pop()}> non fermé` : "";
}
// Couches allumées : muscle, couleur, vue de la couche éclairée, vue et groupe du masque
const layers = html => [...html.matchAll(/<i class="ar-l" data-m="(\w+)" style="background-color:([^;]+);background-image:url\(assets\/anatomy\/(\w+)-light\.webp\);-webkit-mask-image:url\(assets\/anatomy\/(\w+)-(\w+)\.webp\);mask-image:url\(assets\/anatomy\/\4-\5\.webp\)"/g)]
  .map(([, m, color, view, maskView, g]) => ({ m, color, view, maskView, g }));
const lit = html => [...new Set(layers(html).map(x => `${x.g}:${x.color}`))].sort();

test("HTML bien formé, à vide et pour chaque muscle allumé", () => {
  assert.equal(malformed(bodyMap({})), "");
  for (const m of Object.keys(MUSCLES)) assert.equal(malformed(bodyMap({ p: [m] })), "", m);
});

test("chaque groupe musculaire de l'app a son masque, de face et de dos", () => {
  assert.deepEqual([...ANAT_GROUPS].sort(), Object.keys(MUSCLES).sort());
});

test("le muscle principal s'allume en rouge, l'aide en orange, les autres restent gris", () => {
  const l = layers(bodyMap({ p: ["pecs"], s: ["delts"] }));
  assert.deepEqual(l.map(x => `${x.view}:${x.g}:${x.color}`).sort(),
    ["back:delts:var(--mus2)", "back:pecs:var(--mus1)", "front:delts:var(--mus2)", "front:pecs:var(--mus1)"]);
  for (const x of l) { assert.equal(x.view, x.maskView); assert.equal(x.m, x.g); } // couche éclairée et masque de la même vue
  assert.equal(layers(bodyMap({})).length, 0); // rien d'allumé : le corps gris seul
  assert.match(bodyMap({}), /role="img" aria-label="Muscles travaillés"/);
});

test("rôles d'un mouvement et carte de récupération : une couleur libre par muscle", () => {
  const roles = { pecs: "mus p", triceps: "mus s", abs: "mus st", lats: "mus an" };
  assert.deepEqual(lit(bodyMap({}, { cls: m => roles[m] || "mz", label: "Muscles en action" })),
    ["abs:var(--mus-st)", "lats:var(--mus-an)", "pecs:var(--mus1)", "triceps:var(--mus2)"]);
  const rec = bodyMap({}, { cls: m => (m === "quads" ? "mus rc0" : m === "calves" ? "mus rc3" : "mz"), label: "Récupération" });
  assert.match(rec, /aria-label="Récupération"/);
  assert.deepEqual(lit(rec), ["calves:var(--rc3)", "quads:var(--rc0)"]);
});

test("les images existent, restent légères et sont mises en cache hors ligne", () => {
  let total = 0;
  for (const f of ANAT_FILES) {
    const p = new URL(`../${f}`, import.meta.url);
    assert.ok(fs.existsSync(p), `fichier manquant : ${f}`);
    total += fs.statSync(p).size;
  }
  assert.ok(total < 2.5 * 1024 * 1024, `planche trop lourde : ${Math.round(total / 1024)} Ko`);
  // sw.js reconstruit la même liste (même groupes, mêmes vues, écorchés naturels compris)
  const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, new RegExp(`const ANAT_GROUPS = \\[${ANAT_GROUPS.map(g => `"${g}"`).join(",\\s*")}\\]`));
  assert.match(sw, /\["front", "back"\]\.flatMap\(v => \[v, `\$\{v\}-light`, `natural-\$\{v\}`/);
});

test("crédit du modèle anatomique (licence CC BY-SA) dans l'app et à côté des images", () => {
  for (const w of ["BodyParts3D", "Z-Anatomy", "CC BY-SA"]) assert.ok(ANAT_CREDIT.includes(w), w);
  const lic = fs.readFileSync(new URL("../assets/anatomy/LICENSE.md", import.meta.url), "utf8");
  assert.match(lic, /BodyParts3D - The Database Center for Life Science - CC-BY-SA 2\.1 Japan/);
  assert.match(lic, /Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4\.0/);
});
