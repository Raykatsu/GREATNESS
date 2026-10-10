// Cache hors ligne de l'app (le moteur KAREN local marche sans réseau).
const CACHE = "greatness-v2";
const ASSETS = ["./", "index.html", "css/style.css", "js/app.js", "js/data.js", "js/store.js", "js/engine.js", "js/ai.js", "js/fx.js", "assets/icon.svg", "manifest.webmanifest"];

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
