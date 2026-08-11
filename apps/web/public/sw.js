const CACHE = "motivelife-shell-v7";
const SHELL = ["/", "/login", "/register", "/dashboard"];
/** Cap cached navigations so the PWA shell cannot grow without bound. */
const MAX_NAV_ENTRIES = 12;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function putNavAndTrim(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  // Keep shell URLs; trim oldest extras beyond MAX_NAV_ENTRIES.
  const shellSet = new Set(SHELL.map((p) => new URL(p, self.location.origin).href));
  const extras = keys.filter((req) => !shellSet.has(req.url));
  const overflow = extras.length - Math.max(0, MAX_NAV_ENTRIES - SHELL.length);
  if (overflow > 0) {
    for (let i = 0; i < overflow; i++) {
      const stale = extras[i];
      if (stale) await cache.delete(stale);
    }
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Next.js assets — doing so breaks CSS/JS in dev and prod.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/brand/")
  ) {
    return;
  }

  // Network-first for navigations only; let the browser handle everything else.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void putNavAndTrim(request, copy);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match("/");
        if (fallback) return fallback;
        return Response.error();
      })
  );
});
