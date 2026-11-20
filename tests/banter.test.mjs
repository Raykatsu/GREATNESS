// Le coach taquin (js/banter.js) : chaque réplique est bien formée et traduite, ne vise jamais le corps ; accords
// selon le profil ; la situation qui parle le plus (repas, pesée, fin de séance, accueil, bilan de forme, semaine) ;
// rien quand l'option est coupée.
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../js/store.js";
import EN from "../js/lang/en.js";
import {
  LINES, pickLine, fillLine, quip, isJunk, isLate, foodSituation, weightSituation, endSituation, homeSituation, checkinSituation, weekSituation, banterStyle,
} from "../js/banter.js";

test("répliques : bien formées, traduites en anglais, jamais sur le corps", () => {
  const all = Object.values(LINES).flat();
  assert.ok(all.length >= 90, `${all.length} répliques`);
  for (const l of all) {
    assert.ok(/^\p{L}/u.test(l), `commence par une lettre : ${l}`);
    assert.doesNotMatch(l, /%[^nskf\s.]/, `valeurs connues seulement : ${l}`);
    for (const [, o] of l.matchAll(/\[\[([^\]]+)\]\]/g)) assert.equal(o.split("|").length, 3, `accord homme | femme | neutre : ${l}`);
    assert.ok(EN[l], `traduite : ${l}`);
    assert.doesNotMatch(` ${l.toLowerCase()} `, /[\s'’](gros|grosse|gras|bide|obèse|moche|fat)[\s,.!?]/, `jamais sur le corps : ${l}`);
  }
  assert.ok(Object.keys(LINES).every(k => LINES[k].length >= 1));
});

test("accords et valeurs : homme, femme, neutre ; nombres à la française", () => {
  const tpl = "T'es pas [[censé|censée|censé·e]] sécher ? %s kcal de moins.";
  assert.equal(fillLine(tpl, { s: 140 }, "m"), "T'es pas censé sécher ? 140 kcal de moins.");
  assert.equal(fillLine(tpl, { s: 140 }, "f"), "T'es pas censée sécher ? 140 kcal de moins.");
  assert.equal(fillLine(tpl, { s: 140 }, "a"), "T'es pas censé·e sécher ? 140 kcal de moins.");
  assert.match(fillLine("Il reste %n kcal.", { n: 1250 }), /^Il reste 1\s?250 kcal\.$/u);
  assert.equal(fillLine("La balance monte de %k kg.", { k: 0.4 }), "La balance monte de 0,4 kg.");
  // même réplique toute la journée avec la même graine ; jamais deux fois de suite sinon
  assert.equal(pickLine("go", "2026-11-20"), pickLine("go", "2026-11-20"));
  const a = pickLine("restOver", null, () => 0), b = pickLine("restOver", null, () => 0);
  assert.notEqual(a, b);
});

test("coupé par défaut : aucune pique ; activé : une pique ; le coach IA reçoit le ton", () => {
  const before = state.profile.banter;
  try {
    state.profile.banter = false;
    assert.equal(quip("go"), "");
    assert.equal(banterStyle(), "");
    state.profile.banter = true;
    assert.ok(LINES.go.map(l => fillLine(l, {}, state.profile.sex)).includes(quip("go")));
    assert.match(banterStyle(), /familier et taquin/);
    assert.match(banterStyle(), /Jamais d'insulte ni de moquerie sur son corps/);
  } finally { state.profile.banter = before; }
});

test("repas : la situation qui parle le plus", () => {
  const base = { target: 2000, protein: 150, proteinTarget: 150, hour: 21 };
  // sèche : l'excès est repris sur 3 jours (au plus 15 % de l'objectif par jour)
  assert.deepEqual(foodSituation({ ...base, goal: "seche", eaten: 2420 }), { kind: "overCut", vals: { n: 420, s: 140 } });
  assert.deepEqual(foodSituation({ ...base, goal: "seche", eaten: 3500 }).vals, { n: 1500, s: 300 });
  // forme : la moitié ; prise de masse : rien de repris ; adaptation coupée
  assert.deepEqual(foodSituation({ ...base, goal: "forme", eaten: 2600 }), { kind: "overForme", vals: { n: 600, s: 100 } });
  assert.equal(foodSituation({ ...base, goal: "muscle", eaten: 2600 }).kind, "overBulk");
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 2600, adapt: false }).kind, "overPlain");
  // aliment plaisir, sucre, protéines du soir, eau de l'après-midi, trop peu le soir, journée nickel
  assert.deepEqual(foodSituation({ ...base, goal: "seche", eaten: 1500, junk: ["Pizza reine"] }), { kind: "junk", vals: { f: "Pizza reine" } });
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 1800, sugar: 85 }).kind, "sugar");
  assert.deepEqual(foodSituation({ ...base, goal: "seche", eaten: 1900, protein: 80 }), { kind: "lowProtein", vals: { n: 70 } });
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 1900, hour: 17, water: 2, waterGoal: 10 }).kind, "water");
  assert.equal(foodSituation({ ...base, goal: "muscle", eaten: 1200 }).kind, "underGain");
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 1200 }).kind, "underCut", "sécher, ce n'est pas jeûner");
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 1980 }).kind, "onTarget");
  // le matin : l'excès des jours d'avant repris aujourd'hui
  assert.deepEqual(foodSituation({ ...base, goal: "seche", eaten: 300, hour: 9, delta: -140 }), { kind: "compensating", vals: { n: 140 } });
  assert.equal(foodSituation({ ...base, goal: "seche", eaten: 300, hour: 9 }), null);
});

