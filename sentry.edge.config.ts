// Sentry — Edge runtime. Loaded by `instrumentation.ts`'s `register()`.
// Nothing in this app runs on the edge today (every route is Node), but Next loads this
// runtime for middleware and edge routes, and an unconfigured runtime is a silent hole
// the day one is added. See PLAN/observability.md.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    enableLogs: false,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
