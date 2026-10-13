// Progrès en images : mur des records (niveau de force, paliers) et courbes de force.
// Les calculs prennent l'état en paramètre (testés dans Node) ; l'affichage utilise l'état courant.
import { EXERCISES } from "./data.js";
import { state, e1rm } from "./store.js";
import { chart, linear } from "./chart.js";
import { animSvg, mountAnims } from "./anim.js";
import { $, $$, esc } from "./ui.js";

const DAY = 864e5;
export const LEVELS = ["Débutant", "Novice", "Intermédiaire", "Avancé", "Élite"];
// Repères indicatifs pour passer Novice, Intermédiaire, Avancé, Élite : 1RM / poids de corps, ou reps au poids du corps
const DL = { m: [1, 1.5, 2, 3], f: [0.6, 1, 1.5, 2.1] };
const STD = {
  squat: { m: [0.75, 1.25, 1.75, 2.5], f: [0.5, 0.85, 1.25, 1.75] },
  front_squat: { m: [0.6, 1, 1.4, 2], f: [0.4, 0.7, 1, 1.4] },
  bench: { m: [0.5, 1, 1.5, 2], f: [0.3, 0.55, 0.85, 1.2] },
  incline: { m: [0.4, 0.85, 1.25, 1.7], f: [0.25, 0.45, 0.7, 1] },
  deadlift: DL, sumo_deadlift: DL,
  rdl: { m: [0.75, 1.2, 1.6, 2.4], f: [0.5, 0.8, 1.2, 1.7] },
  ohp: { m: [0.35, 0.6, 0.85, 1.2], f: [0.2, 0.4, 0.6, 0.8] },
  row: { m: [0.4, 0.75, 1.1, 1.5], f: [0.25, 0.45, 0.7, 1] },
  hip_thrust: { m: [0.75, 1.25, 2, 3], f: [0.6, 1.1, 1.75, 2.5] },
  barbell_curl: { m: [0.2, 0.4, 0.6, 0.85], f: [0.1, 0.23, 0.38, 0.55] },
  pullup: { reps: true, m: [1, 6, 12, 20], f: [1, 3, 8, 14] },
  chinup: { reps: true, m: [1, 7, 13, 20], f: [1, 3, 8, 14] },
  pushup: { reps: true, m: [10, 25, 40, 60], f: [3, 12, 25, 40] },
  dips: { reps: true, m: [3, 10, 20, 30], f: [1, 5, 12, 20] },
};
const BIG3 = ["squat", "bench", "deadlift"];
const kg = v => (Math.round(v * 2) / 2).toLocaleString("fr-FR");
const day = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Niveau de force : { level, name, pct (vers le niveau suivant), next (1RM ou reps à viser), nextName }
export function strengthLevel(id, best, { bw = 75, sex = "m" } = {}) {
  const s = STD[id];
  if (!s || !(best > 0) || (!s.reps && !(bw > 0))) return null;
  const th = s[sex === "f" ? "f" : "m"], v = s.reps ? best : best / bw;
  let i = 0;
  while (i < th.length && v >= th[i]) i++;
  const lo = i ? th[i - 1] : 0, hi = th[i];
  return {
    level: i, name: LEVELS[i], nextName: LEVELS[i + 1] || null, reps: !!s.reps, ratio: s.reps ? null : v,
    pct: i < th.length ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 1,
    next: i < th.length ? (s.reps ? hi : Math.ceil((hi * bw) / 2.5) * 2.5) : null,
  };
}

// Une entrée par séance : meilleure série (1RM estimé), série la plus lourde, plus grand nombre de reps
const score = x => (x.weight > 0 ? e1rm(x.weight, x.reps) : x.reps);
export function liftHistory(sessions, id) {
  const out = [];
  for (const s of sessions || []) {
    const sets = (s.sets || []).filter(x => x.exId === id && x.reps > 0);
    if (!sets.length) continue;
    const top = sets.reduce((b, x) => (score(x) > score(b) ? x : b));
    const heavy = sets.reduce((b, x) => (x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps) ? x : b));
    out.push({ date: s.date, e1rm: e1rm(top.weight || 0, top.reps), heavy, reps: Math.max(...sets.map(x => x.reps)) });
  }
  return out.sort((a, b) => a.date - b.date);
}

