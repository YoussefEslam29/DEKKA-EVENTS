// Dekka's push service worker (PLAN/LOG_SIGN_AUTH_IN.md §6).
//
// Deliberately minimal: this is not a full offline/PWA worker, just the two
// listeners the Push API requires to exist *somewhere* before a browser will
// let a page call `pushManager.subscribe()`. Registered on demand — see
// `components/PushOptIn.tsx` — never on every page load.
//
// Plain JS, not TypeScript: this file is served as-is from `/sw.js` (the
// Next.js build does not process anything under `public/`), so it has to run
// unmodified in the browser.

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

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an already-open tab on that event instead of stacking a new
        // one, so tapping the notification twice doesn't open two tabs.
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
