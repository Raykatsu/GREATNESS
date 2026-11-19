// La fréquence cardiaque de ta montre pendant la séance (Apple Watch → Apple Santé → l'app iPhone) : la dernière mesure
// si elle est récente (la montre mesure en continu pendant un exercice lancé sur elle) et, à la fin, la moyenne et le
// maximum de la séance. Logique pure, testée dans Node.

export const FRESH_MS = 2 * 60e3; // au-delà, la mesure ne dit plus grand-chose de l'effort en cours
const ok = s => s && Number.isFinite(s.t) && s.bpm > 30 && s.bpm < 240;

// samples : [{ t (ms), bpm }] → la dernière mesure si elle a moins de 2 minutes, 0 sinon
export function liveHr(samples = [], now = Date.now()) {
  let last = null;
  for (const s of samples) if (ok(s) && s.t <= now + 5e3 && (!last || s.t > last.t)) last = s;
  return last && now - last.t <= FRESH_MS ? Math.round(last.bpm) : 0;
}

// Moyenne (pondérée par le temps jusqu'à la mesure suivante, plafonné à 1 min : la montre mesure plus souvent pendant
// l'effort) et maximum entre `from` et `to` ; null s'il y a moins de 3 mesures
export function hrStats(samples = [], from = 0, to = Infinity) {
  const v = samples.filter(s => ok(s) && s.t >= from && s.t <= to).sort((a, b) => a.t - b.t);
  if (v.length < 3) return null;
  let sum = 0, dur = 0;
  v.forEach((s, i) => {
    const dt = i < v.length - 1 ? Math.min(60e3, Math.max(1e3, v[i + 1].t - s.t)) : 5e3;
    sum += s.bpm * dt; dur += dt;
  });
  return { avg: Math.round(sum / dur), max: Math.round(Math.max(...v.map(s => s.bpm))), n: v.length };
}
