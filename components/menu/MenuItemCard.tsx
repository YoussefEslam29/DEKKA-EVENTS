import Image from "next/image";
import { Badge } from "@/components/ui/Surface";
import { formatMoney } from "@/lib/format";
// Type-only: `@/lib/i18n` itself reads cookies (`next/headers`), and this card
// also renders inside the client-side menu board.
import type { Locale } from "@/lib/i18n";
import { headlinePrice, localDescription, localName } from "@/lib/menu";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { MenuItemDTO } from "@/lib/data";
import { cn } from "@/lib/utils";

/** "40 ج.م" / "EGP 40" — the price formatting every menu surface shares. */
export function menuPrice(amount: number, locale: Locale, t: Dict): string {
  return `${formatMoney(amount, locale)} ${t.common.egp}`;
}

/** The headline price, "from"-prefixed when the item has several sizes. */
export function menuHeadline(item: MenuItemDTO, locale: Locale, t: Dict): string {
  const headline = headlinePrice(item);
  const price = menuPrice(headline.amount, locale, t);
  // Inline rather than `fill()` from `@/lib/i18n`, which is server-only.
  return headline.from ? t.cafeMenu.from.replace("{price}", price) : price;
}

/**
 * One row of the public menu (`PLAN/DEKKA_PWA_APP.md` §3).
 *
 * Text-forward by design: no dish photography exists yet, so the card is
 * complete without one — name, price, a line of description — and a photo,
 * when there is one, is a thumbnail at the end rather than a frame the layout
 * depends on. There is never an empty image box or a broken-image icon.
 *
 * Sold out keeps the item on the menu, marked with words ("Sold out today"),
 * not just greyed: colour alone would say nothing to a screen reader or to
 * anyone who can't tell muted from normal text. The text dims to `text-muted`
 * rather than dropping opacity, which held contrast at AA elsewhere in the app.
 *
 * Takes `t`/`locale` as props (like `EventCard`) so the same card renders in the
 * client-side menu board and on the server.
 */
export function MenuItemCard({
  item,
  locale,
  t,
}: {
  item: MenuItemDTO;
  locale: Locale;
  t: Dict;
}) {
  const name = localName(item, locale);
  const description = localDescription(item, locale);
  const soldOut = !item.available;

  return (
    // `data-menu-item`: what `/menu`'s view counter watches (MenuBoard); nothing else reads it.
    <article data-menu-item={item.id} className="dk-card flex gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className={cn("text-base font-bold", soldOut ? "text-text-muted" : "text-on-dark")}>
            {name}
          </h3>
          <p className="whitespace-nowrap text-sm font-bold text-gold-accent">
            {menuHeadline(item, locale, t)}
          </p>
        </div>

        {description ? (
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{description}</p>
        ) : null}

        {item.variants.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {item.variants.map((variant) => (
              <li
                key={`${variant.labelEn}-${variant.price}`}
                className="rounded-full border border-border-dark px-2.5 py-0.5 text-xs text-text-muted"
              >
                {locale === "ar" ? variant.labelAr : variant.labelEn}
                <span className="ms-1.5 font-semibold text-on-dark">
                  {formatMoney(variant.price, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {soldOut || item.isFeatured || item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {soldOut ? <Badge tone="bad">{t.cafeMenu.soldOut}</Badge> : null}
            {item.isFeatured ? <Badge tone="gold">{t.cafeMenu.baristaPick}</Badge> : null}
            {item.tags.map((tag) => (
              <Badge key={tag}>{t.cafeMenu.tags[tag]}</Badge>
            ))}
          </div>
        ) : null}
      </div>

      {item.image ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-coffee">
          <Image
            src={item.image}
            alt=""
            fill
            sizes="80px"
            className={cn("object-cover", soldOut && "grayscale")}
          />
        </div>
      ) : null}
    </article>
  );
}
