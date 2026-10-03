// Dekka's service worker: push (PLAN/LOG_SIGN_AUTH_IN.md §6) plus the
// installable app's offline fallback and asset caching (PLAN/DEKKA_PWA_APP.md §2).
//
// Registered for every visitor by `components/ServiceWorkerRegistrar.tsx`, and
// again (idempotently) by `components/PushOptIn.tsx` when someone opts into push.
//
// Plain JS, not TypeScript: this file is served as-is from `/sw.js` (the
// Next.js build does not process anything under `public/`), so it has to run
// unmodified in the browser. `next.config.ts` serves it `no-cache` so a deploy
// that changes it reaches browsers on their next visit.
//
// THE RULE THIS FILE EXISTS TO KEEP: nothing user- or role-specific is ever
// written to a cache. Every page here is `force-dynamic` and per-user (who is
// signed in, live spots left), so a cached page would show a stale count or
// someone else's account. Pages are therefore never cached at all — offline,
// a navigation gets the generic `/offline` page instead. Only content-addressed
// static files, images, and (from the menu phase) the public `GET /api/menu`
// are cached, and `/admin` + `/staff` are never touched.

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

// `lib/pwa.ts` registers `/sw.js?cache=off` under `next dev`, whose chunks are
// not content-hashed: cache-first there would serve stale code after every edit.
const CACHING = new URL(self.location.href).searchParams.get("cache") !== "off";

// Bump when the caching *rules* change. Old `dekka-*` caches are deleted on
// activate. Asset URLs are content-hashed, so a normal deploy needs no bump.
const VERSION = "v1";
const OFFLINE_CACHE = `dekka-offline-${VERSION}`;
const STATIC_CACHE = `dekka-static-${VERSION}`;
const IMAGE_CACHE = `dekka-images-${VERSION}`;
const DATA_CACHE = `dekka-data-${VERSION}`;
const CURRENT_CACHES = [OFFLINE_CACHE, STATIC_CACHE, IMAGE_CACHE, DATA_CACHE];

// Ceilings so a long-lived install can't grow without bound. Oldest go first.
const STATIC_MAX_ENTRIES = 300;
const IMAGE_MAX_ENTRIES = 120;

const OFFLINE_URL = "/offline";
// The offline page uses a plain <img> for the logo (not next/image), so this
// exact URL is the one it asks for.
const OFFLINE_EXTRAS = ["/brand/dekka-logo.png"];

// Back-office: never intercepted, so nothing from it can land in a cache.
const PRIVATE_PREFIXES = ["/admin", "/staff"];

const IMAGE_PREFIXES = ["/_next/image", "/brand/", "/icons/", "/uploads/"];
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|ico|avif)$/i;

function isPrivate(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isImage(pathname) {
  return IMAGE_PREFIXES.some((p) => pathname.startsWith(p)) || IMAGE_EXTENSION.test(pathname);
}

/**
 * Stores the offline page together with every `/_next/static` file its HTML
 * references, in one cache. They have to travel together: the page's CSS and
 * scripts are content-hashed per deploy, and a page whose stylesheet was evicted
 * would render unstyled exactly when someone is already having a bad time.
 *
 * Best effort by design. If this fails (offline at install, a 500), the worker
 * still installs — push must never depend on it — and `activate` tries again.
 */
async function precacheOffline() {
  const cache = await caches.open(OFFLINE_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`offline page answered ${response.status}`);

  const html = await response.clone().text();
  // Matches both plain attributes and the JSON-escaped copies in the RSC
  // payload; the character class stops at quotes, whitespace and backslashes.
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];

  await cache.put(OFFLINE_URL, response);
  // One by one rather than `addAll`, which rejects the lot if any single
  // file fails — a missing font is no reason to lose the stylesheet.
  await Promise.allSettled([...OFFLINE_EXTRAS, ...assets].map((url) => cache.add(url)));
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // `keys()` returns insertion order, so the front of the list is the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((k) => cache.delete(k)));
}

/** Content-hashed assets and images: answer from cache, fill it on a miss. */
async function cacheFirst(event, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  if (hit) return hit;

  const response = await fetch(event.request);
  // `basic` = same-origin and readable; never cache an error or an opaque body.
  if (response.ok && response.type === "basic") {
    event.waitUntil(
      cache.put(event.request, response.clone()).then(() => trimCache(cacheName, maxEntries))
    );
  }
  return response;
}

/** Public data: answer instantly from cache, refresh it in the background. */
async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  const network = fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  });
  if (hit) {
    // Keep the refresh alive after we've answered; its failure is harmless.
    event.waitUntil(network.catch(() => {}));
    return hit;
  }
  return network;
}

/**
 * Pages: always the network. The offline page is the only fallback — see the
 * rule at the top of this file. `preloadResponse` is the request the browser
 * started in parallel with booting this worker (navigation preload, enabled on
 * activate), so having a worker never makes a navigation slower.
 */
async function navigate(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(OFFLINE_CACHE);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(CACHING ? precacheOffline().catch(() => {}) : Promise.resolve());
  // Take over straight away: pages are never served from cache and assets are
  // content-hashed, so there is no old/new mix for a waiting phase to protect.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("dekka-") && (!CACHING || !CURRENT_CACHES.includes(k)))
          .map((k) => caches.delete(k))
      );

      if (CACHING) {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
        const offline = await caches.open(OFFLINE_CACHE);
        if (!(await offline.match(OFFLINE_URL))) await precacheOffline().catch(() => {});
      } else if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHING) return;

  const { request } = event;
  if (request.method !== "GET") return;
  // DevTools quirk: "only-if-cached" outside same-origin mode throws in fetch().
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Every navigation, back-office included — the fallback stores nothing.
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }

  if (isPrivate(url.pathname)) return;

  // The public menu (DEKKA_PWA_APP.md §3) — the one API response worth caching.
  if (url.pathname === "/api/menu") {
    event.respondWith(staleWhileRevalidate(event, DATA_CACHE));
    return;
  }
  // Every other API response is per-user or per-role: straight to the network.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC_CACHE, STATIC_MAX_ENTRIES));
    return;
  }

  if (isImage(url.pathname)) {
    event.respondWith(cacheFirst(event, IMAGE_CACHE, IMAGE_MAX_ENTRIES));
  }
  // Anything else (RSC payloads for client navigations, the manifest, ...)
  // falls through to the network untouched.
});

// ---------------------------------------------------------------------------
// Push — unchanged from PLAN/LOG_SIGN_AUTH_IN.md §6
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Not JSON — fall back to plain text so a malformed payload still shows
    // *something* rather than silently dropping the notification.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "دكة / Dekka";
  const url = payload.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/brand/dekka-logo-square.png",
      badge: "/brand/dekka-logo-square.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  // `showNotification` stored a relative path (`/events/<id>`, see above),
  // but every open `WindowClient.url` is absolute — comparing them directly
  // never matched, so the "focus an existing tab" branch was dead code and
  // every click opened a new tab. Resolve against this worker's own origin
  // before comparing.
  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an already-open tab on that event instead of stacking a new
        // one, so tapping the notification twice doesn't open two tabs.
        for (const client of windowClients) {
          if (client.url === absoluteUrl && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
