// Amis, classement, défi de la semaine, duels 1 contre 1, fil d'actus, et partage de séances par lien.
import { EXERCISES } from "./data.js";
import { state, save, publicSummary, currentUser, weekStart, syncCustomExercises } from "./store.js";
import { isOnlineMode, friendCall, push } from "./cloud.js";
import { weeklyChallenge, METRICS, duelWith, duelScore, computeEvents, unread, duelRecord, sameWeek, weekOf } from "./rivals.js";
import { DIVS, PTS, SAFE, MIN_UP, SOLO_UP, SEASON_WEEKS, seasonOf, seasonPoints, standings, settleLeague, resultText, nextStep, daysLeft as seasonDaysLeft } from "./league.js";
import { mascot } from "./mascot.js";
import { $, $$, esc, I, sheet, toast, confirmSheet, fmtNum, fmtTime } from "./ui.js";
import { LOC, tr } from "./i18n.js";

export { weeklyChallenge };
// Les stats "semaine" d'un ami ne comptent que si elles datent de cette semaine.
const fresh = p => (p?.week?.start === weekStart().getTime() ? p : { ...p, week: { count: 0, volume: 0, minutes: 0, prs: 0 } });

const BOARDS = [
  { id: "volume", name: "Volume", val: p => p.week.volume, fmt: v => `${fmtNum(v)} kg` },
  { id: "count", name: "Séances", val: p => p.week.count, fmt: v => `${v}` },
  { id: "streak", name: "Série", val: p => p.streak || 0, fmt: v => `${v} j` },
  { id: "xp", name: "XP", val: p => p.xp || 0, fmt: v => `${fmtNum(v)}` },
];
let board = "volume", cache = null;

const avatar = (n, cls = "") => `<div class="avatar ${cls}">${esc((n || "?").charAt(0).toUpperCase())}</div>`;
const daysLeft = () => Math.max(1, Math.ceil((weekStart().getTime() + 7 * 864e5 - Date.now()) / 864e5));

// Carte du défi de la semaine (avec ou sans amis)
function challengeCard(people) {
  const ch = weeklyChallenge(), left = daysLeft();
  return `<div class="card card-hero ch-card">
    <div class="ch-head"><span class="ch-ic">${I.trophy}</span><div class="grow"><b class="h3">${esc(ch.name)}</b></div>
      <span class="chip">${left === 1 ? "Dernier jour" : `${left} jours`}</span></div>
    ${people.map(f => { const v = ch.val(f.p), pct = Math.min(1, v / ch.goal); return `<div class="ch-row ${f.status === "me" ? "me" : ""} ${pct >= 1 ? "done" : ""}"><span class="ellipsis">${esc(f.status === "me" ? "Toi" : f.p.name || f.username)}</span>
      <div class="bar"><i style="width:${Math.max(pct ? 4 : 0, pct * 100)}%"></i></div><span class="tnum">${pct >= 1 ? I.check : `${fmtNum(v)}<small>/${fmtNum(ch.goal)}</small>`}</span></div>`; }).join("")}
  </div>`;
}

/* ---------- Fil d'actus et duels ---------- */
const DAY = 864e5;
export const FEED_ICON = { over: "⚡", pass: "🚀", pr: "🏅", inv: "⚔️", acc: "🤝", duel: "🏆", weekly: "👑", league: "🎖️" };
let syncing = null;
const listeners = new Set();
export const onSocial = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(fn => fn(unread(state.social)));
export const unreadCount = () => unread(state.social);

