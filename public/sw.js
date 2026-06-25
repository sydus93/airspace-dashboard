// Minimal app-shell service worker. Live data (/api/*) is NEVER cached — it must
// always hit the network so traffic/weather/audio stay real-time. Same-origin
// static assets are cached network-first so the shell opens offline.

const CACHE = "airspace-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // never intercept the live data / audio proxy
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (url.origin === self.location.origin && res && res.ok && res.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const root = await caches.match("/");
          if (root) return root;
        }
        throw new Error("offline and uncached");
      }
    })()
  );
});
