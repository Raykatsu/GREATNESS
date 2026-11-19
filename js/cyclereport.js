// Le bilan de chaque cycle de 7 semaines (Volume, Force, Pic, Récupération) : séances, volume soulevé (comparé au cycle
// d'avant), records battus, et ce que tes mouvements ont gagné — le meilleur 1RM estimé du cycle (charge ×
// répétitions) comparé à ton meilleur d'avant le cycle. Affiché pendant la semaine de récupération et la première semaine
// du cycle suivant (cycle-ui.js) ; la dernière semaine du bloc Pic est la semaine test. Logique pure, testée dans Node.

const DAY = 864e5, WEEK = 7 * DAY;
export const CYCLE_MS = 7 * WEEK;
const e1rm = (w, r) => (w > 0 ? w * (1 + r / 30) : 0); // même formule que store.js
const r1 = v => Math.round(v * 10) / 10;

// Quel bilan montrer à la date `now` : celui du cycle en cours pendant sa semaine de récupération, celui du cycle
// d'avant pendant la première semaine du suivant ; 0 sinon
export function reportCycle(cycleStart, now = Date.now()) {
  if (!cycleStart || now < cycleStart) return 0;
  const week = Math.floor((now - cycleStart) / WEEK) + 1, pos = ((week - 1) % 7) + 1, n = Math.ceil(week / 7);
  return pos === 7 ? n : pos === 1 && n > 1 ? n - 1 : 0;
}

// Le bilan du cycle n (1 = le premier)
export function cycleReport(sessions = [], cycleStart, n) {
  const from = cycleStart + (n - 1) * CYCLE_MS, to = from + CYCLE_MS;
  const list = sessions.filter(s => s?.date).sort((a, b) => a.date - b.date);
  const inCycle = list.filter(s => s.date >= from && s.date < to), prevCycle = list.filter(s => s.date >= from - CYCLE_MS && s.date < from);
  const vol = l => Math.round(l.reduce((a, s) => a + (s.volume || 0), 0));
  // meilleur niveau de chaque exercice avant le cycle, puis pendant ; records : chaque série qui dépasse le meilleur d'avant
  const best = {}, before = {}, during = {};
  let records = 0;
  for (const s of list) {
    if (s.date >= to) break;
    for (const x of s.sets || []) {
      const v = e1rm(x.weight, x.reps);
      if (!v) continue;
      const prev = best[x.exId] || 0;
      if (s.date >= from) {
        if (prev > 0 && v > prev + 0.01) records++;
        if (v > (during[x.exId]?.v || 0)) during[x.exId] = { v, name: x.name || x.exId };
      } else if (v > (before[x.exId]?.v || 0)) before[x.exId] = { v, name: x.name || x.exId };
      if (v > prev) best[x.exId] = v;
    }
  }
  const lifts = Object.entries(during).filter(([id]) => before[id]).map(([id, x]) => ({
    id, name: x.name, before: r1(before[id].v), now: r1(x.v), gain: r1(x.v - before[id].v), pct: Math.round(((x.v - before[id].v) / before[id].v) * 100),
  })).sort((a, b) => b.pct - a.pct || b.gain - a.gain);
  const volume = vol(inCycle), prevVolume = prevCycle.length ? vol(prevCycle) : null;
  return {
    n, from, to, sessions: inCycle.length, volume, records,
    volumeVsPrev: prevVolume ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null,
    lifts: lifts.slice(0, 4), up: lifts.filter(l => l.gain > 0).length, tracked: lifts.length,
  };
}
