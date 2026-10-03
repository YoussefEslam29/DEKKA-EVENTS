"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useI18n } from "@/components/I18nProvider";
import { useCookieConsent } from "@/components/CookieConsentProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { useMotionPresets } from "@/lib/motion";

/**
 * The consent banner, mounted once in `app/(site)/layout.tsx`.
 *
 * Two actions only — Accept all / Necessary only — and deliberately no bare
 * "✕" dismiss: closing a consent banner without choosing is ambiguous with
 * accepting, and if it meant "undecided" the banner would simply return on the
 * next page anyway. Both buttons are a real answer, and the footer's "Manage
 * cookies" link reopens this to change it later.
 */
export function CookieConsent() {
  const { t } = useI18n();
  const { bannerOpen, acceptAll, necessaryOnly } = useCookieConsent();
  const { reduced } = useMotionPresets();

  return (
    <AnimatePresence>
      {bannerOpen ? (
        <Card
          key="cookie-consent"
          role="region"
          aria-label={t.legal.cookies.title}
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 8, transition: { duration: 0.15, ease: "easeOut" } }
          }
          // `standalone:` lifts it clear of the installed app's bottom tab bar
          // (h-16 + the home-indicator inset). The old `sm:bottom-4` repeated the
          // base value and would have competed with that variant, so it's gone.
          className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 p-4 shadow-xl sm:inset-x-auto sm:end-4 sm:w-[420px] standalone:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
              <Cookie className="h-4.5 w-4.5" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-text-muted">
              {t.legal.cookieBanner.message}{" "}
              <Link href="/cookies" className="font-semibold text-gold-accent underline">
                {t.legal.cookieBanner.learnMore}
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={necessaryOnly}>
              {t.legal.cookieBanner.necessaryOnly}
            </Button>
            <Button type="button" size="sm" onClick={acceptAll}>
              {t.legal.cookieBanner.acceptAll}
            </Button>
          </div>
        </Card>
      ) : null}
    </AnimatePresence>
  );
}