// Récupère les amis et met à jour le fil d'actus (à l'ouverture de l'app, au retour dessus, dans l'onglet Amis).
// Renvoie les nouvelles actus.
export function syncSocial() {
  if (!isOnlineMode() || !currentUser) return Promise.resolve([]);
  return (syncing ||= (async () => {
    try {
      const r = await friendCall("gt_friends");
      cache = r.friends || [];
      return applyFriends(cache);
    } catch { return []; } finally { syncing = null; }
  })());
}
function applyFriends(list) {
  const friends = list.filter(f => f.status === "accepted");
  const out = computeEvents(state.social || {}, { me: currentUser, mine: publicSummary(), myDuels: state.duels, friends });
  state.social = { ...out.social, at: Date.now() };
  const lg = leagueEvent(settleLeague(state, friends)); // nouvelle saison : montée, maintien ou descente
  if (lg) out.events.unshift(lg);
  const fresh = out.log.filter(l => !(state.duelLog || []).some(x => x.id === l.id));
  if (fresh.length) { state.duelLog = [...(state.duelLog || []), ...fresh]; save(); }
  else save({ silent: true });
  emit();
  return out.events;
}
// Fin de saison → une actu (et le palmarès de la ligue est dans state.league.history)
function leagueEvent(res) {
  if (!res) return null;
  const e = { id: `league:${res.s}`, kind: "league", u: currentUser, text: resultText(res), at: Date.now(), read: false, move: res.move };
  state.social ||= {};
  state.social.feed = [e, ...(state.social.feed || []).filter(x => x.id !== e.id)].slice(0, 30);
  return e;
}
// Sans comptes en ligne : la saison se règle avec les paliers, à l'ouverture de l'app
export function ensureLeague() {
  if (isOnlineMode() || !currentUser) return null;
  const e = leagueEvent(settleLeague(state, []));
  if (e) { save(); emit(); }
  return e;
}

/* ---------- Ligue de la saison ---------- */
function leagueHtml(friends = []) {
  const s = seasonOf(), div = state.league?.div || 0, D = DIVS[div], pts = seasonPoints(state.sessions, s).total;
  const table = standings({ username: currentUser, name: state.profile.name || "Toi", pts, div }, friends, s), left = seasonDaysLeft();
  return `<div class="section"><h2>Ligue</h2><button class="lg-rules-btn" id="lg-rules">${I.info} Règles</button></div>
    <div class="card lg-card lg-${D.id}">
      <div class="lg-head"><span class="lg-badge" aria-hidden="true">${D.icon}</span><div class="grow"><b>Ligue ${D.name}</b><span class="xs muted">Saison ${s} · ${left === 1 ? "dernier jour" : `encore ${left} jours`}</span></div>
        <b class="lg-pts tnum">${fmtNum(pts)}<small> pts</small></b></div>
      ${table.length > 1 ? `<ol class="lg-table">${table.map(r => `<li class="${r.me ? "me" : ""} ${r.up ? "up" : r.down ? "down" : ""}"><span class="pos tnum">${r.rank}</span>
        <span class="grow ellipsis">${esc(r.me ? "Toi" : r.name)}</span><span class="lg-div" title="${DIVS[r.div].name}">${DIVS[r.div].icon}</span><b class="tnum">${fmtNum(r.pts)}</b></li>`).join("")}</ol>` : ""}
      <p class="xs lg-next">${esc(nextStep(table, div))}</p>
    </div>`;
}
function leagueRules() {
  const div = state.league?.div || 0, hist = (state.league?.history || []).slice(-6).reverse();
  sheet(`<div class="eyebrow">Ligue entre amis</div><h2 class="h2">Règles de la saison</h2>
    <p class="muted small">Une saison dure ${SEASON_WEEKS} semaines. Les points sont les mêmes pour tous, quel que soit ton entraînement : le poids du corps vaut la fonte.</p>
    <div class="card card-list mt lg-rules">
      <div><span>Séance (6 par semaine au plus)</span><b>+${PTS.session}</b></div>
      <div><span>2 minutes d'entraînement</span><b>+1</b></div>
      <div><span>Record personnel</span><b>+${PTS.pr}</b></div>
      <div><span>Défi de la semaine réussi</span><b>+${PTS.challenge}</b></div></div>
    <p class="small mt">En fin de saison, le premier tiers du classement entre amis monte d'une division (avec au moins ${MIN_UP} points), le dernier tiers descend (sauf à partir de ${SAFE} points). À moins de 3, tu montes en atteignant le palier de ta division.</p>
    <div class="lg-ladder mt">${DIVS.map((d, i) => `<div class="${i === div ? "on" : ""}"><span>${d.icon}</span><b>${d.name}</b><small class="muted">${i === div ? "ta division" : Number.isFinite(SOLO_UP[i]) ? `palier ${SOLO_UP[i]} pts` : "le sommet"}</small></div>`).join("")}</div>
    ${hist.length ? `<div class="eyebrow mt">Tes saisons</div><div class="card card-list">${hist.map(h => `<div class="lg-h"><span>Saison ${h.s}</span><span class="grow muted small">${h.n >= 3 ? `${h.rank === 1 ? "1er" : `${h.rank}e`} sur ${h.n} · ` : ""}${h.pts} pts</span><b>${h.move > 0 ? "⬆️" : h.move < 0 ? "⬇️" : "＝"} ${DIVS[h.to].icon}</b></div>`).join("")}</div>` : ""}`, { z: 70 });
}

