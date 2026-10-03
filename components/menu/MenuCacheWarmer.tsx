"use client";

import { useEffect } from "react";

/**
 * Puts the current menu into the service worker's cache, so the offline page
 * can show "the menu as you last saw it" (`PLAN/DEKKA_PWA_APP.md` §2, §7).
 *
 * `/menu` itself is server-rendered and never cached (pages hold per-user
 * chrome — see `public/sw.js`), so the worker only ever stores the menu when
 * something fetches `GET /api/menu`. This does, once per visit to `/menu`, after
 * the page has gone quiet — and only when a worker is actually in control, so a
 * first-time visitor without one doesn't cost the server a second query for
 * nothing. Renders nothing.
 */
export function MenuCacheWarmer() {
  useEffect(() => {
    if (!navigator.serviceWorker?.controller) return;

    const warm = () => {
      fetch("/api/menu", { priority: "low" } as RequestInit).catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = setTimeout(warm, 1500);
    return () => clearTimeout(handle);
  }, []);

  return null;
}
