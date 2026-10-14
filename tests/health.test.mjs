// Apple Santé dans l'app (js/health.js) : mesures reçues, valeurs habituelles, bilan de forme proposé, pesées
import test from "node:test";
import assert from "node:assert/strict";
import { dayKeyOf, shiftDay, fmtSleep, mergeHealth, baseline, readinessFromHealth, formLabel, applyWeights, healthContext, healthLine } from "../js/health.js";

const TODAY = "2026-10-14";
// 10 jours habituels : VFC 60 ms, fréquence au repos 55 bpm
const usual = () => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [shiftDay(TODAY, -(i + 1)), { hrv: 56 + (i % 3) * 4, rhr: 54 + (i % 3), sleep: 7.5 }]));

test("jours, décalages, durée de sommeil lisible", () => {
  assert.equal(dayKeyOf(new Date(2026, 9, 4, 23, 59)), "2026-10-04");
  assert.equal(shiftDay("2026-10-01", -1), "2026-09-30");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(fmtSleep(7.5), "7 h 30");
  assert.equal(fmtSleep(8), "8 h");
  assert.equal(fmtSleep(6.08), "6 h 05");
});

test("mesures du serveur ajoutées jour par jour (60 jours gardés, valeurs abîmées ignorées)", () => {
  const cur = { "2026-10-13": { steps: 9000, at: 1 }, "2026-07-01": { steps: 1 } };
  const out = mergeHealth(cur, [
    { day: "2026-10-13", data: { sleep: 7.2, src: "apple" }, at: "2026-10-13T06:00:00Z" },
    { day: "2026-10-14T00:00:00", data: { hrv: "61", rhr: null, weight: "", steps: "abc" }, at: "2026-10-14T06:00:00Z" },
    { day: "pas-une-date", data: { steps: 5 } },
  ], TODAY);
  assert.deepEqual(Object.keys(out).sort(), ["2026-10-13", "2026-10-14"]);
  assert.deepEqual(out["2026-10-13"], { steps: 9000, sleep: 7.2, at: Date.parse("2026-10-13T06:00:00Z") });
  assert.deepEqual(out["2026-10-14"], { hrv: 61, at: Date.parse("2026-10-14T06:00:00Z") });
});

test("valeur habituelle : médiane des 30 jours d'avant, au moins 4 mesures", () => {
  const days = usual();
  assert.equal(baseline(days, "hrv", TODAY), 60);
  assert.equal(baseline(days, "rhr", TODAY), 55);
  assert.equal(baseline({ [shiftDay(TODAY, -1)]: { hrv: 50 } }, "hrv", TODAY), null);
  // la mesure du jour ne compte pas dans sa propre référence, ni celles d'il y a plus de 30 jours
  assert.equal(baseline({ ...days, [TODAY]: { hrv: 999 }, [shiftDay(TODAY, -40)]: { hrv: 999 } }, "hrv", TODAY), 60);
});

test("bilan de forme proposé : nuit, VFC et fréquence au repos comparées à tes habitudes", () => {
  const days = usual();
  assert.equal(readinessFromHealth(days, TODAY), null); // rien reçu aujourd'hui
  const good = readinessFromHealth({ ...days, [TODAY]: { sleep: 8.2, hrv: 66, rhr: 53 } }, TODAY);
  assert.deepEqual([good.sleep, good.energy], [5, 5]);
  assert.deepEqual(good.notes, ["8 h 12 de sommeil", "VFC 66 ms, au-dessus de ta moyenne"]);
  const tired = readinessFromHealth({ ...days, [TODAY]: { sleep: 5.4, hrv: 47, rhr: 62 } }, TODAY);
  assert.deepEqual([tired.sleep, tired.energy], [2, 1]);
  assert.deepEqual(tired.notes, ["5 h 24 de sommeil", "VFC 47 ms, sous ta moyenne", "fréquence au repos +7 bpm"]);
  // fréquence au repos seule : énergie « bonne » ajustée
  assert.equal(readinessFromHealth({ ...days, [TODAY]: { rhr: 59 } }, TODAY).energy, 3);
  // sommeil seul, sans habitudes connues
  assert.deepEqual(readinessFromHealth({ [TODAY]: { sleep: 6.5, hrv: 70 } }, TODAY), { sleep: 3, notes: ["6 h 30 de sommeil"] });
  assert.equal(readinessFromHealth({ [TODAY]: { steps: 4000 } }, TODAY), null);
});

test("libellé de la carte d'accueil", () => {
  assert.equal(formLabel(null), null);
  assert.deepEqual(formLabel({ sleep: 5, energy: 5 }), { text: "En pleine forme", tone: "up" });
  assert.deepEqual(formLabel({ sleep: 4, energy: 3 }), { text: "Bonne forme", tone: "ok" });
  assert.deepEqual(formLabel({ sleep: 3 }), { text: "Forme moyenne", tone: "mid" });
  assert.deepEqual(formLabel({ sleep: 1, energy: 2 }), { text: "Journée récup conseillée", tone: "down" });
});

test("pesées d'Apple Santé ajoutées à la courbe, sans écraser celles de l'app ni se dupliquer", () => {
  const st = { profile: { bodyweight: 75 }, body: [{ date: new Date(2026, 9, 12, 7).getTime(), weight: 74 }, { date: new Date(2026, 9, 11, 7).getTime(), waist: 80 }] };
  const days = { "2026-10-11": { weight: 74.46 }, "2026-10-12": { weight: 74.9 }, "2026-10-13": { weight: 74.2 }, "2026-10-14": { steps: 10 } };
  assert.equal(applyWeights(st, days), 2);
  assert.deepEqual(st.body.filter(b => b.weight).map(b => [dayKeyOf(b.date), b.weight, b.src]), [["2026-10-11", 74.5, "sante"], ["2026-10-12", 74, undefined], ["2026-10-13", 74.2, "sante"]]);
  assert.equal(st.profile.bodyweight, 74.2);
  assert.equal(applyWeights(st, days), 0);
  assert.equal(st.body.length, 4);
});

test("ce que le coach et l'accueil en disent", () => {
  const days = { ...usual(), [shiftDay(TODAY, -1)]: { steps: 12000, hrv: 60, rhr: 55 }, [TODAY]: { sleep: 7.5, hrv: 58, rhr: 54, steps: 8432, weight: 72.4, kcal: 420.6 } };
  const ctx = healthContext(days, TODAY);
  assert.match(ctx, /^Apple Santé : nuit dernière 7 h 30, VFC 58 ms \(habituelle 60\), fréquence cardiaque au repos 54 bpm \(habituelle 55\), 8\s432 pas aujourd'hui, 421 kcal actives aujourd'hui\./);
  assert.match(healthContext({ [shiftDay(TODAY, -1)]: { steps: 12000 } }, TODAY), /12\s000 pas hier/);
  assert.equal(healthContext({}, TODAY), "");
  assert.match(healthLine(days, TODAY), /^7 h 30 de sommeil · VFC 58 ms · FC repos 54 · 8\s432 pas · 72,4 kg$/);
  assert.equal(healthLine(days, "2020-01-01"), "");
});
