// POST /api/events/:id/report — generate (first click) or refresh (every click
// after) this event's "Show on PDF" report: one Google Sheet + one PDF in the
// cafe's shared Drive folder, kept in sync in place (Admin_Event_PDF.md).
// Admin only. Only meaningful once the event is "happened" or "archived".
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { handle, isValidId, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { getI18n } from "@/lib/i18n";
import { getEventReportData } from "@/lib/data";
import { computeAnalytics } from "@/lib/report/analytics";
import { buildReportView, toSheetValues } from "@/lib/report/view";
import { reportHtml } from "@/lib/report/html";
import { renderReportPdf } from "@/lib/report/pdf";
import { reportingConfigured, syncEventReport } from "@/lib/report/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return handle("POST /api/events/:id/report", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const event = await Event.findById(id).select("status report").lean();
    if (!event) return jsonError("Not found", 404);

    if (event.status !== "happened" && event.status !== "archived") {
      return jsonError("REPORT_NOT_AVAILABLE", 409);
    }

    if (!reportingConfigured()) {
      return jsonError("REPORT_NOT_CONFIGURED", 501);
    }

    const data = await getEventReportData(id);
    if (!data) return jsonError("Not found", 404);

    const { locale, t } = await getI18n();
    const generatedAt = new Date();
    const analytics = computeAnalytics(data);
    const view = buildReportView(data, analytics, locale, t, generatedAt);

    const pdf = await renderReportPdf(reportHtml(view, locale));

    const artifacts = await syncEventReport({
      existing: {
        spreadsheetId: event.report?.spreadsheetId ?? "",
        pdfFileId: event.report?.pdfFileId ?? "",
      },
      title: view.title,
      sheetValues: toSheetValues(view),
      pdf,
    });

    await Event.findByIdAndUpdate(id, {
      $set: { report: { ...artifacts, generatedAt } },
    });

    return NextResponse.json({
      data: {
        spreadsheetUrl: artifacts.spreadsheetUrl,
        pdfUrl: artifacts.pdfUrl,
        generatedAt: generatedAt.toISOString(),
      },
    });
  });
}
