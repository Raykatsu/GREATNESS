// L'app installée depuis l'App Store (Capacitor) : mêmes écrans que la version web, plus ce que seul le natif
// permet. Fin du repos en notification locale (même hors connexion), vibrations du téléphone, et Apple Santé lu
// directement (HealthKit), sans Raccourci. Dans un navigateur, tout ceci est simplement absent.
const C = () => (typeof window !== "undefined" ? window.Capacitor : null);
export const isNative = () => !!C()?.isNativePlatform?.();
const plugin = name => { const c = C(); return c?.Plugins?.[name] || c?.registerPlugin?.(name) || null; };

/* ---------- Version App Store : pas de nom ni de personnage sous licence (règle 5.2 d'Apple) ---------- */
const STORE_NAMES = { spider: { name: "Tisseur", bio: "Le héros du quartier : agile, blagueur et toujours là pour ta série suivante." } };
export const STORE_HIDDEN = new Set(["harley"]);
export const storeSafe = c => (isNative() && STORE_NAMES[c?.id] ? { ...c, ...STORE_NAMES[c.id] } : c);
export const storeHidden = id => isNative() && STORE_HIDDEN.has(id);
export const storeText = t => (isNative() ? String(t).replace(/Spider-Man/g, "Tisseur") : t);

/* ---------- Notifications locales (fin du repos) ---------- */
const REST_ID = 4242;
export async function nativeRestAlert(atMs, title, body) {
  const N = isNative() && plugin("LocalNotifications");
  if (!N) return false;
  try {
    const p = await N.checkPermissions();
    if (p.display !== "granted" && (await N.requestPermissions()).display !== "granted") return false;
    await N.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {});
    await N.schedule({ notifications: [{ id: REST_ID, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true }, sound: "default" }] });
    return true;
  } catch { return false; }
}
export async function nativeRestCancel() {
  const N = isNative() && plugin("LocalNotifications");
  if (N) await N.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {});
}

/* ---------- Rappels de séance (notifications locales, chaque semaine) ---------- */
const REMIND_IDS = [101, 102, 103, 104, 105, 106, 107]; // lundi … dimanche
// plan : { at: "18:00", before: 15, days: { "0": "Push", … (0 = lundi) } }
export async function nativeReminders(plan, ask = false) {
  const N = isNative() && plugin("LocalNotifications");
  if (!N) return false;
  let p = await N.checkPermissions();
  if (p.display !== "granted" && ask) p = await N.requestPermissions();
  if (p.display !== "granted") return false;
  await N.cancel({ notifications: REMIND_IDS.map(id => ({ id })) }).catch(() => {});
  const [h, m] = String(plan.at || "18:00").split(":").map(Number), t = h * 60 + m - (+plan.before || 0);
  const at = ((t % 1440) + 1440) % 1440, prevDay = t < 0;
  const list = Object.entries(plan.days || {}).map(([d, name]) => {
    const dow = (+d + (prevDay ? 6 : 0)) % 7; // la veille si l'alerte tombe avant minuit
    return { id: REMIND_IDS[+d], title: `Séance du jour : ${name}`, body: plan.before ? `On commence dans ${plan.before} min. Prépare-toi !` : "C'est l'heure. On y va ?",
      schedule: { on: { weekday: ((dow + 1) % 7) + 1, hour: Math.floor(at / 60), minute: at % 60 }, allowWhileIdle: true } }; // Capacitor : 1 = dimanche
  });
  if (list.length) await N.schedule({ notifications: list });
  return true;
}
export async function nativeRemindersOff() {
  const N = isNative() && plugin("LocalNotifications");
  if (N) await N.cancel({ notifications: REMIND_IDS.map(id => ({ id })) }).catch(() => {});
}
export async function nativeRemindersOn() {
  const N = isNative() && plugin("LocalNotifications");
  if (!N) return false;
  try { const { notifications } = await N.getPending(); return notifications.some(n => REMIND_IDS.includes(+n.id)); } catch { return false; }
}

