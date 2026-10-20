// Données du widget « Séance du jour » (app App Store) : la séance de chacun des 7 jours qui viennent, ta série de
// jours et ta semaine. Le widget les lit sans ouvrir l'app et change de jour tout seul à minuit.
import { state, getProgram, streak, sessionsOn, weekStart } from "./store.js";
import { ensureWeekPlan, estimateMinutes } from "./planner.js";
import { classicSession } from "./classics.js";
import { tr } from "./i18n.js";

const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function widgetData(now = Date.now(), st = state) {
  const plan = ensureWeekPlan();
  const days = [];
  let n = st.classic?.n || 0; // programme célèbre : chaque jour prévu, la séance suivante du programme
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const id = plan[(date.getDay() + 6) % 7];
    const p = id === "classic" ? (st.classic ? classicSession({ ...st.classic, n: n++ }, st) : null) : id && id !== "mobility" ? getProgram(id) : null;
    const done = i === 0 && sessionsOn(date).length > 0;
    // le widget s'affiche hors de l'app : textes traduits ici si l'app est en anglais
    days.push(done ? { date: key(date), title: tr("Séance faite ✓"), sub: tr("Bravo : récupère bien"), rest: true }
      : p ? { date: key(date), title: tr(p.name), sub: tr(`~${estimateMinutes(p)} min · ${p.exercises.length} exercice${p.exercises.length > 1 ? "s" : ""}`), rest: false }
      : { date: key(date), title: tr("Récupération"), sub: tr("Mobilité · 15 min"), rest: true });
  }
  const start = +weekStart();
  return {
    days, streak: streak(),
    weekDone: (st.sessions || []).filter(s => s.date >= start).length,
    weekGoal: Object.values(plan).filter(x => x && x !== "mobility").length,
    updated: now,
  };
}
