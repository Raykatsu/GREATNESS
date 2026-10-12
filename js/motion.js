// Types de mouvement : pour animer chaque exercice et compter les répétitions à la caméra.
// Les poses sont vues de profil, dans un carré 100 × 100 (sol à y = 92).
// Points : h tête, n cou, s épaule, e coude, w main, p hanche, k genou, f pied, k2/f2 2e jambe.
import { EXERCISES } from "./data.js";

const STAND = { h: [50, 13], n: [50, 21], s: [50, 24], e: [50, 39], w: [50, 54], p: [50, 52], k: [50, 72], f: [50, 92] };
const P = (base, over) => ({ ...base, ...over });

// joint : articulation suivie par la caméra · low/high : angles (degrés) des deux positions
export const PATTERNS = {
  squat:   { name: "Squat", joint: "knee", low: 110, high: 155,
    a: P(STAND, { e: [42, 30], w: [52, 25] }),
    b: { h: [60, 38], n: [57, 45], s: [55, 48], e: [47, 55], w: [57, 50], p: [37, 67], k: [60, 72], f: [50, 92] } },
  lunge:   { name: "Fente", joint: "knee", low: 110, high: 155,
    a: P(STAND, { k: [55, 72], f: [57, 92], k2: [45, 72], f2: [42, 92] }),
    b: P(STAND, { h: [50, 28], n: [50, 36], s: [50, 39], e: [50, 53], w: [50, 66], p: [48, 66], k: [64, 68], f: [64, 92], k2: [40, 84], f2: [28, 92] }) },
  legext:  { name: "Extension de jambe", joint: "knee", low: 110, high: 155,
    a: { h: [40, 30], n: [40, 38], s: [40, 41], e: [44, 54], w: [50, 62], p: [42, 64], k: [62, 64], f: [64, 88] },
    b: { h: [40, 30], n: [40, 38], s: [40, 41], e: [44, 54], w: [50, 62], p: [42, 64], k: [62, 64], f: [84, 62] } },
  legcurl: { name: "Flexion de jambe", joint: "knee", low: 100, high: 150,
    a: { h: [16, 60], n: [22, 62], s: [26, 63], e: [22, 74], w: [16, 76], p: [52, 66], k: [72, 67], f: [90, 68] },
    b: { h: [16, 60], n: [22, 62], s: [26, 63], e: [22, 74], w: [16, 76], p: [52, 66], k: [72, 67], f: [70, 46] } },
  hinge:   { name: "Charnière de hanche", joint: "hip", low: 120, high: 160,
    a: STAND,
    b: { h: [73, 40], n: [67, 42], s: [64, 44], e: [62, 58], w: [60, 70], p: [42, 52], k: [47, 72], f: [50, 92] } },
  bridge:  { name: "Extension de hanche", joint: "hip", low: 130, high: 160,
    a: { h: [16, 56], n: [22, 58], s: [26, 59], e: [36, 68], w: [46, 72], p: [48, 78], k: [66, 64], f: [70, 92] },
    b: { h: [16, 56], n: [22, 58], s: [26, 59], e: [36, 62], w: [46, 60], p: [48, 59], k: [66, 58], f: [70, 92] }, bench: [[14, 62], [32, 62]] },
  press_h: { name: "Développé couché", joint: "elbow", low: 100, high: 150,
    a: { h: [20, 57], n: [26, 59], s: [30, 60], e: [30, 46], w: [30, 31], p: [60, 61], k: [74, 66], f: [80, 92] },
    b: { h: [20, 57], n: [26, 59], s: [30, 60], e: [41, 64], w: [32, 50], p: [60, 61], k: [74, 66], f: [80, 92] }, bench: [[16, 65], [70, 65]] },
  pushup:  { name: "Pompe", joint: "elbow", low: 100, high: 150,
    a: { h: [21, 52], n: [26, 55], s: [30, 57], e: [30, 69], w: [30, 81], p: [60, 65], k: [74, 72], f: [88, 81] },
    b: { h: [23, 70], n: [28, 71], s: [32, 72], e: [42, 72], w: [30, 81], p: [60, 75], k: [74, 78], f: [88, 81] } },
  dips:    { name: "Dips", joint: "elbow", low: 100, high: 150,
    a: P(STAND, { e: [50, 38], w: [50, 50], p: [52, 52], k: [57, 68], f: [52, 82] }),
    b: { h: [52, 28], n: [51, 36], s: [50, 39], e: [40, 41], w: [50, 50], p: [52, 66], k: [57, 82], f: [52, 94] }, bars: [[40, 50], [60, 50]] },
  press_v: { name: "Développé vertical", joint: "elbow", low: 95, high: 150,
    a: P(STAND, { e: [42, 33], w: [49, 23] }),
    b: P(STAND, { e: [50, 12], w: [50, 1] }) },
  raise:   { name: "Élévation", joint: "shoulder", low: 30, high: 75,
    a: STAND, b: P(STAND, { e: [64, 25], w: [78, 26] }) },
  fly:     { name: "Écarté", joint: null,
    a: { h: [20, 57], n: [26, 59], s: [30, 60], e: [30, 46], w: [30, 32], p: [60, 61], k: [74, 66], f: [80, 92] },
    b: { h: [20, 57], n: [26, 59], s: [30, 60], e: [22, 52], w: [14, 60], p: [60, 61], k: [74, 66], f: [80, 92] }, bench: [[16, 65], [70, 65]] },
  pull_v:  { name: "Tirage vertical", joint: "elbow", low: 90, high: 150,
    a: { h: [50, 18], n: [50, 25], s: [50, 28], e: [50, 16], w: [50, 4], p: [50, 54], k: [52, 72], f: [50, 88] },
    b: { h: [50, 4], n: [50, 10], s: [50, 13], e: [41, 15], w: [50, 4], p: [50, 40], k: [52, 58], f: [50, 74] }, bars: [[30, 4], [70, 4]] },
  row:     { name: "Rowing", joint: "elbow", low: 100, high: 150,
    a: { h: [71, 36], n: [66, 38], s: [62, 40], e: [62, 56], w: [62, 71], p: [40, 50], k: [46, 70], f: [46, 92] },
    b: { h: [71, 36], n: [66, 38], s: [62, 40], e: [50, 45], w: [58, 56], p: [40, 50], k: [46, 70], f: [46, 92] } },
  curl:    { name: "Curl", joint: "elbow", low: 70, high: 140,
    a: P(STAND, { e: [50, 39], w: [52, 56] }), b: P(STAND, { e: [50, 39], w: [57, 26] }) },
  tri_ext: { name: "Extension triceps", joint: "elbow", low: 90, high: 150,
    a: P(STAND, { e: [52, 39], w: [61, 33] }), b: P(STAND, { e: [52, 39], w: [54, 56] }) },
  shrug:   { name: "Haussement", joint: null, a: STAND, b: P(STAND, { s: [50, 20], e: [50, 35], w: [50, 50] }) },
  calf:    { name: "Mollets", joint: null, a: STAND,
    b: { h: [50, 8], n: [50, 16], s: [50, 19], e: [50, 34], w: [50, 49], p: [50, 47], k: [50, 67], f: [50, 89] } },
  crunch:  { name: "Abdos", joint: "hip", low: 120, high: 150,
    a: { h: [18, 80], n: [24, 80], s: [28, 80], e: [22, 74], w: [16, 74], p: [56, 82], k: [68, 66], f: [80, 86] },
    b: { h: [32, 64], n: [35, 69], s: [38, 72], e: [34, 64], w: [28, 62], p: [56, 82], k: [68, 66], f: [80, 86] } },
  plank:   { name: "Gainage", joint: null,
    a: { h: [21, 60], n: [26, 63], s: [30, 65], e: [30, 81], w: [40, 81], p: [60, 69], k: [74, 75], f: [88, 81] },
    b: { h: [21, 59], n: [26, 62], s: [30, 64], e: [30, 81], w: [40, 81], p: [60, 67], k: [74, 74], f: [88, 81] } },
  cardio:  { name: "Cardio", joint: "shoulder", low: 40, high: 120,
    a: P(STAND, { k2: [50, 72], f2: [50, 92] }),
    b: P(STAND, { h: [50, 10], n: [50, 18], s: [50, 21], e: [62, 10], w: [66, 0], p: [50, 49], k: [58, 69], f: [64, 88], k2: [42, 69], f2: [36, 88] }) },
  stretch: { name: "Étirement", joint: null, a: P(STAND, { k: [55, 72], f: [57, 92], k2: [45, 72], f2: [42, 92] }),
    b: { h: [58, 40], n: [55, 46], s: [53, 48], e: [60, 60], w: [64, 72], p: [44, 66], k: [62, 70], f: [64, 92], k2: [34, 86], f2: [24, 92] } },
};

