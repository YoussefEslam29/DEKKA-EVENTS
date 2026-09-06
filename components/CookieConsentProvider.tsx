"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { setCookieConsent } from "@/lib/actions/cookie-consent";
import type { CookieConsentValue } from "@/lib/cookie-consent";

type CookieConsentContextValue = {
  consent: CookieConsentValue | null;
  /** Whether third-party embeds (the Google Maps iframe) may load on sight. */
  mapsAllowed: boolean;
  bannerOpen: boolean;
  acceptAll: () => void;
  necessaryOnly: () => void;
  /** Re-opens the banner from the footer link, after a choice was made. */
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/**
 * Holds the visitor's cookie choice for the client tree.
 *
 * Seeded from the server (`getCookieConsent()` in the root layout) so the first
 * paint already knows the answer — a banner that flashes on every page load for
 * someone who accepted a year ago is worse than no banner. Choices update local
 * state immediately and persist through the server action in the background,
 * rather than waiting on the round trip to redraw.
 */
export function CookieConsentProvider({
  initialConsent,
  children,
}: {
  initialConsent: CookieConsentValue | null;
  children: React.ReactNode;
}) {
  const [consent, setConsent] = useState<CookieConsentValue | null>(initialConsent);
  const [reopened, setReopened] = useState(false);
  const [, startTransition] = useTransition();

  const choose = useCallback((value: CookieConsentValue) => {
    setConsent(value);
    setReopened(false);
    startTransition(() => {
      void setCookieConsent(value);
    });
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      mapsAllowed: consent === "all",
      bannerOpen: consent === null || reopened,
      acceptAll: () => choose("all"),
      necessaryOnly: () => choose("necessary"),
      openPreferences: () => setReopened(true),
    }),
    [consent, reopened, choose]
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside <CookieConsentProvider>");
  return ctx;
}
