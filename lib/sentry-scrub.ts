// The `beforeSend` hook every Sentry runtime shares — see PLAN/observability.md §4.
//
// `Before_Deployment.md` §8 asks to *verify* rather than assume that nothing sensitive
// reaches Sentry. Doing that honestly means naming this app's own leak vectors, because
// the ones that matter here are not the ones a default install protects against:
//
//   1. `MONGODB_URI` is `mongodb+srv://user:pass@cluster/...`, and a Mongoose connection
//      failure puts it straight in the error message. It is the likeliest secret to
//      escape this app, and no field-name scrubber catches it — it's a URI, not a field
//      called `password`. Phase 3's `UPSTASH_REDIS_REST_URL` will have the same shape.
//   2. Plaintext passwords ride in POST bodies under this app's own names
//      (`password`, `newPassword`, `confirmPassword`, `currentPassword`).
//   3. The session cookie is a valid JWT.
//
// The SDK configs already decline to collect (2) and (3) — `sendDefaultPii: false`, no
// request bodies. This is the second layer, for whatever gets through anyway: an
// exception message that happens to embed a body, a breadcrumb, a nested `cause`.
//
// Verified by `scripts/check-sentry-scrub.ts` (`npm run check:sentry`).
import type { ErrorEvent } from "@sentry/nextjs";

export const REDACTED = "[redacted]";

/**
 * Any `scheme://user:pass@host` credential pair, in any string.
 *
 * Deliberately scheme-agnostic rather than `mongodb`-specific: it covers the Mongo URI
 * today, Upstash Redis in Phase 3, and whatever gets added after, without anyone having
 * to remember to come back here. Only the credential half is replaced — the host stays,
 * because "which cluster failed" is exactly the debugging value we're keeping.
 */
const CREDENTIAL_URI = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;

/** Key names whose *value* is dropped wholesale, matched case-insensitively. */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|credential|session/i;

/** Depth cap so a cyclic or pathologically deep payload can't hang the hook. */
const MAX_DEPTH = 8;

export function redactString(value: string): string {
  return value.replace(CREDENTIAL_URI, `$1${REDACTED}@`);
}

/**
 * Recursively redacts in place-ish (returns a new value; never mutates the input).
 * Arrays keep their shape so a stack frame list stays a list.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * `Sentry.init({ beforeSend })`. Returning the event sends it; returning `null` drops it
 * entirely — we never drop, because an error we can't see is worse than a redacted one.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  // Belt and braces: these are already off via `sendDefaultPii: false`, but an
  // integration or a future SDK default could reintroduce them.
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  return scrubValue(event) as ErrorEvent;
}
