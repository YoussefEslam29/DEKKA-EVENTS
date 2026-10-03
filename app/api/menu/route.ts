// GET /api/menu — the public cafe menu (`PLAN/DEKKA_PWA_APP.md` §3)
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getMenu } from "@/lib/data";

/**
 * Deliberately unauthenticated, like `/api/health` (developer-guide.md §3 rule
 * 9) — and for the same reason it can afford to be: it leaks nothing. The menu
 * is public by nature, and `getMenu()` without `includeHidden` returns only
 * what any guest already sees on `/menu`: visible sections, their items.
 *
 * It must also never vary by caller. `public/sw.js` caches this exact response
 * (stale-while-revalidate) for the offline page, so a role-aware answer here —
 * hidden sections for an admin, say — would end up stored on a device and
 * shown later. The admin screen reads hidden sections server-side through
 * `getMenu({ includeHidden: true })` instead, never through this route.
 */
export async function GET() {
  return handle("GET /api/menu", async () => {
    const data = await getMenu();
    return NextResponse.json({ data });
  });
}
