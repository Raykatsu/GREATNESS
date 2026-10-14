// Vitesse de barre mesurée à la caméra (VBT) : pour chaque rep, la vitesse moyenne de la phase de poussée
// (concentrique), comme les capteurs des salles de force. La perte de vitesse au fil de la série dit à quel
// point elle a été dure : l'app en déduit le ressenti (RPE) et prévient quand il vaut mieux s'arrêter.
// Échelle : la taille de l'athlète et les longueurs de ses segments (bras, cuisse…) vues par la caméra.
// Logique pure, testée (les points arrivent de cam.js, en unités « hauteur de l'image »).

// Sens de la poussée : l'angle suivi s'ouvre (+1, on se relève, on pousse) ou se ferme (−1, on tire, on enroule)
export const CONC = { squat: 1, lunge: 1, legext: 1, hinge: 1, bridge: 1, press_h: 1, pushup: 1, dips: 1, press_v: 1, raise: 1, tri_ext: 1,
  legcurl: -1, pull_v: -1, row: -1, curl: -1, crunch: -1 };
// Vitesse de la dernière rep possible (seuil d'échec, m/s), d'après la littérature VBT ; sans seuil : perte de vitesse seulement
export const MVT = { squat: 0.3, lunge: 0.33, hinge: 0.17, press_h: 0.17, press_v: 0.19, pull_v: 0.23, row: 0.4, dips: 0.22, pushup: 0.25 };
// Segments du corps (points MediaPipe gauche/droite) et leur longueur en fraction de la taille
const SEGS = [["sh", "hip", 0.288], ["sh", "el", 0.186], ["el", "wr", 0.146], ["hip", "kn", 0.245], ["kn", "an", 0.246]];
const TRACK = ["wr", "sh", "hip"]; // ce qui bouge avec la charge : les mains, les épaules ou le bassin
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = v => Math.round(v * 100) / 100;

export class VelocityTracker {
  // pattern : type de mouvement (motion.js) ; height : taille de l'athlète en mètres
  constructor(pattern, { height = 1.75 } = {}) {
    this.dir = CONC[pattern] || 0;
    this.mvt = MVT[pattern] || null;
    this.height = height > 1.2 && height < 2.3 ? height : 1.75;
    this.seg = {};          // longueurs vues de chaque segment (on garde les plus grandes : la perspective ne fait que raccourcir)
    this.buf = [];          // images de la rep en cours : { t, a, y: { wr, sh, hip } }
    this.reps = [];         // { v, peak, disp, dur }
    this.pending = null;    // rep comptée, poussée pas encore finie
    this.smooth = {};
  }
  get ok() { return !!this.dir; }

  // Longueur d'un segment : 90e centile des mesures (robuste à une image où un point saute)
  len(k) {
    const l = this.seg[k];
    if (!l || l.length < 5) return 0;
    const s = [...l].sort((x, y) => x - y);
    return s[Math.floor(s.length * 0.9)];
  }
  // Mètres par unité d'image, d'après les segments bien vus (au moins deux)
  scale() {
    const est = SEGS.map(([a, b, f]) => [this.len(`${a}-${b}`), f]).filter(([l]) => l > 0.02).map(([l, f]) => (f * this.height) / l);
    return est.length >= 2 ? median(est) : null;
  }

  // Une image : t (ms), angle de l'articulation suivie (degrés), points du côté filmé { sh, el, wr, hip, kn, an } (x, y, v)
  frame(t, raw, pts) {
    if (!this.dir || raw == null || !Number.isFinite(raw)) return null;
    const a = (this.ang = this.ang == null ? raw : this.ang * 0.4 + raw * 0.6);
    for (const [p, q] of SEGS) {
      const A = pts[p], B = pts[q];
      if (!A || !B || (A.v ?? 1) < 0.5 || (B.v ?? 1) < 0.5) continue;
      const l = (this.seg[`${p}-${q}`] ||= []);
      l.push(Math.hypot(A.x - B.x, A.y - B.y));
      if (l.length > 240) l.shift();
    }
    const y = {};
    for (const k of TRACK) if (pts[k] && (pts[k].v ?? 1) >= 0.4) y[k] = this.smooth[k] = this.smooth[k] == null ? pts[k].y : this.smooth[k] * 0.5 + pts[k].y * 0.5;
    this.buf.push({ t, a, y });
    if (this.buf.length > 600) this.buf.shift();
    // fin de la poussée : l'angle ne progresse plus d'au moins 1° (ou 700 ms après la rep comptée)
    const p = this.pending;
    if (p) {
      if (this.dir * (a - p.ext) > 1) { p.ext = a; p.extT = t; }
      else if (this.dir * (p.ext - a) > 4 || t - p.extT > 300 || t - p.t > 700) return this.finish();
    }
    return null;
  }

  // Le compteur vient de valider une rep
  rep(t) {
    if (!this.dir) return null;
    const out = this.pending ? this.finish() : null;
    const last = this.buf.at(-1);
    this.pending = { t, ext: last?.a ?? 0, extT: t };
    return out;
  }