const BY_ID = {
  squat: "deep_squat squat front_squat smith_squat hack_squat leg_press goblet kb_goblet air_squat jump_squat wall_sit box_jump",
  lunge: "lunge db_lunge walking_lunge bulgarian step_up",
  legext: "leg_ext adductor tke", legcurl: "leg_curl seated_leg_curl nordic",
  hinge: "inchworm down_dog seated_fold deadlift rdl db_rdl good_morning sumo_deadlift kb_swing back_ext superman",
  bridge: "pelvic_tilt clamshell hip_thrust glute_machine glute_bridge cable_kickback abductor band_walk",
  press_h: "bench incline decline db_bench incline_db chest_press incline_machine smith_bench smith_incline close_grip band_press",
  pushup: "pushup incline_pushup decline_pushup diamond pike",
  dips: "dips bench_dips dip_machine",
  press_v: "ohp db_press arnold shoulder_machine smith_ohp kb_press",
  raise: "arm_circles wall_slide band_ext_rot lateral cable_lateral lateral_machine front_raise upright_row",
  fly: "pec_deck fly low_fly db_fly reverse_pec_deck rear_delt band_pull_apart face_pull pullover",
  pull_v: "pullup chinup assisted_pullup lat_pull close_pulldown straight_pulldown",
  row: "row tbar_row cable_row machine_row db_row chest_row inverted_row band_row",
  curl: "curl barbell_curl ez_curl hammer incline_curl concentration spider_curl preacher cable_curl band_curl wrist_curl",
  tri_ext: "pushdown rope_pushdown cable_overhead overhead_ext skull kickback",
  shrug: "shrug bar_shrug farmer", calf: "calf seated_calf press_calf calf_bw",
  crunch: "crunch bicycle cable_crunch leg_raise hanging_raise ab_wheel russian_twist dead_bug",
  plank: "bird_dog plank side_plank hollow pallof",
  cardio: "burpee jumping_jack high_knees mountain jump_rope battle_rope treadmill bike rower elliptical stairs",
  stretch: "cat_cow worlds_greatest hip_flexor pigeon hamstring thoracic child_pose dislocates foam_roll",
};
const ID_MAP = Object.fromEntries(Object.entries(BY_ID).flatMap(([pat, ids]) => ids.split(" ").map(id => [id, pat])));
const BY_MUSCLE = { Pectoraux: "press_h", Dos: "row", "Épaules": "press_v", "Trapèzes": "shrug", Biceps: "curl", Triceps: "tri_ext", "Avant-bras": "curl",
  Quadriceps: "squat", Ischios: "hinge", Fessiers: "bridge", Mollets: "calf", Abdos: "crunch", Lombaires: "hinge", "Chaîne post.": "hinge", Cardio: "cardio", "Mobilité": "stretch" };

