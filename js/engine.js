// KAREN — moteur de coaching local.
// Décide instantanément (hors ligne) des charges, reps et repos après chaque série.
// L'IA Claude (ai.js), si elle est activée, peut ensuite affiner ces décisions.
import { EXERCISES } from "./data.js";
import { state, e1rm } from "./store.js";

const CUES = {
  "Pectoraux": ["Omoplates serrées, pieds ancrés au sol.", "Descends contrôlé, pousse explosif.", "Coudes à 45°, pas à 90."],
  "Épaules": ["Gainage fort, ne cambre pas.", "Pousse la tête à travers à la fin du mouvement.", "Contrôle la descente."],
  "Triceps": ["Coudes fixes, seuls les avant-bras bougent.", "Verrouille en bas, une seconde."],
  "Dos": ["Tire avec les coudes, pas avec les mains.", "Poitrine haute, serre les omoplates en fin de mouvement.", "Pas d'élan, contrôle total."],
  "Biceps": ["Coudes collés au corps.", "Descente lente, trois secondes."],
  "Jambes": ["Genoux dans l'axe des pieds.", "Pousse le sol, garde le buste fier.", "Respire en haut, bloque, descends."],
  "Chaîne post.": ["Dos neutre, barre collée aux jambes.", "Pousse le sol avec les pieds, hanches et épaules montent ensemble."],
  "Ischios": ["Hanches en arrière, léger fléchi des genoux.", "Sens l'étirement à l'arrière des cuisses."],
  "Fessiers": ["Menton rentré, serre les fessiers en haut.", "Bassin en rétroversion au sommet."],
  "Mollets": ["Amplitude complète, pause en haut."],
  "Abdos": ["Bas du dos plaqué, respire court.", "Contracte les fessiers pour verrouiller le bassin."],
  "Cardio": ["Rythme constant, respire.", "Atterris en douceur."],
};

const round = (v, step) => Math.max(0, Math.round(v / step) * step);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function readinessScore({ sleep, energy, soreness }) {
  return (sleep + energy + (6 - soreness)) / 15; // 0.2 .. 1
}

export function readinessVerdict(score) {
  if (score >= 0.8) return { factor: 1.03, setDelta: 0, label: "SENS D'ARAIGNÉE AU MAX", tone: "up",
    text: "Tu es en pleine forme. On pousse un peu plus fort aujourd'hui." };
  if (score >= 0.6) return { factor: 1, setDelta: 0, label: "PRÊT À TISSER", tone: "info",
    text: "Bonne forme. Séance standard, on vise la progression." };
  if (score >= 0.42) return { factor: 0.93, setDelta: -1, label: "SENS D'ARAIGNÉE EN ALERTE", tone: "warn",
    text: "Récupération moyenne. Charges allégées et une série en moins sur les accessoires." };
  return { factor: 0.85, setDelta: -1, label: "MODE RÉCUPÉRATION", tone: "down",
    text: "Ton corps demande du repos. Séance légère, technique parfaite, zéro échec." };
}

// Charge de départ à partir de l'historique (double progression).
function startingTarget(item) {
  const meta = EXERCISES[item.id];
  const last = state.lifts[item.id];
  const [min, max] = item.reps;
  let weight = item.weight;
  let goal = Math.round((min + max) / 2);
  if (last) {
    if (meta.type === "load") {
      weight = last.weight;
      if (last.reps >= max) weight += meta.step;
      else if (last.reps < min) weight -= meta.step;
    } else {
      goal = clamp(last.reps + (last.reps >= goal ? 1 : 0), min, max + 5);
    }
  }
  return { weight, goal };
}

