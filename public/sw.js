/*
 * Vendora minimal service worker (Phase 3.3 / 3.4).
 *
 * Strategy:
 *  - Precache a small, always-available app shell (offline fallback + icons).
 *  - Static, content-hashed build assets (/_next/static, icons, fonts, images):
 *    cache-first — they are immutable, so a cache hit is always correct.
 *  - Navigation requests (HTML): network-first, falling back to the last cached
 *    response and finally the offline page.
 *  - /api/*: NEVER handled by the SW. Offline behaviour comes from the offline
 *    queue and TanStack Query, not from an HTTP cache — a cached API response
 *    would show stale sales figures.
 */

const VERSION = "v1";
const PRECACHE = `vendora-precache-${VERSION}`;
const RUNTIME = `vendora-runtime-${VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only same-origin requests are handled by the SW.
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic (offline handled by the queue, not HTTP cache).
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline.html");
    return offline || Response.error();
  }
}
