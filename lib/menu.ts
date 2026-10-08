/**
 * Cafe-menu helpers shared by the API routes and every menu screen
 * (`PLAN/DEKKA_PWA_APP.md` §3). Pure, no Mongoose, so client components can
 * import them freely.
 *
 * The one pricing rule lives here: an item with sizes is priced *by* its sizes,
 * and its headline price is the cheapest of them ("from 40"). The API stores
 * that cheapest price in `price` too, so a sort or a total never disagrees
 * with what the card shows.
 */

type Priced = { price: number; variants: { price: number }[] };

/** The price an item with these variants must carry; `null` when it has none. */
export function cheapestVariantPrice(variants: { price: number }[]): number | null {
  return variants.length === 0 ? null : Math.min(...variants.map((v) => v.price));
}

/** What a card shows as the headline price, and whether to prefix it "from". */
export function headlinePrice(item: Priced): { amount: number; from: boolean } {
  const cheapest = cheapestVariantPrice(item.variants);
  return cheapest === null
    ? { amount: item.price, from: false }
    : { amount: cheapest, from: item.variants.length > 1 };
}

/** A name in the reader's language, falling back to the other if blank. */
export function localName(
  thing: { nameAr: string; nameEn: string },
  locale: "ar" | "en"
): string {
  return locale === "ar" ? thing.nameAr || thing.nameEn : thing.nameEn || thing.nameAr;
}

// --- Seasonal sections (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b.4) ---------------------------------
//
// A season is two optional Cairo calendar days, "YYYY-MM-DD", both inclusive. Strings, not
// Dates: they say exactly what the admin picked, with no timezone to get wrong, and
// zero-padded ISO days compare correctly as strings in JavaScript and in MongoDB alike.

export type Seasonal = { isActive: boolean; startsOn?: string | null; endsOn?: string | null };

/** The one visibility rule: shown, and `today` (a Cairo `dayKey`) inside its season. */
export function isInSeason(section: Seasonal, today: string): boolean {
  return (
    section.isActive &&
    (!section.startsOn || today >= section.startsOn) &&
    (!section.endsOn || today <= section.endsOn)
  );
}

/**
 * `isInSeason` as a MongoDB filter, for the menu aggregations. `prefix` is for a joined
 * section ("section."). A `null` match also matches a missing field.
 */
export function seasonFilter(today: string, prefix = ""): Record<string, unknown> {
  return {
    [`${prefix}isActive`]: true,
    $and: [
      { $or: [{ [`${prefix}startsOn`]: null }, { [`${prefix}startsOn`]: { $lte: today } }] },
      { $or: [{ [`${prefix}endsOn`]: null }, { [`${prefix}endsOn`]: { $gte: today } }] },
    ],
  };
}

/** A season ending before it starts would never show. */
export function seasonRangeOk(startsOn?: string | null, endsOn?: string | null): boolean {
  return !startsOn || !endsOn || startsOn <= endsOn;
}

/** Where a section's season stands on `today`, for the admin's badge. */
export function seasonState(
  section: Omit<Seasonal, "isActive">,
  today: string
): "allYear" | "upcoming" | "current" | "ended" {
  if (!section.startsOn && !section.endsOn) return "allYear";
  if (section.startsOn && today < section.startsOn) return "upcoming";
  if (section.endsOn && today > section.endsOn) return "ended";
  return "current";
}

/** Same fallback rule for an item's description. */
export function localDescription(
  thing: { descriptionAr: string; descriptionEn: string },
  locale: "ar" | "en"
): string {
  return locale === "ar"
    ? thing.descriptionAr || thing.descriptionEn
    : thing.descriptionEn || thing.descriptionAr;
}
