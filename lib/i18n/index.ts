import { cookies } from "next/headers";
import { dictionaries, type Dict } from "@/lib/i18n/dictionaries";

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Arabic is the default — English is the toggle, not the base language. */
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "dekka_locale";

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "ar" || value === "en";
}

/** Reads the locale cookie. Server-side only. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The locale plus its dictionary and text direction, for server components. */
export async function getI18n(): Promise<{
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Dict;
}> {
  const locale = await getLocale();
  return { locale, dir: dirFor(locale), t: dictionaries[locale] as Dict };
}

export function dictFor(locale: Locale): Dict {
  return dictionaries[locale] as Dict;
}

/** Fills `{n}`-style placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

export type { Dict };
