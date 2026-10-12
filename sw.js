// Cache hors ligne de l'app (le moteur KAREN local marche sans réseau).
const CACHE = "greatness-v7";
const ASSETS = ["./", "index.html", "css/style.css", "assets/icon.svg", "manifest.webmanifest",
  ...["actions", "app", "ai", "auth", "badges", "brain", "cloud", "coach", "config", "create", "data", "engine", "fx", "live", "llm", "llm-worker", "planner", "social", "spidey", "store", "train", "ui"].map(f => `js/${f}.js`)];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
