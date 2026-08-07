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

// v2: Seiten des eingeloggten Bereichs werden nicht mehr gecacht. Die Version
// MUSS mitwandern, sonst bleibt der alte Cache auf Bestandsgeraeten liegen --
// samt der gerenderten Seiten frueherer Nutzer, und genau dagegen ist die
// Aenderung gebaut. activate raeumt jeden Cache, der nicht v2 ist.
const VERSION = "v2";
const PRECACHE = `vendora-precache-${VERSION}`;
const RUNTIME = `vendora-runtime-${VERSION}`;

// Upper bound for the runtime cache. Every deploy ships new content-hashed
// chunks under a new URL, so without a limit the cache would grow with every
// release and never shrink — on a phone that is used a whole market season
// that adds up. Entries are evicted oldest-first (Cache API keys() preserves
// insertion order); everything evicted is re-fetchable while online.
const RUNTIME_MAX_ENTRIES = 150;

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

// Seiten des eingeloggten Bereichs werden nicht zwischengespeichert: ihre
// gerenderte Antwort gehoert zu genau einem Konto. Der Offline-Fall des
// Marktmodus laeuft ueber die IndexedDB-Queue, nicht ueber HTML im Cache.
const PRIVATE_PATHS = [
  "/dashboard", "/orders", "/markets", "/expenses", "/steuer", "/settings", "/admin",
];

// Ausnahme von der Ausnahme: die Kassenseite. Sie ist die einzige Seite, die
// laut offline.html ohne Netz starten koennen muss. Ihre Daten kommen aus dem
// persistierten Abfrage-Cache (lib/offlineCache.ts), das HTML-Geruest von hier.
// Beim Abmelden und beim Loeschen des Kontos wird der Cache geraeumt.
function isRegisterPage(pathname) {
  return /^\/markets\/[^/]+\/kasse\/?$/.test(pathname);
}

function isCacheable(request) {
  const url = new URL(request.url);
  if (isRegisterPage(url.pathname)) return true;
  return !PRIVATE_PATHS.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + "/")
  );
}

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

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(RUNTIME);
      cache
        .put(request, response.clone())
        .then(() => trimCache(cache, RUNTIME_MAX_ENTRIES))
        .catch(() => {});
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
    // Das Schreiben in den Cache steht bewusst NEBEN dem fetch, nicht im
    // selben try: bei vollem Geraetespeicher wirft cache.put, und der catch
    // haette dann die frische Antwort verworfen und stattdessen altes HTML
    // ausgeliefert -- bei einwandfreier Verbindung, dauerhaft.
    if (response && response.ok && response.type === "basic" && isCacheable(request)) {
      cache
        .put(request, response.clone())
        .then(() => trimCache(cache, RUNTIME_MAX_ENTRIES))
        .catch(() => {});
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

  // Die Kasse wird per Soft-Navigation geoeffnet (next/link). Dabei entsteht
  // kein navigate-Request, der Service Worker sieht die Seite also nie und
  // koennte sie nicht ablegen. Die Seite meldet sich deshalb selbst, wenn sie
  // offen ist, und wir holen ihr HTML-Geruest einmal aktiv nach.
  if (event.data && event.data.type === "WARM_SHELL" && typeof event.data.url === "string") {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(RUNTIME);
          const response = await fetch(event.data.url, { credentials: "same-origin" });
          if (response.ok && response.type === "basic") {
            await cache.put(event.data.url, response);
            await trimCache(cache, RUNTIME_MAX_ENTRIES);
          }
        } catch {
          // Kein Netz — beim naechsten Oeffnen erneut versuchen.
        }
      })()
    );
  }
  // Beim Abmelden und beim Loeschen des Kontos raeumt die App den Cache. Sonst
  // ueberlebt die gerenderte Seite des Vorgaengers auf einem geteilten
  // Markt-Tablet jeden Logout: im Flugmodus liefert der Service Worker sie
  // aus, ohne dass je ein Request den Server-Gate erreicht.
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          // Der Precache bleibt: er enthaelt die Offline-Seite und die Icons und
          // wird nur beim install-Event befuellt. Loescht man ihn beim Abmelden,
          // ist die Offline-Seite bis zum naechsten Deploy dauerhaft weg.
          keys.filter((key) => key !== PRECACHE).map((key) => caches.delete(key))
        )
      )
    );
  }
});