export class Session {
  constructor(program, readiness) {
    this.program = program;
    this.readiness = readiness;
    this.verdict = readinessVerdict(readinessScore(readiness));
    this.startedAt = Date.now();
    this.fatigue = clamp(Math.round((1 - readinessScore(readiness)) * 30), 0, 30);
    this.flags = { cut: false, stop: false };
    this.prs = [];
    this.log = []; // fil des consignes du coach

    this.plan = program.exercises.map((item, i) => {
      const meta = EXERCISES[item.id];
      const t = startingTarget(item);
      const isMain = i < 2;
      const sets = Math.max(1, item.sets + (isMain ? 0 : this.verdict.setDelta) - (this.verdict.factor < 0.9 && isMain ? 1 : 0));
      const weight = meta.type === "load" ? round(t.weight * this.verdict.factor, meta.step) : 0;
      return {
        id: item.id, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step,
        sets, reps: item.reps, rpe: item.rpe, rest: item.rest,
        weight, goal: meta.type === "bw" ? Math.max(item.reps[0], Math.round(t.goal * (this.verdict.factor < 1 ? 0.9 : 1))) : t.goal,
        done: [], status: "todo",
      };
    });
    this.idx = 0;
  }

  get current() { return this.plan[this.idx]; }
  get setNumber() { return this.current ? this.current.done.length + 1 : 0; }
  get finished() { return this.idx >= this.plan.length; }
  get elapsed() { return Math.floor((Date.now() - this.startedAt) / 1000); }

  get progress() {
    const total = this.plan.reduce((a, e) => a + (e.status === "skipped" ? e.done.length : e.sets), 0);
    const done = this.plan.reduce((a, e) => a + e.done.length, 0);
    return total ? done / total : 0;
  }

  // Consigne d'ouverture pour l'exercice en cours.
  intro() {
    const ex = this.current;
    if (!ex) return null;
    const target = ex.type === "load" ? `${ex.weight} kilos, ${ex.goal} répétitions` : `${ex.goal} ${ex.id === "plank" || ex.id === "hollow" ? "secondes" : "répétitions"}`;
    const cue = pick(CUES[ex.muscle] || ["Concentre-toi sur la technique."]);
    return this.push({ kind: "info", title: ex.name, text: `${ex.sets} séries · objectif ${target}. ${cue}`,
      say: `${ex.name}. ${ex.sets} séries. Objectif : ${target}. ${cue}` });
  }

  push(ev) {
    const e = { ...ev, t: Date.now() };
    this.log.unshift(e);
    return e;
  }

