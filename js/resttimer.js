// Fin du repos sur l'écran verrouillé. Quand le téléphone se verrouille (ou que tu changes d'app) pendant un
// repos, l'app demande au serveur de t'envoyer « Repos terminé » à la seconde près (notification Web Push, même
// app fermée) ; si tu reviens avant, l'alerte est annulée. Dans l'app App Store : notification locale, sans réseau.
import { SUPABASE_URL } from "./config.js";
import { isOnlineMode, authToken, friendCall } from "./cloud.js";
import { state } from "./store.js";
import { isNative, nativeRestAlert, nativeRestCancel } from "./native.js";

let getRest = null, endpoint = null, armed = null;
const rid = () => `rest-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const restAlertsOn = () => state.profile?.restAlert !== false;

// Abonnement push de ce téléphone (lu à l'avance : au verrouillage, il faut envoyer tout de suite)
export async function prepareRestAlerts() {
  if (isNative() || !restAlertsOn() || !isOnlineMode() || !authToken()) return;
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    endpoint = sub?.endpoint || null;
  } catch { endpoint = null; }
}

// La séance en direct dit où en est le repos : () => ({ end, title, body }) ou null
export function watchRest(getter) { getRest = getter; prepareRestAlerts(); }
export function unwatchRest() { getRest = null; if (armed) cancel(); }

function send(payload) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/reminders`, body = JSON.stringify(payload);
  // texte brut : pas de vérification préalable du navigateur, et l'envoi part même si la page s'endort
  if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

function arm() {
  const r = getRest?.();
  if (!r || !restAlertsOn()) return;
  const left = r.end - Date.now();
  if (left < 4000) return;
  const id = rid();
  if (isNative()) { nativeRestAlert(r.end, r.title, r.body); armed = { id, end: r.end, native: true }; return; }
  if (!endpoint || !authToken()) return;
  send({ token: authToken(), timer: { id, endpoint, in: Math.round(left), title: r.title, body: r.body } });
  armed = { id, end: r.end };
}
function cancel() {
  const a = armed;
  armed = null;
  if (!a || Date.now() >= a.end - 1000) return; // déjà envoyée : rien à annuler
  if (a.native) { nativeRestCancel(); return; }
  friendCall("gt_timer_cancel", { p_id: a.id }).catch(() => send({ token: authToken(), timer: { id: a.id, cancel: true } }));
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!getRest) return;
    if (document.visibilityState === "hidden") { if (!armed) arm(); }
    else if (armed) cancel();
  });
  // iPhone : « pagehide » arrive parfois sans « visibilitychange » (app balayée)
  addEventListener("pagehide", () => { if (getRest && !armed) arm(); });
}
