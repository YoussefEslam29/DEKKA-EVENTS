// Whether this device is in demo mode (PLAN/DEKKA_PWA_APP.md §5.4, 4c.3). Server-only.
//
// Only pages ask. No `/api/*` route does, so nothing sample can reach a cached menu, a share
// card or a calendar file; `check:owner-tools` asserts that. The cookie grants nothing: it
// swaps in sample data for whoever holds it, and `proxy.ts` refuses their writes.
import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/demo-guard";

export async function isDemo(): Promise<boolean> {
  return (await cookies()).get(DEMO_COOKIE)?.value === "1";
}

/** Sample pages are under `/events/demo-*`; no real id ever looks like that. */
export const isDemoId = (id: string) => id.startsWith("demo-");
