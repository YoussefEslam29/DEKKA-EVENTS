"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QrCode, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * "Show at the door" (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.4): the door code full-screen, big
 * enough to hold up to the door team in a dim cafe. A real dialog: focus moves in, Esc and
 * the Close button leave, focus goes back to the button. While it's open the screen stays
 * on where the browser allows it (Wake Lock); that's a progressive extra that fails silently.
 */
export function DoorCodeButton({ code, title, when }: { code: string; title: string; when: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    nav.wakeLock
      ?.request("screen")
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const triggerEl = trigger.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      lock?.release().catch(() => {});
      triggerEl?.focus();
    };
  }, [open]);

  return (
    <>
      <Button ref={trigger} variant="gold" className="min-h-11" onClick={() => setOpen(true)}>
        <QrCode className="h-4 w-4" aria-hidden />
        {t.doorCode.show}
      </Button>
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="door-code-title"
              className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-ink-black px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center"
            >
              <p id="door-code-title" className="text-sm font-bold uppercase tracking-[0.2em] text-gold-accent">
                {t.doorCode.title}
              </p>
              <div className="rounded-3xl bg-cream px-6 py-8 shadow-2xl">
                <p
                  className="font-mono text-6xl font-black tracking-[0.18em] text-ink-black sm:text-7xl"
                  dir="ltr"
                  aria-label={code.split("").join(" ")}
                >
                  {code}
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-on-dark">{title}</p>
                <p className="mt-1 text-sm text-text-muted">{when}</p>
              </div>
              <div className="max-w-sm space-y-1 text-sm text-text-muted">
                <p>{t.doorCode.hint}</p>
                <p>{t.doorCode.offlineHint}</p>
              </div>
              <Button ref={closeButton} variant="outline" size="lg" className="min-h-11" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" aria-hidden />
                {t.doorCode.close}
              </Button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