export function markSocialRead() {
  if (!unread(state.social)) return;
  state.social.feed = state.social.feed.map(e => ({ ...e, read: true }));
  save({ silent: true });
  emit();
}

function feedHtml() {
  const feed = (state.social?.feed || []).slice(0, 6);
  if (!feed.length) return "";
  return `<div class="section"><h2>Actus</h2>${unread(state.social) ? `<span class="chip red">${unread(state.social)} nouvelle${unread(state.social) > 1 ? "s" : ""}</span>` : ""}</div>
    <div class="card card-list feed">${feed.map(e => `<div class="feed-row ${e.read ? "" : "new"} k-${e.kind}"><span class="feed-ic" aria-hidden="true">${FEED_ICON[e.kind] || "•"}</span>
      <div class="grow"><span>${esc(e.text)}</span><small>${ago(e.at)}</small></div></div>`).join("")}</div>`;
}
const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
  return new Date(t).toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "short" });
};

// Duels de la semaine avec chaque ami
function duelsOf(friends) {
  const ws = weekStart().getTime(), hidden = new Set(state.social?.hidden || []);
  return friends.map(f => ({ f, d: duelWith(currentUser, state.duels, f.username, f.public, ws) }))
    .filter(x => x.d && !(x.d.status === "invited" && hidden.has(`${x.f.username}|${ws}`)));
}
function duelsHtml(friends) {
  const list = duelsOf(friends), rec = duelRecord(state.duelLog), mine = publicSummary().week;
  const left = daysLeft();
  const rows = list.map(({ f, d }) => {
    const M = METRICS[d.m], name = esc(f.public?.name || f.username);
    if (d.status === "invited") return `<div class="duel inv"><div class="duel-h"><span class="duel-ic">⚔️</span><div class="grow"><b>${name} te défie</b><small>${esc(M.short)} · jusqu'à dimanche</small></div></div>
      <div class="duel-acts"><button class="btn btn-ghost btn-sm" data-dno="${esc(f.username)}">Refuser</button><button class="btn btn-primary btn-sm" data-dyes="${esc(f.username)}" data-m="${d.m}">Relever le défi</button></div></div>`;
    if (d.status === "pending") return `<div class="duel pend"><div class="duel-h"><span class="duel-ic">⏳</span><div class="grow"><b>Duel proposé à ${name}</b><small>${esc(M.short)} · en attente de sa réponse</small></div>
      <button class="btn btn-ghost btn-sm" data-dcancel="${esc(f.username)}">Annuler</button></div></div>`;
    const sc = duelScore(d, mine, f.public), max = Math.max(1, sc.me, sc.them);
    return `<div class="duel on"><div class="duel-h"><span class="duel-ic">⚔️</span><div class="grow"><b>Duel contre ${name}</b><small>${esc(M.name)} · ${left === 1 ? "dernier jour" : `${left} jours restants`}</small></div></div>
      <div class="duel-row me"><span>Toi</span><div class="bar"><i style="width:${Math.max(sc.me ? 4 : 0, (sc.me / max) * 100)}%"></i></div><b class="tnum">${M.fmt(sc.me)}</b></div>
      <div class="duel-row"><span class="ellipsis">${name}</span><div class="bar"><i style="width:${Math.max(sc.them ? 4 : 0, (sc.them / max) * 100)}%"></i></div><b class="tnum">${M.fmt(sc.them)}</b></div>
      <div class="duel-foot ${sc.lead > 0 ? "up" : sc.lead < 0 ? "down" : ""}">${sc.lead > 0 ? `Tu mènes de ${M.fmt(sc.lead)}` : sc.lead < 0 ? `Il te manque ${M.fmt(-sc.lead)} pour passer devant` : "À égalité : tout se joue maintenant"}</div></div>`;
  }).join("");
  const can = friends.some(f => !list.some(x => x.f.username === f.username));
  return `<div class="section"><h2>Duels</h2>${rec.win + rec.loss + rec.draw ? `<span class="xs muted">Palmarès <b class="tnum" style="color:var(--green-ink)">${rec.win} V</b> · <b class="tnum">${rec.loss} D</b>${rec.draw ? ` · ${rec.draw} N` : ""}</span>` : ""}</div>
    ${rows ? `<div class="duels">${rows}</div>` : ""}
    ${can ? `<button class="btn btn-soft btn-block ${rows ? "mt-s" : ""}" id="duel-new">⚔️ Lancer un duel cette semaine</button>` : ""}`;
}

