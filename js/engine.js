// Moteur de coaching local : décide instantanément (hors ligne) des charges,
// répétitions et temps de repos après chaque série. L'IA Claude (ai.js), si
// elle est activée, peut ensuite affiner ces décisions.
import { EXERCISES } from "./data.js";
import { state, e1rm, lastPerformance, exerciseHistory } from "./store.js";
import { recovery, exerciseReady, programStrain } from "./recovery.js";
import { goalFix } from "./goals.js";

const round = (v, step) => Math.max(0, Math.round(v / step) * step);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const unitOf = type => (type === "time" ? "s" : "reps");
export const fmtTarget = ex => (ex.type === "load" ? `${ex.weight} kg × ${ex.goal}${ex.amrap ? "+" : ""}` : `${ex.goal}${ex.amrap ? "+" : ""} ${ex.type === "time" ? "s" : "reps"}`);

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
  // charge fixée par le coach pour la prochaine séance
  if (last?.next > 0 && meta.type === "load") return { weight: last.next, goal: min };
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

// rec : récupération des muscles (recovery.js) ; un exercice dont les muscles principaux ne sont pas remis
// (sous 50 %) perd une série et 5 % de charge : on ne recharge pas un muscle encore fatigué.
// Charge imposée (`item.fixed` : test final, séance d'objectif ; sinon la prescription d'un objectif chiffré en cours) :
// on la suit, allégée seulement un jour sans ou sur un muscle pas remis.
function makeItem(item, verdict, isMain, rec, goals = true) {
  const meta = EXERCISES[item.id];
  if (item.scheme) return schemeItem(item, meta, verdict, rec);
  const fix = item.fixed || (goals ? goalFix(item.id) : null);
  if (fix) return fixedItem(item, meta, fix, verdict, rec);
  const t = startingTarget(item);
  const sore = rec ? exerciseReady(item.id, rec) < 0.5 : false;
  const sets = Math.max(1, item.sets + (isMain ? 0 : verdict.setDelta) - (verdict.factor < 0.9 && isMain ? 1 : 0) - (verdict.deload ? 1 : 0) - (sore ? 1 : 0));
  // Plateau : 3 séances sans progrès → on recule de 10 % pour mieux repartir.
  const plateau = meta.type === "load" && stalled(item.id);
  return {
    id: item.id, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step, cues: meta.cues,
    sets, reps: item.reps, rpe: item.rpe, rest: item.rest, ss: item.ss || null, plateau, sore,
    weight: meta.type === "load" ? round(t.weight * verdict.factor * (plateau ? 0.9 : 1) * (sore ? 0.95 : 1), meta.step) : 0,
    goal: meta.type === "load" ? t.goal : Math.max(item.reps[0], round(t.goal * (verdict.factor < 1 ? 0.9 : 1), meta.step)),
    done: [], status: "todo", last: lastPerformance(item.id), introduced: false,
  };
}

function fixedItem(item, meta, fix, verdict, rec) {
  const sore = rec ? exerciseReady(item.id, rec) < 0.5 : false;
  const sets = Math.max(1, (item.fixed ? item.sets : fix.sets) - (sore ? 1 : 0) - (verdict.factor < 0.9 && !item.ramp ? 1 : 0));
  const weight = meta.type === "load" ? round(fix.weight * Math.min(1, verdict.factor) * (sore && !item.ramp ? 0.95 : 1), meta.step) : 0;
  return {
    id: item.id, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step, cues: meta.cues,
    sets, reps: item.ramp ? item.reps : [fix.goal, fix.goal], rpe: item.rpe, rest: item.rest, ss: item.ss || null, plateau: false, sore,
    weight, goal: fix.goal, ramp: item.ramp || null, goalNote: fix.note || null,
    done: [], status: "todo", last: lastPerformance(item.id), introduced: false,
  };
}

