import type { Locale } from "@/lib/i18n";
import { fill } from "@/lib/i18n";
import { formatShortDate } from "@/lib/format";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { legalContent } from "@/lib/i18n/legal-content";
import { site } from "@/lib/site";

/**
 * When each legal document was last substantively edited.
 *
 * One date per document rather than a single site-wide one, so amending the
 * cookie policy doesn't silently reset the "last updated" stamp on the privacy
 * policy — that date is the reader's only signal of whether the terms they
 * agreed to have changed since.
 *
 * Bump the relevant entry whenever the wording of that document changes in
 * `lib/i18n/dictionaries.ts`. Dates are ISO so they format per-locale below,
 * which keeps the Arabic and English pages from ever drifting apart.
 */
export const LEGAL_UPDATED_AT = {
  privacy: "2026-10-08",
  terms: "2026-09-07",
  cookies: "2026-10-08",
  refundPolicy: "2026-09-07",
} as const;

export type LegalDocId = keyof typeof LEGAL_UPDATED_AT;

/**
 * Resolves one legal document into what `LegalPageLayout` renders.
 *
 * Titles come from the dictionary (the footer links need them everywhere); the
 * prose comes from `legal-content.ts`, which no client component imports — see
 * the note at the top of that file.
 *
 * The `{email}` token is filled here rather than hardcoded into ~35 separate
 * strings, so the contact address on every policy page tracks `site.email`
 * (and therefore NEXT_PUBLIC_CAFE_EMAIL) from one place.
 */
export function legalDoc(id: LegalDocId, locale: Locale) {
  const t = dictionaries[locale].legal;

  return {
    title: t[id].title,
    updatedLabel: fill(t.common.lastUpdated, {
      date: formatShortDate(LEGAL_UPDATED_AT[id], locale),
    }),
    sections: Object.values(legalContent[locale][id]).map((section) => ({
      heading: section.heading,
      body: fill(section.body, { email: site.email }),
    })),
  };
}
