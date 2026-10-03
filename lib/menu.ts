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

/** Same fallback rule for an item's description. */
export function localDescription(
  thing: { descriptionAr: string; descriptionEn: string },
  locale: "ar" | "en"
): string {
  return locale === "ar"
    ? thing.descriptionAr || thing.descriptionEn
    : thing.descriptionEn || thing.descriptionAr;
}
