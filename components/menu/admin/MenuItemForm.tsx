"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { MENU_TAGS, type MenuTag } from "@/lib/constants";
import { cheapestVariantPrice, localName } from "@/lib/menu";
import { uploadImage } from "@/lib/upload-image";
import type { MenuCategoryDTO, MenuItemDTO } from "@/lib/data";

type VariantDraft = { labelAr: string; labelEn: string; price: string };

/**
 * Add / edit one menu item (`PLAN/DEKKA_PWA_APP.md` §3). Inline on the admin
 * page rather than a modal: it's a long form, and a panel the page scrolls to
 * is easier on a phone than a dialog that has to scroll inside itself.
 *
 * Sizes follow `lib/menu.ts`'s rule — while any exist, the price field is
 * replaced by "from sizes" and the cheapest size becomes the price. The server
 * enforces the same rule; this only keeps the form from suggesting otherwise.
 */
export function MenuItemForm({
  categories,
  item,
  defaultCategoryId,
  onSaved,
  onCancel,
}: {
  categories: MenuCategoryDTO[];
  item?: MenuItemDTO;
  defaultCategoryId?: string;
  onSaved: (item: MenuItemDTO, created: boolean) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const a = t.cafeMenu.admin;

  const [form, setForm] = useState({
    category: item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
    nameAr: item?.nameAr ?? "",
    nameEn: item?.nameEn ?? "",
    descriptionAr: item?.descriptionAr ?? "",
    descriptionEn: item?.descriptionEn ?? "",
    price: item ? String(item.price) : "",
    image: item?.image ?? "",
  });
  const [variants, setVariants] = useState<VariantDraft[]>(
    (item?.variants ?? []).map((v) => ({ ...v, price: String(v.price) }))
  );
  const [tags, setTags] = useState<MenuTag[]>(item?.tags ?? []);
  const [isFeatured, setIsFeatured] = useState(item?.isFeatured ?? false);
  const [available, setAvailable] = useState(item?.available ?? true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const setVariant = (index: number, key: keyof VariantDraft, value: string) =>
    setVariants((list) => list.map((v, i) => (i === index ? { ...v, [key]: value } : v)));

  const toggleTag = (tag: MenuTag) =>
    setTags((list) => (list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]));

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after a failure
    if (!file) return;
    setUploading(true);
    setError(null);
    const result = await uploadImage(file);
    setUploading(false);
    if ("url" in result) {
      setForm((f) => ({ ...f, image: result.url }));
      return;
    }
    setError(
      result.error === "tooBig"
        ? t.admin.uploadTooBig
        : result.error === "badType"
          ? t.admin.uploadBadType
          : t.common.somethingWrong
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedVariants = variants
      .filter((v) => v.labelAr.trim() || v.labelEn.trim() || v.price.trim())
      .map((v) => ({ labelAr: v.labelAr.trim(), labelEn: v.labelEn.trim(), price: Number(v.price) }));
    if (parsedVariants.some((v) => !v.labelAr || !v.labelEn || !Number.isFinite(v.price) || v.price < 0)) {
      setError(a.sizesInvalid);
      return;
    }
    const price = cheapestVariantPrice(parsedVariants) ?? Number(form.price);
    const priceMissing = parsedVariants.length === 0 && form.price.trim() === "";
    if (priceMissing || !Number.isFinite(price) || price < 0) {
      setError(a.priceInvalid);
      return;
    }

    const payload = {
      category: form.category,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn,
      price,
      variants: parsedVariants,
      image: form.image,
      tags,
      isFeatured,
      available,
    };

    setBusy(true);
    try {
      const res = await fetch(item ? `/api/menu/items/${item.id}` : "/api/menu/items", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        const path = body.details?.[0]?.path as string | undefined;
        setError(path === "image" ? a.photoOnlyUploads : t.common.somethingWrong);
        return;
      }
      onSaved(body.data as MenuItemDTO, !item);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-lg font-bold">{item ? a.editItem : a.newItem}</h2>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={a.section} htmlFor="menu-category" className="sm:col-span-2 sm:max-w-sm">
            <Select id="menu-category" value={form.category} onChange={set("category")} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {localName(c, locale)}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label={a.nameAr} htmlFor="menu-nameAr">
            <Input id="menu-nameAr" dir="rtl" value={form.nameAr} onChange={set("nameAr")} required maxLength={120} />
          </FormRow>
          <FormRow label={a.nameEn} htmlFor="menu-nameEn">
            <Input id="menu-nameEn" dir="ltr" value={form.nameEn} onChange={set("nameEn")} required maxLength={120} />
          </FormRow>
          <FormRow label={a.descriptionAr} htmlFor="menu-descAr" hint={t.common.optional}>
            <Textarea id="menu-descAr" dir="rtl" rows={2} value={form.descriptionAr} onChange={set("descriptionAr")} maxLength={500} />
          </FormRow>
          <FormRow label={a.descriptionEn} htmlFor="menu-descEn" hint={t.common.optional}>
            <Textarea id="menu-descEn" dir="ltr" rows={2} value={form.descriptionEn} onChange={set("descriptionEn")} maxLength={500} />
          </FormRow>
        </div>

        {/* Sizes */}
        <fieldset className="mb-4">
          <legend className="dk-label mb-1 block text-sm font-semibold">{a.sizes}</legend>
          <p className="dk-muted mb-2 text-xs">{a.sizesHint}</p>
          {variants.map((variant, index) => (
            <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_6rem_auto] items-center gap-2">
              <Input
                aria-label={a.sizeLabelAr}
                placeholder={a.sizeLabelAr}
                dir="rtl"
                value={variant.labelAr}
                onChange={(e) => setVariant(index, "labelAr", e.target.value)}
                maxLength={40}
              />
              <Input
                aria-label={a.sizeLabelEn}
                placeholder={a.sizeLabelEn}
                dir="ltr"
                value={variant.labelEn}
                onChange={(e) => setVariant(index, "labelEn", e.target.value)}
                maxLength={40}
              />
              <Input
                aria-label={a.price}
                placeholder={a.price}
                type="number"
                min={0}
                step="1"
                dir="ltr"
                inputMode="numeric"
                value={variant.price}
                onChange={(e) => setVariant(index, "price", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVariants((list) => list.filter((_, i) => i !== index))}
                aria-label={a.removeSize}
                className="dk-icon-btn inline-flex h-11 w-11 items-center justify-center rounded-[4px]"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          {variants.length < 8 ? (
            <Button
              type="button"
              variant="lightOutline"
              size="sm"
              className="h-11"
              onClick={() => setVariants((list) => [...list, { labelAr: "", labelEn: "", price: "" }])}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {a.addSize}
            </Button>
          ) : null}
        </fieldset>

        <FormRow label={a.price} htmlFor="menu-price" className="max-w-xs">
          {variants.length > 0 ? (
            <p id="menu-price" className="dk-muted flex min-h-11 items-center text-sm">
              {a.priceFromSizes}
            </p>
          ) : (
            <Input
              id="menu-price"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              inputMode="numeric"
              value={form.price}
              onChange={set("price")}
              required
            />
          )}
        </FormRow>

        <fieldset className="mb-4">
          <legend className="dk-label mb-1.5 block text-sm font-semibold">{a.tagsLabel}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {MENU_TAGS.map((tag) => (
              <label key={tag} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-gold-deep)]"
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
                {t.cafeMenu.tags[tag]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mb-4">
          <p className="dk-label mb-1.5 text-sm font-semibold">
            {a.photo} <span className="dk-muted font-normal">({t.common.optional})</span>
          </p>
          {form.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin-only preview, same as EventForm
            <img src={form.image} alt="" className="mb-3 h-28 w-28 rounded-[4px] border border-line object-cover" />
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePhoto}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="lightOutline"
              size="sm"
              className="h-11"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? t.admin.uploading : t.admin.uploadImage}
            </Button>
            {form.image ? (
              <Button
                type="button"
                variant="lightGhost"
                size="sm"
                className="h-11"
                onClick={() => setForm((f) => ({ ...f, image: "" }))}
              >
                {t.admin.removeImage}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-2 flex flex-col gap-1">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-gold-deep)]"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            {a.featured}
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-gold-deep)]"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            {a.available}
          </label>
        </div>

        {error ? (
          <p role="alert" className="mb-3 text-sm font-semibold text-bad">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="lightPrimary" size="lg" disabled={busy || uploading}>
            {busy ? t.common.saving : t.common.save}
          </Button>
          <Button type="button" variant="lightGhost" size="lg" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      </Card>
    </form>
  );
}
