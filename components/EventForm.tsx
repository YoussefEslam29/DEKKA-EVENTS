"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, FormRow, Label } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surface";
import { toLocalInputValue, fromLocalInputValue, CAFE_TIMEZONE } from "@/lib/format";
import { EVENT_STATUSES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import type { EventDTO } from "@/lib/data";

type Props = { event?: EventDTO };

const blank = {
  titleAr: "",
  titleEn: "",
  descriptionAr: "",
  descriptionEn: "",
  locationAr: "",
  locationEn: "",
  mapUrl: "",
  coverImage: "",
  startsAt: "",
  doorsOpenAt: "",
  price: "0",
  capacity: "",
  instapayNumber: "",
  termsAr: "",
  termsEn: "",
  status: "draft" as (typeof EVENT_STATUSES)[number],
};

/**
 * Create/edit form for an event. Date fields are wall-clock in the cafe's
 * timezone: the admin types "20:00" and means 20:00 in Cairo regardless of where
 * they are, so values are converted on the way in and out.
 */
export function EventForm({ event }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [methods, setMethods] = useState<PaymentMethod[]>(
    event?.paymentMethods ?? ["cash"]
  );
  const [form, setForm] = useState({
    ...blank,
    ...(event
      ? {
          titleAr: event.titleAr,
          titleEn: event.titleEn,
          descriptionAr: event.descriptionAr,
          descriptionEn: event.descriptionEn,
          locationAr: event.locationAr,
          locationEn: event.locationEn,
          mapUrl: event.mapUrl,
          coverImage: event.coverImage,
          startsAt: toLocalInputValue(event.startsAt),
          doorsOpenAt: toLocalInputValue(event.doorsOpenAt),
          price: String(event.price),
          capacity: event.capacity == null ? "" : String(event.capacity),
          instapayNumber: event.instapayNumber,
          termsAr: event.termsAr,
          termsEn: event.termsEn,
          status: event.status,
        }
      : {}),
  });

  const set =
    (key: keyof typeof blank) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleMethod(method: PaymentMethod) {
    setMethods((current) =>
      current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const startsAt = fromLocalInputValue(form.startsAt);
    if (!startsAt) {
      setError(t.admin.fields.startsAt);
      setBusy(false);
      return;
    }
    if (methods.length === 0) {
      setError(t.admin.fields.paymentMethods);
      setBusy(false);
      return;
    }

    const doorsOpenAt = fromLocalInputValue(form.doorsOpenAt);
    const payload = {
      titleAr: form.titleAr,
      titleEn: form.titleEn,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionEn,
      locationAr: form.locationAr,
      locationEn: form.locationEn,
      mapUrl: form.mapUrl,
      coverImage: form.coverImage,
      startsAt: startsAt.toISOString(),
      doorsOpenAt: doorsOpenAt ? doorsOpenAt.toISOString() : null,
      price: Number(form.price) || 0,
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      paymentMethods: methods,
      instapayNumber: form.instapayNumber,
      termsAr: form.termsAr,
      termsEn: form.termsEn,
      status: form.status,
    };

    try {
      const res = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t.common.somethingWrong);
        return;
      }
      router.push(`/admin/events/${event?.id ?? body.data.id}`);
      router.refresh();
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="mb-4 p-5">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={t.admin.fields.titleAr} htmlFor="titleAr">
            <Input id="titleAr" dir="rtl" value={form.titleAr} onChange={set("titleAr")} required />
          </FormRow>
          <FormRow label={t.admin.fields.titleEn} htmlFor="titleEn">
            <Input id="titleEn" dir="ltr" value={form.titleEn} onChange={set("titleEn")} required />
          </FormRow>
          <FormRow label={t.admin.fields.descriptionAr} htmlFor="descriptionAr">
            <Textarea id="descriptionAr" dir="rtl" rows={4} value={form.descriptionAr} onChange={set("descriptionAr")} />
          </FormRow>
          <FormRow label={t.admin.fields.descriptionEn} htmlFor="descriptionEn">
            <Textarea id="descriptionEn" dir="ltr" rows={4} value={form.descriptionEn} onChange={set("descriptionEn")} />
          </FormRow>
          <FormRow label={t.admin.fields.locationAr} htmlFor="locationAr">
            <Input id="locationAr" dir="rtl" value={form.locationAr} onChange={set("locationAr")} />
          </FormRow>
          <FormRow label={t.admin.fields.locationEn} htmlFor="locationEn">
            <Input id="locationEn" dir="ltr" value={form.locationEn} onChange={set("locationEn")} />
          </FormRow>
          <FormRow label={t.admin.fields.mapUrl} htmlFor="mapUrl" hint={t.common.optional}>
            <Input id="mapUrl" dir="ltr" value={form.mapUrl} onChange={set("mapUrl")} />
          </FormRow>
          <FormRow label={t.admin.fields.coverImage} htmlFor="coverImage" hint={t.common.optional}>
            <Input id="coverImage" dir="ltr" value={form.coverImage} onChange={set("coverImage")} />
          </FormRow>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={t.admin.fields.startsAt} htmlFor="startsAt" hint={CAFE_TIMEZONE}>
            <Input
              id="startsAt"
              type="datetime-local"
              dir="ltr"
              value={form.startsAt}
              onChange={set("startsAt")}
              required
            />
          </FormRow>
          <FormRow label={t.admin.fields.doorsOpenAt} htmlFor="doorsOpenAt" hint={t.common.optional}>
            <Input
              id="doorsOpenAt"
              type="datetime-local"
              dir="ltr"
              value={form.doorsOpenAt}
              onChange={set("doorsOpenAt")}
            />
          </FormRow>
          <FormRow label={t.admin.fields.price} htmlFor="price">
            <Input
              id="price"
              type="number"
              min={0}
              step="1"
              dir="ltr"
              value={form.price}
              onChange={set("price")}
              required
            />
          </FormRow>
          <FormRow label={t.admin.fields.capacity} htmlFor="capacity" hint={t.common.optional}>
            <Input
              id="capacity"
              type="number"
              min={1}
              step="1"
              dir="ltr"
              value={form.capacity}
              onChange={set("capacity")}
            />
          </FormRow>
        </div>

        <div className="mb-4">
          <Label>{t.admin.fields.paymentMethods}</Label>
          <div className="flex gap-4">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="inline-flex items-center gap-2 text-sm font-semibold">
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
        </div>

        {methods.includes("instapay") ? (
          <FormRow label={t.admin.fields.instapayNumber} htmlFor="instapayNumber">
            <Input
              id="instapayNumber"
              dir="ltr"
              value={form.instapayNumber}
              onChange={set("instapayNumber")}
            />
          </FormRow>
        ) : null}
      </Card>

      <Card className="mb-4 p-5">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={t.admin.fields.termsAr} htmlFor="termsAr" hint={t.common.optional}>
            <Textarea id="termsAr" dir="rtl" rows={4} value={form.termsAr} onChange={set("termsAr")} />
          </FormRow>
          <FormRow label={t.admin.fields.termsEn} htmlFor="termsEn" hint={t.common.optional}>
            <Textarea id="termsEn" dir="ltr" rows={4} value={form.termsEn} onChange={set("termsEn")} />
          </FormRow>
        </div>
        <FormRow label={t.admin.fields.status} htmlFor="status" className="max-w-xs">
          <Select id="status" value={form.status} onChange={set("status")}>
            {EVENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.event.status[status]}
              </option>
            ))}
          </Select>
        </FormRow>
      </Card>

      {error ? <p className="mb-3 text-sm font-semibold text-bad">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.common.saving : event ? t.common.save : t.admin.createEvent}
        </Button>
        <Button type="button" variant="lightGhost" size="lg" onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