/* ---------- Vibrations ---------- */
export function nativeHaptic(kind = "light") {
  const H = isNative() && plugin("Haptics");
  if (!H) return false;
  if (kind === "success" || kind === "warning") H.notification({ type: kind.toUpperCase() }).catch(() => {});
  else H.impact({ style: kind === "heavy" ? "HEAVY" : kind === "medium" ? "MEDIUM" : "LIGHT" }).catch(() => {});
  return true;
}

/* ---------- Apple Santé (HealthKit) ---------- */
const READ = ["sleep", "heartRateVariability", "restingHeartRate", "steps", "weight", "calories"];
const iso = t => new Date(t).toISOString();
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const nativeHealthAvailable = async () => { const H = isNative() && plugin("Health"); if (!H) return false; try { return !!(await H.isAvailable()).available; } catch { return false; } };
export async function nativeHealthAuthorize() {
  const H = plugin("Health");
  await H.requestAuthorization({ read: READ, write: [] });
}

// Mesures des `days` derniers jours, au même format que le serveur : [{ day, data: { sleep, hrv, rhr, steps, weight, kcal }, at }]
export async function nativeHealthRead(days = 35, now = Date.now()) {
  const H = plugin("Health");
  if (!H) return [];
  const start = now - days * 864e5, out = {};
  const put = (day, k, v) => { if (Number.isFinite(v)) (out[day] ||= {})[k] = v; };
  const safe = p => p.then(r => r?.samples || []).catch(() => []);
  const [sleep, hrv, rhr, steps, weight, kcal] = await Promise.all([
    safe(H.readSamples({ dataType: "sleep", startDate: iso(start), endDate: iso(now), limit: 2000 })),
    safe(H.readSamples({ dataType: "heartRateVariability", startDate: iso(start), endDate: iso(now), limit: 2000 })),
    safe(H.queryAggregated({ dataType: "restingHeartRate", startDate: iso(start), endDate: iso(now), bucket: "day", aggregation: "average" })),
    safe(H.queryAggregated({ dataType: "steps", startDate: iso(start), endDate: iso(now), bucket: "day", aggregation: "sum" })),
    safe(H.queryAggregated({ dataType: "weight", startDate: iso(start), endDate: iso(now), bucket: "day", aggregation: "average" })),
    safe(H.queryAggregated({ dataType: "calories", startDate: iso(start), endDate: iso(now), bucket: "day", aggregation: "sum" })),
  ]);
  // sommeil : la nuit compte pour le jour du réveil (phases endormies seulement, en minutes) ; montre et téléphone
  // enregistrent souvent la même nuit : on garde la source la plus complète au lieu d'additionner
  const night = {};
  for (const s of sleep) {
    if (["inBed", "awake"].includes(s.sleepState) || !s.endDate) continue;
    const d = (night[dayKey(s.endDate)] ||= {}), src = s.sourceId || s.sourceName || "?";
    d[src] = (d[src] || 0) + (+s.value || 0);
  }
  for (const [d, by] of Object.entries(night)) { const min = Math.max(...Object.values(by)); if (min >= 30) put(d, "sleep", Math.round((min / 60) * 10) / 10); }
  // VFC : moyenne des mesures du jour
  const h = {};
  for (const s of hrv) if (+s.value > 0) (h[dayKey(s.startDate)] ||= []).push(+s.value);
  for (const [d, vs] of Object.entries(h)) put(d, "hrv", Math.round(vs.reduce((a, v) => a + v, 0) / vs.length));
  for (const s of rhr) if (+s.value > 0) put(dayKey(s.startDate), "rhr", Math.round(+s.value));
  for (const s of steps) if (+s.value > 0) put(dayKey(s.startDate), "steps", Math.round(+s.value));
  for (const s of weight) if (+s.value > 0) put(dayKey(s.startDate), "weight", Math.round(+s.value * 10) / 10);
  for (const s of kcal) if (+s.value > 0) put(dayKey(s.startDate), "kcal", Math.round(+s.value));
  return Object.entries(out).map(([day, data]) => ({ day, data, at: new Date(now).toISOString() }));
}
