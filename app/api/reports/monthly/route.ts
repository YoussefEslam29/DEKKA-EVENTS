// GET /api/reports/monthly?month=YYYY-MM — earnings rolled up for one month (admin)
import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { getMonthlyReport } from "@/lib/data";

export async function GET(request: Request) {
  return handle("GET /api/reports/monthly", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return jsonError("month must be formatted YYYY-MM", 400);
    }

    return NextResponse.json({ data: await getMonthlyReport(month) });
  });
}
