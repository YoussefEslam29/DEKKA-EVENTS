"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Coffee, Pencil, Plus, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { MenuItemForm } from "@/components/menu/admin/MenuItemForm";
import { MenuSections } from "@/components/menu/admin/MenuSections";
import { menuHeadline } from "@/components/menu/MenuItemCard";
import { formatMoney } from "@/lib/format";
import { localName } from "@/lib/menu";
import type { MenuCategoryDTO, MenuItemDTO } from "@/lib/data";
import { cn } from "@/lib/utils";

type Sent = { ok: boolean; body: { data?: unknown; error?: string } };

async function send(url: string, method: string, payload?: unknown): Promise<Sent> {
  try {
    const res = await fetch(url, {
      method,
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, body: {} };
  }
}

const ICON_BTN =
  "dk-icon-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] disabled:pointer-events-none disabled:opacity-40";

/**
 * `/admin/menu` (`PLAN/DEKKA_PWA_APP.md` §3): sections on top, then each
 * section's items in the shared spreadsheet grid — names, price and "pick"
 * edit in place; sold-out is one tap; order is up/down; everything else goes
 * through the full item form.
 *
 * State is local and optimistic where it's safe (moves, toggles) and the
 * server's answer is what lands in the row afterwards. Any refusal that means
 * "the screen is out of date" (`STALE_ORDER`) re-fetches the page rather than
 * guessing at a merge.
 */
export function MenuManager({ initial }: { initial: MenuCategoryDTO[] }) {
  const { t, locale } = useI18n();
  const a = t.cafeMenu.admin;
  const router = useRouter();

  const [categories, setCategories] = useState(initial);
  // Same "server is the source of truth" re-seed as CustomersGrid: a refresh
  // hands down new props, and local edits must not resurrect the old ones.
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setCategories(initial);
  }

  const [editing, setEditing] = useState<{ item?: MenuItemDTO; categoryId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Bring the form into view when it opens — on a phone it can be far above.
  useEffect(() => {
    if (!editing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [editing]);

  function explain(error?: string): string {
    if (error === "CATEGORY_NOT_EMPTY") return a.categoryNotEmpty;
    if (error === "STALE_ORDER") return a.staleOrder;
    if (error === "PRICE_SET_BY_VARIANTS") return a.priceSetBySizes;
    if (error === "SEASON_RANGE") return a.seasonRangeError;
    if (error === "DEMO_MODE") return t.demo.blocked;
    return t.common.somethingWrong;
  }

  function fail(sent: Sent) {
    setNotice(explain(sent.body.error));
    if (sent.body.error === "STALE_ORDER") router.refresh();
  }

  /** Puts a saved item where it now belongs — its section may have changed. */
  function placeItem(updated: MenuItemDTO) {
    setCategories((list) => {
      const elsewhere = list.map((c) => ({
        ...c,
        items: c.items.filter((i) => i.id !== updated.id || c.id === updated.categoryId),
      }));
      return elsewhere.map((c) => {
        if (c.id !== updated.categoryId) return c;
        const at = c.items.findIndex((i) => i.id === updated.id);
        return {
          ...c,
          items: at === -1 ? [...c.items, updated] : c.items.map((i) => (i.id === updated.id ? updated : i)),
        };
      });
    });
  }

  // --- Sections ----------------------------------------------------------

  async function addSection(names: { nameAr: string; nameEn: string }) {
    const sent = await send("/api/menu/categories", "POST", names);
    if (!sent.ok) {
      fail(sent);
      return false;
    }
    setCategories((list) => [...list, sent.body.data as MenuCategoryDTO]);
    return true;
  }

  async function patchSection(category: MenuCategoryDTO, patch: Partial<MenuCategoryDTO>) {
    const sent = await send(`/api/menu/categories/${category.id}`, "PATCH", patch);
    if (!sent.ok) {
      fail(sent);
      return false;
    }
    const saved = sent.body.data as Omit<MenuCategoryDTO, "items">;
    setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, ...saved } : c)));
    return true;
  }

  async function moveSection(index: number, delta: -1 | 1) {
    const next = [...categories];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setCategories(next);
    const sent = await send("/api/menu/categories/order", "PATCH", { ids: next.map((c) => c.id) });
    if (!sent.ok) {
      fail(sent);
      router.refresh();
    }
  }

  async function deleteSection(category: MenuCategoryDTO) {
    if (!window.confirm(a.deleteSectionConfirm.replace("{name}", localName(category, locale)))) return;
    const sent = await send(`/api/menu/categories/${category.id}`, "DELETE");
    if (!sent.ok) return fail(sent);
    setCategories((list) => list.filter((c) => c.id !== category.id));
  }

  // --- Items ---------------------------------------------------------------

  async function commitCell(id: string, key: string, value: string): Promise<boolean> {
    let patch: Record<string, unknown>;
    if (key === "price") {
      const price = Number(value);
      if (!Number.isFinite(price) || price < 0) return false;
      patch = { price };
    } else if (key === "isFeatured") {
      patch = { isFeatured: value === "yes" };
    } else {
      patch = { [key]: value.trim() };
    }
    const sent = await send(`/api/menu/items/${id}`, "PATCH", patch);
    if (!sent.ok) {
      if (sent.body.error) setNotice(explain(sent.body.error));
      return false;
    }
    placeItem(sent.body.data as MenuItemDTO);
    return true;
  }

  async function toggleAvailable(item: MenuItemDTO) {
    const available = !item.available;
    placeItem({ ...item, available });
    const sent = await send(`/api/menu/items/${item.id}/availability`, "PATCH", { available });
    if (!sent.ok) {
      placeItem(item);
      fail(sent);
    }
  }

  async function moveItem(category: MenuCategoryDTO, index: number, delta: -1 | 1) {
    const items = [...category.items];
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
    setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, items } : c)));
    const sent = await send("/api/menu/items/order", "PATCH", { ids: items.map((i) => i.id) });
    if (!sent.ok) {
      fail(sent);
      router.refresh();
    }
  }

  async function deleteItem(item: MenuItemDTO) {
    if (!window.confirm(a.deleteItemConfirm.replace("{name}", localName(item, locale)))) return;
    const sent = await send(`/api/menu/items/${item.id}`, "DELETE");
    if (!sent.ok) return fail(sent);
    setCategories((list) =>
      list.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) }))
    );
  }

  function columnsFor(category: MenuCategoryDTO): GridColumn<MenuItemDTO>[] {
    const position = (row: MenuItemDTO) => category.items.findIndex((i) => i.id === row.id);
    return [
      {
        key: "photo",
        header: a.photoColumn,
        render: (row) =>
          row.image ? (
            <Image
              src={row.image}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-[4px] object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-gold-wash text-ink-faint">
              <Coffee className="h-4 w-4" aria-hidden />
            </span>
          ),
      },
      {
        key: "nameAr",
        header: a.nameAr,
        editor: { kind: "text", value: (r) => r.nameAr, validate: (v) => v.trim().length > 0 },
        render: (r) => (
          <span dir="rtl" className="font-semibold">
            {r.nameAr}
          </span>
        ),
      },
      {
        key: "nameEn",
        header: a.nameEn,
        editor: { kind: "text", value: (r) => r.nameEn, validate: (v) => v.trim().length > 0 },
        render: (r) => <span dir="ltr">{r.nameEn}</span>,
      },
      {
        key: "price",
        header: a.price,
        align: "end",
        // Priced by its sizes: edited through the full form, not this cell.
        readOnly: (r) => r.variants.length > 0,
        editor: {
          kind: "number",
          min: 0,
          step: "1",
          value: (r) => String(r.price),
          validate: (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
        },
        render: (r) =>
          r.variants.length > 0 ? (
            <span title={a.priceFromSizes}>{menuHeadline(r, locale, t)}</span>
          ) : (
            <span className="font-semibold">{formatMoney(r.price, locale)}</span>
          ),
      },
      {
        key: "isFeatured",
        header: a.pickColumn,
        editor: {
          kind: "select",
          value: (r) => (r.isFeatured ? "yes" : "no"),
          options: [
            { value: "yes", label: t.common.yes },
            { value: "no", label: t.common.no },
          ],
        },
        render: (r) => (r.isFeatured ? <Badge tone="gold">{t.common.yes}</Badge> : "—"),
      },
      {
        key: "available",
        header: a.statusColumn,
        render: (r) => (
          <button
            type="button"
            onClick={() => void toggleAvailable(r)}
            aria-label={r.available ? a.markSoldOut : a.markAvailable}
            title={r.available ? a.markSoldOut : a.markAvailable}
            className="inline-flex min-h-11 items-center"
          >
            <Badge tone={r.available ? "good" : "bad"}>
              {r.available ? a.availableBadge : a.soldOutBadge}
            </Badge>
          </button>
        ),
      },
      {
        key: "order",
        header: a.orderColumn,
        render: (r) => {
          const i = position(r);
          return (
            <span className="flex">
              <button
                type="button"
                className={ICON_BTN}
                aria-label={a.moveUp}
                disabled={i <= 0}
                onClick={() => void moveItem(category, i, -1)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className={ICON_BTN}
                aria-label={a.moveDown}
                disabled={i === -1 || i >= category.items.length - 1}
                onClick={() => void moveItem(category, i, 1)}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            </span>
          );
        },
      },
      {
        key: "edit",
        header: t.common.edit,
        render: (r) => (
          <button
            type="button"
            className={ICON_BTN}
            aria-label={`${t.common.edit}: ${localName(r, locale)}`}
            onClick={() => setEditing({ item: r })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        ),
      },
    ];
  }

  return (
    <div>
      <PageHeader
        title={t.cafeMenu.title}
        subtitle={a.subtitle}
        action={
          <Button
            type="button"
            variant="lightPrimary"
            className="h-11"
            disabled={categories.length === 0}
            onClick={() => setEditing({})}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {a.addItem}
          </Button>
        }
      />

      {notice ? (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-[4px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm font-semibold text-bad"
        >
          <span className="pt-2.5">{notice}</span>
          <button
            type="button"
            className={ICON_BTN}
            aria-label={t.push.dismiss}
            onClick={() => setNotice(null)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div ref={formRef} className="scroll-mt-24">
        {editing ? (
          <MenuItemForm
            // Remount per item so the form never carries one item's draft into another.
            key={editing.item?.id ?? `new-${editing.categoryId ?? ""}`}
            categories={categories}
            item={editing.item}
            defaultCategoryId={editing.categoryId}
            onSaved={(item) => {
              placeItem(item);
              setEditing(null);
              setNotice(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </div>

      <MenuSections
        categories={categories}
        onAdd={addSection}
        onSave={(category, patch) => patchSection(category, patch)}
        onToggle={(category) => void patchSection(category, { isActive: !category.isActive })}
        onMove={(index, delta) => void moveSection(index, delta)}
        onDelete={(category) => void deleteSection(category)}
      />

      {categories.map((category) => (
        <section key={category.id} aria-labelledby={`admin-menu-${category.id}`} className="mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 id={`admin-menu-${category.id}`} className="flex items-center gap-2 text-lg font-bold">
              {localName(category, locale)}
              {category.isActive ? null : <Badge>{a.hidden}</Badge>}
            </h2>
            <Button
              type="button"
              variant="lightOutline"
              size="sm"
              className="h-11"
              onClick={() => setEditing({ categoryId: category.id })}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {a.addItem}
            </Button>
          </div>
          <Card className={cn("overflow-hidden p-0")}>
            <DataGrid
              rows={category.items}
              columns={columnsFor(category)}
              rowId={(row) => row.id}
              onCommit={commitCell}
              onDelete={deleteItem}
              empty={<EmptyState className="m-4">{a.emptySection}</EmptyState>}
              labels={{
                delete: t.common.delete,
                saving: t.common.saving,
                error: t.grid.saveFailed,
                editHint: t.grid.editHint,
              }}
            />
          </Card>
        </section>
      ))}
    </div>
  );
}
