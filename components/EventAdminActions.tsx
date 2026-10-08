"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { EVENT_TRANSITIONS, type EventStatus } from "@/lib/constants";
import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * The button for moving from `from` to `to`. The same target reads differently depending
 * on where you are: `→ published` is "Publish" from a draft but "Reopen reservations"
 * from a closed night.
 */
function transitionLabel(from: EventStatus, to: EventStatus, t: Dict): string {
  switch (to) {
    case "published":
      return from === "draft" ? t.admin.publish : t.admin.reopenReservations;
    case "closed":
      return from === "happened" ? t.admin.undoHappened : t.admin.close;
    case "happened":
      return from === "archived" ? t.admin.unarchive : t.admin.markHappened;
    case "draft":
      return t.admin.unpublish;
    case "archived":
      return t.admin.archive;
  }
}

/**
 * Lifecycle buttons for one event. Which moves exist comes from `EVENT_TRANSITIONS` — the
 * same table `PATCH /api/events/:id` enforces — so the screen can't offer a move the API
 * refuses. `hasRecords` (reservations or door rows) hides "Back to draft" and Delete,
 * which the API would refuse with `EVENT_HAS_RECORDS` anyway.
 */
export function EventAdminActions({
  eventId,
  status,
  reservationCount,
  hasRecords,
}: {
  eventId: string;
  status: EventStatus;
  reservationCount: number;
  hasRecords: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function messageFor(code: unknown): string {
    if (code === "INVALID_TRANSITION") return t.admin.invalidTransition;
    if (code === "EVENT_HAS_RECORDS") return t.admin.eventHasRecords;
    return t.common.somethingWrong;
  }

  async function setStatus(next: EventStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
      else setError(messageFor((await res.json().catch(() => ({}))).error));
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const question =
      reservationCount > 0
        ? t.admin.confirmDeleteCount.replace("{n}", String(reservationCount))
        : t.admin.confirmDelete;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/events");
        router.refresh();
      } else {
        setError(messageFor((await res.json().catch(() => ({}))).error));
      }
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  const targets = EVENT_TRANSITIONS[status].filter((to) => !(to === "draft" && hasRecords));
  const canDelete = !hasRecords && status !== "happened" && status !== "archived";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {targets.map((to) => (
          <Button
            key={to}
            variant="lightOutline"
            size="sm"
            disabled={busy}
            onClick={() => setStatus(to)}
          >
            {transitionLabel(status, to, t)}
          </Button>
        ))}
        {canDelete ? (
          <Button variant="danger" size="sm" disabled={busy} onClick={remove}>
            {t.admin.deleteEvent}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
