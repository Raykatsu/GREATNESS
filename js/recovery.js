// Récupération musculaire, calculée hors ligne d'après les vraies séances : chaque série laisse une fatigue sur les
// muscles qu'elle fait travailler (pleine sur les muscles principaux, moitié sur ceux qui aident, plus forte quand la
// série est dure), puis cette fatigue s'efface avec le temps, plus vite pour les petits muscles (bras, mollets…) que
// pour les gros (cuisses, fessiers, dos). Le coach s'en sert pour ne pas recharger un muscle pas encore remis.
import { moveOf } from "./moves.js";
import { patternOf } from "./motion.js";
import { MUSCLES } from "./body.js";

const H = 36e5;
// Constante de temps de la récupération (heures) : après deux fois ce temps, il reste ~14 % de la fatigue
const TAU = { quads: 30, glutes: 30, hams: 30, lowerback: 30, lats: 28, pecs: 26, adductors: 26, traps: 24, delts: 22, triceps: 20, biceps: 20,
  abductors: 20, hipflex: 20, forearms: 18, calves: 18, abs: 18, obliques: 18 };
const FULL = 8;   // ~8 séries dures d'affilée sur un muscle : il est « vidé » (0 %)
const READY = 0.85; // au-dessus : récupéré
export const LEVELS = [
  { name: "À reposer", cls: "rc0" }, { name: "Fatigué", cls: "rc1" }, { name: "Presque prêt", cls: "rc2" }, { name: "Récupéré", cls: "rc3" },
];

// Dureté d'une série selon le ressenti (RPE 5 → 0,6 ; 8 → 0,96 ; 10 → 1,2) ; sans ressenti : série normale
const effort = rpe => (rpe > 0 ? Math.min(1.25, Math.max(0.6, 0.6 + (rpe - 5) * 0.12)) : 1);
// Les étirements ne fatiguent pas ; le cardio un peu
const kindOf = exId => ({ stretch: 0, cardio: 0.35 })[patternOf(exId)] ?? 1;
// Muscles d'un exercice (principaux p, secondaires s), d'après sa démo ; exercice perso : ceux de son type de mouvement
export function musclesOf(exId) { const m = moveOf(exId).mus || {}; return { p: m.p || [], s: m.s || [] }; }

// État de chaque muscle : fatigue restante, récupération (0 → 1), niveau (0 à reposer → 3 récupéré),
// heures avant d'être récupéré, séries de la semaine (les muscles qui aident comptent pour moitié)
export function recovery(sessions = [], now = Date.now()) {
  const out = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, { fatigue: 0, week: 0, last: 0 }]));
  const since = now - 7 * 864e5;
  for (const s of sessions) {
    if (!(s.date > since && s.date <= now)) continue;
    const age = (now - s.date) / H;
    // séries de musculation, et efforts du minuteur d'intervalles (40 s d'effort à fond ≈ une série dure)
    const work = [...(s.sets || []).map(set => [set.exId, effort(set.rpe)]),
      ...(s.iv?.work || []).map(w => [w.exId, w.sec ? Math.min(1.2, Math.max(0.3, w.sec / 40)) : 0.8])];
    for (const [exId, e0] of work) {
      const k = kindOf(exId);
      if (!k) continue;
      const { p, s: sec } = musclesOf(exId), e = e0 * k;
      for (const [list, w] of [[p, 1], [sec, 0.5]]) for (const m of list) {
        const r = out[m];
        if (!r) continue;
        r.fatigue += w * e * Math.exp(-age / TAU[m]);
        r.week += w * k;
        r.last = Math.max(r.last, s.date);
      }
    }
  }
  for (const [m, r] of Object.entries(out)) {
    r.ready = Math.max(0, Math.min(1, 1 - r.fatigue / FULL));
    r.level = r.ready >= READY ? 3 : r.ready >= 0.6 ? 2 : r.ready >= 0.35 ? 1 : 0;
    r.hours = r.ready >= READY ? 0 : Math.ceil(TAU[m] * Math.log(r.fatigue / ((1 - READY) * FULL))); // fatigue × e^(−h/τ) = 15 %
    r.week = Math.round(r.week * 2) / 2;
  }
  return out;
}

