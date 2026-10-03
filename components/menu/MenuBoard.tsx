"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { EmptyState } from "@/components/ui/Surface";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { localName } from "@/lib/menu";
import type { MenuCategoryDTO, MenuItemDTO } from "@/lib/data";
import { cn } from "@/lib/utils";

const sectionId = (id: string) => `menu-${id}`;

/** Case- and diacritic-insensitive, so "latte" finds "Latté" and Arabic tashkeel doesn't matter. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ًͯ-ْٰ]/g, "")
    .toLowerCase();
}

function matches(item: MenuItemDTO, query: string): boolean {
  if (!query) return true;
  const haystack = normalise(
    `${item.nameAr} ${item.nameEn} ${item.descriptionAr} ${item.descriptionEn}`
  );
  return haystack.includes(query);
}

/**
 * The public menu (`PLAN/DEKKA_PWA_APP.md` §3): a search box, a sticky row of
 * section chips that tracks where you are, and the sections themselves.
 *
 * Search is client-side on purpose — unlike the Customers grid, the menu isn't
 * capped server-side, so every item is already here and filtering locally
 * really does search all of it, instantly, with no round trip.
 */
export function MenuBoard({ categories }: { categories: MenuCategoryDTO[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const chipRefs = useRef(new Map<string, HTMLAnchorElement>());

  const needle = normalise(query.trim());
  const visible = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => matches(item, needle)),
        }))
        .filter((category) => category.items.length > 0),
    [categories, needle]
  );

  // Light up the chip for whichever section is under the sticky bar. The
  // negative bottom margin means a section counts as "current" once its top
  // has passed the upper part of the screen, not merely when a sliver shows.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace(/^menu-/, ""));
      },
      { rootMargin: "-140px 0px -55% 0px" }
    );
    for (const category of visible) {
      const el = document.getElementById(sectionId(category.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visible]);

  // Keep the lit chip in view inside its own scroll row. `block: "nearest"`
  // never moves the page: the row is sticky, so it is already in view.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chipRefs.current.get(active)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [active]);

  return (
    <div>
      <div className="relative mb-4">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4 w-4 text-text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.cafeMenu.searchPlaceholder}
          aria-label={t.common.search}
          className="dk-field w-full rounded-full ps-11"
        />
      </div>

      {visible.length > 1 ? (
        <nav
          aria-label={t.cafeMenu.sections}
          // Sits right under the sticky header; in the installed app the header
          // also carries the status-bar inset, so the offset follows it.
          className="sticky top-16 z-30 -mx-4 mb-4 border-b border-border-dark bg-ink-black/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8 standalone:top-[calc(4rem+env(safe-area-inset-top))]"
        >
          {/* The one horizontal scroller on the page — the page itself never scrolls sideways. */}
          <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {visible.map((category) => {
              const current = category.id === active;
              return (
                <li key={category.id} className="shrink-0">
                  <a
                    ref={(el) => {
                      if (el) chipRefs.current.set(category.id, el);
                      else chipRefs.current.delete(category.id);
                    }}
                    href={`#${sectionId(category.id)}`}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                      current
                        ? "border-gold-accent bg-gold-accent/15 text-gold-accent"
                        : "border-border-dark text-text-muted hover:border-gold-accent/40 hover:text-on-dark"
                    )}
                  >
                    {localName(category, locale)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState>{t.cafeMenu.searchEmpty}</EmptyState>
      ) : (
        <div className="grid gap-10">
          {visible.map((category) => (
            <section
              key={category.id}
              id={sectionId(category.id)}
              aria-labelledby={`${sectionId(category.id)}-title`}
              // Clears the sticky header + chip row when a chip jumps here.
              className="scroll-mt-36"
            >
              <h2
                id={`${sectionId(category.id)}-title`}
                className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent"
              >
                {localName(category, locale)}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {category.items.map((item) => (
                  <MenuItemCard key={item.id} item={item} locale={locale} t={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
