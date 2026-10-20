// Séance en duo à distance : tu crées une salle (un code de 6 caractères à envoyer à un ami) ou tu rejoins la
// sienne. Pendant la séance, chacun voit où en est l'autre (exercice, série, charge, repos), est prévenu quand
// l'autre valide une série ou bat un record, et peut l'encourager d'un émoji. Mise à jour toutes les 4 s.
import { isOnlineMode, friendCall, MESSAGES } from "./cloud.js";
import { vibrate } from "./fx.js";
import { $, esc, I, sheet, toast } from "./ui.js";
import { LOC, tr } from "./i18n.js";

const KEY = "greatness.duo";
Object.assign(MESSAGES, { NO_ROOM: "Code inconnu ou duo terminé.", FULL: "Ce duo est déjà complet.", NOT_MEMBER: "Tu ne fais pas partie de ce duo.", BAD_EMOJI: "Encouragement inconnu." });
export const CHEERS = ["🔥", "💪", "👏", "😤", "🏆", "❤️"];
let duo = load(), timer = null, getMine = null, onUpdate = null, busy = false;

function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && d.exp > Date.now() ? d : null; } catch { return null; } }
function keep() { try { duo ? localStorage.setItem(KEY, JSON.stringify(duo)) : localStorage.removeItem(KEY); } catch { /* mode privé */ } }
export const duoActive = () => !!duo;
export const duoState = () => duo;
export const duoAvailable = () => isOnlineMode();

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const PAIR = svg('<circle cx="8.5" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M2.5 20c0-3.4 2.7-6 6-6s6 2.6 6 6M14.5 14.6c3.2-.4 6.5 1.6 7 5.4"/>');
const ago = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 8 ? "à l'instant" : s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`; };
const kg = w => String(w).replace(".", ",");

// Ce que voit le partenaire de ma séance : { ex, set, of, w, r, done, rest, fin, vol, min }
export function duoBarHtml() {
  if (!duo) return "";
  const p = duo.partner, s = duo.state;
  const what = !p ? `<b>Salle ${esc(duo.code)}</b><span class="xs muted">En attente de ton partenaire…</span>`
    : !s?.at ? `<b>${esc(p)}</b><span class="xs muted">Vient d'arriver, pas encore de série</span>`
    : s.fin ? `<b>${esc(p)} a terminé 🎉</b><span class="xs muted">${s.min ? `${s.min} min` : ""}${s.vol ? ` · ${s.vol.toLocaleString(LOC())} kg` : ""}</span>`
    : `<b>${esc(p)} · ${esc(s.ex || "Séance")}</b><span class="xs muted">${s.rest && s.rest > Date.now() ? "En repos" : `Série ${s.set || 1}${s.of ? `/${s.of}` : ""}`}${s.r ? ` · dernière ${s.w ? `${kg(s.w)} kg × ` : ""}${s.r}` : ""} · ${ago(s.at)}</span>`;
  return `<div class="duo-bar" role="status" aria-live="polite"><span class="duo-ic">${PAIR}</span><span class="grow">${what}</span>
    ${p ? `<span class="duo-cheers">${CHEERS.slice(0, 3).map(e => `<button data-cheer="${e}" aria-label="Encourager ${esc(p)} : ${e}">${e}</button>`).join("")}</span>` : ""}</div>`;
}
export function bindDuoBar(root) {
  root?.querySelectorAll("[data-cheer]").forEach(b => b.onclick = () => cheer(b.dataset.cheer));
}
const paint = () => { const box = document.getElementById("duo-bar"); if (box) { box.innerHTML = duoBarHtml(); bindDuoBar(box); } };

async function cheer(e) {
  if (!duo) return;
  vibrate(8);
  try { await friendCall("gt_duo_cheer", { p_code: duo.code, p_emoji: e }); toast(`${e} envoyé à ${duo.partner}`); } catch { toast("Pas de réseau : réessaie."); }
}

// Démarrer la synchro pendant la séance : getMine() donne mon état ; update() quand l'autre bouge
export function startDuo(mine, update) {
  getMine = mine; onUpdate = update;
  clearInterval(timer);
  if (!duo) return;
  tick();
  timer = setInterval(() => { if (document.visibilityState !== "hidden") tick(); }, 4000);
}
export function stopDuo() { clearInterval(timer); timer = null; getMine = null; onUpdate = null; }

