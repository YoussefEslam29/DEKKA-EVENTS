// Security headers for every page (`PLAN/SITE_ROADMAP.md` S6). Imported by next.config.ts,
// so plain TypeScript with no `@/` imports and nothing that needs a request.

/**
 * Where browsers send Content-Security-Policy violation reports: Sentry's "security"
 * ingest endpoint for this project, derived from the public DSN
 * (`https://<key>@<host>/<projectId>` → `https://<host>/api/<projectId>/security/?sentry_key=<key>`).
 * `null` when there is no DSN or it doesn't parse: the policy still applies, it just
 * reports to the browser console only.
 */
export function cspReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (url.protocol !== "https:" || !url.username || !/^\d+$/.test(projectId)) return null;
    return `https://${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

/**
 * The policy, as a list of directives. Shipped as **Report-Only** first: the site has an
 * inline early script (lib/pwa.ts), Next's own inline RSC scripts, a Google Maps iframe,
 * Sentry and Speed Insights, and the reports show what a real visit loads before anything
 * is blocked. `'unsafe-inline'` on scripts is what Next needs without per-request nonces;
 * enforcing a nonce-based policy needs `proxy.ts` (Next's CSP guide) and is the next step.
 */
export function contentSecurityPolicy(reportUri: string | null): string {
  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io https://va.vercel-scripts.com",
    "frame-src https://www.google.com https://maps.google.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Sign-in posts to our own /api/auth and may redirect on to a provider's consent page.
    "form-action 'self' https://accounts.google.com https://www.facebook.com https://appleid.apple.com",
    "frame-ancestors 'none'",
  ];
  if (reportUri) directives.push(`report-uri ${reportUri}`);
  return directives.join("; ");
}

/**
 * Headers for every route. `X-Frame-Options` duplicates `frame-ancestors` for browsers
 * that predate CSP2, and is enforced today even while the CSP only reports.
 */
export function securityHeaders(dsn: string | undefined): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      // The door-code screen keeps the screen awake (Wake Lock); nothing uses the rest.
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(self)",
    },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(cspReportUri(dsn)) },
  ];
}