// Records de chaque exercice, le plus récent d'abord
export function liftRecords(st = state, now = Date.now()) {
  const sex = st.profile?.sex === "f" ? "f" : "m", bw = +st.profile?.bodyweight || 75;
  const ids = new Set((st.sessions || []).flatMap(s => (s.sets || []).map(x => x.exId)));
  const list = [];
  for (const id of ids) {
    const ex = EXERCISES[id];
    if (!ex || ex.muscle === "Mobilité" || ex.muscle === "Cardio") continue;
    const h = liftHistory(st.sessions, id);
    if (!h.length) continue;
    if (ex.type === "load" && h.some(x => x.heavy.weight > 0)) {
      let best = h[0], heavy = h[0];
      for (const x of h) { if (x.e1rm > best.e1rm) best = x; if (x.heavy.weight > heavy.heavy.weight) heavy = x; }
      const top = heavy.heavy.weight, gain = best.e1rm - h[0].e1rm, step = (Math.floor(top / 10 + 1e-9) + 1) * 10;
      const bar = ex.equip === "bar" || ex.equip === "smith";
      list.push({
        id, name: ex.name, load: true, value: top, reps: heavy.heavy.reps, e1rm: best.e1rm, date: best.date, gain, sessions: h.length,
        level: strengthLevel(id, best.e1rm, { bw, sex }), next: step, toNext: step - top,
        plates: bar ? [180, 140, 100, 60].findIndex(p => top >= p) : -1, recent: now - best.date < 14 * DAY,
      });
    } else {
      let best = h[0];
      for (const x of h) if (x.reps > best.reps) best = x;
      list.push({
        id, name: ex.name, load: false, unit: ex.type === "time" ? "s" : "reps", value: best.reps, date: best.date, gain: best.reps - h[0].reps,
        sessions: h.length, level: strengthLevel(id, best.reps, { bw, sex }), recent: now - best.date < 14 * DAY,
      });
    }
  }
  return list.sort((a, b) => b.date - a.date);
}

// Points d'une courbe : 1RM estimé par séance (ou total des 3 grands mouvements), records marqués
export function curvePoints(st, key, from = 0) {
  let pts;
  if (key === "total") {
    const lifts = BIG3.filter(id => liftHistory(st.sessions, id).length);
    const best = {};
    pts = [];
    for (const s of (st.sessions || []).slice().sort((a, b) => a.date - b.date)) {
      let hit = false;
      for (const id of lifts) {
        const h = liftHistory([s], id)[0];
        if (h && h.e1rm > (best[id] || 0)) { best[id] = h.e1rm; hit = true; }
      }
      if (hit && lifts.every(id => best[id])) pts.push({ x: s.date, y: lifts.reduce((a, id) => a + best[id], 0) });
    }
  } else pts = liftHistory(st.sessions, key).filter(h => h.e1rm > 0).map(h => ({ x: h.date, y: h.e1rm }));
  const marks = [];
  let max = 0;
  pts.forEach((p, i) => { if (p.y > max) { if (i) marks.push(i); max = p.y; } });
  const keep = pts.map((p, i) => [p, i]).filter(([p]) => p.x >= from);
  const shift = keep.length ? keep[0][1] : 0;
  return { pts: keep.map(([p]) => p), marks: marks.filter(i => i >= shift).map(i => i - shift) };
}

// Choix proposés : les exercices chargés les plus pratiqués, et le total des 3 grands s'il y en a au moins 2
export function curveChoices(st = state) {
  const n = {};
  for (const s of st.sessions || []) for (const id of new Set((s.sets || []).filter(x => x.weight > 0).map(x => x.exId))) if (EXERCISES[id]?.type === "load") n[id] = (n[id] || 0) + 1;
  const top = Object.entries(n).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  return BIG3.filter(id => n[id]).length >= 2 ? [...top, "total"] : top;
}

// Mesure de poids (et tour de taille) la plus proche d'une date, à 7 jours près
export function measureNear(body, date, key = "weight") {
  let best = null;
  for (const b of body || []) if (b[key] > 0 && Math.abs(b.date - date) <= 7 * DAY && (!best || Math.abs(b.date - date) < Math.abs(best.date - date))) best = b;
  return best ? best[key] : null;
}
// « en 9 semaines », « en 12 jours »
export function spanText(ms) {
  const d = Math.round(ms / DAY);
  if (d < 14) return `en ${d} jour${d > 1 ? "s" : ""}`;
  if (d < 70) return `en ${Math.round(d / 7)} semaines`;
  return `en ${Math.round(d / 30.4)} mois`;
}

