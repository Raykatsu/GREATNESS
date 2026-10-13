// Correction de posture à la caméra : à partir des points du corps détectés par MediaPipe, repère les
// défauts courants de chaque mouvement (dos rond, buste trop penché, bassin qui s'affaisse, coudes qui
// bougent, élan, cambrure, amplitude, vitesse) et dit quoi corriger. Pur (sans affichage) : testé dans Node.
import { EXERCISES } from "./data.js";
import { patternOf } from "./motion.js";

// Points MediaPipe : [côté gauche, côté droit]
const IDX = { ear: [7, 8], sh: [11, 12], el: [13, 14], wr: [15, 16], hip: [23, 24], knee: [25, 26], ank: [27, 28] };
const CHAIN = ["ear", "sh", "el", "wr", "hip", "knee", "ank"];
const DEG = 180 / Math.PI;

export const ISSUES = {
  back:    { label: "Dos rond", msg: "Dos rond : sors la poitrine et garde le dos plat.", say: "Dos plat !" },
  sag:     { label: "Bassin affaissé", msg: "Le bassin s'affaisse : serre les abdos et les fessiers.", say: "Gaine-toi !" },
  pike:    { label: "Fesses trop hautes", msg: "Fesses trop hautes : aligne épaules, bassin et chevilles.", say: "Baisse les fesses." },
  lean:    { label: "Buste trop penché", msg: "Buste trop penché : garde la poitrine haute.", say: "Poitrine haute !" },
  arch:    { label: "Dos cambré", msg: "Tu te cambres : serre les fessiers et les abdos.", say: "Ne te cambre pas !" },
  knees:   { label: "Genoux trop pliés", msg: "Genoux trop pliés : jambes presque tendues, c'est la hanche qui recule.", say: "Jambes plus tendues." },
  high:    { label: "Pas assez bas", msg: "Descends : cuisses parallèles au sol.", say: "Plus bas !" },
  elbows:  { label: "Coudes qui bougent", msg: "Les coudes bougent : garde-les fixes, près du corps.", say: "Coudes fixes !" },
  swing:   { label: "Élan du buste", msg: "Tu prends de l'élan avec le buste : reste immobile, allège si besoin.", say: "Sans élan !" },
  partial: { label: "Amplitude incomplète", msg: "Amplitude incomplète : va au bout du mouvement.", say: "Plus d'amplitude !" },
  fast:    { label: "Trop rapide", msg: "Trop rapide : contrôle la descente, environ 2 secondes.", say: "Plus lentement." },
};
// Conseil d'amplitude propre à chaque mouvement
const PARTIAL = {
  squat: "Descends au moins jusqu'aux cuisses parallèles, puis remonte jambes tendues.",
  lunge: "Descends le genou arrière près du sol.",
  legext: "Tends complètement les jambes en haut.",
  legcurl: "Ramène les talons vers les fessiers.",
  hinge: "Va au bout : hanches bien tendues en haut, étirement des ischios en bas.",
  bridge: "Monte jusqu'à aligner épaules, hanches et genoux.",
  press_h: "Descends jusqu'à la poitrine et tends les bras en haut.",
  pushup: "Descends la poitrine près du sol, puis tends les bras.",
  dips: "Descends jusqu'à ce que les bras fassent un angle droit.",
  press_v: "Tends les bras en haut, redescends au niveau du menton.",
  raise: "Monte les bras jusqu'à l'horizontale.",
  pull_v: "Tire jusqu'au menton, redescends bras tendus.",
  row: "Tire jusqu'au ventre, tends les bras en bas.",
  curl: "Bras tendus en bas, serrés en haut.",
  tri_ext: "Tends complètement les bras.",
  crunch: "Enroule davantage le buste.",
};
const PRIORITY = ["back", "sag", "pike", "lean", "arch", "knees", "high", "elbows", "swing"];

