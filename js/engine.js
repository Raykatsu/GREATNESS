// Moteur de coaching local : décide instantanément (hors ligne) des charges,
// répétitions et temps de repos après chaque série. L'IA Claude (ai.js), si
// elle est activée, peut ensuite affiner ces décisions.
import { EXERCISES } from "./data.js";
import { state, e1rm, lastPerformance } from "./store.js";

const round = (v, step) => Math.max(0, Math.round(v / step) * step);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const unitOf = type => (type === "time" ? "s" : "reps");
export const fmtTarget = ex => (ex.type === "load" ? `${ex.weight} kg × ${ex.goal}` : `${ex.goal} ${ex.type === "time" ? "s" : "reps"}`);

export function readinessScore({ sleep, energy, soreness }) {
  return (sleep + energy + (6 - soreness)) / 15; // 0.2 .. 1
}

export function readinessVerdict(score) {
  if (score >= 0.8) return { factor: 1.03, setDelta: 0, label: "En pleine forme", tone: "up",
    text: "Tu es au top. On pousse un peu plus fort aujourd'hui." };
  if (score >= 0.6) return { factor: 1, setDelta: 0, label: "Prêt", tone: "info",
    text: "Bonne forme. Séance normale, on vise la progression." };
  if (score >= 0.42) return { factor: 0.93, setDelta: -1, label: "Récupération moyenne", tone: "warn",
    text: "Charges un peu allégées et une série en moins sur les exercices secondaires." };
  return { factor: 0.85, setDelta: -1, label: "Mode récupération", tone: "down",
    text: "Ton corps demande du repos : séance légère, technique parfaite, aucun échec." };
}

// Charge / objectif de départ à partir de l'historique (double progression).
function startingTarget(item) {
  const meta = EXERCISES[item.id];
  const last = state.lifts[item.id];
  const [min, max] = item.reps;
  let weight = item.weight;
  let goal = Math.round((min + max) / 2);
  if (last) {
    if (meta.type === "load") {
      weight = last.weight || item.weight;
      if (last.reps >= max) { weight += meta.step; goal = min; }
      else if (last.reps < min) { weight -= meta.step; goal = max; }
      else goal = clamp(last.reps + 1, min, max);
    } else {
      goal = clamp(last.reps + (last.reps >= goal ? meta.step : 0), min, max + 5 * meta.step);
    }
  }
  return { weight, goal };
}

function makeItem(item, verdict, isMain) {
  const meta = EXERCISES[item.id];
  const t = startingTarget(item);
  const sets = Math.max(1, item.sets + (isMain ? 0 : verdict.setDelta) - (verdict.factor < 0.9 && isMain ? 1 : 0));
  return {
    id: item.id, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step, cues: meta.cues,
    sets, reps: item.reps, rpe: item.rpe, rest: item.rest,
    weight: meta.type === "load" ? round(t.weight * verdict.factor, meta.step) : 0,
    goal: meta.type === "load" ? t.goal : Math.max(item.reps[0], round(t.goal * (verdict.factor < 1 ? 0.9 : 1), meta.step)),
    done: [], status: "todo", last: lastPerformance(item.id), introduced: false,
  };
}

export class Session {
  constructor(program, readiness) {
    this.program = program;
    this.readiness = readiness;
    this.verdict = readinessVerdict(readinessScore(readiness));
    this.startedAt = Date.now();
    this.fatigue = clamp(Math.round((1 - readinessScore(readiness)) * 30), 0, 30);
    this.flags = { cut: false, stop: false, warmup: false };
    this.prs = [];
    this.log = [];
    this.history = []; // pour annuler
    this.plan = program.exercises.map((item, i) => makeItem(item, this.verdict, i < 2));
    this.idx = 0;
  }

  get current() { return this.plan[this.idx]; }
  get finished() { return !this.plan.some(e => e.status === "todo"); }
  get elapsed() { return Math.floor((Date.now() - this.startedAt) / 1000); }
  get totalDone() { return this.plan.reduce((a, e) => a + e.done.length, 0); }
  get progress() {
    const total = this.plan.reduce((a, e) => a + (e.status === "skipped" ? e.done.length : Math.max(e.sets, e.done.length)), 0);
    return total ? this.totalDone / total : 0;
  }

