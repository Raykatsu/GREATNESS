// Face ID (bio.js) et carte de séance à partager (sharecard.js) : la logique, sans navigateur.
import test from "node:test";
import assert from "node:assert/strict";
import { userVerified, b64u, fromB64u, webBioName } from "../js/bio.js";
import { cardData, svgFilter, coachSvg, durTxt } from "../js/sharecard.js";
import { byIdGet } from "../js/chars/index.js";

test("Face ID : vérification de l'utilisateur lue dans les données de l'authentificateur, identifiants en base64url", () => {
  const data = flags => { const a = new Uint8Array(37); a[32] = flags; return a.buffer; };
  assert.equal(userVerified(data(0x05)), true);   // présent + vérifié (visage ou doigt)
  assert.equal(userVerified(data(0x01)), false);  // présent, pas vérifié : refusé
  assert.equal(userVerified(data(0x45)), true);   // avec d'autres drapeaux
  const id = new Uint8Array([0, 255, 62, 63, 128, 7]);
  assert.equal(b64u(id), "AP8-P4AH");
  assert.deepEqual([...fromB64u(b64u(id))], [...id]);
  assert.equal(webBioName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", 844), "Face ID");
  assert.equal(webBioName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 667), "Touch ID"); // iPhone SE
  assert.equal(webBioName("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 900), "Touch ID");
  assert.equal(webBioName("Mozilla/5.0 (Linux; Android 14)", 900), "ton empreinte");
});

test("carte de séance : chiffres, records (meilleure série), durée lisible", () => {
  const sum = { name: "Push", date: Date.UTC(2026, 9, 15, 12), durationSec: 3320, volume: 12450, xp: 140, prs: ["bench"],
    sets: [{ exId: "bench", name: "Développé couché", weight: 100, reps: 5 }, { exId: "bench", name: "Développé couché", weight: 102.5, reps: 5 }, { exId: "fly", name: "Écarté", weight: 14, reps: 12 }] };
  const d = cardData(sum, { rank: "Rookie", streakDays: 4 });
  assert.deepEqual(d.stats.map(s => s.v.replace(/\s/g, " ")), ["55 min", "12 450 kg", "3", "1"]); // espaces insécables du français
  assert.deepEqual(d.stats.map(s => s.l), ["Durée", "Volume soulevé", "Séries", "Record"]);
  assert.equal(d.stats[3].gold, true);
  assert.deepEqual(d.prs, [{ name: "Développé couché", txt: "102,5 kg × 5" }]);
  assert.match(d.date, /octobre/);
  // sans record ni charge : répétitions et exercices
  const bw = cardData({ name: "Maison", durationSec: 1500, volume: 0, prs: [], sets: [{ exId: "pushup", name: "Pompes", weight: 0, reps: 20 }, { exId: "pushup", name: "Pompes", weight: 0, reps: 15 }] });
  assert.deepEqual(bw.stats.map(s => `${s.v} ${s.l}`), ["25 min Durée", "35 Répétitions", "2 Séries", "1 Exercice"]);
  assert.equal(durTxt(3900), "1 h 05");
});

test("carte de séance : le coach en image SVG autonome, costume en filtre SVG", () => {
  assert.equal(svgFilter(""), "");
  const f = svgFilter("hue-rotate(150deg) saturate(1.6) brightness(1.1)");
  assert.match(f, /type="hueRotate" values="150"/);
  assert.match(f, /type="saturate" values="1.6"/);
  assert.match(f, /feFuncR type="linear" slope="1.1"/);
  const spider = byIdGet("spider");
  const plain = coachSvg(spider, null);
  assert.match(plain, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(plain, /\.sp-db,\.sp-zzz\{display:none\}/); // haltère et « zzz » cachés hors de la page
  assert.doesNotMatch(plain, /filter=/);
  const neon = coachSvg(spider, "neon");
  assert.match(neon, /<g filter="url\(#cf\)">/);
  assert.doesNotMatch(neon, /style="filter:/);
  assert.match(coachSvg(spider, "casquette"), /class="sp-acc"/); // accessoire dessiné
});