/* ---------- Règles par exercice (degrés ; sag/pike en part de la longueur épaules-chevilles) ---------- */
const BODY_LINE = { sag: 0.065, pike: 0.13 };
const BY_ID = {
  squat: { lean: 55, back: 40 }, deep_squat: { lean: 55, back: 40 }, air_squat: { lean: 50, back: 40 },
  front_squat: { lean: 40, back: 40 }, goblet: { lean: 45, back: 40 }, kb_goblet: { lean: 45, back: 40 },
  jump_squat: { fast: 0 }, box_jump: { fast: 0 },
  wall_sit: { hold: true, high: 115, lean: 25 },
  lunge: { lean: 35 }, db_lunge: { lean: 35 }, walking_lunge: { lean: 35 }, bulgarian: { lean: 45 }, step_up: { lean: 45 },
  deadlift: { back: 35 }, sumo_deadlift: { back: 35 },
  rdl: { back: 35, knees: 125 }, db_rdl: { back: 35, knees: 125 }, good_morning: { back: 35, knees: 125 },
  kb_swing: { back: 35, fast: 0 },
  pushup: BODY_LINE, incline_pushup: BODY_LINE, decline_pushup: BODY_LINE, diamond: BODY_LINE,
  inverted_row: { sag: 0.07 },
  ohp: { arch: 18 }, db_press: { arch: 18 }, arnold: { arch: 18 }, smith_ohp: { arch: 18 }, kb_press: { arch: 18 },
  curl: { elbows: 32, swing: 12 }, barbell_curl: { elbows: 32, swing: 12 }, ez_curl: { elbows: 32, swing: 12 },
  hammer: { elbows: 32, swing: 12 }, cable_curl: { elbows: 32, swing: 12 }, band_curl: { elbows: 32, swing: 12 },
  pushdown: { elbows: 35 }, rope_pushdown: { elbows: 35 },
  row: { back: 35, swing: 18 }, tbar_row: { back: 35, swing: 18 }, db_row: { swing: 18 }, cable_row: { swing: 25 },
  lateral: { swing: 12 }, cable_lateral: { swing: 12 }, front_raise: { swing: 12 }, upright_row: { swing: 12 },
  pullup: { swing: 20 }, chinup: { swing: 20 }, assisted_pullup: { swing: 20 }, lat_pull: { swing: 20 }, close_pulldown: { swing: 20 },
  plank: { hold: true, ...BODY_LINE }, side_plank: { hold: true, sag: 0.07, view: "face" },
};
const NO_TEMPO = new Set(["cardio"]);

export function formConfig(id) {
  const pat = patternOf(id), ex = EXERCISES[id] || {};
  const own = BY_ID[id] || {};
  const fast = NO_TEMPO.has(pat) || own.hold ? 0 : ex.type === "load" ? 1100 : 800;
  return { pat, fast, ...own };
}
// Exercices tenus (gainage, chaise) que la caméra chronomètre en surveillant la position
export const formHold = id => !!BY_ID[id]?.hold;