  push(ev) {
    const e = { ...ev, t: Date.now() };
    this.log.unshift(e);
    if (this.log.length > 40) this.log.pop();
    return e;
  }

  // Consigne d'ouverture pour l'exercice en cours.
  intro() {
    const ex = this.current;
    if (!ex) return null;
    ex.introduced = true;
    const target = ex.type === "load" ? `${ex.weight} kilos, ${ex.goal} répétitions` : `${ex.goal} ${ex.type === "time" ? "secondes" : "répétitions"}`;
    const cue = pick(ex.cues);
    let warm = "";
    if (!this.flags.warmup && ex.type === "load" && ex.weight >= 30) {
      this.flags.warmup = true;
      warm = ` Échauffement : 8 reps à ${round(ex.weight * 0.5, ex.step)} kg puis 4 reps à ${round(ex.weight * 0.75, ex.step)} kg.`;
    }
    return this.push({ kind: "info", title: ex.name, text: `${ex.sets} série${ex.sets > 1 ? "s" : ""} · objectif ${fmtTarget(ex)}. ${cue}${warm}`,
      say: `${ex.name}. ${ex.sets} série${ex.sets > 1 ? "s" : ""}. Objectif : ${target}. ${cue}${warm}` });
  }

  // Aller directement à un exercice (ordre libre).
  jump(i) {
    if (this.plan[i] && this.plan[i].status === "todo") { this.idx = i; return true; }
    return false;
  }

