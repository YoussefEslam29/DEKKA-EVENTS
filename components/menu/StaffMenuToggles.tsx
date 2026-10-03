"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui/Surface";
import { menuHeadline } from "@/components/menu/MenuItemCard";
import { localName } from "@/lib/menu";
import type { MenuCategoryDTO } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * `/staff/menu` (`PLAN/DEKKA_PWA_APP.md` §3): every item with one big switch —
 * available or sold out — and nothing else. Plain and high-contrast on
 * purpose, like the door tool: it gets used mid-shift, with one hand, behind a
 * bar. The switch is optimistic and snaps back if the server says no.
 */
export function StaffMenuToggles({ categories }: { categories: MenuCategoryDTO[] }) {
  const { t, locale } = useI18n();
  const a = t.cafeMenu.admin;
  const [available, setAvailable] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.flatMap((c) => c.items.map((i) => [i.id, i.available])))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function toggle(id: string) {
    const next = !available[id];
    setAvailable((s) => ({ ...s, [id]: next }));
    setPending(id);
    setFailed(false);
    try {
      const res = await fetch(`/api/menu/items/${id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setAvailable((s) => ({ ...s, [id]: !next }));
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-6">
      {failed ? (
        <p role="alert" className="text-sm font-semibold text-bad">
          {t.grid.saveFailed}
        </p>
      ) : null}

      {categories.map((category) => (
        <section key={category.id} aria-labelledby={`staff-menu-${category.id}`}>
          <h2
            id={`staff-menu-${category.id}`}
            className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-faint"
          >
            {localName(category, locale)}
          </h2>
          <Card className="divide-y divide-line p-0">
            {category.items.map((item) => {
              const on = available[item.id];
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className={cn("truncate font-semibold", on ? "text-ink" : "text-ink-faint")}>
                      {localName(item, locale)}
                    </p>
                    <p className="text-sm text-ink-faint">{menuHeadline(item, locale, t)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${localName(item, locale)}: ${a.available}`}
                    disabled={pending === item.id}
                    onClick={() => void toggle(item.id)}
                    className={cn(
                      "inline-flex h-12 min-w-28 shrink-0 items-center justify-center rounded-[4px] border px-3 text-sm font-bold transition-colors disabled:opacity-60",
                      on
                        ? "border-good/40 bg-good/10 text-good"
                        : "border-bad/40 bg-bad/10 text-bad"
                    )}
                  >
                    {on ? a.availableBadge : a.soldOutBadge}
                  </button>
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