// Récupération d'un exercice : celle du moins remis de ses muscles principaux
export function exerciseReady(exId, rec) {
  const p = musclesOf(exId).p.filter(m => rec[m]);
  return p.length ? Math.min(...p.map(m => rec[m].ready)) : 1;
}

// Muscles principaux d'une séance pas encore remis (sous 60 %), du plus fatigué au moins fatigué
export function programStrain(program, rec) {
  const seen = new Map();
  for (const e of program?.exercises || []) for (const m of musclesOf(e.id).p) if (rec[m] && rec[m].ready < 0.6) seen.set(m, rec[m]);
  return [...seen].sort((a, b) => a[1].ready - b[1].ready).map(([m, r]) => ({ m, name: MUSCLES[m], ready: r.ready, hours: r.hours }));
}

// « dans ~20 h », « demain », « dans 2 jours »
export function readyIn(hours) {
  if (hours <= 0) return "récupéré";
  if (hours < 20) return `prêt dans ~${hours} h`;
  if (hours < 36) return "prêt demain";
  return `prêt dans ${Math.round(hours / 24)} jours`;
}
const pct = v => `${Math.round(v * 100)} %`;

// Résumé court pour l'accueil et le coach : muscles à reposer, muscles prêts
export function recoverySummary(rec) {
  const worked = Object.entries(rec).filter(([, r]) => r.week > 0);
  const tired = worked.filter(([, r]) => r.level < 2).sort((a, b) => a[1].ready - b[1].ready);
  const almost = worked.filter(([, r]) => r.level === 2);
  const fresh = worked.filter(([, r]) => r.level === 3);
  return { worked: worked.length, tired: tired.map(([m]) => m), almost: almost.map(([m]) => m), fresh: fresh.map(([m]) => m) };
}

// Pour l'IA (en ligne ou locale) : l'état de chaque muscle travaillé cette semaine
export function recoveryContext(sessions, now = Date.now()) {
  const rec = recovery(sessions, now), worked = Object.entries(rec).filter(([, r]) => r.week > 0);
  if (!worked.length) return "";
  worked.sort((a, b) => a[1].ready - b[1].ready);
  const line = ([m, r]) => `${MUSCLES[m]} ${pct(r.ready)}${r.level < 3 ? ` (${readyIn(r.hours)})` : ""}, ${String(r.week).replace(".", ",")} série${r.week > 1 ? "s" : ""} cette semaine`;
  return `Récupération musculaire (calculée par l'app d'après les séances et leur dureté) : ${worked.map(line).join(" ; ")}. `
    + "Ne recharge pas lourdement un muscle sous 60 % : propose plutôt de travailler les muscles récupérés ou d'alléger.";
}

// Réponse du coach local à « quels muscles sont récupérés ? »
export function recoveryAnswer(sessions, now = Date.now()) {
  const rec = recovery(sessions, now), sum = recoverySummary(rec);
  if (!sum.worked) return "Aucune séance ces 7 derniers jours : tous tes muscles sont frais. C'est le moment de t'entraîner !";
  const names = ms => ms.map(m => MUSCLES[m]).join(", ");
  const lines = ["**Ta récupération** (d'après tes séances de la semaine) :"];
  if (sum.tired.length) lines.push(`• À reposer : ${sum.tired.map(m => `${MUSCLES[m]} (${pct(rec[m].ready)}, ${readyIn(rec[m].hours)})`).join(", ")}.`);
  if (sum.almost.length) lines.push(`• Presque prêts : ${names(sum.almost)}.`);
  if (sum.fresh.length) lines.push(`• Récupérés : ${names(sum.fresh)}.`);
  lines.push(sum.tired.length ? "Aujourd'hui, travaille plutôt les muscles récupérés ; si ta séance prévue tombe sur un muscle fatigué, je l'allège automatiquement."
    : "Tout est prêt : tu peux t'entraîner normalement.");
  return lines.join("\n");
}
