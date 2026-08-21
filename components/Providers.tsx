"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/I18nProvider";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";

export function Providers({
  locale,
  dir,
  t,
  dicts,
  children,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dict;
  dicts: { en: Dict; ar: Dict };
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale} dir={dir} t={t} dicts={dicts}>
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
