// Planche d'anatomie : SVG bien formé (pour la carte à partager et tout rendu XML), et le muscle demandé s'allume.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { bodyMap, MUSCLES } from "../js/body.js";

// Balises équilibrées, attributs entre guillemets, aucun attribut en double.
function malformed(svg) {
  const stack = [], re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(svg))) {
    if (/[<>]/.test(svg.slice(last, m.index))) return `texte invalide près de « ${svg.slice(last, last + 40)} »`;
    last = re.lastIndex;
    const [, close, tag, attrs, self] = m, names = [...attrs.matchAll(/([\w:-]+)=/g)].map(a => a[1]);
    if (new Set(names).size !== names.length) return `attribut en double dans <${tag}>`;
    if (close) { if (stack.pop() !== tag) return `</${tag}> inattendu`; } else if (!self) stack.push(tag);
  }
  if (/[<>]/.test(svg.slice(last))) return "texte invalide à la fin";
  return stack.length ? `<${stack.pop()}> non fermé` : "";
}

test("SVG bien formé, à vide et pour chaque muscle allumé", () => {
  assert.equal(malformed(bodyMap({})), "");
  for (const m of Object.keys(MUSCLES)) assert.equal(malformed(bodyMap({ p: [m] })), "", m);
});

test("le muscle principal prend le dégradé rouge, le secondaire l'orange, les autres le gris", () => {
  const svg = bodyMap({ p: ["pecs"], s: ["delts"] });
  assert.match(svg, /fill="url\(#mg\d+-p\)"/);  // un muscle en rouge (dégradé principal)
  assert.match(svg, /fill="url\(#mg\d+-s\)"/);  // un muscle en orange
  assert.match(svg, /fill="url\(#mg\d+-g\)"/);  // au moins un muscle non sollicité reste gris
  assert.match(svg, /<radialGradient /);         // les dégradés de relief sont définis
});

test("carte de récupération : une classe libre par muscle est respectée", () => {
  const svg = bodyMap({}, { cls: m => (m === "quads" ? "mus rc0" : "mz"), label: "Récupération" });
  assert.match(svg, /fill="url\(#mg\d+-rc0\)"/);
  assert.match(svg, /aria-label="Récupération"/);
});
