/*
 * Vendora service worker (Phase 3.1).
 *
 * Hand-written on purpose: the recommended offline plugin (Serwist) currently
 * needs a webpack config, but Next.js 16 builds with Turbopack. A small SW keeps
 * us dependency-free and Turbopack-compatible.
 *
 * Strategy:
 *  - Precache a tiny, always-available app shell (offline fallback + icons).
 *  - Static, content-hashed build assets (/_next/static, icons, fonts, images):
 *    cache-first — they are immutable, so a cache hit is always correct.
 *  - Navigation requests (HTML): network-first, falling back to the last cached
 *    response and finally the offline page. This lets the client app boot offline
 *    and read from its own persisted state / the offline sale queue (IndexedDB).
 *  - /api/*: NEVER handled by the SW. Offline behaviour comes from the offline
 *    queue + TanStack Query, not from an HTTP cache — a cached API response would
 *    show stale sales / financial figures.
 */

const VERSION = "v1";
const PRECACHE = `vendora-precache-${VERSION}`;
const RUNTIME = `vendora-runtime-${VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
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

  // Never cache API traffic (offline handled by the queue, not an HTTP cache).
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
    if (response && response.ok && response.type === "basic") {
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
    if (response && response.ok && response.type === "basic") {
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

// Allow the page to trigger an immediate SW activation after an update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
