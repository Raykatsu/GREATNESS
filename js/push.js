// Vraies notifications : le téléphone s'abonne, le serveur (Supabase) envoie les rappels de séance et
// les défis entre amis (dépassé au classement, duel…), même app fermée.
import { VAPID_PUBLIC_KEY, SUPABASE_URL } from "./config.js";
import { isOnlineMode, friendCall } from "./cloud.js";
import { reminderPlan } from "./store.js";
import { isNative, nativeReminders, nativeRemindersOff, nativeRemindersOn } from "./native.js";

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// null si possible, sinon la raison
export function pushBlocker() {
  if (isNative()) return null; // app App Store : rappels en notifications locales, sans serveur
  if (!VAPID_PUBLIC_KEY || !isOnlineMode()) return "Les notifications nécessitent les comptes en ligne.";
  if (isIOS() && !standalone()) return "Sur iPhone : ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "Ton navigateur ne gère pas les notifications.";
  return null;
}

// Clé publique du serveur (celle qui signe les envois) ; celle de config.js en secours
let keyP = null;
function serverKey() {
  return (keyP ||= fetch(`${SUPABASE_URL}/functions/v1/reminders`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : {})).then(j => j.publicKey || VAPID_PUBLIC_KEY)
    .catch(() => { keyP = null; return VAPID_PUBLIC_KEY; }));
}

async function currentSub() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function pushEnabled() {
  if (isNative()) return nativeRemindersOn();
  if (pushBlocker() || Notification.permission !== "granted") return false;
  return !!(await currentSub().catch(() => null));
}

// Abonnement avec la bonne clé (un abonnement fait avec une ancienne clé ne recevrait rien)
async function subscribe() {
  const reg = await navigator.serviceWorker.ready, key = await serverKey();
  let sub = await reg.pushManager.getSubscription();
  const old = sub?.options?.applicationServerKey;
  if (sub && old && b64url(old) !== key) { await sub.unsubscribe().catch(() => {}); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await friendCall("gt_push_subscribe", { p_sub: sub.toJSON(), p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  try { localStorage.setItem("greatness.pushAt", String(Date.now())); } catch { /* mode privé */ }
}

export async function enablePush() {
  if (isNative()) { if (!(await nativeReminders(reminderPlan(), true))) throw new Error("Notifications refusées : autorise-les dans Réglages → GREATNESS."); return; }
  const why = pushBlocker();
  if (why) throw new Error(why);
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications refusées : autorise-les dans les réglages du téléphone.");
  await subscribe();
}

// Au lancement : si les notifications sont actives, on revérifie la clé et on renouvelle l'inscription
// auprès du serveur une fois par jour (fuseau horaire à jour, abonnement jamais perdu).
export async function refreshPush() {
  if (isNative()) { if (await nativeRemindersOn()) await nativeReminders(reminderPlan()).catch(() => {}); return; }
  try {
    if (pushBlocker() || Notification.permission !== "granted" || !(await currentSub())) return;
    const at = +localStorage.getItem("greatness.pushAt") || 0, sub = await currentSub(), key = await serverKey();
    const stale = sub.options?.applicationServerKey && b64url(sub.options.applicationServerKey) !== key;
    if (stale || Date.now() - at > 864e5) await subscribe();
  } catch { /* hors ligne : on réessaiera */ }
}

export async function disablePush() {
  if (isNative()) return nativeRemindersOff();
  const sub = await currentSub().catch(() => null);
  if (!sub) return;
  await friendCall("gt_push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
