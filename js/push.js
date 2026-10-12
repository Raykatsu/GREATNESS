// Vraies notifications de rappel : le téléphone s'abonne, le serveur (Supabase) envoie
// un rappel les jours de séance, même app fermée.
import { VAPID_PUBLIC_KEY } from "./config.js";
import { isOnlineMode, friendCall } from "./cloud.js";

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// null si possible, sinon la raison
export function pushBlocker() {
  if (!VAPID_PUBLIC_KEY || !isOnlineMode()) return "Les notifications nécessitent les comptes en ligne.";
  if (isIOS() && !standalone()) return "Sur iPhone : ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "Ton navigateur ne gère pas les notifications.";
  return null;
}

async function currentSub() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function pushEnabled() {
  if (pushBlocker() || Notification.permission !== "granted") return false;
  return !!(await currentSub().catch(() => null));
}

export async function enablePush() {
  const why = pushBlocker();
  if (why) throw new Error(why);
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications refusées : autorise-les dans les réglages du téléphone.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC_KEY) }));
  await friendCall("gt_push_subscribe", { p_sub: sub.toJSON(), p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

export async function disablePush() {
  const sub = await currentSub().catch(() => null);
  if (!sub) return;
  await friendCall("gt_push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
