// Programmes célèbres : 5/3/1 de Wendler, GZCLP, nSuns 5/3/1 et Starting Strength, avec leurs vraies règles de
// progression. Chaque séance prescrit la charge et les reps de chaque série (« 5+ » : le plus de reps possible,
// propres) ; la séance faite fait avancer le programme (max d'entraînement, palier, semaine du cycle).
// Logique pure, testée. État : st.classic = { id, n, tm, w, s, fails, start, log }.
import { EXERCISES } from "./data.js";

export const MAIN = ["squat", "bench", "deadlift", "ohp"];
const UPPER = new Set(["bench", "ohp", "row"]);
const stepOf = id => EXERCISES[id]?.step || 2.5;
export const roundW = (x, id) => { const s = stepOf(id); return Math.max(s, Math.round(x / s) * s); };
const inc = (id, small = 2.5, big = 5) => (UPPER.has(id) ? small : big);
const name = id => EXERCISES[id]?.name || id;
const kg = w => `${String(w).replace(".", ",")} kg`;

// Séries prescrites : [pourcentage, reps, au maximum ?]
const S = (list, base, id) => list.map(([p, reps, amrap]) => ({ weight: roundW(base * p, id), reps, ...(amrap ? { amrap: true } : {}) }));
const acc = (id, sets, lo, hi, w = 0) => ({ id, sets, reps: [lo, hi], weight: w, rest: 90, rpe: 8 });
// Exercice à séries imposées (sets, reps et weight aussi renseignés pour l'aperçu et la durée estimée)
const fixedEx = (id, scheme, rest, note) => { const r = scheme.map(x => x.reps); return { id, scheme, sets: scheme.length, reps: [Math.min(...r), Math.max(...r)], weight: scheme[0].weight, rest, rpe: 8, note }; };

/* ---------- 5/3/1 ---------- */
const W531 = {
  1: { label: "5 reps", sets: [[0.65, 5], [0.75, 5], [0.85, 5, true]] },
  2: { label: "3 reps", sets: [[0.7, 3], [0.8, 3], [0.9, 3, true]] },
  3: { label: "5/3/1", sets: [[0.75, 5], [0.85, 3], [0.95, 1, true]] },
  4: { label: "Semaine allégée", sets: [[0.4, 5], [0.5, 5], [0.6, 5]] },
};
const ASSIST531 = { ohp: ["chinup", 5, 5, 10], deadlift: ["hanging_raise", 3, 10, 15], bench: ["db_row", 5, 10, 12], squat: ["leg_curl", 3, 10, 12] };

/* ---------- GZCLP ---------- */
const GZ_DAYS = [{ t1: "squat", t2: "bench", t3: "lat_pull" }, { t1: "ohp", t2: "deadlift", t3: "db_row" }, { t1: "bench", t2: "squat", t3: "lat_pull" }, { t1: "deadlift", t2: "ohp", t3: "db_row" }];
export const GZ_T1 = [[5, 3], [6, 2], [10, 1]], GZ_T2 = [[3, 10], [3, 8], [3, 6]];

