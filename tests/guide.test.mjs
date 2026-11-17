// Guide « Découvrir GREATNESS » : chaque fonction est rangée dans une partie connue, a une explication et un
// emplacement, et son bouton mène quelque part ; les cinq étapes de « Bien démarrer » se cochent d'après ce que
// l'utilisateur a vraiment fait ; la recherche tolère accents et majuscules.
import test from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, ITEMS, STARTER, FNS, starter, found, showStarter, search, isFound, seenSet } from "../js/guide-data.js";
import { isText } from "../scripts/i18n.mjs";

const blank = () => ({ sessions: [], food: {}, chat: [], goals: [], reviews: {}, body: [], customPrograms: [], customExercises: {} });
const checkGo = (go, where) => {
  const kinds = ["to", "fn", "start"].filter(k => go[k]);
  assert.equal(kinds.length, 1, `${where} : une seule action`);
  if (go.to) {
    assert.match(go.to, /^#\/[a-z]*(\?t=(me|friends))?$/, `${where} : écran ${go.to}`);
    assert.ok(go.spot && typeof go.spot === "string", `${where} : élément à montrer`);
  }
  if (go.fn) assert.ok(FNS.includes(go.fn), `${where} : fonction inconnue ${go.fn}`);
  if (go.start) assert.ok(["today", "free"].includes(go.start), `${where} : séance ${go.start}`);
};

test("chaque fonction : identifiant unique, partie connue, textes affichables et bouton valide", () => {
  const ids = [...STARTER, ...ITEMS].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants en double");
  const secs = new Set(SECTIONS.map(s => s.id));
  for (const it of ITEMS) {
    assert.ok(secs.has(it.sec) && it.sec !== "start", `${it.id} : partie ${it.sec}`);
    for (const k of ["t", "d", "w"]) assert.ok(isText(it[k]), `${it.id} : texte « ${it[k]} » (traduit et affiché tel quel)`);
    assert.ok(it.d.length <= 200, `${it.id} : explication trop longue`);
    assert.ok(it.ic, `${it.id} : icône`);
    if (it.go) checkGo(it.go, it.id);
  }
  for (const st of STARTER) { assert.ok(isText(st.t) && isText(st.d)); checkGo(st.go, st.id); }
  // chaque partie (hors « Bien démarrer ») a de quoi lire ; chaque partie a son nom et sa phrase
  for (const s of SECTIONS) {
    assert.ok(isText(s.name) && isText(s.sub), s.id);
    if (s.id !== "start") assert.ok(ITEMS.filter(it => it.sec === s.id).length >= 4, `partie ${s.id} trop courte`);
  }
  assert.equal(STARTER.length, 5);
});

test("Bien démarrer : les étapes se cochent d'après les vraies actions", () => {
  const s = blank();
  let st = starter(s);
  assert.equal(st.n, 0);
  assert.equal(st.next.id, "s-first");
  assert.ok(showStarter(s, st));
  s.sessions.push({ id: "a", date: 1, sets: [] });
  s.food["2026-11-17"] = { items: [{ id: "x" }] };
  s.chat.push({ role: "assistant", content: "Salut" });
  st = starter(s);
  assert.deepEqual(st.steps.filter(x => x.ok).map(x => x.id), ["s-first", "s-meal"]); // le coach n'a pas encore été interrogé
  s.chat.push({ role: "user", content: "Que manger ?" });
  s.guide = { seen: ["demo", "remind"] }; // lus dans le guide : ça ne suffit pas à cocher les étapes
  assert.equal(starter(s).n, 3);
  s.guide = { seen: ["used:demo", "used:remind"] }; // démo vraiment regardée, rappels vraiment activés
  st = starter(s);
  assert.ok(st.all);
  assert.equal(st.next, null);
  assert.ok(!showStarter(s, st)); // tout est fait : la carte disparaît
  // masquée, ou compte déjà bien rodé : pas de carte non plus
  assert.ok(!showStarter({ ...blank(), guide: { hide: true } }));
  assert.ok(!showStarter({ ...blank(), sessions: Array.from({ length: 25 }, (_, i) => ({ id: `s${i}` })) }));
});

test("fonctions découvertes : lues dans le guide, utilisées ou vues dans les données", () => {
  const s = blank();
  const f0 = found(s);
  assert.equal(f0.total, ITEMS.length);
  assert.equal(f0.n, 0);
  s.guide = { seen: ["manual", "manual", "body3d", "used:demo"] }; // lus, ou utilisés
  assert.equal(found(s).n, 3);
  s.sessions.push({ id: "a", date: 1, sets: [] }); // une séance faite : mission, bilan de forme, séries… découverts
  const mission = ITEMS.find(it => it.id === "mission");
  assert.ok(isFound(mission, s, seenSet(s)));
  assert.ok(found(s).n > 5);
});

test("recherche : accents, majuscules, plusieurs mots, et version anglaise", () => {
  assert.ok(search("manuel").some(it => it.id === "manual"));
  assert.ok(search("CAMERA").some(it => it.id === "cam"));
  assert.ok(search("code barres").some(it => it.id === "log"));
  // formes d'un même mot : les exemples proposés quand rien n'est trouvé donnent tous des résultats
  for (const w of ["scanner", "record", "rappel", "3D", "notification", "photographier"]) assert.ok(search(w).length, `rien pour « ${w} »`);
  assert.ok(search("scanner").some(it => it.id === "log"));
  assert.ok(!search("eau").some(it => it.id === "rank")); // en début de mot : « eau » ne trouve pas « niveau »
  assert.deepEqual(search(" "), []);
  assert.deepEqual(search("zzzz"), []);
  // en anglais, le texte traduit compte aussi
  const tr = x => (x === "Manuel des exercices" ? "Exercise guide" : x);
  assert.ok(search("exercise guide", tr).some(it => it.id === "manual"));
});
