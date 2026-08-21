"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";

export type BilingualPair = { en: string; ar: string };

type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  /** Dictionary for the active locale — use for prose and content. */
  t: Dict;
  /** Both dictionaries, for the `English / العربية` label pattern (§3). */
  dicts: { en: Dict; ar: Dict };
  /** Picks the same key out of both dictionaries at once. */
  bi: (select: (d: Dict) => string) => BilingualPair;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Client components read language from context. Both dictionaries are provided
 * because authorization-UI.md §3 mandates bilingual field labels and buttons —
 * those need English and Arabic simultaneously, not the active locale alone.
 */
export function I18nProvider({
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
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir,
      t,
      dicts,
      bi: (select) => ({ en: select(dicts.en), ar: select(dicts.ar) }),
    }),
    [locale, dir, t, dicts]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
