// « Une idée ? Un souci ? » : un message envoyé depuis l'app (idée, souci ou autre) avec la version, le téléphone et
// l'écran ouvert, pour comprendre vite. Signé du pseudo si tu le veux (compte en ligne), sinon anonyme. Hors réseau,
// il attend et part tout seul au retour de la connexion. L'administrateur de l'app lit les retours (et les
// plantages signalés) ici même : Moi → Réglages → Retours reçus (014_feedback.sql).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { APP_VERSION } from "./version.js";
import { authToken, isOnlineMode, friendCall } from "./cloud.js";
import { currentUser } from "./store.js";
import { $, $$, esc, I, sheet, toast } from "./ui.js";

const QUEUE = "greatness.feedback", SEEN = "greatness.feedback.seen";
export const KINDS = [
  { id: "idea", emoji: "💡", label: "Idée", ph: "Ex : j'aimerais pouvoir noter mes séances de vélo…" },
  { id: "bug", emoji: "🐞", label: "Souci", ph: "Ce que tu faisais, ce qui s'est passé, ce que tu attendais…" },
  { id: "other", emoji: "💬", label: "Autre", ph: "Un mot, une question, un encouragement…" },
];

// Ce qui part au serveur (gt_feedback_add)
export function payload({ kind, text, screen = "", token = null, ua = "", version = APP_VERSION }) {
  return { p_token: token || null, p_kind: KINDS.some(k => k.id === kind) ? kind : "other", p_text: String(text || "").trim().slice(0, 1000),
    p_screen: String(screen).slice(0, 60), p_version: version, p_ua: String(ua).slice(0, 160) };
}

