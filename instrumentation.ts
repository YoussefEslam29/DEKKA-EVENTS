// Next.js instrumentation hook — runs once per server runtime at startup.
// This is what wires Sentry into the server; without it only the browser reports.
// See PLAN/observability.md.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Catches throws from Server Components and the rendering pipeline — the errors that
 * never pass through `lib/api.ts`'s `handle()` because they aren't API routes.
 * A no-op when Sentry was never initialised.
 */
export const onRequestError = Sentry.captureRequestError;
