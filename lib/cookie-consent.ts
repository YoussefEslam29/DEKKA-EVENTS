import { cookies } from "next/headers";

/**
 * The visitor's cookie choice, shaped exactly like `lib/i18n/index.ts`'s locale
 * cookie: a constant, a type guard, and a server-side reader, with the writer
 * living in `lib/actions/cookie-consent.ts` because a "use server" module may
 * only export async functions.
 *
 * Only two states are ever stored. "necessary" is not the absence of a choice —
 * it means the visitor actively declined the one non-essential thing this site
 * loads (the Google Maps embed), and the banner must not ask again.
 */
export const COOKIE_CONSENT_COOKIE = "dekka_cookie_consent";

export type CookieConsentValue = "all" | "necessary";

export function isCookieConsent(
  value: string | undefined
): value is CookieConsentValue {
  return value === "all" || value === "necessary";
}

/** Reads the consent cookie. `null` means the visitor hasn't chosen yet. */
export async function getCookieConsent(): Promise<CookieConsentValue | null> {
  const store = await cookies();
  const value = store.get(COOKIE_CONSENT_COOKIE)?.value;
  return isCookieConsent(value) ? value : null;
}
