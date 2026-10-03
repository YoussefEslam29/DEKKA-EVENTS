"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share, Smartphone, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import {
  clearInstallPrompt,
  getInstallPrompt,
  readPlatform,
  subscribeInstallPrompt,
  type AppPlatform,
} from "@/lib/pwa";

/**
 * Install UI (PLAN/DEKKA_PWA_APP.md §2).
 *
 * Two routes into the same app, because the platforms genuinely differ:
 * - **Chromium (Android)** fires `beforeinstallprompt` (parked on `window` by
 *   `EARLY_APP_SCRIPT`), so we can offer a real Install button. Next's PWA
 *   guide warns this event isn't cross-browser, so it is treated as a bonus.
 * - **iPhone** has no install API at all; the best anyone can do is say which
 *   two taps to make.
 *
 * Everything here is client-only state, so it all reads through
 * `useSyncExternalStore` with a server snapshot of "show nothing": the server
 * renders no banner and the client adds one after hydration, never the reverse.
 */

/** `readPlatform()` never changes within a page's life; nothing to subscribe to. */
function subscribeNothing() {
  return () => {};
}

export function useInstallState() {
  const platform = useSyncExternalStore<AppPlatform | null>(
    subscribeNothing,
    readPlatform,
    () => null
  );
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // A prompt can be shown once; accepted or not, it's spent.
    clearInstallPrompt();
  }

  return { platform, canPrompt: prompt !== null, install };
}

// Dismissal is remembered on this device. Wrapped in try/catch throughout:
// private mode or blocked storage must never break the page — at worst the
// banner comes back next visit.
const DISMISS_KEY = "dekka_install_dismissed";
const dismissListeners = new Set<() => void>();

function subscribeDismissed(onChange: () => void) {
  dismissListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    dismissListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Not remembered, but still hidden for the rest of this visit below.
  }
  dismissListeners.forEach((listener) => listener());
}

/** The back-office is a counter tool, not where anyone needs an install pitch. */
const HIDDEN_ON = ["/admin", "/staff", "/get-app"];

/**
 * Slim strip under the header, phones only (`md:hidden`). Inline rather than a
 * floating card: the cookie banner and the push toast already own the bottom
 * corner, and a third stacked card there would cover the page on a small phone.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { platform, canPrompt, install } = useInstallState();
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);

  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const offer = platform === "ios" || (platform === "other" && canPrompt);
  if (dismissed || hiddenHere || !offer) return null;

  return (
    <aside
      aria-label={t.app.install.title}
      className="flex items-center gap-3 border-b border-border-dark bg-surface-dark px-4 py-2 md:hidden standalone:hidden"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
        <Smartphone className="h-4.5 w-4.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-on-dark">{t.app.install.title}</p>
        {platform === "ios" ? (
          <p className="text-xs text-text-muted">
            <Share className="me-1 inline h-3.5 w-3.5 align-[-2px] text-gold-accent" aria-hidden />
            {t.app.install.iosHint}
          </p>
        ) : (
          <p className="text-xs text-text-muted">{t.app.install.body}</p>
        )}
      </div>

      {platform === "ios" ? (
        <Link
          href="/get-app"
          className="flex min-h-11 shrink-0 items-center text-xs font-bold text-gold-accent underline-offset-2 hover:underline"
        >
          {t.app.install.getApp}
        </Link>
      ) : (
        <Button type="button" size="sm" className="h-11 shrink-0" onClick={install}>
          {t.app.install.button}
        </Button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label={t.app.install.dismiss}
        className="-me-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-coffee hover:text-on-dark"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