// Propose un duel à un ami (cette semaine)
function challenge(u, m) {
  const ws = weekStart().getTime();
  if (state.duels.some(d => d.u === u && sameWeek(d.w, ws))) return;
  state.duels.push({ id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), u, m, w: ws, by: currentUser, at: Date.now() });
  save(); push();
}
function accept(u, m) {
  const ws = weekStart().getTime();
  if (state.duels.some(d => d.u === u && sameWeek(d.w, ws))) return;
  state.duels.push({ id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), u, m, w: ws, by: u, at: Date.now() });
  save(); push();
}
function cancelDuel(u) {
  const ws = weekStart().getTime(), gone = state.duels.filter(d => d.u === u && sameWeek(d.w, ws));
  state.duels = state.duels.filter(d => !gone.includes(d));
  (state.deleted.duels ||= []).push(...gone.map(d => d.id));
  save(); push();
}
function duelPicker(friends, preset, done) {
  const free = friends.filter(f => !duelWith(currentUser, state.duels, f.username, f.public, weekStart().getTime()));
  if (!free.length) return toast("Tu as déjà un duel avec chacun de tes amis cette semaine.");
  let who = preset && free.some(f => f.username === preset) ? preset : free[0].username, m = "volume";
  const sh = sheet(`<h2 class="h2">⚔️ Nouveau duel</h2><p class="small muted" style="margin:6px 0 0">Un contre un jusqu'à dimanche soir. Ton ami reçoit l'invitation dans ses actus.</p>
    <div class="eyebrow mt">Adversaire</div><div class="chips mt-s" id="dp-u">${free.map(f => `<button class="chip ${f.username === who ? "on" : ""}" data-u="${esc(f.username)}">${esc(f.public?.name || f.username)}</button>`).join("")}</div>
    <div class="eyebrow mt">Épreuve</div><div class="dp-m mt-s" id="dp-m">${Object.entries(METRICS).map(([k, M]) => `<button class="dp-opt ${k === m ? "on" : ""}" data-m="${k}"><b>${esc(M.name)}</b><small>${esc(M.short)}</small></button>`).join("")}</div>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="dp-go">Lancer le duel</button></div>`);
  $$("#dp-u button", sh.el).forEach(b => b.onclick = () => { who = b.dataset.u; $$("#dp-u button", sh.el).forEach(x => x.classList.toggle("on", x === b)); });
  $$("#dp-m button", sh.el).forEach(b => b.onclick = () => { m = b.dataset.m; $$("#dp-m button", sh.el).forEach(x => x.classList.toggle("on", x === b)); });
  $("#dp-go", sh.el).onclick = () => {
    challenge(who, m); sh.close();
    toast("Duel lancé ⚔️ Ton ami le verra dans ses actus.");
    mascot.react?.("party");
    done?.();
  };
}

