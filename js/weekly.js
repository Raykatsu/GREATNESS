// Bilan de la semaine (lundi → dimanche) : chiffres clés, note sur 100, points forts, points à travailler.
// Aucun affichage ici (testé dans Node) ; l'écran est dans review.js.
import { EXERCISES, GOALS } from "./data.js";
import { targets, dayKey, sumItems } from "./nutrition.js";
import { LOC } from "./i18n.js";

const DAY = 864e5;
export function mondayOf(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
// Semaine à présenter : la semaine en cours le dimanche dès 17 h, sinon la précédente
export function reviewWeek(now = new Date()) {
  const m = mondayOf(now);
  return now.getDay() === 0 && now.getHours() >= 17 ? m : new Date(m.getTime() - 7 * DAY);
}

const LEGS = ["Quadriceps", "Ischios", "Fessiers"], GROUPS = [["Jambes", LEGS], ["Dos", ["Dos"]], ["Pectoraux", ["Pectoraux"]], ["Épaules", ["Épaules"]]];
const sumBy = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

export function weekReport(state, start) {
  const s = mondayOf(start).getTime(), e = s + 7 * DAY, ps = s - 7 * DAY;
  const sessions = (state.sessions || []).filter(x => x.date >= s && x.date < e);
  const prev = (state.sessions || []).filter(x => x.date >= ps && x.date < s);
  const real = sessions.filter(x => x.programId !== "mobility");
  const planned = Math.max(1, Object.values(state.weekPlan || {}).filter(id => id && id !== "mobility").length || state.profile?.days || 3);
  const volume = Math.round(sumBy(sessions, x => x.volume)), prevVolume = Math.round(sumBy(prev, x => x.volume));
  const minutes = Math.round(sumBy(sessions, x => x.durationSec) / 60);
  const prs = [...new Set(sessions.flatMap(x => x.prs || []))];
  const muscles = {};
  for (const x of sessions) for (const st of x.sets || []) { const m = EXERCISES[st.exId]?.muscle; if (m) muscles[m] = (muscles[m] || 0) + 1; }

  // nutrition : jours renseignés de la semaine
  const t = targets(state.profile || {});
  const days = Array.from({ length: 7 }, (_, i) => state.food?.[dayKey(new Date(s + i * DAY + DAY / 2))]).filter(d => d && (d.sum || d.items?.length)).map(d => d.sum || sumItems(d.items));
  const nutri = days.length ? {
    n: days.length, k: Math.round(sumBy(days, d => d.k) / days.length), p: Math.round(sumBy(days, d => d.p) / days.length),
    inRange: days.filter(d => Math.abs(d.k - t.kcal) <= t.kcal * 0.1).length, protOk: days.filter(d => d.p >= t.p * 0.9).length,
  } : null;

  // poids de corps : dernière mesure de la semaine face à la dernière d'avant
  const bw = (state.body || []).filter(b => b.weight > 0);
  const inW = bw.filter(b => b.date >= s && b.date < e).pop(), before = bw.filter(b => b.date < s).pop();
  const bwDelta = inW && before ? Math.round((inW.weight - before.weight) * 10) / 10 : null;

  const good = [], todo = [], goal = state.profile?.goal || "forme";
  const done = real.length;
  if (done >= planned) good.push(`Semaine bouclée : ${done} séance${done > 1 ? "s" : ""} sur ${planned} prévues.`);
  else if (done) todo.push(`${done} séance${done > 1 ? "s" : ""} sur ${planned} : bloque tes créneaux dans ton agenda (les rappels sont dans Réglages).`);
  else todo.push("Aucune séance cette semaine : reprends en douceur avec 2 séances courtes.");
  const dv = pct(volume, prevVolume);
  if (dv != null && dv >= 5) good.push(`Volume en hausse de ${dv} % (${volume.toLocaleString(LOC())} kg).`);
  else if (dv != null && dv <= -15 && done) todo.push(`Volume en baisse de ${-dv} % par rapport à la semaine d'avant.`);
  if (prs.length) good.push(`${prs.length} record${prs.length > 1 ? "s" : ""} battu${prs.length > 1 ? "s" : ""} : ${prs.slice(0, 3).map(id => EXERCISES[id]?.name || id).join(", ")}.`);
  if (done >= 2) {
    const missing = GROUPS.filter(([, ms]) => !ms.some(m => muscles[m])).map(([g]) => g);
    if (missing.length) todo.push(`Rien pour : ${missing.join(", ").toLowerCase()}. Pense à équilibrer ta semaine.`);
  }
  if (nutri) {
    if (nutri.protOk >= Math.ceil(nutri.n * 0.7)) good.push(`Protéines au rendez-vous ${nutri.protOk} jour${nutri.protOk > 1 ? "s" : ""} sur ${nutri.n}.`);
    else todo.push(`Protéines : ${nutri.p} g par jour en moyenne pour un objectif de ${t.p} g. Ajoute une source à chaque repas (skyr, œufs, poulet, thon).`);
    if (nutri.inRange >= Math.ceil(nutri.n * 0.7)) good.push(`Calories dans l'objectif ${nutri.inRange} jour${nutri.inRange > 1 ? "s" : ""} sur ${nutri.n}.`);
    else if (goal === "seche" && nutri.k > t.kcal * 1.1) todo.push(`${nutri.k} kcal par jour en moyenne pour ${t.kcal} visées : la sèche demande un petit déficit.`);
    else if ((goal === "muscle" || goal === "force") && nutri.k < t.kcal * 0.9) todo.push(`${nutri.k} kcal par jour en moyenne pour ${t.kcal} visées : mange un peu plus pour progresser.`);
  } else todo.push("Note tes repas quelques jours (onglet Repas) : ton bilan inclura la nutrition.");
  if (bwDelta != null) {
    const fine = goal === "seche" ? bwDelta < 0 : goal === "muscle" ? bwDelta > 0 && bwDelta <= 0.6 : Math.abs(bwDelta) <= 0.5;
    (fine ? good : todo).push(`Poids de corps : ${bwDelta > 0 ? "+" : ""}${bwDelta.toLocaleString(LOC())} kg sur la semaine${fine ? "" : ` (objectif ${GOALS[goal]?.name.toLowerCase()})`}.`);
  }

  // note sur 100 : régularité 50, progression 15, records 10, nutrition 25
  const score = Math.round(
    Math.min(1, done / planned) * 50 + (dv == null ? (done ? 10 : 0) : dv >= 0 ? 15 : dv > -15 ? 8 : 0) + Math.min(prs.length, 2) * 5
    + (nutri ? ((nutri.inRange / nutri.n) * 12.5 + (nutri.protOk / nutri.n) * 12.5) : 0));
  return { start: s, sessions: done, mobility: sessions.length - done, planned, volume, prevVolume, dv, minutes, prs, muscles, nutri, t, bwDelta, good, todo, score, empty: !sessions.length && !nutri };
}

// Résumé compact pour l'IA en ligne
export function reportText(r) {
  const mus = Object.entries(r.muscles).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(", ");
  return [
    `Semaine du ${new Date(r.start).toLocaleDateString(LOC(), { day: "numeric", month: "long" })} : ${r.sessions} séance(s) sur ${r.planned} prévues, ${r.minutes} min, volume ${r.volume} kg (semaine d'avant ${r.prevVolume} kg).`,
    r.prs.length ? `Records : ${r.prs.map(id => EXERCISES[id]?.name || id).join(", ")}.` : "Pas de record.",
    mus ? `Séries par muscle : ${mus}.` : "",
    r.nutri ? `Nutrition (${r.nutri.n} jours notés) : ${r.nutri.k} kcal et ${r.nutri.p} g de protéines par jour en moyenne (objectifs ${r.t.kcal} kcal, ${r.t.p} g).` : "Repas non notés.",
    r.bwDelta != null ? `Poids de corps : ${r.bwDelta > 0 ? "+" : ""}${r.bwDelta} kg.` : "",
    `Note calculée par l'app : ${r.score}/100.`,
  ].filter(Boolean).join("\n");
}
