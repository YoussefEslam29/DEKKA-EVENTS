"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/I18nProvider";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";

export function Providers({
  locale,
  dir,
  t,
  children,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dict;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider value={{ locale, dir, t }}>{children}</I18nProvider>
    </SessionProvider>
  );
}
