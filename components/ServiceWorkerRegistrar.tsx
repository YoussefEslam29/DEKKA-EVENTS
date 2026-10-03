"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";

/**
 * Registers `/sw.js` for every visitor (PLAN/DEKKA_PWA_APP.md §2). Until now it
 * was registered only when someone opted into push; the worker now also does
 * the offline fallback and asset caching, which have to be in place before
 * anyone thinks to ask for them.
 *
 * Deferred to the window `load` event so the worker's own install (which
 * precaches the offline page) never competes with the first page's bandwidth.
 * Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      // A failed registration costs the offline fallback and nothing else —
      // the site itself never depends on the worker being there.
      registerServiceWorker().catch(() => {});
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
