// GET /api/reports/monthly/csv?month=YYYY-MM — the month's report as a CSV (admin)
// (PLAN/SITE_ROADMAP.md F5): one row per night, then the totals.
import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { getMonthlyReport } from "@/lib/data";
import { toLocalInputValue } from "@/lib/format";
import { csvHeaders, toCsv } from "@/lib/csv";

export async function GET(request: Request) {
  return handle("GET /api/reports/monthly/csv", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) return jsonError("month must be formatted YYYY-MM", 400);

    const report = await getMonthlyReport(month);
    const csv = toCsv([
      [
        "Date / التاريخ",
        "Night (Arabic) / الليلة",
        "Night (English)",
        "Attendees / الحضور",
        "Reservations / الحجوزات",
        "Cash / كاش",
        "InstaPay / إنستاباي",
        "Revenue (EGP) / الإيراد",
      ],
      ...report.events.map((e) => [
        toLocalInputValue(e.startsAt).replace("T", " "),
        e.titleAr,
        e.titleEn,
        e.attendees,
        e.reservations,
        e.cash,
        e.instapay,
        e.revenue,
      ]),
      ["Total / الإجمالي", "", "", report.totalAttendees, "", report.byMethod.cash, report.byMethod.instapay, report.totalRevenue],
    ]);
    return new NextResponse(csv, { headers: csvHeaders(`dekka-report-${month}.csv`) });
  });
}
