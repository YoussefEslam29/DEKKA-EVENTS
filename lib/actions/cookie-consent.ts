"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  COOKIE_CONSENT_COOKIE,
  isCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

/**
 * Persists the cookie choice for a year and re-renders the tree, so the two
 * Google Maps embeds (about page, event page) pick the decision up on the
 * server rather than each holding their own client-side copy of it.
 *
 * Same shape as `setLocale` in lib/actions/locale.ts — deliberately, since
 * this is the same kind of one-value visitor preference.
 */
export async function setCookieConsent(value: CookieConsentValue) {
  if (!isCookieConsent(value)) return;
  const store = await cookies();
  store.set(COOKIE_CONSENT_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