  // Enregistre une série et renvoie les décisions du coach.
  logSet({ reps, rpe, pain = false, weight }) {
    const ex = this.current;
    const events = [];
    const w = weight ?? ex.weight;
    const [min, max] = ex.reps;
    ex.done.push({ weight: w, reps, rpe });

    // PR ?
    const prev = state.lifts[ex.id];
    if (prev && ((ex.type === "load" && e1rm(w, reps) > (prev.best || 0) + 0.01) || (ex.type === "bw" && reps > (prev.bestReps || 0)))) {
      if (!this.prs.includes(ex.id)) this.prs.push(ex.id);
      events.push(this.push({ kind: "pr", title: "NOUVEAU RECORD", text: `${ex.name} : ${w ? w + " kg × " : ""}${reps}. Le quartier est fier de toi.`,
        say: "Nouveau record personnel ! Incroyable." }));
    }

    // Fatigue cumulée
    const over = rpe - ex.rpe;
    this.fatigue = clamp(this.fatigue + 1.5 + Math.max(0, over) * 5 + (reps < min ? 8 : 0) - (over <= -2 ? 2 : 0), 0, 100);

    let rest = ex.rest + clamp(Math.round(over * 20), -30, 75);

    // Douleur : on arrête l'exercice tout de suite.
    if (pain) {
      const alt = (EXERCISES[ex.id].alts || [])[0];
      ex.status = "skipped";
      events.push(this.push({ kind: "warn", title: "SENS D'ARAIGNÉE !", text: `Douleur signalée : on arrête ${ex.name}.${alt ? ` Option : passer à ${EXERCISES[alt].name}.` : ""}`,
        say: `Stop. On arrête ${ex.name}. Ne force jamais sur une douleur.`, swap: alt || null }));
      this.advance(events);
      return { events, rest: Math.min(rest, 90) };
    }

    // Ajustement de la prochaine série
    if (ex.type === "load") {
      let next = w;
      if (reps < min) {
        next = round(w * (reps < min - 2 ? 0.88 : 0.94), ex.step);
        events.push(this.push({ kind: "down", title: "AJUSTEMENT", text: `${reps} reps < ${min}. Charge réduite à ${next} kg pour rester dans la zone.`,
          say: `On descend à ${next} kilos. Reste propre.` }));
        rest += 20;
      } else if (reps >= max && rpe <= ex.rpe - 1) {
        next = round(w + ex.step * (rpe <= ex.rpe - 2.5 ? 2 : 1), ex.step);
        events.push(this.push({ kind: "up", title: "ÇA MONTE", text: `Trop facile (RPE ${rpe}). On passe à ${next} kg.`,
          say: `Trop facile. On monte à ${next} kilos.` }));
      } else if (rpe >= 9.5) {
        events.push(this.push({ kind: "warn", title: "LIMITE", text: `RPE ${rpe} : charge maintenue, repos allongé. Ne va pas à l'échec.`,
          say: "Tu es à la limite. On garde la charge et on récupère plus longtemps." }));
        rest += 20;
      } else {
        events.push(this.push({ kind: "info", title: "PARFAIT", text: `Dans la cible. On garde ${w} kg.`, say: pick(["Parfait. On garde.", "Pile dans la cible.", "Propre. Continue comme ça."]) }));
      }
      ex.weight = next;
      ex.goal = clamp(ex.goal, min, max);
    } else {
      let goal = ex.goal;
      if (reps < min) goal = Math.max(1, reps);
      else if (rpe <= ex.rpe - 1) goal = reps + 1;
      else if (rpe >= 9.5) goal = Math.max(min, reps - 1);
      else goal = reps;
      const unit = ex.id === "plank" || ex.id === "hollow" ? "s" : " reps";
      events.push(this.push({ kind: goal > ex.goal ? "up" : goal < ex.goal ? "down" : "info", title: "PROCHAINE SÉRIE",
        text: `Objectif : ${goal}${unit}.`, say: `Prochaine série : ${goal}.` }));
      ex.goal = goal;
    }

    // Fatigue globale : on coupe du volume si besoin.
    if (this.fatigue >= 65 && !this.flags.cut) {
      this.flags.cut = true;
      let cut = 0;
      this.plan.slice(this.idx + 1).forEach(e => { if (e.sets > 1) { e.sets--; cut++; } });
      if (cut) events.push(this.push({ kind: "warn", title: "OPTIMISATION", text: `Fatigue élevée (${Math.round(this.fatigue)}%). Je retire une série sur ${cut} exercice(s) à venir.`,
        say: "Fatigue élevée. J'allège la fin de séance pour protéger ta récupération." }));
    }
    if (this.fatigue >= 90 && !this.flags.stop) {
      this.flags.stop = true;
      events.push(this.push({ kind: "down", title: "FIN CONSEILLÉE", text: "Réservoir vide. Termine cet exercice puis on rentre. Demain tu reviens plus fort.",
        say: "Le réservoir est vide. Termine cet exercice et on s'arrête là." }));
    }

    rest = clamp(rest, 30, 300);
    if (ex.done.length >= ex.sets) {
      ex.status = "done";
      this.advance(events);
      rest = Math.max(rest, 90);
    }
    return { events, rest };
  }

  advance(events) {
    this.idx++;
    while (this.plan[this.idx] && this.plan[this.idx].status !== "todo") this.idx++;
    if (this.flags.stop) this.idx = this.plan.length;
    if (this.finished) {
      events.push(this.push({ kind: "pr", title: "SÉANCE TERMINÉE", text: "Mission accomplie. Le quartier est en sécurité.", say: "Séance terminée. Mission accomplie !" }));
    } else {
      const n = this.current;
      events.push(this.push({ kind: "info", title: "SUIVANT", text: `${n.name} — ${n.sets} séries.`, say: `Ensuite : ${n.name}.` }));
    }
  }

