// Défis entre amis, sans serveur dédié : chacun publie dans son résumé public sa semaine en cours, sa
// semaine passée, ses duels et ses derniers records. Ici, la logique pure (testée dans Node) : défi de la
// semaine, duels 1 contre 1, et fil d'actus calculé en comparant avec ce qu'on avait déjà vu.
const DAY = 864e5, WEEK = 7 * DAY;
const fmt = n => Math.round(n || 0).toLocaleString("fr-FR");

export const METRICS = {
  volume: { name: "Volume", short: "volume soulevé", unit: "kg", val: w => w?.volume || 0, fmt: v => `${fmt(v)} kg` },
  count: { name: "Séances", short: "nombre de séances", unit: "séances", val: w => w?.count || 0, fmt: v => `${v} séance${v > 1 ? "s" : ""}` },
  minutes: { name: "Minutes", short: "temps d'entraînement", unit: "min", val: w => w?.minutes || 0, fmt: v => `${fmt(v)} min` },
  prs: { name: "Records", short: "records battus", unit: "records", val: w => w?.prs || 0, fmt: v => `${v} record${v > 1 ? "s" : ""}` },
};

/* ---------- Défi de la semaine (le même pour tout le monde) ---------- */
export const CHALLENGES = [
  { id: "count4", name: "4 séances cette semaine", goal: 4, m: "count", val: p => p.week.count, unit: "séances" },
  { id: "vol10", name: "10 tonnes soulevées cette semaine", goal: 10000, m: "volume", val: p => p.week.volume, unit: "kg" },
  { id: "pr2", name: "Battre 2 records cette semaine", goal: 2, m: "prs", val: p => p.week.prs || 0, unit: "records" },
  { id: "min180", name: "3 heures d'entraînement cette semaine", goal: 180, m: "minutes", val: p => p.week.minutes, unit: "min" },
];
// Lundi 00:00 (heure locale) de la semaine de `d`
export function mondayOf(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function weeklyChallenge(d = new Date()) {
  const n = Math.floor(mondayOf(d).getTime() / WEEK);
  return CHALLENGES[n % CHALLENGES.length];
}
// Même semaine malgré un éventuel décalage horaire entre amis
export const sameWeek = (a, b) => a != null && b != null && Math.abs(a - b) < 2 * DAY;

// Stats d'une semaine donnée dans un résumé public (semaine en cours ou passée), sinon zéro
export function weekOf(p, start) {
  if (sameWeek(p?.week?.start, start)) return p.week;
  if (sameWeek(p?.last?.start, start)) return p.last;
  return { start, count: 0, volume: 0, minutes: 0, prs: 0 };
}

/* ---------- Duels 1 contre 1 ---------- */
// Les duels entre moi et `u` pour la semaine `ws` : invité (il m'a défié), en attente (je l'ai défié), actif (les deux)
export function duelWith(me, myDuels, u, p, ws) {
  const mine = (myDuels || []).find(d => d.u === u && sameWeek(d.w, ws));
  const theirs = (p?.duels || []).find(d => d.u === me && sameWeek(d.w, ws));
  if (!mine && !theirs) return null;
  const m = METRICS[(mine || theirs).m] ? (mine || theirs).m : "volume";
  return { u, m, w: ws, status: mine && theirs ? "active" : mine ? "pending" : "invited" };
}

// Score d'un duel actif : moi, lui, écart
export function duelScore(duel, myWeek, p) {
  const M = METRICS[duel.m], a = M.val(myWeek), b = M.val(weekOf(p, duel.w));
  return { me: a, them: b, lead: a - b };
}

/* ---------- Fil d'actus ---------- */
const nameOf = f => f.public?.name || f.username;
const mk = (kind, u, text, at, extra = {}) => ({ id: `${kind}:${u}:${at}`, kind, u, text, at, read: false, ...extra });

// Compare l'état des amis avec ce qu'on avait vu : renvoie les nouvelles actus, le nouvel état vu,
// et les duels de la semaine passée à inscrire au palmarès.
// social : { week, seen: { [u]: { ahead, pr, inv, acc } }, results: { [clé]: res }, weekly }
export function computeEvents(social = {}, { me, mine, myDuels = [], friends = [], now = Date.now() }) {
  const ws = mine.week.start, prevWeek = ws - WEEK;
  const seen = social.week === ws ? { ...social.seen } : Object.fromEntries(Object.entries(social.seen || {}).map(([u, s]) => [u, { ...s, ahead: null }]));
  const results = { ...social.results }, events = [], log = [];
  const myVol = mine.week.volume || 0;
  for (const f of friends) {
    const p = f.public || {}, u = f.username, name = nameOf(f), prev = seen[u];
    const w = weekOf(p, ws), fVol = w.volume || 0;
    const ahead = fVol > myVol ? true : myVol > fVol ? false : prev?.ahead ?? null;
    if (prev && prev.ahead === false && ahead === true) events.push(mk("over", u, `${name} t'a dépassé au classement : ${fmt(fVol)} kg contre ${fmt(myVol)} kg. À toi de jouer !`, now));
    if (prev && prev.ahead === true && ahead === false) events.push(mk("pass", u, `Tu passes devant ${name} au classement : ${fmt(myVol)} kg contre ${fmt(fVol)} kg 💪`, now));
    // records récents (pas au premier passage : on ne déroule pas tout l'historique)
    const prs = (p.prs || []).filter(x => x.d > (prev?.pr || 0));
    if (prev) for (const x of prs.filter(x => now - x.d < 3 * DAY).slice(0, 2)) events.push(mk("pr", u, `${name} a battu un record : ${x.n} (${x.v} ${x.unit || "kg"}).`, x.d));
    const lastPr = Math.max(prev?.pr || 0, ...(p.prs || []).map(x => x.d));
    // duels de la semaine
    const duel = duelWith(me, myDuels, u, p, ws), inv = prev?.inv || [], acc = prev?.acc || [];
    if (duel?.status === "invited" && !inv.some(x => sameWeek(x, ws))) events.push(mk("inv", u, `${name} te défie en duel cette semaine : ${METRICS[duel.m].short}. Tu relèves le défi ?`, now, { duel: duel.m }));
    if (duel?.status === "active" && !acc.some(x => sameWeek(x, ws)) && (myDuels || []).some(d => d.u === u && sameWeek(d.w, ws) && d.by === me)) {
      events.push(mk("acc", u, `${name} a accepté ton duel (${METRICS[duel.m].short}). Que le meilleur gagne !`, now));
    }
    seen[u] = {
      ahead, pr: lastPr > 0 ? lastPr : 0,
      inv: duel?.status === "invited" || duel?.status === "active" ? [...inv.filter(x => x > ws - 3 * WEEK), ws] : inv,
      acc: duel?.status === "active" ? [...acc.filter(x => x > ws - 3 * WEEK), ws] : acc,
    };
    // résultat du duel de la semaine passée (s'il était accepté des deux côtés)
    const old = duelWith(me, myDuels, u, p, prevWeek), key = `${u}|${prevWeek}`;
    if (old?.status === "active" && !(key in results)) {
      const M = METRICS[old.m], a = M.val(mine.last && sameWeek(mine.last.start, prevWeek) ? mine.last : null), b = M.val(weekOf(p, prevWeek));
      const res = a > b ? "win" : a < b ? "loss" : "draw";
      results[key] = res;
      log.push({ id: key, u, m: old.m, w: prevWeek, me: a, them: b, res });
      events.push(mk("duel", u, res === "win" ? `Duel gagné contre ${name} 🏆 ${M.fmt(a)} contre ${M.fmt(b)}.` : res === "loss" ? `Duel perdu contre ${name} : ${M.fmt(a)} contre ${M.fmt(b)}. Revanche cette semaine ?` : `Égalité parfaite avec ${name} : ${M.fmt(a)} chacun !`, now, { res }));
    }
  }
  // résultats du défi de la semaine passée, une fois par semaine
  let weekly = social.weekly;
  if (weekly !== ws && friends.length) {
    weekly = ws;
    const ch = weeklyChallenge(new Date(prevWeek + 3 * DAY)), M = METRICS[ch.m];
    const rows = [{ u: me, name: "Toi", v: M.val(mine.last && sameWeek(mine.last.start, prevWeek) ? mine.last : null) },
      ...friends.map(f => ({ u: f.username, name: nameOf(f), v: M.val(weekOf(f.public, prevWeek)) }))].sort((a, b) => b.v - a.v);
    if (rows[0].v > 0) {
      const rank = rows.findIndex(r => r.u === me) + 1, top = rows[0];
      events.push(mk("weekly", me, rank === 1 ? `Défi de la semaine dernière (${ch.name.replace(" cette semaine", "")}) : tu termines 1er sur ${rows.length} 👑 ${M.fmt(top.v)}.`
        : `Défi de la semaine dernière (${ch.name.replace(" cette semaine", "")}) : tu termines ${rank}e sur ${rows.length}. Victoire de ${top.name} avec ${M.fmt(top.v)}.`, now, { rank }));
    }
  }
  const feed = [...events, ...(social.feed || [])].filter((e, i, a) => a.findIndex(x => x.id === e.id) === i).sort((a, b) => b.at - a.at).slice(0, 30);
  return { events, log, social: { ...social, week: ws, seen, results, weekly, feed } };
}

export const unread = social => (social?.feed || []).filter(e => !e.read).length;

// Palmarès des duels : victoires, défaites, égalités
export function duelRecord(log = []) {
  const r = { win: 0, loss: 0, draw: 0 };
  for (const d of log) r[d.res] = (r[d.res] || 0) + 1;
  return r;
}
