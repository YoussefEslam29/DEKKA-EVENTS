// GET /api/events/:id/report — build this event's analysis report and stream
// it back as a PDF (opened in a new tab by the "Show Analysis Report" button).
// Generated fresh on every request; nothing is stored. Admin only. Only
// meaningful once the event is "happened" or "archived".
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { handle, isValidId, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { getI18n } from "@/lib/i18n";
import { getEventReportData } from "@/lib/data";
import { computeAnalytics } from "@/lib/report/analytics";
import { buildReportView } from "@/lib/report/view";
import { reportHtml } from "@/lib/report/html";
import { renderReportPdf } from "@/lib/report/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle("GET /api/events/:id/report", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const event = await Event.findById(id).select("status").lean();
    if (!event) return jsonError("Not found", 404);
    if (event.status !== "happened" && event.status !== "archived") {
      return jsonError("REPORT_NOT_AVAILABLE", 409);
    }

    const data = await getEventReportData(id);
    if (!data) return jsonError("Not found", 404);

    const { locale, t } = await getI18n();
    const view = buildReportView(data, computeAnalytics(data), locale, t, new Date());
    const pdf = await renderReportPdf(reportHtml(view, locale));

    // ASCII-safe fallback name + RFC 5987 UTF-8 name for the real title.
    const asciiName = "event-analysis-report.pdf";
    const utf8Name = encodeURIComponent(`${view.title}.pdf`);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        "Cache-Control": "no-store",
      },
    });
  });
}