  skip() {
    const ex = this.current;
    if (!ex) return [];
    ex.status = "skipped";
    const events = [this.push({ kind: "info", title: "PASSÉ", text: `${ex.name} passé.` })];
    this.advance(events);
    return events;
  }

  swap(altId) {
    const ex = this.current;
    const meta = EXERCISES[altId];
    if (!ex || !meta) return null;
    const t = startingTarget({ id: altId, weight: meta.type === "load" ? Math.round(ex.weight * 0.6) : 0, reps: ex.reps });
    Object.assign(ex, { id: altId, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step,
      weight: meta.type === "load" ? round(t.weight, meta.step) : 0, goal: t.goal, done: [], status: "todo" });
    return this.push({ kind: "info", title: "REMPLACEMENT", text: `On passe sur ${meta.name}.`, say: `On remplace par ${meta.name}.` });
  }

  // Remplace un exercice déjà passé (suite à une douleur) en le réinsérant juste après.
  insertAlt(altId, sets = 3) {
    const meta = EXERCISES[altId];
    const base = this.plan[this.idx - 1] || this.plan[0];
    const t = startingTarget({ id: altId, weight: meta.type === "load" ? 10 : 0, reps: base.reps });
    this.plan.splice(this.idx, 0, {
      id: altId, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step,
      sets, reps: base.reps, rpe: base.rpe, rest: base.rest,
      weight: meta.type === "load" ? round(t.weight, meta.step) : 0, goal: t.goal, done: [], status: "todo",
    });
  }

  // Applique une recommandation de l'IA, bornée pour rester sûre.
  applyAi(rec) {
    const ex = this.current;
    if (!ex || !rec) return false;
    let changed = false;
    if (ex.type === "load" && typeof rec.next_weight_kg === "number" && rec.next_weight_kg > 0) {
      const lo = ex.weight * 0.85, hi = ex.weight * 1.1 + ex.step;
      const w = round(clamp(rec.next_weight_kg, lo, hi), ex.step);
      if (w !== ex.weight) { ex.weight = w; changed = true; }
    }
    if (typeof rec.next_reps === "number" && rec.next_reps > 0) {
      const g = clamp(Math.round(rec.next_reps), ex.reps[0], ex.reps[1] + 5);
      if (g !== ex.goal) { ex.goal = g; changed = true; }
    }
    return changed;
  }

  snapshot() {
    return {
      programme: this.program.name,
      minutes: Math.round(this.elapsed / 60),
      fatigue_pct: Math.round(this.fatigue),
      forme: this.verdict.label,
      exercices: this.plan.map(e => ({
        nom: e.name, type: e.type === "load" ? "charge" : "poids du corps", series_prevues: e.sets,
        reps_cible: e.reps, rpe_cible: e.rpe, charge_actuelle_kg: e.weight, objectif_reps: e.goal,
        statut: e.status, series: e.done,
      })),
      exercice_en_cours: this.current?.name || null,
    };
  }

  summary() {
    const sets = this.plan.flatMap(e => e.done.map(d => ({ exId: e.id, name: e.name, ...d })));
    const volume = sets.reduce((a, s) => a + s.weight * s.reps, 0);
    const xp = Math.round(volume / 50 + sets.length * 12 + this.prs.length * 60);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: this.startedAt, programId: this.program.id, name: this.program.name,
      durationSec: this.elapsed, volume: Math.round(volume), sets, prs: [...this.prs], xp,
      readiness: this.readiness, fatigue: Math.round(this.fatigue),
    };
  }
}

// Programme conseillé : celui qui n'a pas été fait depuis le plus longtemps (hors maison).
export function suggestProgram(programs) {
  const core = programs.filter(p => ["push", "pull", "legs"].includes(p.id));
  const lastDone = id => state.sessions.filter(s => s.programId === id).reduce((m, s) => Math.max(m, s.date), 0);
  return core.sort((a, b) => lastDone(a.id) - lastDone(b.id))[0];
}
