// Amis, classement, défi de la semaine, et partage de séances par lien.
import { EXERCISES } from "./data.js";
import { state, save, publicSummary, currentUser, weekStart, syncCustomExercises } from "./store.js";
import { isOnlineMode, friendCall, push } from "./cloud.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, I, sheet, toast, confirmSheet, fmtNum, fmtTime } from "./ui.js";

/* ---------- Défi de la semaine (le même pour tout le monde) ---------- */
const CHALLENGES = [
  { id: "count4", name: "4 séances cette semaine", goal: 4, val: p => p.week.count, unit: "séances" },
  { id: "vol10", name: "10 tonnes soulevées cette semaine", goal: 10000, val: p => p.week.volume, unit: "kg" },
  { id: "pr2", name: "Battre 2 records cette semaine", goal: 2, val: p => p.week.prs || 0, unit: "records" },
  { id: "min180", name: "3 heures d'entraînement cette semaine", goal: 180, val: p => p.week.minutes, unit: "min" },
];
export function weeklyChallenge(d = new Date()) {
  const n = Math.floor(weekStart(d).getTime() / (7 * 864e5));
  return CHALLENGES[n % CHALLENGES.length];
}
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

export async function renderFriends(box) {
  if (!isOnlineMode()) {
    const me = { username: currentUser, status: "me", p: fresh(publicSummary()) };
    box.innerHTML = `<div class="section"><h2>Défi de la semaine</h2></div>${challengeCard([me])}
      <div class="card empty mt">${I.heart}<b>Entraîne-toi entre amis</b>Le classement et les défis entre amis demandent les comptes en ligne. En attendant, invite tes amis à installer l'app.</div>
      <button class="btn btn-soft btn-block mt-s" id="invite">${I.send} Inviter un ami</button>`;
    $("#invite", box).onclick = () => invite();
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
          <button class="btn btn-primary btn-sm" data-acc="${esc(f.username)}">Accepter</button><button class="icon-btn" data-ref="${esc(f.username)}" aria-label="Refuser">${I.x}</button></div>`).join("")}</div>` : ""}

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
        if (r.status === "accepted") spidey.react("party");
        load();
      } catch (err) { toast(err.message); }
    };
    $("#invite", box).onclick = () => invite();
    $$("#boards button", box).forEach(b => b.onclick = () => { board = b.dataset.b; draw(list, error); });
    $$("[data-acc]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_respond", { p_username: b.dataset.acc, p_accept: true }).catch(e => toast(e.message)); spidey.react("party"); load(); });
    $$("[data-ref]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_respond", { p_username: b.dataset.ref, p_accept: false }).catch(e => toast(e.message)); load(); });
    $$("[data-rm]", box).forEach(b => b.onclick = async () => { await friendCall("gt_friend_remove", { p_username: b.dataset.rm }).catch(e => toast(e.message)); load(); });
    $$("[data-u]", box).forEach(b => b.onclick = () => {
      const f = people.find(x => x.username === b.dataset.u);
      if (f && f.status !== "me") friendSheet(f, load);
    });
  };
  const load = async () => {
    try {
      await push(); // notre résumé public à jour avant de comparer
      const r = await friendCall("gt_friends");
      cache = r.friends || [];
      draw(cache);
    } catch (e) {
      draw(cache || [], /schema cache|function|SERVER/i.test(e.message + e.code) ? "Le serveur n'a pas encore les fonctions « amis » : lance le fichier supabase/002_social.sql dans Supabase." : e.message);
    }
  };
  draw(cache || [], null);
  load();
}

function friendSheet(f, reload) {
  const p = f.p;
  const sh = sheet(`<div class="fr-hero">${avatar(p.name || f.username, "big")}<h2 class="h2">${esc(p.name || f.username)}</h2>
      <div class="small muted">@${esc(f.username)}</div><div class="chips-c">${p.rank ? `<span class="chip red">${esc(p.rank)}</span>` : ""}<span class="chip">Niveau ${p.level || 1}</span></div></div>
    <div class="grid3 mt">
      <div class="card stat"><div class="v">${p.week.count}</div><div class="l">Semaine</div></div>
      <div class="card stat"><div class="v">${p.streak || 0}<small>j</small></div><div class="l">D'affilée</div></div>
      <div class="card stat"><div class="v">${p.total?.sessions || 0}</div><div class="l">Au total</div></div>
    </div>
    ${p.records?.length ? `<div class="section"><h2>Records</h2><span class="xs muted">1RM estimé</span></div><div class="card card-list">${p.records.map(r => `<div class="fr-line"><span class="ellipsis">${esc(r.n)}</span><b class="num">${r.kg}<small> kg</small></b></div>`).join("")}</div>` : ""}
    ${p.recent?.length ? `<div class="section"><h2>Dernières séances</h2></div><div class="card card-list">${p.recent.map(s => `<div class="fr-line"><div class="grow"><b class="ellipsis">${esc(s.n)}</b><span>${new Date(s.d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} · ${fmtNum(s.v)} kg · ${s.s} séries</span></div>${s.pr ? `<span class="chip amber">${s.pr} PR</span>` : ""}</div>`).join("")}</div>` : ""}
    <button class="btn btn-ghost btn-block mt fr-rm" id="rm">Retirer de mes amis</button>`);
  $("#rm", sh.el).onclick = async () => {
    if (!(await confirmSheet("Retirer cet ami ?", "Vous ne verrez plus vos stats respectives.", "Retirer", true))) return;
    await friendCall("gt_friend_remove", { p_username: f.username }).catch(e => toast(e.message));
    sh.close(); reload();
  };
}

const appUrl = () => location.origin + location.pathname;
async function shareText(text, url) {
  if (navigator.share) { try { await navigator.share({ title: "GREATNESS", text, url }); return; } catch { /* annulé */ } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Lien copié ✓ Colle-le dans un message."); }
  catch { prompt("Copie ce lien :", url); }
}
export const invite = () => shareText(`Rejoins-moi sur GREATNESS, l'app d'entraînement avec Spider-Man comme coach ! Mon pseudo : @${currentUser}`, appUrl());

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
    spidey.react("party");
    location.hash = "#/create?tab=mine";
  };
}
