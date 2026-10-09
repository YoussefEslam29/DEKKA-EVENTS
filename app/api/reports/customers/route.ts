// GET /api/reports/customers?eventId=&q= — the Customers list as a CSV (admin)
// (PLAN/SITE_ROADMAP.md F5): every recorded entry (voided ones left out), newest first,
// with the same night and search filters as the screen.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { getAllCheckIns } from "@/lib/data";
import { dayKey, toLocalInputValue } from "@/lib/format";
import { csvHeaders, toCsv } from "@/lib/csv";

/** Far above a year of nights at cafe scale; the screen itself shows 500. */
const EXPORT_LIMIT = 20_000;

export async function GET(request: Request) {
  return handle("GET /api/reports/customers", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const params = new URL(request.url).searchParams;
    const rows = await getAllCheckIns({
      eventId: params.get("eventId") || undefined,
      q: params.get("q")?.slice(0, 100) || undefined,
      limit: EXPORT_LIMIT,
    });
    const csv = toCsv([
      [
        "Recorded / وقت التسجيل",
        "Night date / تاريخ الليلة",
        "Night / الليلة",
        "Name / الاسم",
        "Phone / الموبايل",
        "Payment / الدفع",
        "Amount (EGP) / المبلغ",
        "Gender / النوع",
        "Note / ملاحظة",
      ],
      ...rows.map((r) => [
        toLocalInputValue(r.createdAt).replace("T", " "),
        r.eventStartsAt ? dayKey(r.eventStartsAt) : "",
        r.eventTitleEn || r.eventTitleAr,
        r.name,
        r.phone,
        r.paymentMethod,
        r.amount,
        r.gender ?? "",
        r.note,
      ]),
    ]);
    return new NextResponse(csv, { headers: csvHeaders(`dekka-customers-${dayKey(new Date())}.csv`) });
  });
}