async function tick(final = false) {
  if (!duo || busy) return;
  busy = true;
  try {
    const r = await friendCall("gt_duo_sync", { p_code: duo.code, p_state: getMine?.() || null, p_after: duo.after || 0 });
    const before = duo.state, wasAlone = !duo.partner;
    duo.partner = r.partner; duo.state = r.state; duo.after = Math.max(duo.after || 0, r.seq || 0); duo.exp = r.expires || duo.exp;
    keep();
    if (wasAlone && r.partner) { toast(`👥 ${r.partner} a rejoint ton duo !`, 3500); vibrate([30, 40, 30]); }
    for (const ev of r.events || []) {
      if (ev.e === "join" || ev.e === "bye") { if (ev.e === "bye") toast("Ton partenaire a quitté le duo."); continue; }
      toast(`${ev.e} ${r.partner || "Ton partenaire"} t'encourage !`, 2600); vibrate(20); floatEmoji(ev.e);
    }
    // série validée ou record de l'autre
    const s = r.state;
    if (!final && s && before && s.done > (before.done || 0)) {
      const pr = (s.prs || 0) > (before.prs || 0);
      toast(`👥 ${r.partner} a validé sa série : ${s.w ? `${kg(s.w)} kg × ` : ""}${s.r}${pr ? " · nouveau record ! 🏆" : ""}`, 3200);
      vibrate(pr ? [30, 40, 80] : 15);
    }
    if (s?.fin && !before?.fin) toast(`🎉 ${r.partner} a terminé sa séance !`, 3500);
    paint(); onUpdate?.();
  } catch (e) {
    // salle fermée ou expirée : on la quitte ; sinon (hors ligne) on réessaiera
    if (e?.code === "NO_ROOM" || e?.code === "NOT_MEMBER") { toast(`Le duo ${duo.code} est terminé.`); leaveLocal(); }
  } finally { busy = false; }
}

function floatEmoji(e) {
  const el = document.createElement("div");
  el.className = "duo-float"; el.textContent = e; el.setAttribute("aria-hidden", "true");
  el.style.left = `${20 + Math.random() * 60}%`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// Fin de ma séance : dernier état (terminé, minutes, volume), puis on quitte la salle
export async function finishDuo(summary) {
  if (!duo) return;
  try { await friendCall("gt_duo_sync", { p_code: duo.code, p_state: { fin: true, min: Math.round((summary?.durationSec || 0) / 60), vol: Math.round(summary?.volume || 0) }, p_after: duo.after || 0 }); } catch { /* rien */ }
  stopDuo();
  await leave(false);
}
function leaveLocal() { duo = null; keep(); stopDuo(); paint(); }
export async function leave(say = true) {
  const d = duo;
  leaveLocal();
  if (d) { try { await friendCall("gt_duo_leave", { p_code: d.code }); } catch { /* rien */ } }
  if (say) toast("Duo quitté.");
}

/* ---------- Créer ou rejoindre ---------- */
export function openDuo(onReady) {
  if (!isOnlineMode()) { toast("Le duo à distance passe par ton compte en ligne."); return; }
  const sh = sheet(`<div class="eyebrow">${PAIR} Duo à distance</div><h2 class="h2">S'entraîner à deux, chacun chez soi</h2>
    <div id="duo-body" class="mt-s"></div>`, { z: 80 });
  const body = $("#duo-body", sh.el);
  const draw = () => {
    if (duo) {
      body.innerHTML = `<p class="muted small">${duo.partner ? `Tu es en duo avec <b>${esc(duo.partner)}</b>.` : "Envoie ce code à ton partenaire : il le tape dans « Rejoindre un duo »."}</p>
        <div class="duo-code" aria-label="Code du duo">${esc(duo.code).split("").map(c => `<span>${c}</span>`).join("")}</div>
        <div class="grid2 mt"><button class="btn btn-primary" id="duo-share">${I.send} Envoyer le code</button><button class="btn btn-soft" id="duo-ok">${I.check} C'est bon</button></div>
        <button class="btn btn-ghost btn-sm danger mt-s" id="duo-quit">${I.x} Quitter le duo</button>`;
      $("#duo-share", body).onclick = async () => {
        const text = tr(`On s'entraîne en duo sur GREATNESS ? Ouvre ta séance, touche « Duo » et tape le code ${duo.code}`);
        try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Invitation copiée ✓"); } } catch { /* partage annulé */ }
      };
      $("#duo-ok", body).onclick = () => sh.close();
      $("#duo-quit", body).onclick = async () => { await leave(); sh.close(); onReady?.(); };
      return;
    }
    body.innerHTML = `<p class="muted small">Chacun voit où en est l'autre (exercice, série, charge, repos), est prévenu à chaque série validée et peut l'encourager.</p>
      <button class="btn btn-primary btn-block mt" id="duo-new">${I.plus} Créer un duo</button>
      <div class="duo-join mt"><label class="field"><span>Rejoindre un duo</span><input class="input" id="duo-in" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="Code à 6 caractères"/></label>
        <button class="btn btn-soft" id="duo-go">Rejoindre</button></div><p class="err" id="duo-err"></p>`;
    $("#duo-new", body).onclick = async () => {
      try { const r = await friendCall("gt_duo_create"); duo = { code: r.code, role: "host", partner: null, state: null, after: 0, exp: Date.now() + 4 * 3600e3 }; keep(); onReady?.(); draw(); }
      catch (e) { $("#duo-err", body).textContent = e.message || "Impossible pour l'instant."; }
    };
    $("#duo-go", body).onclick = async () => {
      const code = $("#duo-in", body).value.trim().toUpperCase();
      if (code.length !== 6) return ($("#duo-err", body).textContent = "Le code fait 6 caractères.");
      try {
        const r = await friendCall("gt_duo_join", { p_code: code });
        duo = { code: r.code, role: r.role, partner: r.partner, state: null, after: 0, exp: Date.now() + 4 * 3600e3 };
        keep(); onReady?.(); sh.close(); toast(`👥 En duo avec ${r.partner || "ton partenaire"} !`);
      } catch (e) { $("#duo-err", body).textContent = e.message || "Impossible pour l'instant."; }
    };
  };
  draw();
}