export async function renderFriends(box) {
  if (!isOnlineMode()) {
    const me = { username: currentUser, status: "me", p: fresh(publicSummary()) };
    box.innerHTML = `${leagueHtml([])}<div class="section"><h2>Défi de la semaine</h2></div>${challengeCard([me])}
      <div class="card empty mt">${I.heart}<b>Entraîne-toi entre amis</b>Le classement et les défis entre amis demandent les comptes en ligne. En attendant, invite tes amis à installer l'app.</div>
      <button class="btn btn-soft btn-block mt-s" id="invite">${I.send} Inviter un ami</button>`;
    $("#invite", box).onclick = () => invite();
    $("#lg-rules", box).onclick = leagueRules;
    if (unread(state.social)) setTimeout(markSocialRead, 1500);
    return;
  }
  const me = { username: currentUser, status: "me", public: publicSummary() };
  const draw = (list, error) => {
    const friends = list.filter(f => f.status === "accepted");
    const incoming = list.filter(f => f.status === "incoming");
    const outgoing = list.filter(f => f.status === "outgoing");
    state.friendsCount = friends.length;
    const people = [me, ...friends].map(f => ({ ...f, p: fresh(f.public || {}) })).filter(f => f.p.week);
    const B = BOARDS.find(b => b.id === board);
    const ranked = people.slice().sort((a, b) => B.val(b.p) - B.val(a.p));
    const who = f => (f.status === "me" ? "Toi" : f.p.name || f.username);
    const podium = ranked.length >= 3 ? ranked.slice(0, 3) : [];
    const rest = podium.length ? ranked.slice(3) : ranked;
    box.innerHTML = `
      ${error ? `<div class="card fr-warn mt">${I.alert}<div><b>Connexion impossible</b><p class="small muted">${esc(error)}</p></div></div>` : ""}
      <form class="fr-add mt" id="add"><span aria-hidden="true">@</span><input class="input" id="add-u" placeholder="pseudo d'un ami" autocapitalize="none" autocomplete="off" spellcheck="false" aria-label="Pseudo d'un ami"/><button class="btn btn-primary" aria-label="Ajouter">${I.plus}</button></form>
      <button class="fr-invite" id="invite">${I.send}<span>Inviter un ami · ton pseudo <b>@${esc(currentUser)}</b></span></button>

      ${incoming.length ? `<div class="section"><h2>Demandes reçues</h2><span class="chip red">${incoming.length}</span></div><div class="card card-list">${incoming.map(f => `
        <div class="friend-row">${avatar(f.public?.name || f.username)}<div class="grow"><b class="ellipsis">${esc(f.public?.name || f.username)}</b><span class="ellipsis">@${esc(f.username)}</span></div>
          <button class="icon-btn fr-ok" data-acc="${esc(f.username)}" aria-label="Accepter">${I.check}</button><button class="icon-btn" data-ref="${esc(f.username)}" aria-label="Refuser">${I.x}</button></div>`).join("")}</div>` : ""}

      ${leagueHtml(friends)}
      ${feedHtml()}
      ${friends.length ? duelsHtml(friends) : ""}

      <div class="section"><h2>Défi de la semaine</h2></div>
      ${challengeCard(people)}
      ${friends.length ? "" : `<p class="xs muted mt-s" style="margin-left:4px">Ajoute des amis pour vous défier.</p>`}

      <div class="section"><h2>Classement</h2><span class="xs muted">cette semaine</span></div>
      <div class="seg" id="boards">${BOARDS.map(b => `<button data-b="${b.id}" class="${b.id === board ? "on" : ""}">${b.name}</button>`).join("")}</div>
      ${podium.length ? `<div class="podium">${[1, 0, 2].map(i => { const f = podium[i]; return `<button class="pod p${i + 1} ${f.status === "me" ? "me" : ""}" data-u="${esc(f.username)}">
          ${i === 0 ? `<span class="crown" aria-hidden="true">👑</span>` : ""}${avatar(f.p.name || f.username)}<b class="ellipsis">${esc(who(f))}</b><span class="num">${B.fmt(B.val(f.p))}</span><i>${i + 1}</i></button>`; }).join("")}</div>` : ""}
      ${rest.length ? `<div class="card card-list ${podium.length ? "mt-s" : "mt"}">${rest.map((f, k) => `
        <button class="friend-row ${f.status === "me" ? "me" : ""}" data-u="${esc(f.username)}"><span class="pos">${k + 1 + podium.length}</span>${avatar(f.p.name || f.username)}
          <div class="grow"><b class="ellipsis">${esc(f.status === "me" ? `${f.p.name} (toi)` : f.p.name || f.username)}</b><span class="ellipsis">${esc(f.p.rank || "")}</span></div><b class="num">${B.fmt(B.val(f.p))}</b></button>`).join("")}</div>` : ""}

      ${outgoing.length ? `<div class="section"><h2>En attente</h2></div><div class="card card-list">${outgoing.map(f => `<div class="friend-row">${avatar(f.username)}<div class="grow"><b class="ellipsis">@${esc(f.username)}</b><span>Demande envoyée</span></div><button class="btn btn-ghost btn-sm" data-rm="${esc(f.username)}">Annuler</button></div>`).join("")}</div>` : ""}
      ${!friends.length && !incoming.length ? `<div class="card empty mt">${I.heart}<b>Aucun ami pour l'instant</b>Partage ton pseudo <span class="fr-tag">@${esc(currentUser)}</span> pour lancer les défis.</div>` : ""}`;

    $("#add", box).onsubmit = async e => {
      e.preventDefault();
      const u = $("#add-u", box).value.trim().replace(/^@/, "");
      if (!u) return;
      try {
        const r = await friendCall("gt_friend_request", { p_username: u });
        toast(r.status === "accepted" ? "Vous êtes maintenant amis ✓" : "Demande envoyée ✓");
        if (r.status === "accepted") mascot.react("party");
        load();
      } catch (err) { toast(err.message); }
    };
    $("#invite", box).onclick = () => invite();
    $("#lg-rules", box).onclick = leagueRules;
    $$("#boards button", box).forEach(b => b.onclick = () => { board = b.dataset.b; draw(list, error); });
    $$("[data-acc]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_respond", { p_username: b.dataset.acc, p_accept: true }).catch(e => toast(e.message)); mascot.react("party"); load(); });
    $$("[data-ref]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_respond", { p_username: b.dataset.ref, p_accept: false }).catch(e => toast(e.message)); load(); });
    $$("[data-rm]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_remove", { p_username: b.dataset.rm }).catch(e => toast(e.message)); load(); });
    $$("[data-u]", box).forEach(b => b.onclick = () => {
      const f = people.find(x => x.username === b.dataset.u);
      if (f && f.status !== "me") friendSheet(f, load, friends);
    });
    const redraw = () => draw(list, error);
    $("#duel-new", box)?.addEventListener("click", () => duelPicker(friends, null, redraw));
    $$("[data-dyes]", box).forEach(b => b.onclick = () => { accept(b.dataset.dyes, b.dataset.m); toast("Défi relevé ⚔️ Bonne chance !"); mascot.react?.("party"); redraw(); });
    $$("[data-dno]", box).forEach(b => b.onclick = () => {
      (state.social.hidden ||= []).push(`${b.dataset.dno}|${weekStart().getTime()}`);
      save({ silent: true }); redraw();
    });
    $$("[data-dcancel]", box).forEach(b => b.onclick = () => { cancelDuel(b.dataset.dcancel); redraw(); });
    // les actus affichées sont lues
    if (unread(state.social)) setTimeout(markSocialRead, 1500);
  };
  const load = async () => {
    try {
      await push(); // notre résumé public à jour avant de comparer
      const r = await friendCall("gt_friends");
      cache = r.friends || [];
      applyFriends(cache);
      draw(cache);
    } catch (e) {
      draw(cache || [], /schema cache|function|SERVER/i.test(e.message + e.code) ? "Le serveur n'a pas encore les fonctions « amis » : lance le fichier supabase/002_social.sql dans Supabase." : e.message);
    }
  };
  draw(cache || [], null);
  load();
}

