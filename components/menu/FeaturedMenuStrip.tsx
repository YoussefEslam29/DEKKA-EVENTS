import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coffee } from "lucide-react";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { menuHeadline } from "@/components/menu/MenuItemCard";
import { localName } from "@/lib/menu";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { MenuItemDTO } from "@/lib/data";

/**
 * "Barista's picks" on the homepage (`PLAN/HOME_PAGE.md` §3, `PLAN/DEKKA_PWA_APP.md`
 * §3): the items the admin marked featured, as a short swipeable row, and a way
 * through to the full menu. A preview, not the menu — the homepage's spine is
 * still the events below it.
 *
 * A card without a photo gets the tatreez texture and a cup instead of an
 * empty frame, so a row mixing both still looks deliberate.
 */
export function FeaturedMenuStrip({
  items,
  locale,
  t,
}: {
  items: MenuItemDTO[];
  locale: Locale;
  t: Dict;
}) {
  return (
    <section
      aria-labelledby="featured-menu-title"
      className="mx-auto max-w-[1180px] px-4 pt-10 md:px-8"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="featured-menu-title" className="text-xl font-bold tracking-tight md:text-2xl">
            {t.cafeMenu.featuredTitle}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t.cafeMenu.featuredSubtitle}</p>
        </div>
        <Link
          href="/menu"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-gold-accent hover:underline"
        >
          {t.cafeMenu.viewFull}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>

      {/* Scrolls sideways inside itself; the page never does. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0">
        {items.map((item) => (
          <li key={item.id} className="w-52 shrink-0 snap-start">
            <Link
              href="/menu"
              className="dk-card block h-full overflow-hidden transition-colors hover:border-gold-accent/50"
            >
              <div className="relative aspect-[4/3] bg-coffee">
                {item.image ? (
                  <Image src={item.image} alt="" fill sizes="208px" className="object-cover" />
                ) : (
                  <>
                    <PatternAccent variant="field" className="absolute inset-0 text-gold-accent/10" />
                    <Coffee
                      className="absolute inset-0 m-auto h-10 w-10 text-gold-accent/70"
                      aria-hidden
                    />
                  </>
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-bold text-on-dark">{localName(item, locale)}</p>
                <p className="mt-0.5 text-sm font-semibold text-gold-accent">
                  {menuHeadline(item, locale, t)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
