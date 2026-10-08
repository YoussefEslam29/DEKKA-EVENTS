"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { formatShortDate } from "@/lib/format";
import type { EventDTO } from "@/lib/data";

/**
 * "Nights to close out" on the admin overview (`PLAN/SITE_ROADMAP.md` I5): nights that are
 * over but still published or closed. Nothing marks a night `happened` on its own, and the
 * analysis report waits for it, so this asks, one tap per night. A prompt rather than a
 * cron (roadmap Q6): the owner stays the one who decides a night is done.
 */
export function CloseOutCard({ events }: { events: EventDTO[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  if (events.length === 0) return null;

  async function markHappened(id: string) {
    setBusyId(id);
    setFailedId(null);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "happened" }),
      });
      if (res.ok) router.refresh();
      else setFailedId(id);
    } catch {
      setFailedId(id);
    } finally {
      setBusyId(null);
    }
  }

  const title = (e: EventDTO) => (locale === "ar" ? e.titleAr || e.titleEn : e.titleEn || e.titleAr);

  return (
    <Card className="mb-6 border-warn/60 p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <CheckCheck className="h-4 w-4 text-gold-deep" aria-hidden />
        {t.admin.closeOut.title}
      </h2>
      <p className="dk-muted mt-1 text-sm">{t.admin.closeOut.body}</p>
      <ul className="mt-3 divide-y divide-line">
        {events.map((event) => (
          <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={`/admin/events/${event.id}`} className="min-w-0 font-semibold hover:underline">
              <span className="truncate">{title(event)}</span>
              <span className="dk-muted ms-2 text-xs font-normal">
                {formatShortDate(event.startsAt, locale)}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {failedId === event.id ? (
                <span role="alert" className="text-xs text-bad">
                  {t.common.somethingWrong}
                </span>
              ) : null}
              <Button
                variant="lightOutline"
                className="min-h-11"
                disabled={busyId !== null}
                onClick={() => markHappened(event.id)}
              >
                {t.admin.closeOut.action}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
