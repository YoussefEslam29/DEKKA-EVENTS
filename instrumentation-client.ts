// Sentry — browser. Next.js loads this file by name (it is the App Router's replacement
// for the Pages-Router-era `sentry.client.config.ts`; don't rename it).
// See PLAN/observability.md.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Only the NEXT_PUBLIC_ one is readable here. A DSN is a write-only ingest key, not a
// secret — exposing it is how browser error reporting works at all.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error tracking only. No `replayIntegration` and no `feedbackIntegration` —
    // both are quota-hungry and neither was asked for (Before_Deployment.md §8).
    tracesSampleRate: 0,
    enableLogs: false,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

/**
 * Required export, even though tracing is off. The SDK prints an "ACTION REQUIRED"
 * warning on every build without it; with `tracesSampleRate: 0` it does nothing, and
 * it means navigation instrumentation works immediately if tracing is ever turned on.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
