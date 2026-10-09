// Demo mode's write block (PLAN/DEKKA_PWA_APP.md §5.4, 4c.3), enforced in one place rather
// than trusted to each route. The matcher only fires for `/api/*` requests that carry the
// demo cookie, so every other visitor never runs this at all.
import { NextResponse, type NextRequest } from "next/server";
import { demoBlocks } from "@/lib/demo-guard";

export function proxy(request: NextRequest) {
  if (demoBlocks(request.method, request.nextUrl.pathname)) {
    return NextResponse.json({ error: "DEMO_MODE" }, { status: 409 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [{ source: "/api/:path*", has: [{ type: "cookie", key: "dekka_demo" }] }],
};
