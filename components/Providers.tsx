"use client";

import { I18nProvider } from "@/components/I18nProvider";
import { CookieConsentProvider } from "@/components/CookieConsentProvider";
import type { CookieConsentValue } from "@/lib/cookie-consent";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";

/**
 * No `SessionProvider` here on purpose. Mounted app-wide it fetched
 * `/api/auth/session` on every page load and again every time the installed app
 * came back to the foreground, and the only screen that reads it is `/account`
 * (`useSession().update`). That page mounts its own, seeded from the server.
 * Server components get the signed-in user from `currentUser()`, and `signIn` /
 * `signOut` from `next-auth/react` work without a provider.
 */
export function Providers({
  locale,
  dir,
  t,
  dicts,
  cookieConsent,
  children,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dict;
  dicts: { en: Dict; ar: Dict };
  cookieConsent: CookieConsentValue | null;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider locale={locale} dir={dir} t={t} dicts={dicts}>
      <CookieConsentProvider initialConsent={cookieConsent}>{children}</CookieConsentProvider>
    </I18nProvider>
  );
}
