// Personnages : la troupe originale (37 coachs), chacun complet et bien dessiné ; anciens coachs redirigés vers
// un nouveau ; plus aucun personnage ni texte sous licence.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { all, loadAll, byIdGet, GROUPS, TRAVELS, LEGACY, figure, coachFace, findCoach } from "../js/chars/index.js";
import { COSTUMES } from "../js/costumes.js";

// SVG bien formé : balises équilibrées, attributs entre guillemets, aucun attribut en double (sinon l'image de la
// carte à partager, lue comme du XML, ne s'affiche pas)
function malformed(svg) {
  const stack = [], re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(svg))) {
    if (/[<>]/.test(svg.slice(last, m.index))) return `texte invalide près de « ${svg.slice(last, last + 50)} »`;
    last = re.lastIndex;
    const [, close, tag, attrs, self] = m, names = [...attrs.matchAll(/([\w:-]+)=/g)].map(a => a[1]);
    if (new Set(names).size !== names.length) return `attribut en double dans <${tag}${attrs.slice(0, 60)}>`;
    if (close) { if (stack.pop() !== tag) return `</${tag}> inattendu`; } else if (!self) stack.push(tag);
  }
  if (/[<>]/.test(svg.slice(last))) return "texte invalide à la fin";
  return stack.length ? `<${stack.pop()}> non fermé` : "";
}

test("37 coachs originaux, répartis en 5 familles, chacun complet", async () => {
  await loadAll();
  const list = all();
  assert.ok(list.length >= 36, `${list.length} coachs`);
  assert.equal(new Set(list.map(c => c.id)).size, list.length);
  assert.equal(list[0].id, "alex"); // le coach par défaut en tête
  for (const g of GROUPS) assert.ok(list.filter(c => c.group === g).length >= 4, g);
  for (const c of list) {
    assert.ok(TRAVELS[c.travel], `${c.id} : déplacement ${c.travel}`);
    assert.ok(c.bio.length > 20 && c.persona.length > 40, `${c.id} : bio et voix`);
    for (const k of ["hello", "tap", "pr", "rest", "sleep"]) assert.ok(c.lines[k].length >= 1, `${c.id} : répliques « ${k} »`);
    assert.match(c.fx.color, /^#[0-9a-f]{6}$/i);
    assert.ok(Array.isArray(c.faceBox) && c.faceBox.length === 4 && c.faceBox.every(Number.isFinite), `${c.id} : cadrage de l'avatar`);
    assert.match(c.head, /class="sp-eyeL"/); assert.match(c.head, /class="sp-eyeR"/);
  }
});

test("dessins : SVG bien formés, identifiants propres à chaque personnage, costumes compris", async () => {
  await loadAll();
  for (const c of all()) {
    const own = [c.defs, c.back, c.legL, c.legR, c.armL, c.armR, c.torso, c.head].join("");
    const ids = [...own.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    for (const id of ids) assert.ok(id.startsWith(`${c.id}-`), `${c.id} : id « ${id} » sans préfixe`);
    for (const [, ref] of own.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `${c.id} : url(#${ref}) introuvable`);
    assert.equal(malformed(figure(c, { costume: null })), "", `${c.id} : figure`);
    assert.equal(malformed(coachFace("", c, null)), "", `${c.id} : visage`);
    for (const k of Object.keys(COSTUMES)) assert.equal(malformed(figure(c, { costume: k })), "", `${c.id} : costume ${k}`);
  }
});

test("anciens coachs (avant les personnages originaux) redirigés vers le plus proche", async () => {
  await loadAll();
  assert.equal(LEGACY.spider, "alex");
  for (const [old, nu] of Object.entries(LEGACY)) assert.equal(byIdGet(old)?.id, nu, old);
  assert.equal(byIdGet("alex").name, "Alex");
});

test("aucun personnage ni texte sous licence", async () => {
  await loadAll();
  const banned = /spider|araign|toile d|marvel|batman|harley|pikachu|pok[eé]mon|hello kitty|naruto|goku|saiyan|ninja turtle|tortues? ninja|venom|symbiote|sailor/i;
  for (const c of all()) for (const t of [c.name, c.bio, c.persona, ...Object.values(c.lines).flat()]) assert.doesNotMatch(t, banned, `${c.id} : « ${t} »`);
  const src = fs.readdirSync(new URL("../js/", import.meta.url), { recursive: true }).filter(f => f.endsWith(".js"))
    .map(f => fs.readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8")).join("\n");
  for (const w of ["Spider-Man", "araignée", "Midtown", "Tisseur", "Spider-Verse", "coach de quartier", "\u{1F577}", "\u{1F578}"]) assert.ok(!src.includes(w), w);
  for (const c of Object.values(COSTUMES)) assert.doesNotMatch(`${c.name} ${c.desc}`, /symbiote|force/i);
});

test("les commandes du coach trouvent les nouveaux personnages par leur nom ou leur espèce", async () => {
  await loadAll();
  assert.equal(findCoach("prends Noor comme coach")?.id, "noor");
  assert.equal(findCoach("je veux le robot")?.id, "boulon");
  assert.equal(findCoach("mets le chat")?.id, "mochi");
  assert.equal(findCoach("la mamie")?.id, "jeanne");
});