  logSet({ reps, rpe, pain = false, weight }) {
    const ex = this.current;
    if (!ex) return { events: [], rest: 0 };
    this.history.push(JSON.stringify({ plan: this.plan, idx: this.idx, fatigue: this.fatigue, flags: this.flags, prs: this.prs }));
    if (this.history.length > 30) this.history.shift();

    const events = [];
    const w = ex.type === "load" ? (weight ?? ex.weight) : 0;
    const [min, max] = ex.reps;
    ex.done.push({ weight: w, reps, rpe });

    // Record ?
    const prev = state.lifts[ex.id];
    const beat = prev && ((ex.type === "load" && e1rm(w, reps) > (prev.best || 0) + 0.01) || (ex.type !== "load" && reps > (prev.bestReps || 0)));
    if (beat && !this.prs.includes(ex.id)) {
      this.prs.push(ex.id);
      events.push(this.push({ kind: "pr", mood: "party", title: "Nouveau record !", text: `${ex.name} : ${w ? w + " kg × " : ""}${reps}${ex.type === "time" ? " s" : ""}. Le quartier est fier de toi.`,
        say: "Nouveau record personnel ! Incroyable." }));
    }

    const over = rpe - ex.rpe;
    this.fatigue = clamp(this.fatigue + 1.5 + Math.max(0, over) * 5 + (reps < min ? 6 : 0) - (over <= -2 ? 1.5 : 0), 0, 100);
    let rest = ex.rest + clamp(Math.round(over * 20), -30, 75);

    // Douleur : arrêt immédiat.
    if (pain) {
      const alt = (EXERCISES[ex.id].alts || [])[0];
      ex.status = "skipped";
      events.push(this.push({ kind: "warn", mood: "alert", title: "Stop, on arrête", text: `Douleur signalée : on arrête ${ex.name}.${alt ? ` Tu peux le remplacer par ${EXERCISES[alt].name}.` : ""} Ne force jamais sur une douleur.`,
        say: `Stop. On arrête ${ex.name}. Ne force jamais sur une douleur.`, swap: alt || null }));
      this.advance(events);
      return { events, rest: Math.min(rest, 90) };
    }

    if (ex.type === "load") {
      let next = w;
      if (reps < min) {
        next = round(w * (reps < min - 2 ? 0.88 : 0.94), ex.step);
        events.push(this.push({ kind: "down", title: "On ajuste", text: `${reps} reps, c'est sous la cible. Prochaine série à ${next} kg pour rester dans la zone.`,
          say: `On descend à ${next} kilos. Reste propre.` }));
        rest += 20;
      } else if (reps >= max && rpe <= ex.rpe - 1) {
        next = round(w + ex.step * (rpe <= ex.rpe - 2.5 ? 2 : 1), ex.step);
        events.push(this.push({ kind: "up", mood: "happy", title: "Ça monte", text: `Trop facile (ressenti ${rpe}). On passe à ${next} kg.`,
          say: `Trop facile. On monte à ${next} kilos.` }));
      } else if (rpe >= 9.5) {
        events.push(this.push({ kind: "warn", title: "À la limite", text: `Ressenti ${rpe} : on garde ${w} kg et tu récupères plus longtemps. Pas d'échec.`,
          say: "Tu es à la limite. On garde la charge et on récupère plus longtemps." }));
        rest += 20;
      } else {
        events.push(this.push({ kind: "info", mood: "happy", title: "Parfait", text: `Pile dans la cible. On garde ${w} kg.`, say: pick(["Parfait, on garde.", "Pile dans la cible.", "Propre, continue comme ça."]) }));
      }
      ex.weight = next;
      ex.goal = reps >= max ? (next > w ? min : max) : clamp(Math.max(reps, ex.goal), min, max);
    } else {
      let goal = ex.goal;
      if (reps < min) goal = Math.max(ex.step, reps);
      else if (rpe <= ex.rpe - 1) goal = reps + ex.step;
      else if (rpe >= 9.5) goal = Math.max(min, reps - ex.step);
      else goal = reps;
      const u = ex.type === "time" ? " s" : " reps";
      const kind = goal > ex.goal ? "up" : goal < ex.goal ? "down" : "info";
      events.push(this.push({ kind, mood: kind === "up" ? "happy" : undefined, title: kind === "up" ? "Ça monte" : kind === "down" ? "On ajuste" : "Parfait",
        text: `Prochaine série : ${goal}${u}.`, say: `Prochaine série : ${goal}${ex.type === "time" ? " secondes" : ""}.` }));
      ex.goal = goal;
    }

    // Fatigue globale : on retire du volume si besoin.
    if (this.fatigue >= 65 && !this.flags.cut) {
      this.flags.cut = true;
      let cut = 0;
      this.plan.forEach((e, i) => { if (i !== this.idx && e.status === "todo" && e.sets > 1 && e.done.length < e.sets - 1) { e.sets--; cut++; } });
      if (cut) events.push(this.push({ kind: "warn", mood: "alert", title: "J'allège la fin", text: `Fatigue élevée (${Math.round(this.fatigue)} %). Je retire une série sur ${cut} exercice(s) restant(s).`,
        say: "Fatigue élevée. J'allège la fin de séance pour protéger ta récupération." }));
    }
    if (this.fatigue >= 90 && !this.flags.stop) {
      this.flags.stop = true;
      events.push(this.push({ kind: "down", mood: "alert", title: "Fin conseillée", text: "Réservoir vide. Termine cet exercice et on s'arrête là : tu reviendras plus fort.",
        say: "Le réservoir est vide. Termine cet exercice et on s'arrête là." }));
    }

    rest = clamp(rest, 20, 300);
    if (ex.done.length >= ex.sets) {
      ex.status = "done";
      this.advance(events);
      rest = Math.max(rest, Math.min(90, ex.rest));
    }
    return { events, rest };
  }

  advance(events) {
    if (this.flags.stop) this.plan.forEach(e => { if (e.status === "todo") e.status = "skipped"; });
    const next = this.plan.findIndex((e, i) => i > this.idx && e.status === "todo");
    const any = next >= 0 ? next : this.plan.findIndex(e => e.status === "todo");
    if (any >= 0) {
      this.idx = any;
      const n = this.current;
      events.push(this.push({ kind: "info", title: "Exercice suivant", text: `${n.name} · ${n.sets} série${n.sets > 1 ? "s" : ""} · ${fmtTarget(n)}`, say: `Ensuite : ${n.name}.` }));
    } else {
      this.idx = this.plan.length;
      events.push(this.push({ kind: "pr", mood: "party", title: "Séance terminée", text: "Mission accomplie. Le quartier est en sécurité.", say: "Séance terminée. Mission accomplie !" }));
    }
  }

  undo() {
    const snap = this.history.pop();
    if (!snap) return false;
    const s = JSON.parse(snap);
    Object.assign(this, { plan: s.plan, idx: s.idx, fatigue: s.fatigue, flags: s.flags, prs: s.prs });
    return true;
  }

