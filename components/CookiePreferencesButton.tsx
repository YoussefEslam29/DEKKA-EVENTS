"use client";

import { useI18n } from "@/components/I18nProvider";
import { useCookieConsent } from "@/components/CookieConsentProvider";
import { cn } from "@/lib/utils";

/**
 * Footer entry point back into the consent banner, so a choice made once is
 * still changeable — the "withdraw your consent as easily as you gave it" half
 * of asking for it in the first place.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const { openPreferences } = useCookieConsent();

  return (
    <button type="button" onClick={openPreferences} className={cn(className)}>
      {t.legal.cookieBanner.managePreferences}
    </button>
  );
}
