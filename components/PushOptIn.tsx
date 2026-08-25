"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, BellOff, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { useMotionPresets } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Permission = "unsupported" | "default" | "granted" | "denied";
type Flow = "idle" | "enabling" | "success" | "error";
type Phase = "hidden" | "ask" | "enabling" | "success" | "blocked" | "error";

/** Consumed on first read — see the mount effect below. Set by `AuthForm.tsx`
 * right before it redirects a fresh sign-in/sign-up to `next`; exported so
 * both sides of that handshake share one literal instead of two copies that
 * could quietly drift apart. */
export const PUSH_TOAST_FLAG_KEY = "dekka_push_toast_pending";

/**
 * Converts the VAPID public key (URL-safe base64, no padding) into the
 * `Uint8Array` shape `pushManager.subscribe`'s `applicationServerKey` wants.
 * There's no browser-native decoder for this — it's the standard bit of
 * boilerplate every Push API integration carries.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // `new Uint8Array(length)` always backs onto a plain `ArrayBuffer` (never a
  // `SharedArrayBuffer`), so the explicit `<ArrayBuffer>` here is accurate —
  // without it TS 5.7's generic `Uint8Array<ArrayBufferLike>` default isn't
  // narrow enough for `PushSubscriptionOptionsInit.applicationServerKey`.
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function readPermission(): Permission {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission;
}

/** There's no browser event for "permission changed" to subscribe to — the
 * only way this value ever changes is `handleEnable`'s own
 * `Notification.requestPermission()` call, which already triggers a
 * re-render via `setFlow`. So the subscription itself is a no-op; this
 * exists only to satisfy `useSyncExternalStore`'s signature. */
function subscribeToNothing() {
  return () => {};
}

/** `useSyncExternalStore`'s server snapshot — matches `readPermission()`'s
 * own `typeof window === "undefined"` branch, so the two can never disagree. */
function getServerPermission(): Permission {
  return "unsupported";
}

/**
 * The one browser-push opt-in flow (`PLAN/LOG_SIGN_AUTH_IN.md` §6) — a
 * persistent, dismissible banner on `/account` and a one-shot toast right
 * after a successful sign-up/login redirect (mounted globally in
 * `app/(site)/layout.tsx`) both render through this component with a
 * different `variant`. Same subscribe logic either way; only layout/copy
 * differs.
 *
 * The permission prompt is the single highest-risk piece of this feature:
 * denying it once silences the origin's future prompts in most browsers. So
 * `handleEnable` — the *only* place in this whole feature that ever calls
 * `Notification.requestPermission()` — runs exclusively inside this
 * component's own button `onClick`, never from an effect and never on mount.
 * Reading `Notification.permission` itself goes through `useSyncExternalStore`
 * rather than a `useState` + `useEffect` pair: there's no local state to
 * compute during render (the browser owns this value, not React), and this
 * is the sanctioned way to read a client-only, SSR-unsafe value without
 * either a hydration mismatch or a synchronous `setState` inside an effect.
 */
export function PushOptIn({ variant }: { variant: "banner" | "toast" }) {
  const { t } = useI18n();
  const { fadeUp, reduced } = useMotionPresets();
  const permission = useSyncExternalStore(
    subscribeToNothing,
    readPermission,
    getServerPermission
  );
  const [flow, setFlow] = useState<Flow>("idle");
  const [dismissed, setDismissed] = useState(false);
  // Toast only: whether this mount is actually the one-shot post-auth moment.
  const [toastArmed, setToastArmed] = useState(false);

  // Mount-only: consumes the "we just signed in" flag `AuthForm.tsx` sets
  // right before its redirect, so the toast can only ever arm itself once
  // per flag, i.e. once per sign-in/sign-up. `sessionStorage` doesn't exist
  // on the server, so this genuinely can't be computed during render.
  useEffect(() => {
    if (variant !== "toast") return;
    try {
      const pending = sessionStorage.getItem(PUSH_TOAST_FLAG_KEY);
      // Consumed on read regardless of what happens next — "at most once per
      // browser session" per §6, so a later hard refresh on any `(site)`
      // page must never bring it back.
      if (pending) {
        sessionStorage.removeItem(PUSH_TOAST_FLAG_KEY);
        // One-shot consume-a-flag-then-arm on mount, not a derived-state sync — there is no render-time equivalent, since sessionStorage is client-only.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToastArmed(true);
      }
    } catch {
      // Storage unavailable (private mode, blocked cookies) — the toast
      // simply never arms; the /account banner is still reachable.
    }
    // `variant` is a literal ("banner" | "toast") fixed per call site, never
    // a value that changes across a mounted instance's lifetime — this is
    // still deliberately mount-only, not a "sync effect to prop" pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEnable() {
    setFlow("enabling");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // The one call in this whole feature allowed to trigger the OS
      // dialog — and it only ever runs from here, inside a real click.
      // `useSyncExternalStore` re-reads `Notification.permission` on the
      // next render, which `setFlow` below always triggers, so there's no
      // need to store this result separately.
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        setFlow("idle");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setFlow("error");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setFlow(res.ok ? "success" : "error");
    } catch {
      setFlow("error");
    }
  }

  const phase: Phase = (() => {
    if (permission === "unsupported" || dismissed) return "hidden";
    if (variant === "toast" && !toastArmed) return "hidden";
    if (flow === "enabling") return "enabling";
    if (flow === "success") return "success";
    if (flow === "error") return "error";
    if (permission === "granted") return "hidden"; // already opted in, nothing to ask
    if (permission === "denied") return variant === "banner" ? "blocked" : "hidden";
    return "ask"; // permission === "default"
  })();

  const title =
    phase === "success"
      ? t.push.enabled
      : phase === "blocked"
        ? t.push.blocked
        : phase === "error"
          ? t.push.error
          : variant === "banner"
            ? t.push.bannerTitle
            : t.push.toastTitle;

  const isBanner = variant === "banner";
  const showEnableButton = phase === "ask" || phase === "enabling" || phase === "error";

  return (
    <AnimatePresence>
      {phase !== "hidden" ? (
        <Card
          key="push-opt-in"
          variants={isBanner ? fadeUp : undefined}
          initial={isBanner ? "hidden" : { opacity: 0, y: reduced ? 0 : 16, scale: reduced ? 1 : 0.97 }}
          animate={isBanner ? "show" : { opacity: 1, y: 0, scale: 1 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15, ease: "easeOut" } }
          }
          className={cn(
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
            !isBanner && "fixed inset-x-4 bottom-4 z-50 shadow-xl sm:inset-x-auto sm:end-4 sm:w-[380px]"
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                phase === "blocked" || phase === "error"
                  ? "bg-bad/10 text-bad"
                  : "bg-gold-accent/10 text-gold-accent"
              )}
            >
              {phase === "blocked" ? (
                <BellOff className="h-4.5 w-4.5" aria-hidden />
              ) : (
                <Bell className="h-4.5 w-4.5" aria-hidden />
              )}
            </span>
            <p className="text-sm font-semibold text-on-dark">{title}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            {showEnableButton ? (
              <Button
                type="button"
                size="sm"
                disabled={phase === "enabling"}
                onClick={handleEnable}
              >
                {phase === "enabling" ? t.push.enabling : t.push.enable}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t.push.dismiss}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-coffee hover:text-on-dark"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Card>
      ) : null}
    </AnimatePresence>
  );
}
