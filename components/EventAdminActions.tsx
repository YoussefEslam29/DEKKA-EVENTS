"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import type { EventStatus } from "@/lib/constants";

/** Lifecycle buttons for one event: draft → published → closed → happened → archived. */
export function EventAdminActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: EventStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t.admin.confirmDelete)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/events");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  // Only the transitions that make sense from here are offered.
  const actions: { label: string; to: EventStatus }[] = [];
  if (status !== "published") actions.push({ label: t.admin.publish, to: "published" });
  if (status === "published") actions.push({ label: t.admin.close, to: "closed" });
  if (status === "published" || status === "closed") {
    actions.push({ label: t.admin.markHappened, to: "happened" });
  }
  if (status !== "draft") actions.push({ label: t.admin.unpublish, to: "draft" });
  if (status === "happened") actions.push({ label: t.admin.archive, to: "archived" });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.to + action.label}
          variant="lightOutline"
          size="sm"
          disabled={busy}
          onClick={() => setStatus(action.to)}
        >
          {action.label}
        </Button>
      ))}
      <Button variant="danger" size="sm" disabled={busy} onClick={remove}>
        {t.admin.deleteEvent}
      </Button>
    </div>
  );
}
