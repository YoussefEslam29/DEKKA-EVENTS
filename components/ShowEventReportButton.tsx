"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { formatDate, formatTime } from "@/lib/format";

type ReportMeta = { spreadsheetUrl: string; pdfUrl: string; generatedAt: string };

/**
 * "Show on PDF" (Admin_Event_PDF.md §3). Red danger-variant button in the
 * event action row, rendered by the page only once status is "happened" or
 * "archived". First click builds the Google Sheet + PDF; every click after
 * refreshes them in place and reopens the same Sheet in a new tab. Same
 * `"use client"` + `fetch` + `busy` shape as `DuplicateEventButton`.
 */
export function ShowEventReportButton({
  eventId,
  report,
}: {
  eventId: string;
  report: ReportMeta | null;
}) {
  const { t, locale } = useI18n();
  const r = t.admin.eventReport;
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<ReportMeta | null>(report);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/report`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const next = body.data as ReportMeta;
        setMeta(next);
        if (next.spreadsheetUrl) window.open(next.spreadsheetUrl, "_blank", "noopener");
      } else {
        setError(body.error === "REPORT_NOT_CONFIGURED" ? r.notConfigured : r.failed);
      }
    } catch {
      setError(r.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="danger" size="sm" disabled={busy} onClick={run}>
        {busy ? r.generating : meta ? r.regenerate : r.button}
      </Button>

      {meta && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faint">
          <a
            href={meta.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold-deep hover:underline"
          >
            {r.openSheet}
          </a>
          <a
            href={meta.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold-deep hover:underline"
          >
            {r.openPdf}
          </a>
          <span>
            {r.lastGenerated.replace(
              "{time}",
              `${formatDate(meta.generatedAt, locale)} · ${formatTime(meta.generatedAt, locale)}`
            )}
          </span>
        </p>
      )}

      {error && <p className="text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
