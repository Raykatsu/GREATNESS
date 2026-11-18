// Couleurs d'une pochette (palette.js) : les teintes présentes, l'accent le plus vif (assez présent), un deuxième
// accent d'une autre teinte, l'ambiance (teinte dominante, assourdie) ; une pochette en noir et blanc garde l'accent de
// l'app ; contraste WCAG.
import test from "node:test";
import assert from "node:assert/strict";
import { swatches, themeFrom, paletteOf, hsl, rgb, hex, contrast, lum } from "../js/palette.js";

// image de synthèse : [couleur, nombre de pixels]…, avec un léger grain
const img = parts => {
  const px = [];
  for (const [c, n] of parts) for (let i = 0; i < n; i++) px.push(Math.min(255, c[0] + (i % 3)), c[1], Math.max(0, c[2] - (i % 2)), 255);
  return px;
};
const hue = h => hsl([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])[0];

test("conversions de couleurs et contraste", () => {
  assert.deepEqual(rgb(...hsl([200, 30, 40])), [200, 30, 40]);
  assert.deepEqual(rgb(...hsl([12, 180, 90])), [12, 180, 90]);
  assert.equal(hex([255, 0, 128]), "#ff0080");
  assert.equal(Math.round(contrast([255, 255, 255], [0, 0, 0])), 21);
  assert.ok(lum([255, 255, 255]) > lum([128, 128, 128]));
});

test("teintes : regroupées, de la plus présente à la moins présente ; le transparent ne compte pas", () => {
  const sw = swatches([...img([[[200, 30, 40], 300], [[20, 30, 90], 100]]), 0, 255, 0, 0]);
  assert.equal(sw.length, 2);
  assert.ok(sw[0].p > 0.7 && sw[0].c[0] > 190, "le rouge domine");
  assert.ok(Math.abs(sw.reduce((s, x) => s + x.p, 0) - 1) < 1e-9);
});

test("thème : accent vif, deuxième accent d'une autre teinte, ambiance dominante", () => {
  // pochette surtout bleu nuit, avec un rouge vif minoritaire : le rouge devient l'accent, le bleu l'ambiance
  const th = paletteOf(img([[[18, 24, 70], 1700], [[220, 30, 45], 500], [[240, 200, 40], 104]]));
  assert.equal(th.neutral, false);
  assert.ok(hue(th.accent) < 15 || hue(th.accent) > 345, `accent rouge : ${th.accent}`);
  assert.ok(Math.abs(hue(th.accent2) - 50) < 15, `deuxième accent jaune : ${th.accent2}`);
  const amb = th.ambient.split(", ").map(Number);
  assert.ok(amb[2] > amb[0], `ambiance bleue : ${th.ambient}`);
  assert.equal(th.dark, true);
  // accent utilisable en bouton : ni trop sombre ni trop clair
  const [, s, l] = hsl([1, 3, 5].map(i => parseInt(th.accent.slice(i, i + 2), 16)));
  assert.ok(s >= 0.5 && l >= 0.43 && l <= 0.59, `${s} ${l}`);
});

test("pochette sans couleur franche : pas d'accent imposé, l'ambiance seulement ; image vide : rien", () => {
  const bw = paletteOf(img([[[240, 240, 240], 1500], [[12, 12, 12], 800]]));
  assert.equal(bw.neutral, true);
  assert.ok(bw.ambient);
  assert.equal(themeFrom([]), null);
  assert.equal(paletteOf([]), null);
  // une seule couleur vive : le deuxième accent est le même ton, plus sombre
  const one = paletteOf(img([[[30, 160, 90], 2000]]));
  assert.equal(one.neutral, false);
  assert.ok(Math.abs(hue(one.accent) - hue(one.accent2)) < 3);
});
