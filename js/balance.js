// Équilibre musculaire et charge d'entraînement, sur plusieurs semaines, d'après les vraies séances (hors ligne).
// - weeklySets : séries par muscle et par semaine, en moyenne (les muscles qui aident comptent pour moitié) ; repères :
//   moins de 5 séries, c'est peu ; 10 à 20, la zone qui fait progresser ; au-delà, beaucoup
// - balanceOf : les muscles en retard ou très chargés, et les grands équilibres (pousser / tirer, avant / arrière de la
//   cuisse, haut / bas du corps), avec un conseil et les groupes d'une séance de rattrapage (planner.js)
// - trainingLoad : la charge de chaque semaine (séries dures × effort, intervalles compris) et le rapport entre cette
//   semaine et la moyenne des 4 précédentes (dont au moins 3 avec de l'entraînement) : une hausse brutale (plus de
//   50 %) augmente le risque de blessure
import { musclesOf, effort, kindOf } from "./recovery.js";
import { MUSCLES } from "./body.js";

const WEEK = 7 * 864e5;
const sum = (o, keys) => keys.reduce((a, k) => a + (o[k] || 0), 0);
const pct = r => Math.round(Math.abs(r - 1) * 100);

export function weeklySets(sessions = [], { weeks = 4, now = Date.now() } = {}) {
  const out = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, 0]));
  const since = now - weeks * WEEK;
  for (const s of sessions) {
    if (!(s.date > since && s.date <= now)) continue;
    for (const set of s.sets || []) {
      const k = kindOf(set.exId);
      if (!k) continue;
      const { p, s: sec } = musclesOf(set.exId);
      for (const m of p) if (m in out) out[m] += k;
      for (const m of sec) if (m in out) out[m] += 0.5 * k;
    }
  }
  for (const m in out) out[m] = Math.round((out[m] / weeks) * 10) / 10;
  return out;
}
export const volLevel = n => (n > 20 ? "high" : n >= 10 ? "ideal" : n >= 5 ? "ok" : "low");

// Groupes du générateur de séance (planner.js GROUPS) qui font travailler chaque muscle
export const GEN_GROUP = { pecs: "pecs", lats: "dos", lowerback: "dos", traps: "epaules", delts: "epaules", biceps: "biceps", forearms: "biceps",
  triceps: "triceps", quads: "jambes", hams: "jambes", calves: "jambes", adductors: "jambes", glutes: "fessiers", abductors: "fessiers",
  abs: "abdos", obliques: "abdos", hipflex: "abdos" };
// Muscles suivis pour l'équilibre (les autres sont travaillés partout : avant-bras, fléchisseurs de hanche, adducteurs…)
const MAIN = ["pecs", "delts", "traps", "lats", "biceps", "triceps", "abs", "lowerback", "glutes", "quads", "hams", "calves"];
const PUSH = ["pecs", "delts", "triceps"], PULL = ["lats", "traps", "biceps"];
const UPPER = ["pecs", "delts", "traps", "lats", "biceps", "triceps"], LOWER = ["quads", "hams", "glutes", "calves"];

export function balanceOf(sessions = [], { weeks = 4, now = Date.now() } = {}) {
  const sets = weeklySets(sessions, { weeks, now });
  const recent = sessions.filter(s => s.date > now - weeks * WEEK && s.date <= now && (s.sets || []).length);
  const total = sum(sets, MAIN);
  if (recent.length < 3 || total < 6) return { sets, enough: false, low: [], high: [], issues: [], groups: [] };
  const low = MAIN.filter(m => sets[m] < 5).sort((a, b) => sets[a] - sets[b]);
  const high = MAIN.filter(m => sets[m] > 20);
  const issues = [];
  const push = sum(sets, PUSH), pull = sum(sets, PULL);
  if (push > 4 && pull < push * 0.7) issues.push({ k: "push", text: "Tu pousses bien plus que tu ne tires : ajoute du dos (tirages, rowing, tractions). Des épaules équilibrées se blessent moins." });
  else if (pull > 4 && push < pull * 0.7) issues.push({ k: "pull", text: "Tu tires bien plus que tu ne pousses : ajoute des pompes ou du développé pour équilibrer." });
  if (sets.quads > 4 && sets.hams < sets.quads * 0.5) issues.push({ k: "hams", text: "Les ischios sont en retard sur les quadriceps : ajoute du soulevé de terre roumain ou du leg curl. Tes genoux te diront merci." });
  const up = sum(sets, UPPER), lowr = sum(sets, LOWER);
  if (up > 6 && lowr < up * 0.35) issues.push({ k: "legs", text: "Le bas du corps est oublié : une séance jambes par semaine suffit à rééquilibrer." });
  else if (lowr > 6 && up < lowr * 0.35) issues.push({ k: "upper", text: "Le haut du corps est oublié : ajoute une séance haut du corps cette semaine." });
  // séance de rattrapage : les groupes des muscles les plus en retard (et des déséquilibres)
  const want = [...low.slice(0, 3)];
  if (issues.some(i => i.k === "push")) want.push("lats");
  if (issues.some(i => i.k === "pull")) want.push("pecs");
  if (issues.some(i => i.k === "hams")) want.push("hams");
  if (issues.some(i => i.k === "legs")) want.push("quads");
  if (issues.some(i => i.k === "upper")) want.push("pecs", "lats");
  const groups = [...new Set(want.map(m => GEN_GROUP[m]).filter(Boolean))].slice(0, 3);
  return { sets, enough: true, low, high, issues, groups };
}

// Charge d'une séance ≈ nombre de séries dures (un effort de 40 s à fond au minuteur compte pour une série)
export function sessionLoad(s) {
  let l = 0;
  for (const set of s.sets || []) l += effort(set.rpe) * kindOf(set.exId); // étirements : rien ; cardio : un peu
  for (const w of s.iv?.work || []) l += Math.min(1.2, Math.max(0.3, (w.sec || 30) / 40));
  return Math.round(l * 10) / 10;
}
export function trainingLoad(sessions = [], { now = Date.now(), weeks = 8 } = {}) {
  const list = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * WEEK, start = end - WEEK;
    return Math.round(sessions.filter(s => s.date > start && s.date <= end).reduce((a, s) => a + sessionLoad(s), 0) * 10) / 10;
  });
  const acute = list[weeks - 1], prev = list.slice(-5, -1), chronic = prev.reduce((a, x) => a + x, 0) / 4;
  const ratio = chronic >= 4 && prev.filter(x => x > 0).length >= 3 ? Math.round((acute / chronic) * 100) / 100 : null;
  const zone = ratio == null ? "new" : ratio > 1.5 ? "spike" : ratio > 1.3 ? "high" : ratio < 0.8 ? "low" : "ok";
  const text = {
    new: "Encore quelques semaines d'entraînement, et je compare ta charge semaine après semaine.",
    spike: `Gros pic : ${pct(ratio)} % de plus que tes 4 dernières semaines. Le risque de blessure monte : la semaine prochaine, reste à ce niveau ou allège.`,
    high: `Charge en hausse de ${pct(ratio)} % : c'est bien, mais ne monte pas plus vite que ça.`,
    ok: "Charge régulière par rapport à tes 4 dernières semaines : la zone idéale pour progresser sans te blesser.",
    low: `Charge en baisse de ${pct(ratio)} % : semaine allégée ? Si ce n'est pas voulu, reprends doucement.`,
  }[zone];
  return { weeks: list, acute, chronic: Math.round(chronic * 10) / 10, ratio, zone, text };
}
