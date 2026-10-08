/**
 * Installable-app plumbing (PLAN/DEKKA_PWA_APP.md §2) shared by the root
 * layout, the service-worker registrar, the push opt-in and the install prompt.
 *
 * No `"use client"` and nothing touches `window` at module scope, so the server
 * layout can import `EARLY_APP_SCRIPT` from here without dragging browser code
 * along; every function below is only ever *called* in the browser.
 */

/**
 * Runs in `<head>`, before the body paints. Two jobs, both of which have to
 * happen earlier than React can:
 *
 * 1. Mark the document `data-app="standalone"` when it was launched from the
 *    home screen. Every installed-only style keys off that attribute through the
 *    `standalone:` variant in `globals.css`, so doing it before first paint is
 *    what stops the browser navbar/footer flashing for a frame on every launch.
 *    `navigator.standalone` covers iOS versions whose Safari predates the
 *    `display-mode` media query for home-screen apps.
 * 2. Catch `beforeinstallprompt`. Chromium can fire it before hydration, and an
 *    event nobody was listening for is gone — so it's parked on `window` here
 *    and announced to whichever install UI mounts later. `preventDefault()`
 *    swaps Chrome's generic mini-infobar for Dekka's own banner; the browser's
 *    own address-bar install icon is unaffected.
 */
export const EARLY_APP_SCRIPT = `(function(){try{var d=document.documentElement;if(window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches){d.setAttribute("data-app","standalone")}}catch(e){}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__dkInstallPrompt=e;window.dispatchEvent(new Event("dk:installable"))});window.addEventListener("appinstalled",function(){window.__dkInstallPrompt=null;window.dispatchEvent(new Event("dk:installable"))})})();`;

/** Chromium-only, so not in the DOM typings. */
export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __dkInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** `useSyncExternalStore` plumbing for the parked install event. */
export function subscribeInstallPrompt(onChange: () => void) {
  window.addEventListener("dk:installable", onChange);
  return () => window.removeEventListener("dk:installable", onChange);
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return window.__dkInstallPrompt ?? null;
}

/** A spent prompt can't be shown twice; forget it and tell the listeners. */
export function clearInstallPrompt() {
  window.__dkInstallPrompt = null;
  window.dispatchEvent(new Event("dk:installable"));
}

export type AppPlatform = "standalone" | "ios" | "other";

export function readPlatform(): AppPlatform {
  if (document.documentElement.dataset.app === "standalone") return "standalone";
  return isIOS() ? "ios" : "other";
}

/** iPhone, iPad or iPod, installed or not. */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support is what gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * Development registers the same worker with caching switched off. Turbopack's
 * dev chunks aren't content-hashed, so a cache-first worker would serve stale
 * code after every edit — and `next dev` and `next start` share
 * `localhost:3000`, so a production worker left behind from a local build has to
 * be actively replaced, not merely not registered. A different script URL is
 * what makes the browser swap it out.
 */
export const SW_URL = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?cache=off";

/** Idempotent: re-registering the same URL just returns the live registration. */
export function registerServiceWorker() {
  return navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
}
