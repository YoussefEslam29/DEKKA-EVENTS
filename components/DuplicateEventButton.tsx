"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import type { EventDTO } from "@/lib/data";

/**
 * Clones an event into a new draft, one week later at the same time of day —
 * the weekly-recurrence workaround decided in PLAN/fix_Events.md §2a (no
 * scheduler): open last week's event, Duplicate, swap the poster, publish.
 */
export function DuplicateEventButton({ event }: { event: EventDTO }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const startsAt = new Date(event.startsAt);
      startsAt.setDate(startsAt.getDate() + 7);

      const payload = {
        titleAr: event.titleAr,
        titleEn: event.titleEn,
        descriptionAr: event.descriptionAr,
        descriptionEn: event.descriptionEn,
        locationAr: event.locationAr,
        locationEn: event.locationEn,
        mapUrl: event.mapUrl,
        coverImage: event.coverImage,
        isPoster: event.isPoster,
        startsAt: startsAt.toISOString(),
        price: event.price,
        capacity: event.capacity,
        paymentMethods: event.paymentMethods,
        instapayNumber: event.instapayNumber,
        termsAr: event.termsAr,
        termsEn: event.termsEn,
        status: "draft",
      };

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.ok) {
        router.push(`/admin/events/${body.data.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="lightOutline" size="sm" disabled={busy} onClick={duplicate}>
      {t.admin.duplicateEvent}
    </Button>
  );
}