/* ---------- nSuns 5/3/1 (5 jours) ---------- */
const HEAVY = [[0.75, 5], [0.85, 3], [0.95, 1, true], [0.9, 3], [0.85, 3], [0.8, 3], [0.75, 5], [0.7, 5], [0.65, 5, true]];
const T2N = p => [[p, 6], [p + 0.1, 5], [p + 0.2, 3], [p + 0.2, 5], [p + 0.2, 7], [p + 0.2, 4], [p + 0.2, 6], [p + 0.2, 8]];
const NS_DAYS = [
  { t1: "bench", t1s: [[0.65, 8], [0.75, 6], [0.85, 4], [0.85, 4], [0.85, 4], [0.8, 5], [0.75, 6], [0.7, 7], [0.65, 8, true]], t2: "ohp", t2base: "ohp", t2s: T2N(0.5), acc: [["row", 3, 8, 12], ["face_pull", 3, 12, 15]] },
  { t1: "squat", t1s: HEAVY, t2: "sumo_deadlift", t2base: "deadlift", t2s: [[0.5, 5], [0.6, 5], [0.7, 3], [0.7, 5], [0.7, 7], [0.7, 4], [0.7, 6], [0.7, 8]], acc: [["leg_curl", 3, 10, 12], ["hanging_raise", 3, 10, 15]] },
  { t1: "ohp", t1s: HEAVY, t2: "incline", t2base: "bench", t2s: T2N(0.4), acc: [["pullup", 3, 6, 10], ["lateral", 3, 12, 15]] },
  { t1: "deadlift", t1s: [[0.75, 5], [0.85, 3], [0.95, 1, true], [0.9, 3], [0.85, 3], [0.8, 3], [0.75, 3], [0.7, 3], [0.65, 3, true]], t2: "front_squat", t2base: "squat", t2s: T2N(0.35), acc: [["row", 3, 8, 12], ["cable_crunch", 3, 12, 15]] },
  { t1: "bench", t1s: [[0.75, 5], [0.85, 3], [0.95, 1, true], [0.9, 3], [0.85, 5], [0.8, 3], [0.75, 5], [0.7, 3], [0.65, 5, true]], t2: "close_grip", t2base: "bench", t2s: T2N(0.4), acc: [["chinup", 3, 6, 10], ["pushdown", 3, 10, 15]] },
];
// Progression selon la série « 1+ » (95 %) : 0-1 rep → rien ; 2-3 → +2,5 ; 4-5 → +2,5 (haut) / +5 (bas) ; 6+ → +5 / +7,5
export function nsunsInc(lift, reps) {
  if (reps <= 1) return 0;
  if (reps <= 3) return 2.5;
  if (reps <= 5) return inc(lift, 2.5, 5);
  return inc(lift, 5, 7.5);
}

/* ---------- Starting Strength ---------- */
const SS_DAYS = [["squat", "bench", "deadlift"], ["squat", "ohp", "row"]];
const SS_SETS = { deadlift: 1 };

export const CLASSICS = {
  wendler: { name: "5/3/1 de Wendler", short: "5/3/1", days: 4, level: "Intermédiaire", by: "Jim Wendler",
    pitch: "Progresser lentement mais sûrement, pendant des années : 4 grands mouvements, une série au maximum à chaque séance, +2,5 à 5 kg par mois.",
    how: ["Cycles de 4 semaines : semaine à 5 reps, à 3 reps, à 5/3/1, puis semaine allégée.", "Charges calculées sur ton max d'entraînement : 90 % de ton max.",
      "Dernière série « + » : le plus de reps possible, propres. Puis 5 × 10 à 50 % (« Boring But Big ») et un exercice d'appoint.",
      "Nouveau cycle : +2,5 kg au couché et au militaire, +5 kg au squat et au soulevé de terre ; −10 % sur un mouvement raté."] },
  gzclp: { name: "GZCLP", short: "GZCLP", days: 4, level: "Débutant à intermédiaire", by: "Cody Lefever",
    pitch: "La progression linéaire la plus solide : on monte à chaque séance, et quand ça coince, on change de palier au lieu de s'arrêter.",
    how: ["4 séances en rotation : un mouvement lourd (T1), un mouvement de volume (T2), un exercice d'appoint (T3).",
      "T1 : 5 × 3, dernière série au max ; raté → 6 × 2, puis 10 × 1, puis on repart à 85 %.", "T2 : 3 × 10 ; raté → 3 × 8, puis 3 × 6, puis on repart à 85 %.",
      "Réussi : +2,5 kg (haut du corps) ou +5 kg (bas). T3 : 3 × 15, la charge monte quand la dernière série atteint 25 reps."] },
  nsuns: { name: "nSuns 5/3/1", short: "nSuns", days: 5, level: "Intermédiaire avancé", by: "n-Suns",
    pitch: "Beaucoup de volume pour progresser chaque semaine : 9 séries lourdes et 8 séries de volume par séance, 5 jours sur 7.",
    how: ["Chaque jour : un mouvement principal en 9 séries (dont une série « 1+ » à 95 %) et un mouvement secondaire en 8 séries.",
      "La série « 1+ » décide de la suite : 2-3 reps → +2,5 kg ; 4-5 → +2,5 à 5 kg ; 6 et plus → +5 à 7,5 kg ; 0-1 → on garde.",
      "Max d'entraînement : 90 % de ton max. Exigeant : à réserver à qui récupère bien."] },
  ss: { name: "Starting Strength", short: "Starting Strength", days: 3, level: "Débutant", by: "Mark Rippetoe",
    pitch: "Le programme des débutants : 3 séances par semaine, 3 × 5 sur les grands mouvements, un peu plus lourd à chaque fois.",
    how: ["Séances A et B en alternance : A = squat, couché, soulevé de terre ; B = squat, militaire, rowing barre.",
      "3 × 5 (soulevé de terre : 1 × 5), même charge pour les 3 séries.", "Réussi : +2,5 kg (+5 kg au soulevé de terre) à la séance suivante. 3 échecs de suite : −10 %."] },
};
export const ORDER531 = ["ohp", "deadlift", "bench", "squat"];

