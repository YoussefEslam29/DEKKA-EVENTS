"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";

/**
 * "Show Analysis Report" (Admin_Event_PDF.md, simplified). Green button in the
 * event action row, rendered by the page only once status is "happened" or
 * "archived". One click opens the freshly-built PDF in a new tab — the report
 * is generated on demand and streamed, nothing is stored, so every click is
 * just up-to-date numbers with no Sheet/Drive plumbing.
 */
export function ShowEventReportButton({ eventId }: { eventId: string }) {
  const { t } = useI18n();

  return (
    <Button
      variant="success"
      size="sm"
      onClick={() =>
        window.open(`/api/events/${eventId}/report`, "_blank", "noopener")
      }
    >
      {t.admin.eventReport.button}
    </Button>
  );
}