test("aliments plaisir, heure tardive", () => {
  for (const n of ["Pizza 4 fromages", "Big Mac", "Frites", "Coca-Cola", "Bières blondes", "Gâteau au chocolat", "Pain au chocolat", "Ice cream"]) assert.ok(isJunk(n), n);
  for (const n of ["Poulet rôti", "Coca-Cola zéro", "Riz basmati", "Skyr nature", "Vinaigrette"]) assert.ok(!isJunk(n), n);
  assert.deepEqual([isLate(23), isLate(2), isLate(4), isLate(21)], [true, true, false, false]);
});

test("pesée, fin de séance, accueil, bilan de forme, semaine", () => {
  assert.deepEqual(weightSituation("seche", 0.42), { kind: "weightUpCut", vals: { k: 0.4 } });
  assert.deepEqual(weightSituation("muscle", -0.3), { kind: "weightDownBulk", vals: { k: 0.3 } });
  assert.equal(weightSituation("seche", -0.5).kind, "weightGood");
  assert.equal(weightSituation("forme", 0.5), null);
  assert.equal(weightSituation("seche", null), null);

  assert.equal(endSituation({ prs: 2, minutes: 60, done: 20, planned: 20 }).kind, "endPr");
  assert.equal(endSituation({ minutes: 30, done: 6, planned: 20 }).kind, "endEarly");
  assert.deepEqual(endSituation({ minutes: 12, done: 6, planned: 6 }), { kind: "endShort", vals: { n: 12 } });
  assert.equal(endSituation({ minutes: 130, done: 20, planned: 20 }).kind, "endLong");
  assert.equal(endSituation({ minutes: 55, done: 18, planned: 20 }).kind, "endGood");

  assert.equal(homeSituation({ hour: 0 }).kind, "night");
  assert.equal(homeSituation({ doneToday: true, hour: 19 }).kind, "doneToday");
  assert.deepEqual(homeSituation({ daysOff: 5, hour: 10 }), { kind: "comeback", vals: { n: 5 } });
  assert.deepEqual(homeSituation({ streak: 6, hour: 10 }), { kind: "streak", vals: { n: 6 } });
  assert.equal(homeSituation({ rest: true, hour: 10 }).kind, "restDay");
  assert.equal(homeSituation({ hour: 10 }).kind, "go");

  assert.equal(checkinSituation({ sleep: 1, energy: 4, soreness: 1 }).kind, "checkinSleep");
  assert.equal(checkinSituation({ sleep: 4, energy: 3, soreness: 5 }).kind, "checkinSore");
  assert.equal(checkinSituation({ sleep: 3, energy: 1, soreness: 2 }).kind, "checkinTired");
  assert.equal(checkinSituation({ sleep: 5, energy: 5, soreness: 1 }).kind, "checkinGreat");
  assert.equal(checkinSituation({ sleep: 3, energy: 3, soreness: 2 }), null);

  assert.deepEqual([weekSituation(92).kind, weekSituation(70).kind, weekSituation(40).kind], ["weekGreat", "weekOk", "weekBad"]);
});