export function patternOf(id) {
  return ID_MAP[id] || BY_MUSCLE[EXERCISES[id]?.muscle] || "stretch";
}

/* ---------- Comptage par angles ---------- */
export function angle(a, b, c) {
  const ab = [a.x - b.x, a.y - b.y], cb = [c.x - b.x, c.y - b.y];
  const cos = (ab[0] * cb[0] + ab[1] * cb[1]) / (Math.hypot(...ab) * Math.hypot(...cb) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// Points MediaPipe (gauche, droite) de chaque angle suivi : [extrémité, sommet, extrémité]
export const JOINTS = {
  knee: [[23, 25, 27], [24, 26, 28]],
  hip: [[11, 23, 25], [12, 24, 26]],
  elbow: [[11, 13, 15], [12, 14, 16]],
  shoulder: [[23, 11, 13], [24, 12, 14]],
};

// Machine à états : une répétition = aller d'une position à l'autre puis revenir.
export class RepCounter {
  constructor({ low, high }) {
    Object.assign(this, { low, high, count: 0, start: null, phase: null, extreme: null, smooth: null, partials: 0 });
  }
  // renvoie "rep", "partial" ou null
  update(raw) {
    this.smooth = this.smooth == null ? raw : this.smooth * 0.55 + raw * 0.45;
    const a = this.smooth, mid = (this.low + this.high) / 2;
    const side = a >= this.high ? "high" : a <= this.low ? "low" : null;
    if (!this.start) { if (side) { this.start = side; this.phase = side; } return null; }
    const far = this.start === "high" ? "low" : "high";
    if (this.phase === this.start) {
      if (side === far) { this.phase = far; this.extreme = a; }
      else if ((this.start === "high" && a < mid) || (this.start === "low" && a > mid)) {
        // on est parti mais sans atteindre l'autre position
        this.extreme = this.extreme == null ? a : this.start === "high" ? Math.min(this.extreme, a) : Math.max(this.extreme, a);
      } else if (this.extreme != null && side === this.start) {
        this.extreme = null; this.partials++;
        return "partial";
      }
      return null;
    }
    if (side === this.start) { this.phase = this.start; this.extreme = null; this.count++; return "rep"; }
    return null;
  }
}
