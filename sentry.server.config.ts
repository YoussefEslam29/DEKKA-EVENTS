// Sentry — Node runtime. Loaded by `instrumentation.ts`'s `register()`.
// See PLAN/observability.md; the shared reasoning lives there rather than being
// repeated across the three runtime configs.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// No DSN means Sentry is simply not configured — skip init entirely rather than
// starting a client that reports nowhere. Same "absent credentials means absent, not
// half-working" rule as `enabledOAuthProviders` and `usingBlobStorage()`.
if (dsn) {
  Sentry.init({
    dsn,
    // Error tracking only (Before_Deployment.md §8). Tracing is the fastest way to burn
    // the free tier and is not what this is for.
    tracesSampleRate: 0,
    enableLogs: false,
    // No cookies, headers or IP — the session cookie here is a valid JWT.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
