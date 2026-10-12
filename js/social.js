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

const avatar = n => `<div class="avatar">${esc((n || "?").charAt(0).toUpperCase())}</div>`;

export async function renderFriends(box) {
  if (!isOnlineMode()) {
    box.innerHTML = `<div class="card empty mt">Les amis et le classement nécessitent les comptes en ligne (Supabase).</div>`;
    return;
  }
  const me = { username: currentUser, status: "me", public: publicSummary() };
  const draw = (list, error) => {
    const friends = list.filter(f => f.status === "accepted");
    const incoming = list.filter(f => f.status === "incoming");
    const outgoing = list.filter(f => f.status === "outgoing");
    state.friendsCount = friends.length;
    const ch = weeklyChallenge();
    const people = [me, ...friends].map(f => ({ ...f, p: fresh(f.public || {}) })).filter(f => f.p.week);
    const B = BOARDS.find(b => b.id === board);
    const ranked = people.slice().sort((a, b) => B.val(b.p) - B.val(a.p));
    box.innerHTML = `
      ${error ? `<div class="card mt" style="border-color:rgba(245,184,61,.4)"><b>Connexion impossible</b><p class="small muted" style="margin:4px 0 0">${esc(error)}</p></div>` : ""}
      <form class="row mt" id="add" style="gap:8px"><input class="input grow" id="add-u" placeholder="Pseudo d'un ami" autocapitalize="none" spellcheck="false"/><button class="btn btn-primary" style="min-height:50px">${I.plus}</button></form>
      <button class="btn btn-ghost btn-sm btn-block mt-s" id="invite">${I.send} Inviter un ami (mon pseudo : @${esc(currentUser)})</button>

      ${incoming.length ? `<div class="section"><h2>Demandes reçues</h2></div><div class="card" style="padding:4px 16px">${incoming.map(f => `
        <div class="friend-row">${avatar(f.public?.name || f.username)}<div class="grow"><b>${esc(f.public?.name || f.username)}</b><span>@${esc(f.username)}</span></div>
          <button class="btn btn-primary btn-sm" data-acc="${esc(f.username)}">Accepter</button><button class="icon-btn" data-ref="${esc(f.username)}" aria-label="Refuser">${I.x}</button></div>`).join("")}</div>` : ""}

      <div class="section"><h2>Défi de la semaine</h2></div>
      <div class="card card-hero"><b class="h3">${esc(ch.name)}</b>
        ${people.map(f => { const v = ch.val(f.p), pct = Math.min(1, v / ch.goal); return `<div class="ch-row ${f.status === "me" ? "me" : ""}"><span class="ellipsis">${esc(f.status === "me" ? "Toi" : f.p.name || f.username)}</span>
          <div class="bar"><i style="width:${pct * 100}%"></i></div><span class="xs ${pct >= 1 ? "" : "muted"}">${pct >= 1 ? "✓" : `${fmtNum(v)}/${fmtNum(ch.goal)}`}</span></div>`; }).join("")}
        ${friends.length ? "" : `<p class="xs muted mt-s" style="margin-bottom:0">Ajoute des amis pour vous défier.</p>`}
      </div>

      <div class="section"><h2>Classement</h2><span class="xs muted">cette semaine</span></div>
      <div class="seg" id="boards">${BOARDS.map(b => `<button data-b="${b.id}" class="${b.id === board ? "on" : ""}">${b.name}</button>`).join("")}</div>
      <div class="card mt-s" style="padding:4px 16px">${ranked.map((f, i) => `
        <button class="friend-row ${f.status === "me" ? "me" : ""}" data-u="${esc(f.username)}"><span class="pos">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${avatar(f.p.name || f.username)}
          <div class="grow"><b>${esc(f.status === "me" ? `${f.p.name} (toi)` : f.p.name || f.username)}</b><span>${esc(f.p.rank || "")}</span></div><b class="num">${B.fmt(B.val(f.p))}</b></button>`).join("")}</div>

      ${outgoing.length ? `<div class="section"><h2>En attente</h2></div><div class="card" style="padding:4px 16px">${outgoing.map(f => `<div class="friend-row">${avatar(f.username)}<div class="grow"><b>@${esc(f.username)}</b><span>Demande envoyée</span></div><button class="btn btn-ghost btn-sm" data-rm="${esc(f.username)}">Annuler</button></div>`).join("")}</div>` : ""}
      ${!friends.length && !incoming.length ? `<div class="empty">Aucun ami pour l'instant. Partage ton pseudo <b>@${esc(currentUser)}</b> !</div>` : ""}`;

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
    $$(".friend-row[data-u]", box).forEach(b => b.onclick = () => {
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
  const sh = sheet(`<div class="row" style="gap:14px">${avatar(p.name || f.username).replace("avatar", "avatar big")}<div><h2 class="h2">${esc(p.name || f.username)}</h2><div class="xs muted">@${esc(f.username)} · ${esc(p.rank || "")} · niv. ${p.level || 1}</div></div></div>
    <div class="grid3 mt">
      <div class="card stat"><div class="v">${p.week.count}</div><div class="l">Séances / sem.</div></div>
      <div class="card stat"><div class="v">${p.streak || 0}</div><div class="l">Jours d'affilée</div></div>
      <div class="card stat"><div class="v">${p.total?.sessions || 0}</div><div class="l">Séances au total</div></div>
    </div>
    ${p.records?.length ? `<div class="section"><h2>Records</h2></div><div class="card" style="padding:4px 16px">${p.records.map(r => `<div class="cmp"><span>${esc(r.n)}</span><span></span><b class="num">${r.kg} kg</b></div>`).join("")}</div>` : ""}
    ${p.recent?.length ? `<div class="section"><h2>Dernières séances</h2></div><div class="card" style="padding:4px 16px">${p.recent.map(s => `<div class="cmp"><span>${esc(s.n)}<br><span class="xs muted">${new Date(s.d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}</span></span><span class="small muted">${fmtNum(s.v)} kg · ${s.s} séries</span>${s.pr ? `<span class="delta p">${s.pr} PR</span>` : "<span></span>"}</div>`).join("")}</div>` : ""}
    <button class="btn btn-ghost btn-block mt" id="rm" style="color:#ff7b88">Retirer de mes amis</button>`);
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
