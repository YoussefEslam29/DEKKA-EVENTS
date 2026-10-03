"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { menuHeadline } from "@/components/menu/MenuItemCard";
import { localName } from "@/lib/menu";
import type { MenuCategoryDTO } from "@/lib/data";

/**
 * "The menu, as you last saw it" on the offline page (`PLAN/DEKKA_PWA_APP.md`
 * §2, §7). Offline, `GET /api/menu` is answered by the service worker from the
 * copy `MenuCacheWarmer` stored on the visitor's last trip to `/menu`; with no
 * copy, the fetch fails and this simply renders nothing.
 *
 * Text only — names and prices. Photos may or may not be in the image cache,
 * and a list with holes in it reads worse than a clean list.
 */
export function OfflineMenu() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<MenuCategoryDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/menu")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: MenuCategoryDTO[] } | null) => {
        if (!cancelled && body?.data?.length) setCategories(body.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!categories) return null;

  return (
    <section className="dk-card w-full max-w-md p-5 text-start">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-gold-accent">
        {t.cafeMenu.offlineTitle}
      </h2>
      <div className="grid gap-5">
        {categories.map((category) => (
          <div key={category.id}>
            <h3 className="mb-2 text-sm font-bold text-on-dark">{localName(category, locale)}</h3>
            <ul className="grid gap-1.5">
              {category.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={item.available ? "text-on-dark" : "text-text-muted"}>
                    {localName(item, locale)}
                    {item.available ? null : (
                      <span className="ms-2 text-xs text-bad">{t.cafeMenu.soldOut}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-semibold text-gold-accent">
                    {menuHeadline(item, locale, t)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
