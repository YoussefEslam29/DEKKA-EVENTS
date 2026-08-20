"use client";

import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";

type I18nValue = { locale: Locale; dir: "rtl" | "ltr"; t: Dict };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Client components read the dictionary from context rather than importing both
 * languages, so the unused locale never ships in the client bundle.
 */
export function I18nProvider({
  value,
  children,
}: {
  value: I18nValue;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