// Programme célèbre (classics.js) : charge et reps imposées série par série (« 5+ » : au maximum). Un jour sans ou un
// muscle pas remis allègent un peu les charges, jamais le nombre de séries (la série au max décide de la suite).
function schemeItem(item, meta, verdict, rec) {
  const sore = rec ? exerciseReady(item.id, rec) < 0.5 : false;
  const k = Math.min(1, verdict.factor) * (sore ? 0.95 : 1), s0 = item.scheme[0], reps = item.scheme.map(x => x.reps);
  return {
    id: item.id, name: meta.name, muscle: meta.muscle, type: meta.type, step: meta.step, cues: meta.cues,
    sets: item.scheme.length, reps: [Math.min(...reps), Math.max(...reps)], rpe: item.rpe || 8, rest: item.rest || 120, ss: null, plateau: false, sore,
    weight: meta.type === "load" ? round(s0.weight * k, meta.step) : 0, goal: s0.reps, amrap: !!s0.amrap,
    scheme: item.scheme, schemeK: k, schemeNote: item.note || null,
    done: [], status: "todo", last: lastPerformance(item.id), introduced: false,
  };
}
// Charge prescrite de la série i (avec l'allègement du jour)
export const schemeAt = (ex, i) => { const x = ex.scheme?.[i]; return x ? { weight: ex.type === "load" ? round(x.weight * (ex.schemeK || 1), ex.step) : 0, reps: x.reps, amrap: !!x.amrap } : null; };

export function stalled(id) {
  const h = exerciseHistory(id).slice(-4);
  if (h.length < 4) return false;
  const best = Math.max(...h.slice(0, -3).map(x => x.e1rm));
  return h.slice(-3).every(x => x.e1rm <= best + 0.01);
}

// Calculateur de disques : ce qu'il faut mettre de chaque côté de la barre.
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export function plates(total, bar = 20) {
  let side = Math.max(0, (total - bar) / 2);
  const out = [];
  for (const p of PLATES) while (side >= p - 1e-9) { out.push(p); side = +(side - p).toFixed(3); }
  return { side: out, rest: side, bar };
}

export class Session {
  constructor(program, readiness, { deload = false } = {}) {
    this.program = program;
    this.readiness = readiness;
    this.verdict = readinessVerdict(readinessScore(readiness));
    if (deload) Object.assign(this.verdict, { deload: true, factor: Math.min(this.verdict.factor, 0.88), label: "Semaine allégée",
      text: "Semaine de récupération : charges et volume réduits pour revenir plus fort. C'est voulu !" });
    this.startedAt = Date.now();
    this.fatigue = clamp(Math.round((1 - readinessScore(readiness)) * 30), 0, 30);
    this.flags = { cut: false, stop: false, warmup: false };
    this.prs = [];
    this.log = [];
    this.history = []; // pour annuler
    this.recovery = recovery(state.sessions, this.startedAt);
    // échauffements, étirements, soins : pas de prescription d'objectif chiffré
    this.goals = !program.simple && !["mobility", "stretch", "care"].includes(program.cat);
    this.plan = program.exercises.map((item, i) => makeItem(item, this.verdict, i < 2, this.recovery, this.goals));
    this.idx = 0;
  }

  get current() { return this.plan[this.idx]; }
  get finished() { return !this.program.free && !this.plan.some(e => e.status === "todo"); }
  get elapsed() { return Math.floor((Date.now() - this.startedAt) / 1000); }
  get totalDone() { return this.plan.reduce((a, e) => a + e.done.length, 0); }
  get progress() {
    const total = this.plan.reduce((a, e) => a + (e.status === "skipped" ? e.done.length : Math.max(e.sets, e.done.length)), 0);
    return total ? this.totalDone / total : 0;
  }

