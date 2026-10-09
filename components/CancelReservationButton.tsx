"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";

/**
 * Cancel a reservation straight from My Events (`PLAN/SITE_ROADMAP.md` F4); before this it
 * was only possible from the event page. Same route and ownership check as there
 * (`DELETE /api/reservations/:id`), with a confirmation, since the spot goes to someone else.
 */
export function CancelReservationButton({ reservationId, title }: { reservationId: string; title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(t.myEvents.confirmCancel.replace("{title}", title))) return;
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else {
        const body = await res.json().catch(() => null);
        setFailed(body?.error === "DEMO_MODE" ? t.demo.blocked : t.common.somethingWrong);
      }
    } catch {
      setFailed(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="ghost" className="min-h-11 text-bad" onClick={cancel} disabled={busy}>
        {t.event.cancelReservation}
      </Button>
      {failed ? (
        <span role="alert" className="text-xs text-bad">
          {failed}
        </span>
      ) : null}
    </span>
  );
}
