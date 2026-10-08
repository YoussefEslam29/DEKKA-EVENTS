"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { EVENT_TEMPLATE_KINDS, PAYMENT_METHODS, type EventTemplateKind, type PaymentMethod } from "@/lib/constants";
import { site } from "@/lib/site";
import { uploadImage } from "@/lib/upload-image";
import type { EventTemplateDTO } from "@/lib/data";

/**
 * Create / edit a template (`PLAN/DEKKA_PWA_APP.md` §4) on `/admin/templates`.
 *
 * Two parts: the template's own fields (button name, night or activity, usual
 * time) and "the event it creates" — the same fields and labels as
 * `EventForm`, minus the date and the status, which belong to each occurrence.
 * A brand-new template starts from the cafe's own address, like a new event.
 */
export function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template?: EventTemplateDTO;
  onSaved: (template: EventTemplateDTO) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const tt = t.templates;
  const f = t.admin.fields;

  const [form, setForm] = useState({
    nameAr: template?.nameAr ?? "",
    nameEn: template?.nameEn ?? "",
    defaultTime: template?.defaultTime ?? "20:00",
    titleAr: template?.titleAr ?? "",
    titleEn: template?.titleEn ?? "",
    descriptionAr: template?.descriptionAr ?? "",
    descriptionEn: template?.descriptionEn ?? "",
    locationAr: template?.locationAr ?? site.addressAr,
    locationEn: template?.locationEn ?? site.addressEn,
    mapUrl: template?.mapUrl ?? site.maps,
    coverImage: template?.coverImage ?? "",
    price: template ? String(template.price) : "0",
    capacity: template?.capacity == null ? "" : String(template.capacity),
    instapayNumber: template?.instapayNumber ?? "",
    termsAr: template?.termsAr ?? "",
    termsEn: template?.termsEn ?? "",
  });
  const [kind, setKind] = useState<EventTemplateKind>(template?.kind ?? "night");
  const [isPoster, setIsPoster] = useState(template?.isPoster ?? false);
  const [methods, setMethods] = useState<PaymentMethod[]>(template?.paymentMethods ?? ["cash"]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));

  const toggleMethod = (method: PaymentMethod) =>
    setMethods((list) => (list.includes(method) ? list.filter((m) => m !== method) : [...list, method]));

  async function handlePoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const result = await uploadImage(file);
    setUploading(false);
    if ("url" in result) {
      setForm((current) => ({ ...current, coverImage: result.url }));
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
    if (methods.length === 0) {
      setError(f.paymentMethods);
      return;
    }
    const payload = {
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      kind,
      defaultTime: form.defaultTime,
      titleAr: form.titleAr,
      titleEn: form.titleEn,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn,
      locationAr: form.locationAr,
      locationEn: form.locationEn,
      mapUrl: form.mapUrl,
      coverImage: form.coverImage,
      isPoster,
      price: Number(form.price) || 0,
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      paymentMethods: methods,
      instapayNumber: form.instapayNumber,
      termsAr: form.termsAr,
      termsEn: form.termsEn,
    };

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(template ? `/api/event-templates/${template.id}` : "/api/event-templates", {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t.common.somethingWrong);
        return;
      }
      onSaved(body.data as EventTemplateDTO);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-lg font-bold">{template ? tt.editTemplate : tt.newTemplate}</h2>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={tt.templateNameAr} htmlFor="tf-nameAr">
            <Input id="tf-nameAr" dir="rtl" value={form.nameAr} onChange={set("nameAr")} required maxLength={80} />
          </FormRow>
          <FormRow label={tt.templateNameEn} htmlFor="tf-nameEn">
            <Input id="tf-nameEn" dir="ltr" value={form.nameEn} onChange={set("nameEn")} required maxLength={80} />
          </FormRow>
          <FormRow label={tt.kindLabel} htmlFor="tf-kind">
            <Select id="tf-kind" value={kind} onChange={(e) => setKind(e.target.value as EventTemplateKind)}>
              {EVENT_TEMPLATE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tt.kind[k]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label={tt.defaultTime} htmlFor="tf-time">
            <Input id="tf-time" type="time" dir="ltr" value={form.defaultTime} onChange={set("defaultTime")} required />
          </FormRow>
        </div>

        <h3 className="dk-hairline mb-4 mt-2 border-t pt-4 text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
          {tt.eventDetails}
        </h3>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={f.titleAr} htmlFor="tf-titleAr">
            <Input id="tf-titleAr" dir="rtl" value={form.titleAr} onChange={set("titleAr")} required maxLength={160} />
          </FormRow>
          <FormRow label={f.titleEn} htmlFor="tf-titleEn">
            <Input id="tf-titleEn" dir="ltr" value={form.titleEn} onChange={set("titleEn")} required maxLength={160} />
          </FormRow>
          <FormRow label={f.descriptionAr} htmlFor="tf-descAr">
            <Textarea id="tf-descAr" dir="rtl" rows={3} value={form.descriptionAr} onChange={set("descriptionAr")} />
          </FormRow>
          <FormRow label={f.descriptionEn} htmlFor="tf-descEn">
            <Textarea id="tf-descEn" dir="ltr" rows={3} value={form.descriptionEn} onChange={set("descriptionEn")} />
          </FormRow>
          <FormRow label={f.locationAr} htmlFor="tf-locAr">
            <Input id="tf-locAr" dir="rtl" value={form.locationAr} onChange={set("locationAr")} />
          </FormRow>
          <FormRow label={f.locationEn} htmlFor="tf-locEn">
            <Input id="tf-locEn" dir="ltr" value={form.locationEn} onChange={set("locationEn")} />
          </FormRow>
          <FormRow label={f.mapUrl} htmlFor="tf-map" hint={t.common.optional}>
            <Input id="tf-map" dir="ltr" value={form.mapUrl} onChange={set("mapUrl")} />
          </FormRow>
        </div>

        {/* Upload-only, like events (PLAN/SITE_ROADMAP.md S7). */}
        <div className="mb-4">
          <p className="dk-label mb-1.5 text-sm font-semibold">
            {f.coverImage} <span className="dk-muted font-normal">({t.common.optional})</span>
          </p>
          {form.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin-only preview, same as EventForm
            <img src={form.coverImage} alt="" className="mb-3 h-32 w-auto max-w-xs rounded-[4px] border border-line object-cover" />
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handlePoster}
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
            {form.coverImage ? (
              <Button
                type="button"
                variant="lightGhost"
                size="sm"
                className="h-11"
                onClick={() => setForm((current) => ({ ...current, coverImage: "" }))}
              >
                {t.admin.removeImage}
              </Button>
            ) : null}
          </div>
          <label className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-gold-deep)]"
              checked={isPoster}
              onChange={(e) => setIsPoster(e.target.checked)}
            />
            {f.isPoster}
          </label>
        </div>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={f.price} htmlFor="tf-price">
            <Input id="tf-price" type="number" min={0} step="1" dir="ltr" value={form.price} onChange={set("price")} required />
          </FormRow>
          <FormRow label={f.capacity} htmlFor="tf-capacity" hint={t.common.optional}>
            <Input id="tf-capacity" type="number" min={1} step="1" dir="ltr" value={form.capacity} onChange={set("capacity")} />
          </FormRow>
        </div>

        <fieldset className="mb-4">
          <legend className="dk-label mb-1.5 block text-sm font-semibold">{f.paymentMethods}</legend>
          <div className="flex gap-4">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-gold-deep)]"
                  checked={methods.includes(method)}
                  onChange={() => toggleMethod(method)}
                />
                {method === "cash" ? t.event.cash : t.event.instapay}
              </label>
            ))}
          </div>
        </fieldset>

        {methods.includes("instapay") ? (
          <FormRow label={f.instapayNumber} htmlFor="tf-instapay" className="max-w-sm">
            <Input id="tf-instapay" dir="ltr" value={form.instapayNumber} onChange={set("instapayNumber")} />
          </FormRow>
        ) : null}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={f.termsAr} htmlFor="tf-termsAr" hint={t.common.optional}>
            <Textarea id="tf-termsAr" dir="rtl" rows={3} value={form.termsAr} onChange={set("termsAr")} />
          </FormRow>
          <FormRow label={f.termsEn} htmlFor="tf-termsEn" hint={t.common.optional}>
            <Textarea id="tf-termsEn" dir="ltr" rows={3} value={form.termsEn} onChange={set("termsEn")} />
          </FormRow>
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