  // Muscles pas encore remis : message de départ (les exercices concernés sont déjà allégés)
  recoveryNote() {
    const sore = this.plan.filter(e => e.sore);
    if (!sore.length || !this.recovery) return null;
    const ms = programStrain(this.program, this.recovery).filter(x => x.ready < 0.5).slice(0, 3);
    if (!ms.length) return null;
    return this.push({ kind: "warn", title: "Muscles pas encore remis",
      text: `${ms.map(x => `${x.name} ${Math.round(x.ready * 100)} %`).join(", ")} : une série de moins et charge un peu allégée sur ${sore.map(e => e.name).join(", ")}.`,
      say: `${ms.map(x => x.name).join(" et ")} pas encore récupérés : j'allège un peu ces exercices.` });
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
    if (ex.ramp) {
      this.flags.warmup = true;
      const steps = ex.ramp.filter(r => !r.attempt), tgt = ex.ramp.find(r => r.attempt);
      warm = ex.type === "load" ? ` Test final : montée en charge ${steps.map(r => `${r.reps} × ${String(r.weight).replace(".", ",")} kg`).join(", ")}, puis la tentative à ${String(tgt.weight).replace(".", ",")} kg.`
        : ` Test final : une série facile pour te chauffer, puis le maximum : objectif ${tgt.reps}${ex.type === "time" ? " secondes" : " répétitions"}.`;
    } else if (ex.goalNote) warm = ` ${ex.goalNote}`;
    else if (ex.schemeNote) warm = ` ${ex.schemeNote}`;
    if (!this.flags.warmup && ex.type === "load" && ex.weight >= 30) {
      this.flags.warmup = true;
      warm += ` Échauffement : 8 reps à ${round(ex.weight * 0.5, ex.step)} kg puis 4 reps à ${round(ex.weight * 0.75, ex.step)} kg.`;
    }
    const ssMates = ex.ss ? this.plan.filter(e => e.ss === ex.ss && e !== ex).map(e => e.name) : [];
    if (ssMates.length) warm += ` Superset avec ${ssMates.join(" et ")} : enchaîne sans repos.`;
    if (ex.plateau) warm += " Ça stagne depuis 3 séances : on recule de 10 % pour mieux repartir.";
    if (ex.sore) warm += " Muscles pas encore remis : une série de moins et charge un peu allégée.";
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

    if (ex.ramp) this.rampNext(ex, reps, w, events);
    else if (ex.scheme) this.schemeNext(ex, reps, w, events);
    else if (ex.type === "load") {
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
      this.plan.forEach((e, i) => { if (i !== this.idx && e.status === "todo" && !e.scheme && e.sets > 1 && e.done.length < e.sets - 1) { e.sets--; cut++; } });
      if (cut) events.push(this.push({ kind: "warn", mood: "alert", title: "J'allège la fin", text: `Fatigue élevée (${Math.round(this.fatigue)} %). Je retire une série sur ${cut} exercice(s) restant(s).`,
        say: "Fatigue élevée. J'allège la fin de séance pour protéger ta récupération." }));
    }
    if (this.fatigue >= 90 && !this.flags.stop) {
      this.flags.stop = true;
      events.push(this.push({ kind: "down", mood: "alert", title: "Fin conseillée", text: "Réservoir vide. Termine cet exercice et on s'arrête là : tu reviendras plus fort.",
        say: "Le réservoir est vide. Termine cet exercice et on s'arrête là." }));
    }

    rest = clamp(rest, 20, 300);
    if (ex.done.length >= ex.sets) ex.status = "done";
    // Superset / circuit : on enchaîne avec l'exercice suivant du groupe, repos à la fin du tour.
    if (ex.ss && !this.flags.stop) {
      const mates = this.plan.map((e, i) => [e, i]).filter(([e]) => e.ss === ex.ss && e.status === "todo");
      if (mates.length) {
        const after = mates.find(([, i]) => i > this.idx) || mates[0];
        const endOfRound = after[1] <= this.idx;
        this.idx = after[1];
        const n = this.current;
        if (!endOfRound) {
          events.push(this.push({ kind: "info", title: "Enchaîne !", text: `Superset : ${n.name} tout de suite · ${fmtTarget(n)}`, say: `Enchaîne : ${n.name}.` }));
          return { events, rest: 0 };
        }
        events.push(this.push({ kind: "info", title: "Fin du tour", text: `Récupère, puis on repart sur ${n.name}.`, say: "Fin du tour. Récupère." }));
        return { events, rest: Math.max(rest, ex.rest) };
      }
    }
    if (ex.status === "done") {
      this.advance(events);
      rest = Math.max(rest, Math.min(90, ex.rest));
    }
    return { events, rest };
  }

  // Programme célèbre : la série suivante est celle du programme ; la série au maximum est commentée
  schemeNext(ex, reps, w, events) {
    const k = ex.done.length, cur = ex.scheme[k - 1], nx = schemeAt(ex, k);
    if (cur?.amrap) {
      const u = ex.type === "time" ? " s" : " reps";
      if (reps < cur.reps) events.push(this.push({ kind: "down", title: "Moins que prévu", text: `${reps}${u} sur la série au maximum (${cur.reps} visées). Le programme en tiendra compte : pas de panique, ça arrive.`, say: "Moins que prévu. Le programme va s'adapter." }));
      else events.push(this.push({ kind: "up", mood: "party", title: reps >= cur.reps + 3 ? "Énorme !" : "Série au max réussie", text: `${reps}${u}${w ? ` à ${String(w).replace(".", ",")} kg` : ""} : ${reps >= cur.reps + 3 ? "de la marge, ça va monter." : "objectif atteint."}`, say: reps >= cur.reps + 3 ? `Énorme, ${reps} répétitions !` : "Série au max réussie." }));
    }
    if (!nx) return;
    ex.weight = nx.weight; ex.goal = nx.reps; ex.amrap = nx.amrap;
    const what = ex.type === "load" ? `${String(nx.weight).replace(".", ",")} kg × ${nx.reps}${nx.amrap ? "+" : ""}` : `${nx.reps}${nx.amrap ? "+" : ""}${ex.type === "time" ? " s" : " reps"}`;
    if (nx.amrap) events.push(this.push({ kind: "info", title: "Série au maximum", text: `${what} : le plus de reps possible, propres, en gardant 1 rep en réserve. C'est elle qui fait avancer le programme.`,
      say: `Série au maximum. ${ex.type === "load" ? `${nx.weight} kilos` : ""}. Le plus de répétitions possible, propres.` }));
    else if (!cur?.amrap) events.push(this.push({ kind: "info", title: "Série suivante", text: `${what}.`, say: `Série suivante : ${what.replace(" kg × ", " kilos, ").replace("+", "")}.` }));
  }