async function send(body) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/gt_feedback_add`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { throw Object.assign(new Error("OFFLINE"), { offline: true }); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error("SERVER"), { offline: r.status >= 500 });
  if (j?.error) throw Object.assign(new Error(j.error), { code: j.error });
  return j;
}

// File d'attente hors réseau (10 messages au plus)
const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE) || "[]"); } catch { return []; } };
const keep = q => { try { q.length ? localStorage.setItem(QUEUE, JSON.stringify(q.slice(-10))) : localStorage.removeItem(QUEUE); } catch { /* mode privé */ } };
let flushing = false;
export async function flushFeedback() {
  if (!isOnlineMode() || flushing || !queue().length) return;
  flushing = true;
  try {
    const left = [];
    for (const b of queue()) { try { await send(b); } catch (e) { if (e.offline) left.push(b); } } // refus définitif : on n'insiste pas
    keep(left);
  } finally { flushing = false; }
}
if (typeof window !== "undefined") addEventListener("online", () => flushFeedback());

export function openFeedback(screen = location.hash || "#/") {
  if (!isOnlineMode()) {
    sheet(`<div class="eyebrow">${I.idea} Une idée ? Un souci ?</div><h2 class="h2">Dis-nous tout</h2>
      <p class="muted small">Sur cette version de l'app (sans serveur), écris-nous sur <a href="https://github.com/Raykatsu/GREATNESS/issues" target="_blank" rel="noopener">la page du projet</a>.</p>`, { z: 80 });
    return;
  }
  const user = currentUser, token = authToken();
  let kind = "idea";
  const sh = sheet(`<div class="eyebrow">${I.idea} Une idée ? Un souci ?</div><h2 class="h2">Dis-nous tout</h2>
    <p class="muted small">Une idée d'amélioration, un bug, un truc pas clair : chaque message est lu.</p>
    <div class="seg fb-kind mt" role="radiogroup" aria-label="Type de message">${KINDS.map(k => `<button role="radio" data-k="${k.id}" aria-checked="${k.id === kind}" class="${k.id === kind ? "on" : ""}">${k.emoji} ${k.label}</button>`).join("")}</div>
    <label class="field mt"><span>Ton message</span><textarea class="input" id="fb-text" rows="5" maxlength="1000" placeholder="${esc(KINDS[0].ph)}"></textarea></label>
    ${user && token ? `<label class="toggle mt-s"><div><b>Signer avec @${esc(user)}</b><span class="xs muted">Pour qu'on puisse te répondre</span></div><input type="checkbox" id="fb-sign" checked/></label>` : ""}
    <p class="xs muted mt-s">Envoyé avec la version de l'app (${esc(APP_VERSION)}), le modèle de téléphone et l'écran ouvert, pour comprendre plus vite.</p>
    <p class="err" id="fb-err"></p>
    <button class="btn btn-primary btn-lg btn-block" id="fb-send">${I.send} Envoyer</button>`, { z: 80 });
  const text = $("#fb-text", sh.el), err = $("#fb-err", sh.el);
  $$(".fb-kind button", sh.el).forEach(b => b.onclick = () => {
    kind = b.dataset.k;
    $$(".fb-kind button", sh.el).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
    text.placeholder = KINDS.find(k => k.id === kind).ph;
    text.focus();
  });
  $("#fb-send", sh.el).onclick = async () => {
    if (text.value.trim().length < 3) { err.textContent = "Écris quelques mots."; return text.focus(); }
    const body = payload({ kind, text: text.value, screen, token: $("#fb-sign", sh.el)?.checked ? token : null, ua: navigator.userAgent });
    const b = $("#fb-send", sh.el);
    b.disabled = true;
    try {
      await send(body);
      sh.close(); toast("Merci ! Message envoyé ✓", 3000);
    } catch (e) {
      if (e.offline) { keep([...queue(), body]); sh.close(); toast("Pas de réseau : ton message partira tout seul au retour de la connexion.", 4500); }
      else { err.textContent = e.code === "LIMIT" ? "Beaucoup de messages aujourd'hui : réessaie demain." : "Envoi impossible pour l'instant. Réessaie plus tard."; b.disabled = false; }
    }
  };
  setTimeout(() => text.focus(), 350);
}

/* ---------- Administrateur : retours reçus et plantages ---------- */
let admin = null; // { user, ok }
export async function isAdmin() {
  if (!isOnlineMode() || !currentUser) return false;
  if (admin?.user === currentUser) return admin.ok;
  try { admin = { user: currentUser, ok: !!(await friendCall("gt_is_admin")).admin }; } catch { return false; }
  return admin.ok;
}
const seenAt = () => { try { return +localStorage.getItem(SEEN) || 0; } catch { return 0; } };
const when = t => new Date(t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const device = ua => (/iPhone/.test(ua) ? `iPhone, iOS ${(ua.match(/OS (\d+)[._](\d+)/) || []).slice(1, 3).join(".")}` : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "");

// Nombre de retours pas encore vus (pour la pastille du réglage)
export async function unseenFeedback() {
  if (!(await isAdmin())) return 0;
  try { const r = await friendCall("gt_feedback_list", { p_limit: 60 }); return (r.feedback || []).filter(f => f.at > seenAt()).length; } catch { return 0; }
}

export async function openInbox() {
  const sh = sheet(`<div class="eyebrow">${I.idea} Administrateur</div><h2 class="h2">Retours reçus</h2>
    <div class="seg mt" id="fb-tabs"><button data-t="fb" class="on">Retours</button><button data-t="err">Plantages</button></div>
    <div id="fb-box" class="mt"><div class="center"><i class="spinner"></i></div></div>`, { z: 80 });
  const box = $("#fb-box", sh.el);
  let data;
  try { data = await friendCall("gt_feedback_list", { p_limit: 100 }); }
  catch (e) { box.innerHTML = `<p class="muted small">${esc(e.message || "Liste indisponible.")}</p>`; return; }
  const seen = seenAt();
  try { localStorage.setItem(SEEN, String(Date.now())); } catch { /* mode privé */ }
  const fb = () => (data.feedback || []).length ? (data.feedback || []).map(f => `<article class="card fb-item ${f.at > seen ? "new" : ""}">
      <div class="row between"><b>${KINDS.find(k => k.id === f.kind)?.emoji || "💬"} ${f.username ? `@${esc(f.username)}` : "Anonyme"}</b><span class="xs muted">${esc(when(f.at))}</span></div>
      <p class="fb-msg">${esc(f.msg)}</p>
      <span class="xs muted">${[f.screen, f.version, device(f.ua || "")].filter(Boolean).map(esc).join(" · ")}</span></article>`).join("")
    : `<div class="card empty">${I.idea}<b>Aucun retour pour l'instant</b>Les messages envoyés depuis « Une idée ? Un souci ? » arrivent ici.</div>`;
  const errs = () => (data.errors || []).length ? (data.errors || []).map(e => `<article class="card fb-item">
      <div class="row between"><b>×${e.count} · ${esc(e.place || "?")}</b><span class="xs muted">${esc(when(e.last_at))}</span></div>
      <p class="fb-msg mono">${esc(e.msg)}</p><span class="xs muted">${esc(e.version || "")}</span></article>`).join("")
    : `<div class="card empty">${I.check}<b>Aucun plantage ces 14 derniers jours</b>Les erreurs de l'app sur les téléphones arrivent ici.</div>`;
  box.innerHTML = fb();
  $$("#fb-tabs button", sh.el).forEach(b => b.onclick = () => {
    $$("#fb-tabs button", sh.el).forEach(x => x.classList.toggle("on", x === b));
    box.innerHTML = b.dataset.t === "err" ? errs() : fb();
  });
}