function friendSheet(f, reload, friends = []) {
  const p = f.p, d = duelWith(currentUser, state.duels, f.username, f.public, weekStart().getTime());
  const sh = sheet(`<div class="fr-hero">${avatar(p.name || f.username, "big")}<h2 class="h2">${esc(p.name || f.username)}</h2>
      <div class="small muted">@${esc(f.username)}</div><div class="chips-c">${p.rank ? `<span class="chip red">${esc(p.rank)}</span>` : ""}<span class="chip">Niveau ${p.level || 1}</span></div></div>
    <div class="grid3 mt">
      <div class="card stat"><div class="v">${p.week.count}</div><div class="l">Semaine</div></div>
      <div class="card stat"><div class="v">${p.streak || 0}<small>j</small></div><div class="l">D'affilée</div></div>
      <div class="card stat"><div class="v">${p.total?.sessions || 0}</div><div class="l">Au total</div></div>
    </div>
    ${d ? `<p class="small muted mt" style="text-align:center">⚔️ ${d.status === "active" ? `Duel en cours : ${esc(METRICS[d.m].short)}` : d.status === "pending" ? "Duel proposé, en attente de sa réponse" : "Il te défie cette semaine : réponds dans Duels"}</p>`
      : `<button class="btn btn-primary btn-block mt" id="fr-duel">⚔️ Défier en duel cette semaine</button>`}
    ${p.records?.length ? `<div class="section"><h2>Records</h2><span class="xs muted">1RM estimé</span></div><div class="card card-list">${p.records.map(r => `<div class="fr-line"><span class="ellipsis">${esc(r.n)}</span><b class="num">${r.kg}<small> kg</small></b></div>`).join("")}</div>` : ""}
    ${p.recent?.length ? `<div class="section"><h2>Dernières séances</h2></div><div class="card card-list">${p.recent.map(s => `<div class="fr-line"><div class="grow"><b class="ellipsis">${esc(s.n)}</b><span>${new Date(s.d).toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "short" })} · ${fmtNum(s.v)} kg · ${s.s} séries</span></div>${s.pr ? `<span class="chip amber">${s.pr} PR</span>` : ""}</div>`).join("")}</div>` : ""}
    <button class="btn btn-ghost btn-block mt fr-rm" id="rm">Retirer de mes amis</button>`);
  $("#fr-duel", sh.el)?.addEventListener("click", () => { sh.close(); duelPicker(friends.length ? friends : [f], f.username, reload); });
  $("#rm", sh.el).onclick = async () => {
    if (!(await confirmSheet("Retirer cet ami ?", "Vous ne verrez plus vos stats respectives.", "Retirer", true))) return;
    await friendCall("gt_friend_remove", { p_username: f.username }).catch(e => toast(e.message));
    sh.close(); reload();
  };
}

