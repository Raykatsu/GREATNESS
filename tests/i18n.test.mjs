// Version anglaise : choix de la langue, traduction des textes (entiers, par morceaux, pluriels), typographie anglaise,
// et dictionnaire complet (chaque texte de l'app a sa traduction).
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { detectLang, polish, tr, useDict, EN_READY } from "../js/i18n.js";
import { collect } from "../scripts/i18n.mjs";

test("langue : celle choisie sur l'appareil, sinon celle du téléphone (français s'il est en français)", () => {
  assert.equal(detectLang(null, "fr-FR", true), "fr");
  assert.equal(detectLang(null, "fr-CA", true), "fr");
  assert.equal(detectLang(null, "en-GB", true), "en");
  assert.equal(detectLang(null, "de-DE", true), "en");
  assert.equal(detectLang("fr", "en-US", true), "fr");
  assert.equal(detectLang("en", "fr-FR", true), "en");
  assert.equal(detectLang("en", "en-US", false), "fr"); // dictionnaire pas encore livré : tout reste en français
});

test("typographie anglaise : pas d'espace avant « : ! ? % », guillemets, virgule décimale, milliers", () => {
  assert.equal(polish("Rest : 90 s"), "Rest: 90 s");
  assert.equal(polish("Done !"), "Done!");
  assert.equal(polish("77,5 kg"), "77.5 kg");
  assert.equal(polish("12 %"), "12%");
  assert.equal(polish("« Hello »"), "“Hello”");
  assert.equal(polish("10 000 kg"), "10,000 kg");
});

test("traduction : texte entier, morceaux, pluriel, première lettre en minuscule, inconnu laissé tel quel", () => {
  useDict({ "Séance du jour": "Today's workout", "séries de": "sets of", "jour": "day", "Repos": "Rest", "tranche": "slice", "Garde le dos droit": "Keep your back straight", "à": "to" });
  assert.equal(tr("Séance du jour"), "Today's workout");
  assert.equal(tr("  Séance du jour  "), "  Today's workout  ");
  assert.equal(tr("9 séries de 60 à 85 kg"), "9 sets of 60 to 85 kg");
  assert.equal(tr("3 jours"), "3 days");
  assert.equal(tr("2 tranches"), "2 slices");
  assert.equal(tr("garde le dos droit"), "keep your back straight");
  assert.equal(tr("Repos : 90 s"), "Rest: 90 s");
  assert.equal(tr("Bonjour"), "Bonjour");
  assert.equal(tr("Reposant"), "Reposant"); // mot entier seulement
  assert.equal(tr("12,5"), "12.5");
});

test("dictionnaire anglais : chaque texte de l'app a sa traduction", { skip: !EN_READY && "version anglaise pas encore livrée" }, async () => {
  const en = (await import("../js/lang/en.js")).default;
  const missing = [...collect().keys()].filter(k => !(k in en));
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} textes sans traduction (node scripts/i18n.mjs --missing f.json)`);
  for (const [k, v] of Object.entries(en)) assert.ok(typeof v === "string" && v.trim(), `traduction vide : ${k}`);
});