/* ---------- Affichage ---------- */
export function recordsWallHtml(list = liftRecords()) {
  if (!list.length) return "";
  const PLATES = ["4 plaques", "3 plaques", "2 plaques", "1 plaque"];
  return `<div class="rw" id="rw">${list.slice(0, 12).map(r => {
    const lv = r.level, t = lv ? `t${lv.level}` : "tx";
    return `<button class="rw-card ${t}${r.recent ? " new" : ""}" data-ex="${r.id}">
      <div class="rw-top">${animSvg(r.id, "rw-anim")}${r.recent ? `<span class="rw-new">Nouveau</span>` : r.plates >= 0 ? `<span class="rw-pl">${PLATES[r.plates]}</span>` : ""}</div>
      <b class="rw-name">${esc(r.name)}</b>
      <div class="rw-val"><b class="num">${r.load ? kg(r.value) : r.value}<small>${r.load ? " kg" : ` ${r.unit}`}</small></b>${r.load && r.reps > 1 ? `<span>× ${r.reps}</span>` : ""}</div>
      <div class="rw-sub">${r.load ? `1RM estimé ${kg(r.e1rm)} kg` : "Meilleure série"}${r.gain > 0 ? ` · <i>+${r.load ? `${kg(r.gain)} kg` : `${r.gain} ${r.unit}`}</i>` : ""}</div>
      ${lv ? `<div class="rw-lvl"><span class="rw-chip">${lv.name}</span><div class="bar"><i style="width:${Math.max(4, Math.round(lv.pct * 100))}%"></i></div>
        <small>${lv.next ? `${lv.nextName} : ${lv.reps ? `${lv.next} reps` : `${kg(lv.next)} kg au 1RM`}` : "Niveau maximum"}</small></div>`
        : r.load ? `<div class="rw-lvl"><small>Prochain palier : <b>${r.next} kg</b> (encore ${kg(r.toNext)} kg)</small></div>` : ""}
      <div class="rw-date">Record du ${day(r.date)}</div></button>`;
  }).join("")}</div>`;
}

let sel = null, range = "all";
const RANGES = [["3", "3 mois", 91], ["6", "6 mois", 182], ["12", "1 an", 365], ["all", "Tout", 0]];
export function curvesHtml(st = state) {
  const choices = curveChoices(st);
  if (!choices.length) return "";
  if (!choices.includes(sel)) sel = choices[0];
  return `<div class="section"><h2>Courbes de force</h2><span class="xs muted">1RM estimé</span></div>
    <div class="card fc-card" id="fc">
      <div class="chips fc-chips">${choices.map(id => `<button class="chip ${id === sel ? "on" : ""}" data-fc="${id}">${id === "total" ? "Total des 3" : esc(EXERCISES[id].name)}</button>`).join("")}</div>
      <div class="seg fc-range" style="--n:4">${RANGES.map(([k, l]) => `<button data-fr="${k}" class="${k === range ? "on" : ""}">${l}</button>`).join("")}</div>
      <div id="fc-body">${curveBody(st)}</div></div>`;
}
function curveBody(st) {
  const days = RANGES.find(r => r[0] === range)[2];
  const { pts, marks } = curvePoints(st, sel, days ? Date.now() - days * DAY : 0);
  const bw = +st.profile?.bodyweight || 0;
  let foot = "";
  if (pts.length >= 2) {
    const best = pts.reduce((b, p) => (p.y > b.y ? p : b)), span = pts[pts.length - 1].x - pts[0].x;
    const trend = pts.length >= 3 && span >= 14 * DAY ? linear(pts).perDay * 30 : null;
    foot = `<div class="fc-foot">
      ${trend != null ? `<span class="${trend >= 0 ? "up" : "down"}"><b class="tnum">${trend >= 0 ? "+" : "−"}${kg(Math.abs(trend))} kg</b> par mois</span>` : ""}
      <span>Record <b class="tnum">${kg(best.y)} kg</b> le ${day(best.x)}</span>
      ${bw && sel !== "total" ? `<span><b class="tnum">${(best.y / bw).toFixed(2).replace(".", ",")}×</b> ton poids</span>` : ""}
      ${marks.length ? `<span class="pr-l"><i></i>${marks.length} record${marks.length > 1 ? "s" : ""}</span>` : ""}</div>`;
  }
  return `${chart(pts, { unit: "kg", time: true, marks, trend: true, empty: "Pas assez de séances sur cette période." })}${foot}`;
}
export function bindCurves(root, st = state) {
  const box = $("#fc", root);
  if (!box) return;
  const redraw = () => { $("#fc-body", box).innerHTML = curveBody(st); };
  $$("[data-fc]", box).forEach(b => b.onclick = () => { sel = b.dataset.fc; $$("[data-fc]", box).forEach(x => x.classList.toggle("on", x === b)); redraw(); });
  $$("[data-fr]", box).forEach(b => b.onclick = () => { range = b.dataset.fr; $$("[data-fr]", box).forEach(x => x.classList.toggle("on", x === b)); redraw(); });
}
export const mountWall = root => mountAnims(root);