const appUrl = () => location.origin + location.pathname;
async function shareText(text, url) {
  text = tr(text); // partagé hors de l'app : dans sa langue
  if (navigator.share) { try { await navigator.share({ title: "GREATNESS", text, url }); return; } catch { /* annulé */ } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Lien copié ✓ Colle-le dans un message."); }
  catch { prompt("Copie ce lien :", url); }
}
export const invite = () => shareText(`Rejoins-moi sur GREATNESS, l'app d'entraînement avec un coach animé (37 personnages à choisir : Alex, Moussa, Noor, un robot, un dragon…) ! Mon pseudo : @${currentUser}`, appUrl());

/* ---------- Partage de séance par lien ---------- */
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function shareProgram(prog) {
  const ids = [...new Set(prog.exercises.map(e => e.id))];
  const payload = {
    v: 1, n: prog.name, t: prog.tag || "",
    e: prog.exercises.map(e => [e.id, e.sets, e.reps[0], e.reps[1], e.weight || 0, e.rest, e.rpe, e.ss || 0]),
    x: Object.fromEntries(ids.filter(id => EXERCISES[id]?.custom).map(id => { const { custom, ...d } = EXERCISES[id]; return [id, d]; })),
  };
  return shareText(`Voici ma séance « ${prog.name} » sur GREATNESS 💪`, `${appUrl()}#/import?s=${b64(JSON.stringify(payload))}`);
}

export function renderImport(view, code) {
  let data;
  try { data = JSON.parse(unb64(code || "")); if (!Array.isArray(data.e)) throw 0; }
  catch { view.innerHTML = `<div class="card empty mt-l">Ce lien de séance est invalide ou incomplet.</div>`; return; }
  const known = id => EXERCISES[id] || data.x?.[id];
  const rows = data.e.filter(r => known(r[0]));
  view.innerHTML = `
    <div class="eyebrow">Séance partagée</div><h1 class="h1">${esc(data.n)}</h1>
    <p class="muted small">${esc(data.t)}</p>
    <div class="card mt" style="padding:4px 16px">${rows.map(r => `<div class="cmp"><span>${esc(known(r[0]).name)}</span><span class="small muted">${r[1]} × ${r[2]}–${r[3]}${r[4] ? ` · ${r[4]} kg` : ""}</span>${r[7] ? `<span class="chip blue" style="height:20px;font-size:10.5px;padding:0 7px">${esc(r[7])}</span>` : "<span></span>"}</div>`).join("")}</div>
    <button class="btn btn-primary btn-lg btn-block mt" id="imp">${I.plus} Ajouter à mes séances</button>
    <a class="btn btn-ghost btn-block mt-s" href="#/">Plus tard</a>`;
  $("#imp", view).onclick = () => {
    // exercices perso inconnus : on les ajoute à la bibliothèque de l'utilisateur
    const map = {};
    Object.entries(data.x || {}).forEach(([id, d]) => {
      if (EXERCISES[id]) return;
      const nid = "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      state.customExercises[nid] = { cues: [], alts: [], ...d };
      map[id] = nid;
    });
    syncCustomExercises();
    state.customPrograms.push({
      id: "c" + Date.now(), name: String(data.n).slice(0, 40), tag: data.t, accent: "blue",
      exercises: rows.map(r => ({ id: map[r[0]] || r[0], sets: r[1], reps: [r[2], r[3]], weight: r[4], rest: r[5], rpe: r[6], ...(r[7] ? { ss: r[7] } : {}) })),
    });
    save();
    toast("Séance ajoutée à « Mes séances » ✓");
    mascot.react("party");
    location.hash = "#/create?tab=mine";
  };
}
