"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Surface";
import { Input } from "@/components/ui/Field";
import type { MenuCategoryDTO } from "@/lib/data";
import { seasonRangeOk, seasonState } from "@/lib/menu";
import { dayKey, formatDayKey } from "@/lib/format";

type Names = { nameAr: string; nameEn: string };
/** What the edit form saves: the names and the season (`null` clears a date). */
export type SectionPatch = Names & { startsOn: string | null; endsOn: string | null };
type EditDraft = Names & { startsOn: string; endsOn: string };

const ICON_BTN =
  "dk-icon-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] disabled:pointer-events-none disabled:opacity-40";

/**
 * The sections list on `/admin/menu` (`PLAN/DEKKA_PWA_APP.md` §3): add, rename,
 * show/hide, reorder, delete, and a season (§5.3, 4b.4) with a badge saying why a
 * section isn't on `/menu` right now. Every action is a callback — `MenuManager` owns
 * the requests and the state, this only lays the rows out.
 *
 * Delete stays enabled even for a section with items; the server refuses it
 * with a reason (`CATEGORY_NOT_EMPTY`) that `MenuManager` turns into a message,
 * which explains more than a greyed-out button would.
 */
export function MenuSections({
  categories,
  onAdd,
  onSave,
  onToggle,
  onMove,
  onDelete,
}: {
  categories: MenuCategoryDTO[];
  onAdd: (names: Names) => Promise<boolean>;
  onSave: (category: MenuCategoryDTO, patch: SectionPatch) => Promise<boolean>;
  onToggle: (category: MenuCategoryDTO) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (category: MenuCategoryDTO) => void;
}) {
  const { t, locale } = useI18n();
  const a = t.cafeMenu.admin;
  const [draft, setDraft] = useState<Names>({ nameAr: "", nameEn: "" });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ nameAr: "", nameEn: "", startsOn: "", endsOn: "" });
  const [rangeError, setRangeError] = useState(false);
  const today = dayKey(new Date());

  /** Why the section is or isn't on `/menu` today; nothing for an all-year one. */
  function seasonBadge(category: MenuCategoryDTO): string | null {
    const day = (d: string | null) => (d ? formatDayKey(d, locale) : "…");
    switch (seasonState(category, today)) {
      case "upcoming":
        return a.seasonUpcoming.replace("{date}", day(category.startsOn));
      case "ended":
        return a.seasonEnded.replace("{date}", day(category.endsOn));
      case "current":
        return a.seasonBadge.replace("{from}", day(category.startsOn)).replace("{until}", day(category.endsOn));
      default:
        return null;
    }
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const ok = await onAdd({ nameAr: draft.nameAr.trim(), nameEn: draft.nameEn.trim() });
    setAdding(false);
    if (ok) setDraft({ nameAr: "", nameEn: "" });
  }

  async function submitEdit(e: React.FormEvent, category: MenuCategoryDTO) {
    e.preventDefault();
    const startsOn = editDraft.startsOn || null;
    const endsOn = editDraft.endsOn || null;
    // The server refuses it too (SEASON_RANGE); saying so here saves a round trip.
    if (!seasonRangeOk(startsOn, endsOn)) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    const ok = await onSave(category, {
      nameAr: editDraft.nameAr.trim(),
      nameEn: editDraft.nameEn.trim(),
      startsOn,
      endsOn,
    });
    if (ok) setEditingId(null);
  }

  return (
    <Card className="mb-8 p-5">
      <h2 className="mb-3 text-lg font-bold">{a.sectionsTitle}</h2>

      {categories.length === 0 ? (
        <p className="dk-muted mb-4 text-sm">{a.noSections}</p>
      ) : (
        <ul className="dk-hairline mb-4 divide-y divide-line border-y">
          {categories.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-2 py-2">
              {editingId === category.id ? (
                <form
                  onSubmit={(e) => submitEdit(e, category)}
                  className="flex flex-1 flex-wrap items-center gap-2"
                >
                  <Input
                    aria-label={a.sectionNameAr}
                    dir="rtl"
                    value={editDraft.nameAr}
                    onChange={(e) => setEditDraft((d) => ({ ...d, nameAr: e.target.value }))}
                    required
                    maxLength={80}
                    className="min-w-0 flex-1 basis-40"
                  />
                  <Input
                    aria-label={a.sectionNameEn}
                    dir="ltr"
                    value={editDraft.nameEn}
                    onChange={(e) => setEditDraft((d) => ({ ...d, nameEn: e.target.value }))}
                    required
                    maxLength={80}
                    className="min-w-0 flex-1 basis-40"
                  />
                  <fieldset className="flex w-full flex-wrap items-end gap-2">
                    <legend className="sr-only">{a.seasonHint}</legend>
                    <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs font-semibold">
                      {a.seasonFrom}
                      <Input
                        type="date"
                        value={editDraft.startsOn}
                        onChange={(e) => setEditDraft((d) => ({ ...d, startsOn: e.target.value }))}
                      />
                    </label>
                    <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs font-semibold">
                      {a.seasonUntil}
                      <Input
                        type="date"
                        value={editDraft.endsOn}
                        onChange={(e) => setEditDraft((d) => ({ ...d, endsOn: e.target.value }))}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="lightGhost"
                      size="sm"
                      className="h-11"
                      disabled={!editDraft.startsOn && !editDraft.endsOn}
                      onClick={() => setEditDraft((d) => ({ ...d, startsOn: "", endsOn: "" }))}
                    >
                      {a.seasonClear}
                    </Button>
                    <p className="dk-muted w-full text-xs" aria-hidden>
                      {a.seasonHint}
                    </p>
                    {rangeError ? (
                      <p role="alert" className="w-full text-xs font-semibold text-bad">
                        {a.seasonRangeError}
                      </p>
                    ) : null}
                  </fieldset>
                  <Button type="submit" variant="lightPrimary" size="sm" className="h-11">
                    {t.common.save}
                  </Button>
                  <Button
                    type="button"
                    variant="lightGhost"
                    size="sm"
                    className="h-11"
                    onClick={() => {
                      setEditingId(null);
                      setRangeError(false);
                    }}
                  >
                    {t.common.cancel}
                  </Button>
                </form>
              ) : (
                <>
                  {/* A 12rem floor: on a phone the five 44px actions can't share a
                      line with the name, so they wrap below it instead of
                      squeezing the name to a word per line. */}
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">
                      {locale === "ar" ? category.nameAr : category.nameEn}
                      <span className="dk-muted ms-2 text-sm font-normal">
                        {locale === "ar" ? category.nameEn : category.nameAr}
                      </span>
                    </p>
                    <p className="dk-muted text-xs">
                      {a.itemCount.replace("{n}", String(category.items.length))}
                    </p>
                  </div>
                  <Badge tone={category.isActive ? "good" : "neutral"}>
                    {category.isActive ? a.visible : a.hidden}
                  </Badge>
                  {seasonBadge(category) ? (
                    <Badge tone={seasonState(category, today) === "current" ? "gold" : "neutral"}>
                      {seasonBadge(category)}
                    </Badge>
                  ) : null}
                  <div className="ms-auto flex items-center">
                    <button
                      type="button"
                      className={ICON_BTN}
                      aria-label={category.isActive ? a.hide : a.show}
                      title={category.isActive ? a.hide : a.show}
                      onClick={() => onToggle(category)}
                    >
                      {category.isActive ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      className={ICON_BTN}
                      aria-label={a.moveUp}
                      title={a.moveUp}
                      disabled={index === 0}
                      onClick={() => onMove(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={ICON_BTN}
                      aria-label={a.moveDown}
                      title={a.moveDown}
                      disabled={index === categories.length - 1}
                      onClick={() => onMove(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={ICON_BTN}
                      aria-label={t.common.edit}
                      title={t.common.edit}
                      onClick={() => {
                        setEditingId(category.id);
                        setRangeError(false);
                        setEditDraft({
                          nameAr: category.nameAr,
                          nameEn: category.nameEn,
                          startsOn: category.startsOn ?? "",
                          endsOn: category.endsOn ?? "",
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`${ICON_BTN} hover:bg-bad/10 hover:text-bad`}
                      aria-label={t.common.delete}
                      title={t.common.delete}
                      onClick={() => onDelete(category)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submitNew} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={a.sectionNameAr}
          placeholder={a.sectionNameAr}
          dir="rtl"
          value={draft.nameAr}
          onChange={(e) => setDraft((d) => ({ ...d, nameAr: e.target.value }))}
          required
          maxLength={80}
          className="min-w-0 flex-1 basis-40"
        />
        <Input
          aria-label={a.sectionNameEn}
          placeholder={a.sectionNameEn}
          dir="ltr"
          value={draft.nameEn}
          onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
          required
          maxLength={80}
          className="min-w-0 flex-1 basis-40"
        />
        <Button type="submit" variant="lightOutline" size="sm" className="h-11" disabled={adding}>
          <Plus className="h-4 w-4" aria-hidden />
          {a.addSection}
        </Button>
      </form>
    </Card>
  );
}