// Charges de départ à partir du max (1RM) de chaque mouvement principal
export function startClassic(id, maxes, now = Date.now()) {
  const m = lift => Math.max(stepOf(lift) * 2, +maxes[lift] || 0);
  const c = { id, n: 0, start: now, tm: {}, w: {}, s: {}, fails: {}, log: [] };
  if (id === "wendler" || id === "nsuns") for (const l of MAIN) c.tm[l] = roundW(m(l) * 0.9, l);
  if (id === "gzclp") for (const l of MAIN) { c.w[`t1_${l}`] = roundW(m(l) * 0.75, l); c.w[`t2_${l}`] = roundW(m(l) * 0.5, l); c.s[`t1_${l}`] = 0; c.s[`t2_${l}`] = 0; }
  if (id === "ss") { for (const l of MAIN) c.w[l] = roundW(m(l) * 0.7, l); c.w.row = roundW(m("bench") * 0.6, "row"); }
  return c;
}

// Où en est le programme (pour les cartes) : « Semaine 2 · 3 reps », « Cycle 1 »…
export function classicStatus(c) {
  const P = CLASSICS[c.id];
  if (c.id === "wendler") { const wk = Math.floor(c.n / 4) % 4 + 1; return { cycle: Math.floor(c.n / 16) + 1, week: wk, label: `Cycle ${Math.floor(c.n / 16) + 1} · semaine ${wk} · ${W531[wk].label}` }; }
  const per = P.days, wk = Math.floor(c.n / per) + 1;
  return { week: wk, label: `Semaine ${wk} · séance ${(c.n % per) + 1}/${per}` };
}

