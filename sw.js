// Cache hors ligne de l'app (le coach local marche sans réseau).
const CACHE = "greatness-v27";
const ASSETS = ["./", "index.html", "css/style.css", "assets/icon.svg", "manifest.webmanifest",
  "assets/fonts/inter-latin-wght.woff2", "assets/fonts/outfit-latin-wght.woff2",
  ...["actions", "ai", "anim", "app", "auth", "badges", "brain", "cam", "cloud", "coach", "config", "create", "data", "engine", "fx", "live", "llm", "llm-worker", "merge", "motion", "planner", "push", "social", "mascot", "store", "train", "ui", "voice", "coach-picker", "chars/index", "chars/kit", "chars/base", "online", "foods", "nutrition", "off", "scan", "food", "demo", "memory", "aiact", "weekly", "review", "form", "chart", "records", "photos", "rivals", "body", "moves", "recovery", "recovery-ui", "adaptive", "mealplan", "mealplan-ui", "intervals", "intervals-ui", "goals", "goals-ui", "league", "health", "health-ui", "importer", "import-ui", "vbt", "videocoach", "resttimer", "native", "costumes", "story", "story-ui", "duo", "errors", "version", "bio", "feedback", "sharecard", "classics", "classics-ui", "widgetdata", "i18n", "lang/en"].map(f => `js/${f}.js`)];
// Univers de coachs chargés à la demande : mis en cache s'ils existent, sans bloquer l'installation.
const OPTIONAL = ["salle", "sports", "nature", "zen", "compagnons"].map(f => `js/chars/${f}.js`);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([c.addAll(ASSETS), ...OPTIONAL.map(u => c.add(u).catch(() => {}))])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API Anthropic, polices : réseau direct
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

/* ---------- Rappels (Web Push) ---------- */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = { body: e.data?.text() }; }
  // fin du repos (tag « rest ») : on revient simplement dans la séance en cours, sans changer de page
  const rest = d.tag === "rest";
  e.waitUntil(self.registration.showNotification(d.title || "GREATNESS", {
    body: d.body || "C'est l'heure de ta séance !",
    icon: "assets/icon.svg", badge: "assets/icon.svg", tag: rest ? "greatness-repos" : "greatness-rappel", renotify: true,
    ...(rest ? { vibrate: [200, 100, 200, 100, 300] } : {}),
    data: { url: rest ? null : d.url || "./" },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = e.notification.data?.url, url = new URL(target || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (!w) return clients.openWindow(url);
    return target ? w.focus().then(c => c.navigate?.(url)) : w.focus();
  }));
});