  // Test final : montée en charge fixée d'avance, puis la tentative ; le 2e essai monte si elle est réussie, redescend sinon
  rampNext(ex, reps, w, events) {
    const k = ex.done.length, nx = ex.ramp[k], prev = ex.ramp[k - 1];
    if (!nx) return;
    const ok = reps >= (prev?.reps || 1), load = ex.type === "load";
    if (load) ex.weight = nx.retry ? round(ok ? w + ex.step : w - 2 * ex.step, ex.step) : nx.weight;
    ex.goal = nx.retry && !load ? Math.max(nx.reps, reps + 1) : nx.reps;
    const what = load ? `${String(ex.weight).replace(".", ",")} kg × ${ex.goal}` : `${ex.goal}${ex.type === "time" ? " s" : " reps"}`;
    const title = nx.retry ? (ok ? "Réussi ! Un essai plus lourd ?" : "Deuxième essai") : nx.attempt ? "La tentative" : "Montée en charge";
    events.push(this.push({ kind: nx.attempt ? "up" : "info", mood: nx.retry && ok ? "party" : undefined, title,
      text: `${what}${nx.attempt ? " : récupère 3 à 5 minutes, concentre-toi, et donne tout." : "."}`,
      say: nx.attempt ? `${title}. ${load ? `${ex.weight} kilos` : `${ex.goal} ${ex.type === "time" ? "secondes" : "répétitions"}`}. Prends ton temps.` : `Série suivante : ${what.replace(" kg × ", " kilos, ")}.` }));
  }

  advance(events) {
    if (this.flags.stop) this.plan.forEach(e => { if (e.status === "todo") e.status = "skipped"; });
    const next = this.plan.findIndex((e, i) => i > this.idx && e.status === "todo");
    const any = next >= 0 ? next : this.plan.findIndex(e => e.status === "todo");
    if (any >= 0) {
      this.idx = any;
      const n = this.current;
      events.push(this.push({ kind: "info", title: "Exercice suivant", text: `${n.name} · ${n.sets} série${n.sets > 1 ? "s" : ""} · ${fmtTarget(n)}`, say: `Ensuite : ${n.name}.` }));
    } else if (this.program.free) {
      this.idx = this.plan.length;
      events.push(this.push({ kind: "info", title: "Et maintenant ?", text: "Ajoute un exercice, ou termine ta séance libre.", say: "Ajoute un exercice ou termine la séance." }));
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

  // Séance libre (ou ajout en cours de séance) : nouvel exercice à la fin.
  addExercise(item) {
    this.plan.push(makeItem(item, { factor: 1, setDelta: 0 }, this.plan.length < 2, this.recovery));
    this.idx = this.plan.length - 1;
  }

  // Sauvegarde / reprise (si l'app est fermée en pleine séance).
  toJSON() {
    const { program, readiness, verdict, startedAt, fatigue, flags, prs, log, plan, idx } = this;
    return { program, readiness, verdict, startedAt, fatigue, flags, prs, log: log.slice(0, 8), plan, idx, savedAt: Date.now() };
  }
  static restore(data) {
    const s = Object.create(Session.prototype);
    Object.assign(s, data, { history: [] });
    // le temps passé fermé ne compte pas
    if (data.savedAt) s.startedAt += Math.max(0, Date.now() - data.savedAt - 60000);
    return s;
  }

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
    const fresh = makeItem(item, { factor: 1, setDelta: 0 }, true, this.recovery);
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
    this.plan.splice(pos, 0, makeItem(item, { factor: 1, setDelta: 0 }, true, this.recovery));
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