// La prochaine séance du programme (objet programme pour le moteur de séance)
export function classicSession(c, st = {}) {
  if (!c) return null;
  const P = CLASSICS[c.id], ex = [], main = [];
  let title = "";
  const lastW = id => st.lifts?.[id]?.weight || 0;
  if (c.id === "wendler") {
    const lift = ORDER531[c.n % 4], wk = Math.floor(c.n / 4) % 4 + 1, tm = c.tm[lift];
    ex.push(fixedEx(lift, S(W531[wk].sets, tm, lift), 180,
      `5/3/1, ${W531[wk].label.toLowerCase()} : ${W531[wk].sets.map(([p]) => Math.round(p * 100)).join(", ")} % de ton max d'entraînement (${kg(tm)})${wk < 4 ? ", dernière série au maximum" : ""}.`));
    main.push({ lift, amrap: wk < 4 ? W531[wk].sets[2][1] : 0 });
    if (wk < 4) ex.push(fixedEx(lift, S([[0.5, 10], [0.5, 10], [0.5, 10], [0.5, 10], [0.5, 10]], tm, lift), 90, "Boring But Big : 5 × 10 à 50 %, repos courts."));
    const [a, sets, lo, hi] = ASSIST531[lift];
    ex.push(acc(a, sets, lo, hi, lastW(a)));
    title = `${name(lift)}`;
  } else if (c.id === "gzclp") {
    const d = GZ_DAYS[c.n % 4];
    const [s1, r1] = GZ_T1[c.s[`t1_${d.t1}`] || 0], [s2, r2] = GZ_T2[c.s[`t2_${d.t2}`] || 0], w1 = c.w[`t1_${d.t1}`], w2 = c.w[`t2_${d.t2}`];
    ex.push(fixedEx(d.t1, Array.from({ length: s1 }, (_, i) => ({ weight: w1, reps: r1, ...(i === s1 - 1 ? { amrap: true } : {}) })), 180, `T1 : ${s1} × ${r1} à ${kg(w1)}, dernière série au maximum.`));
    ex.push(fixedEx(d.t2, Array.from({ length: s2 }, () => ({ weight: w2, reps: r2 })), 120, `T2 : ${s2} × ${r2} à ${kg(w2)}.`));
    const w3 = c.w[`t3_${d.t3}`] || lastW(d.t3) || 20;
    ex.push(fixedEx(d.t3, [{ weight: w3, reps: 15 }, { weight: w3, reps: 15 }, { weight: w3, reps: 15, amrap: true }], 60, "T3 : 3 × 15, dernière série au maximum (25 reps : la charge monte)."));
    main.push({ lift: d.t1, tier: 1, sets: s1, reps: r1 }, { lift: d.t2, tier: 2, sets: s2, reps: r2 }, { lift: d.t3, tier: 3, reps: 15 });
    title = `${name(d.t1)} · ${name(d.t2)}`;
  } else if (c.id === "nsuns") {
    const d = NS_DAYS[c.n % 5];
    ex.push(fixedEx(d.t1, S(d.t1s, c.tm[d.t1], d.t1), 150, `Max d'entraînement ${kg(c.tm[d.t1])}.${d.t1s.some(x => x[1] === 1) ? " La série « 1+ » décide de la suite." : " Séance de volume."}`));
    ex.push(fixedEx(d.t2, S(d.t2s, c.tm[d.t2base], d.t2), 90, `Secondaire : 8 séries de ${Math.round(d.t2s[0][0] * 100)}–${Math.round(d.t2s.at(-1)[0] * 100)} % du max d'entraînement ${d.t2 === d.t2base ? "" : `de ${name(d.t2base).toLowerCase()} `}(${kg(c.tm[d.t2base])}).`));
    for (const [a, sets, lo, hi] of d.acc) ex.push(acc(a, sets, lo, hi, lastW(a)));
    const one = d.t1s.findIndex(x => x[1] === 1 && x[2]);
    main.push({ lift: d.t1, oneIdx: one });
    title = `${name(d.t1)} · ${name(d.t2)}`;
  } else if (c.id === "ss") {
    const day = SS_DAYS[c.n % 2];
    for (const l of day) ex.push(fixedEx(l, Array.from({ length: SS_SETS[l] || 3 }, () => ({ weight: c.w[l], reps: 5 })), 180, `${SS_SETS[l] || 3} × 5 à ${kg(c.w[l])}.`));
    main.push(...day.map(l => ({ lift: l })));
    title = `Séance ${c.n % 2 ? "B" : "A"}`;
  }
  const st8 = classicStatus(c);
  return { id: `classic_${c.id}_${c.n}`, name: `${P.short} · ${title}`.slice(0, 48), tag: st8.label, cat: "gym", classic: { id: c.id, n: c.n, main }, exercises: ex };
}