/* ---------- Géométrie (points en pixels : x multiplié par largeur / hauteur de l'image) ---------- */
const vis = p => p && p.v >= 0.5;
const pt = (lm, i, ar) => ({ x: lm[i].x * ar, y: lm[i].y, v: lm[i].visibility ?? 1 });
const angleAt = (a, b, c) => {
  const ab = [a.x - b.x, a.y - b.y], cb = [c.x - b.x, c.y - b.y];
  const cos = (ab[0] * cb[0] + ab[1] * cb[1]) / (Math.hypot(...ab) * Math.hypot(...cb) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
};
// inclinaison du segment a → b par rapport à la verticale (0 = vertical, 90 = horizontal)
const incline = (a, b) => Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * DEG;
// angle signé de u vers v (sens horaire à l'écran = positif)
const turn = (u, v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * DEG;
// écart du bassin à la ligne épaules → chevilles, en part de sa longueur (positif = bassin plus bas que la ligne)
export function hipOffset(sh, hip, ank) {
  const dx = ank.x - sh.x, dy = ank.y - sh.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; } // normale tournée vers le sol
  const u = ((hip.x - sh.x) * dx + (hip.y - sh.y) * dy) / (len * len);
  return ((hip.x - (sh.x + u * dx)) * nx + (hip.y - (sh.y + u * dy)) * ny) / len;
}

export class FormCoach {
  constructor(exId) {
    this.id = exId; this.cfg = formConfig(exId);
    this.side = null; this.face = 1;
    this.since = {}; this.okSince = {}; this.on = new Set();
    this.cur = new Set(); this.range = null; this.flash = null;
    this.reps = []; this.partials = 0; this.last = null;
    this.hold = { t: null, good: 0, total: 0, bad: {} };
    this.m = {};
  }

  // Le côté tourné vers la caméra (le plus visible), avec un peu d'inertie
  pickSide(lm) {
    const s = k => CHAIN.reduce((t, n) => t + (lm[IDX[n][k]].visibility ?? 1), 0);
    const best = s(0) >= s(1) ? 0 : 1;
    if (this.side == null || s(best) - s(this.side) > 0.8) this.side = best;
  }

  // Une image : points normalisés, temps (ms), rapport largeur / hauteur de l'image, mouvement commencé ?
  // Renvoie le défaut à montrer (ou null), les segments à colorer et une ligne guide.
  frame(lm, t, ar = 1, active = true) {
    if (!lm) return null;
    this.pickSide(lm);
    const P = n => pt(lm, IDX[n][this.side], ar), c = this.cfg;
    const ear = P("ear"), sh = P("sh"), el = P("el"), hip = P("hip"), knee = P("knee"), ank = P("ank"), nose = pt(lm, 0, ar);
    if (vis(nose) && vis(ear) && Math.abs(nose.x - ear.x) > 0.008) this.face = nose.x > ear.x ? 1 : -1;
    const f = this.face, bad = {}, m = (this.m = {});
    const torso = vis(sh) && vis(hip), legs = vis(hip) && vis(knee) && vis(ank), line = vis(sh) && vis(hip) && vis(ank);
    if (torso) {
      m.incline = incline(hip, sh);
      m.lean = Math.atan2(f * (sh.x - hip.x), hip.y - sh.y) * DEG; // + vers l'avant, − vers l'arrière
    }
    if (legs) m.knee = angleAt(hip, knee, ank);
    if (line) { m.lineIncline = incline(sh, ank); m.hip = hipOffset(sh, hip, ank); }
    if (torso && vis(ear)) m.back = f * turn([sh.x - hip.x, sh.y - hip.y], [ear.x - sh.x, ear.y - sh.y]); // + = tête et épaules qui s'enroulent
    if (torso && vis(el)) m.elbow = -f * turn([hip.x - sh.x, hip.y - sh.y], [el.x - sh.x, el.y - sh.y]); // + = coude vers l'avant

    // position de travail (pour les exercices tenus)
    const inPos = !c.hold ? true
      : this.id === "wall_sit" ? m.knee != null && m.knee < 140
      : m.lineIncline != null && m.lineIncline > (this.id === "side_plank" ? 35 : 50);
    const on = c.hold ? inPos : active;

    if (on) {
      if (c.back && m.back != null && m.incline > 25) bad.back = m.back > c.back;
      if (c.lean && m.incline != null && (c.hold || (m.knee != null && m.knee < 140))) bad.lean = m.incline > c.lean;
      if ((c.sag || c.pike) && m.hip != null && m.lineIncline > 35) {
        if (c.sag) bad.sag = m.hip > c.sag;
        if (c.pike) bad.pike = m.hip < -c.pike;
      }
      if (c.arch && m.lean != null) bad.arch = m.lean < -c.arch;
      if (c.knees && m.knee != null && m.incline > 35) bad.knees = m.knee < c.knees;
      if (c.high && m.knee != null) bad.high = m.knee > c.high;
      if (c.elbows && m.elbow != null && m.incline < 30) bad.elbows = m.elbow > c.elbows;
      // élan : amplitude du buste pendant la rep
      if (c.swing && m.lean != null) {
        const r = (this.range ||= { min: m.lean, max: m.lean });
        r.min = Math.min(r.min, m.lean); r.max = Math.max(r.max, m.lean);
        if (r.max - r.min > c.swing && !this.cur.has("swing")) { this.cur.add("swing"); this.flash = { id: "swing", until: t + 1500 }; }
      }
    }
    // un défaut s'allume après 250 ms et s'éteint après 400 ms de bonne position
    for (const id of PRIORITY) {
      if (!(id in c) || id === "swing") continue;
      if (bad[id]) {
        this.since[id] ??= t; delete this.okSince[id];
        if (t - this.since[id] >= 250) this.on.add(id);
      } else {
        delete this.since[id];
        if (this.on.has(id)) {
          this.okSince[id] ??= t;
          if (t - this.okSince[id] >= 400 || !on) { this.on.delete(id); delete this.okSince[id]; }
        }
      }
    }
    if (on) for (const id of this.on) this.cur.add(id);
    if (this.flash && t > this.flash.until) this.flash = null;
    const issue = PRIORITY.find(id => this.on.has(id)) || this.flash?.id || null;

    if (c.hold && this.hold.t != null && inPos) {
      const dt = Math.min(t - this.hold.t, 250);
      this.hold.total += dt;
      if (issue) this.hold.bad[issue] = (this.hold.bad[issue] || 0) + dt;
      else this.hold.good += dt;
    }
    if (c.hold) this.hold.t = t;
    return { issue, inPos, bones: issue ? this.bones(issue) : [], guide: issue ? this.guide(issue, { ear, sh, hip, ank }, ar) : null };
  }

  // Segments à colorer (indices MediaPipe)
  bones(id) {
    const k = this.side, i = n => IDX[n][k];
    const B = {
      back: [["ear", "sh"], ["sh", "hip"]], lean: [["sh", "hip"]], arch: [["sh", "hip"]], swing: [["sh", "hip"]],
      sag: [["sh", "hip"], ["hip", "knee"], ["knee", "ank"]], pike: [["sh", "hip"], ["hip", "knee"], ["knee", "ank"]],
      knees: [["hip", "knee"], ["knee", "ank"]], high: [["hip", "knee"], ["knee", "ank"]], elbows: [["sh", "el"]],
    }[id] || [];
    return B.map(([a, b]) => [i(a), i(b)]);
  }

  // Ligne guide (coordonnées normalisées) : l'alignement à retrouver
  guide(id, { sh, hip, ank }, ar) {
    const n = p => [p.x / ar, p.y];
    if ((id === "sag" || id === "pike") && vis(ank)) return [n(sh), n(ank)];
    if (id === "back") return [n(hip), n({ x: hip.x + (sh.x - hip.x) * 1.3, y: hip.y + (sh.y - hip.y) * 1.3 })];
    return null;
  }

  // Événement du compteur : "rep" ou "partial". Renvoie le défaut à signaler tout de suite (ou null).
  event(kind, t) {
    this.range = null;
    if (kind === "partial") { this.partials++; this.cur = new Set(this.on); return "partial"; }
    if (kind !== "rep") return null;
    const dt = this.last != null ? t - this.last : null;
    this.last = t;
    if (this.cfg.fast && dt != null && dt < this.cfg.fast) this.cur.add("fast");
    const issues = [...this.cur];
    this.reps.push({ issues, dt });
    this.cur = new Set(this.on);
    return issues.includes("fast") ? "fast" : null;
  }

  msg(id) { return id === "partial" ? `Amplitude incomplète : ${(PARTIAL[this.cfg.pat] || "va au bout du mouvement.").replace(/^./, s => s.toLowerCase())}` : ISSUES[id]?.msg || ""; }

  // Bilan : reps propres (ou secondes tenues), défauts les plus fréquents, conseil principal
  summary() {
    const label = ([id, n]) => ({ id, n, label: ISSUES[id].label });
    if (this.cfg.hold) {
      const total = Math.round(this.hold.total / 1000), good = Math.round(this.hold.good / 1000);
      const issues = Object.entries(this.hold.bad).map(([id, ms]) => [id, Math.round(ms / 1000)]).filter(x => x[1] >= 1).sort((a, b) => b[1] - a[1]).map(label);
      return { hold: true, seconds: total, good, score: total ? Math.round((good / total) * 100) : null, issues, tip: issues.length ? this.msg(issues[0].id) : null };
    }
    const count = {};
    for (const r of this.reps) for (const i of r.issues) count[i] = (count[i] || 0) + 1;
    if (this.partials) count.partial = this.partials;
    const issues = Object.entries(count).sort((a, b) => b[1] - a[1]).map(label);
    const reps = this.reps.length, clean = this.reps.filter(r => !r.issues.length).length;
    return { reps, clean, score: reps ? Math.round((clean / reps) * 100) : null, issues, tip: issues.length ? this.msg(issues[0].id) : null };
  }
}

// Phrase courte pour le bilan (toast en séance)
export function summaryText(s) {
  if (!s) return "";
  if (s.hold) return s.seconds ? `${s.seconds} s tenues${s.score != null ? ` · ${s.score} % en bonne position` : ""}` : "";
  if (!s.reps) return s.issues.length ? `À corriger : ${s.issues[0].label.toLowerCase()}` : "";
  return `Technique ${s.score} % (${s.clean}/${s.reps} reps propres)${s.issues.length ? ` · à corriger : ${s.issues[0].label.toLowerCase()}` : ""}`;
}
