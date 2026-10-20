// Apple Santé : les mesures envoyées chaque jour par un Raccourci iOS (sommeil, variabilité cardiaque, fréquence
// cardiaque au repos, pas, poids, énergie active) préremplissent le bilan de forme avant une séance, alimentent la
// courbe de poids (et donc les calories adaptatives) et renseignent le coach. La variabilité cardiaque et la fréquence
// au repos se lisent par rapport à TES valeurs habituelles (médiane des 30 jours d'avant). Logique pure, testée.
import { LOC } from "./i18n.js";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nice = v => String(Math.round(v * 10) / 10).replace(".", ",");
export const dayKeyOf = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const shiftDay = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKeyOf(new Date(y, m - 1, d + n)); };
// 7,5 → « 7 h 30 »
export const fmtSleep = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`; };
const KEYS = ["steps", "sleep", "hrv", "rhr", "weight", "kcal"];

// Lignes du serveur [{ day, data, at }] → { "2026-10-14": { steps, sleep…, at } } (60 derniers jours)
export function mergeHealth(cur = {}, rows = [], today = dayKeyOf(new Date())) {
  const out = { ...cur };
  for (const r of rows || []) {
    const day = String(r?.day || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const v = {};
    for (const k of KEYS) if (Number.isFinite(+r.data?.[k]) && r.data[k] !== null && r.data[k] !== "") v[k] = +r.data[k];
    out[day] = { ...out[day], ...v, at: Date.parse(r.at) || Date.now() };
  }
  const from = shiftDay(today, -60);
  for (const d of Object.keys(out)) if (d < from) delete out[d];
  return out;
}
// Valeur habituelle : médiane des `n` jours d'avant (au moins 4 mesures), sinon null
export function baseline(days = {}, key, today, n = 30) {
  const from = shiftDay(today, -n), vals = Object.entries(days).filter(([d, v]) => d >= from && d < today && Number.isFinite(v?.[key])).map(([, v]) => v[key]);
  return vals.length >= 4 ? median(vals) : null;
}

// Bilan de forme proposé (mêmes échelles que le check-in : 1 → 5) : le sommeil d'après les heures de la nuit,
// l'énergie d'après la variabilité cardiaque (VFC) et la fréquence au repos comparées à tes valeurs habituelles.
// null si rien d'utile n'est arrivé aujourd'hui.
export function readinessFromHealth(days = {}, today = dayKeyOf(new Date())) {
  const d = days[today];
  if (!d) return null;
  const out = { notes: [] };
  if (Number.isFinite(d.sleep)) {
    out.sleep = d.sleep < 5 ? 1 : d.sleep < 6 ? 2 : d.sleep < 7 ? 3 : d.sleep < 8 ? 4 : 5;
    out.notes.push(`${fmtSleep(d.sleep)} de sommeil`);
  }
  let energy = null;
  const bh = baseline(days, "hrv", today), br = baseline(days, "rhr", today);
  if (Number.isFinite(d.hrv) && bh) {
    const r = d.hrv / bh;
    energy = r >= 1.05 ? 5 : r >= 0.97 ? 4 : r >= 0.9 ? 3 : r >= 0.8 ? 2 : 1;
    out.notes.push(`VFC ${Math.round(d.hrv)} ms, ${r >= 1.05 ? "au-dessus de" : r >= 0.9 ? "dans" : "sous"} ta moyenne`);
  }
  if (Number.isFinite(d.rhr) && br) {
    const up = d.rhr - br;
    energy = clamp(Math.round((energy ?? 4) + (up >= 6 ? -2 : up >= 3 ? -1 : 0)), 1, 5);
    if (Math.abs(up) >= 3) out.notes.push(`fréquence au repos ${up > 0 ? "+" : "−"}${Math.round(Math.abs(up))} bpm`);
  }
  if (energy != null) out.energy = energy;
  return out.sleep == null && out.energy == null ? null : out;
}
// Libellé court pour l'accueil
export function formLabel(r) {
  if (!r) return null;
  const s = ((r.sleep ?? 3) + (r.energy ?? r.sleep ?? 3)) / 2;
  return s >= 4.5 ? { text: "En pleine forme", tone: "up" } : s >= 3.5 ? { text: "Bonne forme", tone: "ok" } : s >= 2.5 ? { text: "Forme moyenne", tone: "mid" } : { text: "Journée récup conseillée", tone: "down" };
}

// Pesées venues d'Apple Santé → courbe de poids (une par jour, sans écraser une pesée faite dans l'app).
// Renvoie le nombre de pesées ajoutées.
export function applyWeights(st, days = {}) {
  st.body ||= [];
  const have = new Set(st.body.filter(b => b.weight).map(b => dayKeyOf(b.date)));
  let n = 0, last = null;
  for (const [day, v] of Object.entries(days).sort()) {
    if (!Number.isFinite(v?.weight)) continue;
    last = v.weight;
    if (have.has(day)) continue;
    const [y, m, d] = day.split("-").map(Number);
    st.body.push({ date: new Date(y, m - 1, d, 8).getTime(), weight: Math.round(v.weight * 10) / 10, src: "sante" });
    have.add(day); n++;
  }
  if (n) { st.body.sort((a, b) => a.date - b.date); if (last && st.profile) st.profile.bodyweight = Math.round(last * 10) / 10; }
  return n;
}

// Pour le coach (IA en ligne ou locale)
export function healthContext(days = {}, today = dayKeyOf(new Date())) {
  const t = days[today], y = days[shiftDay(today, -1)];
  if (!t && !y) return "";
  const out = [], bh = baseline(days, "hrv", today), br = baseline(days, "rhr", today);
  if (Number.isFinite(t?.sleep)) out.push(`nuit dernière ${fmtSleep(t.sleep)}`);
  if (Number.isFinite(t?.hrv)) out.push(`VFC ${Math.round(t.hrv)} ms${bh ? ` (habituelle ${Math.round(bh)})` : ""}`);
  if (Number.isFinite(t?.rhr)) out.push(`fréquence cardiaque au repos ${Math.round(t.rhr)} bpm${br ? ` (habituelle ${Math.round(br)})` : ""}`);
  const steps = Number.isFinite(t?.steps) ? ["aujourd'hui", t.steps] : Number.isFinite(y?.steps) ? ["hier", y.steps] : null;
  if (steps) out.push(`${steps[1].toLocaleString(LOC())} pas ${steps[0]}`);
  if (Number.isFinite(t?.kcal)) out.push(`${Math.round(t.kcal)} kcal actives aujourd'hui`);
  return out.length ? `Apple Santé : ${out.join(", ")}. Si le sommeil ou la VFC sont bas, propose une séance plus légère.` : "";
}
// « 7 h 30 de sommeil · VFC 58 ms · 8 432 pas »
export function healthLine(days = {}, today = dayKeyOf(new Date())) {
  const t = days[today];
  if (!t) return "";
  return [Number.isFinite(t.sleep) && `${fmtSleep(t.sleep)} de sommeil`, Number.isFinite(t.hrv) && `VFC ${Math.round(t.hrv)} ms`,
    Number.isFinite(t.rhr) && `FC repos ${Math.round(t.rhr)}`, Number.isFinite(t.steps) && `${t.steps.toLocaleString(LOC())} pas`,
    Number.isFinite(t.weight) && `${nice(t.weight)} kg`].filter(Boolean).join(" · ");
}