  // Calcule la rep en attente. L'angle situe le fond du mouvement ; la poussée se mesure ensuite sur ce qui porte
  // la charge (mains, épaules ou bassin : ce qui a le plus bougé), entre 5 % et 95 % de son trajet, comme un capteur.
  finish() {
    const b = this.buf, p = this.pending;
    this.pending = null;
    if (!p || b.length < 4) { this.buf = b.slice(-1); return null; }
    let end = b.length - 1;
    for (let i = b.length - 1; i >= 0; i--) if (b[i].t <= p.extT) { end = i; break; }
    // fond du mouvement : l'angle le plus « fermé » (poussée qui ouvre) ou le plus « ouvert » (tirage qui ferme)
    let turn = 0;
    for (let i = 0; i <= end; i++) if (this.dir * (b[i].a - b[turn].a) < 0) turn = i;
    const s = this.scale(), last = b.length - 1;
    this.buf = b.slice(end);
    if (!s) return null;
    let best = null;
    for (const k of TRACK) {
      const y0 = b[turn].y[k];
      if (y0 == null) continue;
      let far = y0;
      for (let i = turn; i <= last; i++) if (b[i].y[k] != null && Math.abs(b[i].y[k] - y0) > Math.abs(far - y0)) far = b[i].y[k];
      if (!best || Math.abs(far - y0) > Math.abs(best.D)) best = { k, y0, D: far - y0 };
    }
    if (!best || Math.abs(best.D) * s < 0.05) return null;
    const prog = i => (b[i].y[best.k] == null ? null : (b[i].y[best.k] - best.y0) / best.D);
    let i5 = -1, i95 = -1;
    for (let i = turn; i <= last; i++) {
      const q = prog(i);
      if (q == null) continue;
      if (i5 < 0 && q >= 0.05) i5 = i;
      if (i5 >= 0 && q >= 0.95) { i95 = i; break; }
    }
    if (i5 < 0 || i95 <= i5) return null;
    // instants interpolés où le trajet passe 5 % et 95 %
    const at = (i, q) => { const a = prog(i - 1), c = prog(i); return a == null || c === a ? b[i].t : b[i - 1].t + ((q - a) / (c - a)) * (b[i].t - b[i - 1].t); };
    const dur = (at(i95, 0.95) - at(i5, 0.05)) / 1000;
    if (dur < 0.12 || dur > 6) return null;
    const disp = Math.abs(best.D) * s;
    // pic de vitesse : sur des fenêtres d'environ 100 ms
    let peak = 0;
    for (let i = i5, j = i5; i < i95; i++) {
      while (j < i95 && b[j].t - b[i].t < 100) j++;
      const yi = b[i].y[best.k], yj = b[j].y[best.k];
      if (yi != null && yj != null && b[j].t > b[i].t) peak = Math.max(peak, (Math.abs(yj - yi) * s) / ((b[j].t - b[i].t) / 1000));
    }
    const v = (0.9 * disp) / dur;
    const rep = { v: r2(v), peak: r2(Math.max(peak, v)), disp: r2(disp), dur: r2(dur / 0.9) };
    this.reps.push(rep);
    return rep;
  }

  summary() {
    if (this.pending) this.finish();
    return velocitySummary(this.reps.map(r => r.v), this.mvt);
  }
}

// Perte de vitesse : de la meilleure des deux premières reps à la dernière (en %)
export function velocityLoss(vs) {
  if (vs.length < 2) return 0;
  const best = Math.max(vs[0], vs[1] ?? 0), last = vs.at(-1);
  return best > 0 ? Math.max(0, Math.round(((best - last) / best) * 100)) : 0;
}

// Reps en réserve et RPE estimés : la vitesse baisse à peu près régulièrement jusqu'au seuil d'échec (mvt)
export function estimateRpe(vs, mvt) {
  if (!mvt || vs.length < 3) return null;
  const first = Math.max(vs[0], vs[1]), last = vs.at(-1);
  if (last <= mvt * 1.06) return { rir: 0, rpe: 10 };
  const slope = (first - last) / (vs.length - 1);
  const rir = slope > 0.004 ? Math.min(5, (last - mvt) / slope) : 5;
  const rpe = Math.max(5, Math.min(10, Math.round((10 - rir) * 2) / 2));
  return { rir: Math.round(rir), rpe };
}

export function velocitySummary(vs = [], mvt = null) {
  if (!vs.length) return null;
  const loss = velocityLoss(vs), est = estimateRpe(vs, mvt);
  return { reps: vs, first: vs[0], last: vs.at(-1), best: Math.max(...vs), mean: r2(vs.reduce((a, v) => a + v, 0) / vs.length), loss, ...(est || {}) };
}

// Seuil de perte de vitesse conseillé selon l'objectif : force et puissance s'arrêtent tôt, le muscle va plus loin
export const lossLimit = goal => (goal === "force" ? 20 : goal === "muscle" ? 35 : 30);

// « 0,48 m/s »
export const fmtV = v => `${String(r2(v).toFixed(2)).replace(".", ",")} m/s`;
