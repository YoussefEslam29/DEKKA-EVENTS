// POST /api/demo — turn demo mode on for this device (admin) (PLAN/DEKKA_PWA_APP.md §5.4,
// 4c.3). Sets one cookie: two hours, not httpOnly (it holds no secret, and "Leave demo"
// clears it in the browser). It grants nothing: it swaps sample data in for whoever holds
// it, and proxy.ts refuses that device's writes, so the database sees nothing.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { DEMO_COOKIE, DEMO_MAX_AGE_SECONDS } from "@/lib/demo-guard";

export async function POST(request: Request) {
  return handle("POST /api/demo", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const response = NextResponse.json({ data: { on: true, maxAge: DEMO_MAX_AGE_SECONDS } });
    response.cookies.set(DEMO_COOKIE, "1", {
      maxAge: DEMO_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      httpOnly: false,
    });
    return response;
  });
}