// Après la séance : le programme avance. Renvoie des phrases pour l'écran de fin.
export function classicAfter(c, sum, program, now = Date.now()) {
  if (!c || !program?.classic || program.classic.id !== c.id || program.classic.n !== c.n) return [];
  const out = [], sets = id => (sum.sets || []).filter(x => x.exId === id);
  const P = CLASSICS[c.id];
  if (!(sum.sets || []).length) return [];
  if (c.id === "wendler") {
    const { lift, amrap } = program.classic.main[0], own = sets(lift).slice(0, 3);
    const top = own[2];
    if (amrap && top) {
      if (top.reps < amrap) { c.fails[lift] = true; out.push(`${name(lift)} : ${top.reps} rep${top.reps > 1 ? "s" : ""} sur la série au max (au moins ${amrap} visées). Ton max d'entraînement baissera de 10 % au prochain cycle.`); }
      else out.push(`${name(lift)} : ${top.reps} reps à ${kg(top.weight)} sur la série au max${top.reps >= amrap + 5 ? ", excellent" : ""}.`);
    }
    c.n++;
    if (c.n % 16 === 0) {
      const ch = MAIN.map(l => { const before = c.tm[l]; c.tm[l] = c.fails[l] ? roundW(before * 0.9, l) : before + inc(l); return `${name(l)} ${c.tm[l] > before ? "+" : ""}${String(c.tm[l] - before).replace(".", ",")} kg`; });
      c.fails = {};
      out.push(`Nouveau cycle ! Max d'entraînement : ${ch.join(", ")}.`);
    }
  } else if (c.id === "gzclp") {
    for (const m of program.classic.main) {
      const own = sets(m.lift);
      if (!own.length) continue;
      if (m.tier === 3) {
        const last = own.at(-1);
        if (last.reps >= 25) { c.w[`t3_${m.lift}`] = (c.w[`t3_${m.lift}`] || last.weight) + stepOf(m.lift); out.push(`${name(m.lift)} : ${last.reps} reps sur la dernière série, la charge monte.`); }
        else c.w[`t3_${m.lift}`] = c.w[`t3_${m.lift}`] || last.weight;
        continue;
      }
      const key = `t${m.tier}_${m.lift}`, ok = own.length >= m.sets && own.slice(0, m.sets).every(x => x.reps >= m.reps);
      const stages = m.tier === 1 ? GZ_T1 : GZ_T2;
      if (ok) { c.w[key] += inc(m.lift); out.push(`${name(m.lift)} (T${m.tier}) réussi : ${kg(c.w[key])} la prochaine fois.`); }
      else if ((c.s[key] || 0) < 2) { c.s[key] = (c.s[key] || 0) + 1; const [ns, nr] = stages[c.s[key]]; out.push(`${name(m.lift)} (T${m.tier}) pas complet : on passe à ${ns} × ${nr} à la même charge.`); }
      else { c.s[key] = 0; c.w[key] = roundW(c.w[key] * 0.85, m.lift); out.push(`${name(m.lift)} (T${m.tier}) : on repart à ${stages[0][0]} × ${stages[0][1]} à ${kg(c.w[key])}.`); }
    }
    c.n++;
  } else if (c.id === "nsuns") {
    const { lift, oneIdx } = program.classic.main[0], one = sets(lift)[oneIdx];
    if (one) {
      const add = nsunsInc(lift, one.reps);
      c.tm[lift] += add;
      out.push(add ? `${name(lift)} : ${one.reps} reps sur la série « 1+ », max d'entraînement +${String(add).replace(".", ",")} kg (${kg(c.tm[lift])}).` : `${name(lift)} : ${one.reps} rep sur la série « 1+ », on garde ${kg(c.tm[lift])}.`);
    }
    c.n++;
  } else if (c.id === "ss") {
    for (const { lift } of program.classic.main) {
      const own = sets(lift), need = SS_SETS[lift] || 3;
      if (!own.length) continue;
      if (own.length >= need && own.slice(0, need).every(x => x.reps >= 5)) { c.w[lift] += lift === "deadlift" ? 5 : 2.5; c.fails[lift] = 0; out.push(`${name(lift)} : réussi, ${kg(c.w[lift])} la prochaine fois.`); }
      else if ((c.fails[lift] = (c.fails[lift] || 0) + 1) >= 3) { c.w[lift] = roundW(c.w[lift] * 0.9, lift); c.fails[lift] = 0; out.push(`${name(lift)} : 3 échecs de suite, on recule de 10 % (${kg(c.w[lift])}).`); }
      else out.push(`${name(lift)} : pas complet, on garde ${kg(c.w[lift])}.`);
    }
    c.n++;
  }
  c.log = [...(c.log || []), { d: sum.date || now, n: c.n - 1 }].slice(-60);
  const next = classicSession(c);
  out.push(`Prochaine séance : ${next.name.replace(`${P.short} · `, "")} (${next.tag.toLowerCase()}).`);
  return out;
}

// Séries imposées (programme célèbre) : « 30×5 · 35×5 · 37,5×5+ kg », « 3 × 5 à 70 kg », « 9 séries de 60 à 85 kg »
export function schemeText(e) {
  const sc = e.scheme, same = new Set(sc.map(x => x.weight)).size === 1, max = sc.some(x => x.amrap);
  if (same) return `${sc.length} × ${sc[0].reps} à ${kgsT(sc[0].weight)} kg${max ? ", dernière au max" : ""}`;
  if (sc.length <= 4) return `${sc.map(x => `${kgsT(x.weight)}×${x.reps}${x.amrap ? "+" : ""}`).join(" · ")} kg`;
  const ws = sc.map(x => x.weight);
  return `${sc.length} séries de ${kgsT(Math.min(...ws))}–${kgsT(Math.max(...ws))} kg${max ? ", avec série au max" : ""}`;
}
const kgsT = w => String(w).replace(".", ",");

// Jours d'entraînement de la semaine (0 = lundi) selon le nombre de séances
export const CLASSIC_DAYS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5] };