  addSet() { const ex = this.current; if (ex) ex.sets++; }

  skip() {
    const ex = this.current;
    if (!ex) return [];
    ex.status = ex.done.length ? "done" : "skipped";
    const events = [];
    this.advance(events);
    return events;
  }

  swap(altId) {
    const ex = this.current;
    if (!ex || !EXERCISES[altId]) return null;
    const meta = EXERCISES[altId];
    const item = { id: altId, sets: ex.sets - ex.done.length || 1, reps: ex.reps, rpe: ex.rpe, rest: ex.rest,
      weight: meta.type === "load" ? (ex.type === "load" ? Math.round(ex.weight * 0.5) : 10) : 0 };
    const fresh = makeItem(item, { factor: 1, setDelta: 0 }, true);
    if (ex.done.length) {
      ex.status = "done"; ex.sets = ex.done.length;
      this.plan.splice(this.idx + 1, 0, fresh);
      this.idx++;
    } else {
      this.plan[this.idx] = fresh;
    }
    return this.push({ kind: "info", title: "Remplacement", text: `On passe sur ${meta.name}.`, say: `On remplace par ${meta.name}.` });
  }

  // Ajoute une alternative juste après l'exercice courant (après une douleur, par exemple).
  insertAlt(altId) {
    const meta = EXERCISES[altId];
    const ref = this.plan.find(e => e.status === "skipped") || this.plan[0];
    const item = { id: altId, sets: 3, reps: ref.reps, rpe: ref.rpe, rest: ref.rest, weight: meta.type === "load" ? 10 : 0 };
    const pos = Math.min(this.idx, this.plan.length);
    this.plan.splice(pos, 0, makeItem(item, { factor: 1, setDelta: 0 }, true));
    this.idx = pos;
  }

  // Recommandation IA, bornée pour rester sûre.
  applyAi(rec) {
    const ex = this.current;
    if (!ex || !rec) return false;
    let changed = false;
    if (ex.type === "load" && typeof rec.next_weight_kg === "number" && rec.next_weight_kg > 0) {
      const w = round(clamp(rec.next_weight_kg, ex.weight * 0.85, ex.weight * 1.1 + ex.step), ex.step);
      if (w !== ex.weight) { ex.weight = w; changed = true; }
    }
    if (typeof rec.next_reps === "number" && rec.next_reps > 0) {
      const g = clamp(Math.round(rec.next_reps), ex.reps[0], ex.reps[1] + 5 * ex.step);
      if (g !== ex.goal) { ex.goal = g; changed = true; }
    }
    return changed;
  }

  snapshot() {
    return {
      programme: this.program.name, minutes: Math.round(this.elapsed / 60), fatigue_pct: Math.round(this.fatigue), forme: this.verdict.label,
      exercices: this.plan.map(e => ({ nom: e.name, type: e.type, series_prevues: e.sets, cible: e.reps, rpe_cible: e.rpe,
        charge_kg: e.weight, objectif: e.goal, statut: e.status, series: e.done })),
      exercice_en_cours: this.current?.name || null,
    };
  }

  summary() {
    const sets = this.plan.flatMap(e => e.done.map(d => ({ exId: e.id, name: e.name, ...d })));
    const volume = sets.reduce((a, s) => a + s.weight * s.reps, 0);
    const xp = Math.round(volume / 50 + sets.length * 12 + this.prs.length * 60);
    const compare = this.plan.filter(e => e.done.length).map(e => {
      const sc = s => (s.weight > 0 ? e1rm(s.weight, s.reps) : s.reps);
      const best = e.done.reduce((b, s) => (sc(s) > sc(b) ? s : b), e.done[0]);
      const prevBest = e.last ? e.last.reduce((b, s) => (sc(s) > sc(b) ? s : b), e.last[0]) : null;
      const delta = prevBest ? sc(best) - sc(prevBest) : null;
      return { id: e.id, name: e.name, type: e.type, sets: e.done.length, best, prevBest, delta };
    });
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: this.startedAt, programId: this.program.id, name: this.program.name,
      durationSec: this.elapsed, volume: Math.round(volume), sets, prs: [...this.prs], xp,
      readiness: this.readiness, fatigue: Math.round(this.fatigue), compare, cut: this.flags.cut,
    };
  }
}
