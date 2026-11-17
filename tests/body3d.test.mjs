// Corps 3D interactif : le fichier allégé se décode juste (sommets, triangles, groupes), les couleurs suivent le même
// code que la planche (naturel, ou gris + rôles / récupération), et la caméra tourne autour du corps.
import "./setup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decodeBody, colorTable, hexToLinear, orbitEye } from "../js/body3d.js";
import { ANAT_GROUPS } from "../js/anatomy.js";

const meta = JSON.parse(fs.readFileSync(new URL("../assets/anatomy/body.json", import.meta.url), "utf8"));
const raw = fs.readFileSync(new URL("../assets/anatomy/body.bin", import.meta.url));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

test("le fichier 3D se décode : tailles, indices dans les bornes, groupes connus", () => {
  assert.equal(raw.byteLength, meta.bytes);
  assert.ok(meta.bytes < 4 * 1024 * 1024, `corps 3D trop lourd : ${Math.round(meta.bytes / 1024)} Ko`);
  assert.equal(meta.off.idx % 4, 0); // indices 32 bits alignés
  const b = decodeBody(buf, meta);
  assert.ok(b.v > 20000 && b.t > 50000, "géométrie trop pauvre");
  let max = 0;
  for (let i = 0; i < b.idx.length; i++) if (b.idx[i] > max) max = b.idx[i];
  assert.ok(max < b.v, "indice hors des sommets");
  // groupes : os, tendon, muscle « autre », puis les 17 groupes de la planche, chacun présent
  assert.deepEqual(b.parts, ["bone", "tendon", "muscle", ...ANAT_GROUPS]);
  const seen = new Set();
  for (let i = 3; i < b.nor.length; i += 4) seen.add(b.nor[i]);
  for (let g = 0; g < b.parts.length; g++) assert.ok(seen.has(g), `groupe absent : ${b.parts[g]}`);
  // normales unitaires (à l'arrondi 8 bits près)
  for (let i = 0; i < b.nor.length; i += 4 * 997) {
    const l = Math.hypot(b.nor[i], b.nor[i + 1], b.nor[i + 2]) / 127;
    assert.ok(l > 0.9 && l < 1.1, `normale ${i / 4} : longueur ${l}`);
  }
  // le corps tient dans sa boîte : 1,7 m de haut, debout (z en haut)
  assert.ok(meta.hi[2] - meta.lo[2] > 1.5 && meta.hi[2] - meta.lo[2] < 2.0);
});

test("couleurs : écorché naturel par défaut, gris + couleur du rôle avec une classe par muscle", () => {
  const parts = ["bone", "tendon", "muscle", ...ANAT_GROUPS];
  const nat = colorTable(parts, null);
  assert.equal(nat.length, parts.length);
  assert.ok(nat[parts.indexOf("pecs")][0] > nat[parts.indexOf("pecs")][1] * 4, "muscle naturel : rouge");
  const css = v => ({ "--mus1": "#ff0000", "--mus2": "#ff8000", "--rc3": "#00ff00" })[v] || "";
  const roles = colorTable(parts, m => (m === "pecs" ? "mus p" : m === "delts" ? "mus s" : m === "calves" ? "mus rc3" : "mz"), css);
  assert.deepEqual(roles[parts.indexOf("pecs")], [1, 0, 0]);
  assert.deepEqual(roles[parts.indexOf("calves")], [0, 1, 0]);
  assert.ok(roles[parts.indexOf("delts")][1] > 0.2 && roles[parts.indexOf("delts")][2] === 0, "aide : orange");
  const grey = roles[parts.indexOf("quads")];
  assert.ok(Math.max(...grey) < 0.15 && Math.abs(grey[0] - grey[2]) < 0.05, "muscle non sollicité : gris");
});

test("conversion des couleurs du thème et caméra en orbite", () => {
  assert.deepEqual(hexToLinear("#ffffff"), [1, 1, 1]);
  assert.deepEqual(hexToLinear("#000"), [0, 0, 0]);
  assert.ok(Math.abs(hexToLinear("#808080")[0] - 0.2158) < 0.01); // sRGB → linéaire
  const t = [0, 1, 0];
  const front = orbitEye(t, 0, 0, 3), back = orbitEye(t, Math.PI, 0, 3), side = orbitEye(t, Math.PI / 2, 0, 3);
  assert.ok(front[2] > 2.99 && Math.abs(front[0]) < 1e-9, "de face : caméra devant (+z)");
  assert.ok(back[2] < -2.99, "de dos : caméra derrière");
  assert.ok(side[0] > 2.99, "de profil : caméra sur le côté");
  assert.ok(orbitEye(t, 0, 0.5, 3)[1] > 1, "tangage : la caméra monte");
});
