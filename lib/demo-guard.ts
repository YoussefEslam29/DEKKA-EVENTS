/**
 * Demo mode's one hard rule (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.3): a device in demo mode
 * writes nothing. Pure, so the rule is unit-tested (`check:owner-tools`) and `proxy.ts`
 * only applies it.
 */

/** The per-device switch: set by `POST /api/demo`, cleared by "Leave demo" or after 2 h. */
export const DEMO_COOKIE = "dekka_demo";
export const DEMO_MAX_AGE_SECONDS = 2 * 60 * 60;

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request from a demo device is refused: anything but a read, to any `/api/*`
 * route except sign-in and sign-out (`/api/auth/*`), so leaving an account still works.
 */
export function demoBlocks(method: string, pathname: string): boolean {
  if (READS.has(method.toUpperCase())) return false;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return false;
  return pathname === "/api" || pathname.startsWith("/api/");
}
