// Rate limiting — see PLAN/rate-limiting.md for the full reasoning.
//
// Shaped like `guard()` in lib/rbac.ts on purpose, so a route reads the same way:
//
//   const rl = await rateLimit("register", clientIp(request));
//   if ("response" in rl) return rl.response;
//
// Backed by Upstash Redis rather than an in-memory counter because every Vercel
// invocation is a separate process: an in-memory limit of 5 is really 5 *per instance*,
// which under real concurrency is barely a limit at all.
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
import { jsonError } from "@/lib/api";

/**
 * Every limit in the app, in one table. Changing a limit is a one-line edit here and no
 * route hardcodes a number. Windows are Upstash duration strings.
 */
const BUCKETS = {
  // Two sign-in buckets, checked together: per-email stops a targeted brute force
  // against one account, per-IP stops one machine spraying many accounts. Neither
  // covers the other.
  "signin-email": { limit: 10, window: "10 m" },
  "signin-ip": { limit: 30, window: "10 m" },
  register: { limit: 5, window: "1 h" },
  // The tightest limits in the table. This is the only anonymous endpoint that sends
  // email, so it is simultaneously a way to spam a real person's inbox and a way to
  // run up the mail provider's bill. Keyed both ways: per-IP stops one machine
  // hammering many addresses, per-email stops many machines hammering one person.
  "forgot-password-ip": { limit: 5, window: "1 h" },
  "forgot-password-email": { limit: 3, window: "1 h" },
  // Authenticated, so keyed by user id rather than IP — on shared cafe wifi an
  // IP-keyed limit would make one guest throttle everyone else.
  reserve: { limit: 10, window: "1 h" },
  upload: { limit: 20, window: "1 h" },
  // Public, unauthenticated, and touches the database. The uptime monitor uses one
  // request per 5 minutes, so this is generous by two orders of magnitude.
  health: { limit: 60, window: "1 m" },
} as const satisfies Record<string, { limit: number; window: `${number} ${"s" | "m" | "h"}` }>;

export type Bucket = keyof typeof BUCKETS;

const configured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

/**
 * Shared across limiters and kept module-level so it survives between invocations on a
 * warm instance: a caller already known to be over its limit is rejected in-process
 * without a Redis round trip at all.
 */
const ephemeralCache = new Map<string, number>();

const limiters = new Map<Bucket, Ratelimit>();

/**
 * One client shared by every bucket. `Redis.fromEnv()` per limiter would build six
 * separate HTTP clients for what is one upstream. Lazy so it is never constructed on an
 * unconfigured install, where `fromEnv()` would throw.
 */
let redis: Redis | undefined;
function redisClient(): Redis {
  redis ??= Redis.fromEnv();
  return redis;
}

function limiterFor(bucket: Bucket): Ratelimit {
  let limiter = limiters.get(bucket);
  if (!limiter) {
    const { limit, window } = BUCKETS[bucket];
    limiter = new Ratelimit({
      redis: redisClient(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `dekka:rl:${bucket}`,
      // Off deliberately: analytics costs extra Redis commands per check against a
      // 10k/day free tier, and buys a dashboard nobody here would read.
      analytics: false,
      ephemeralCache,
    });
    limiters.set(bucket, limiter);
  }
  return limiter;
}

let warnedUnconfigured = false;

/**
 * Warn once per process when limits are silently inactive. Loud in production because a
 * deploy missing these vars is unprotected while looking completely healthy — the one
 * real cost of the fail-open policy below.
 */
function warnUnconfiguredOnce() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  const message =
    "UPSTASH_REDIS_REST_URL/TOKEN are not set — rate limiting is INACTIVE. " +
    "Every limited endpoint accepts unlimited requests.";
  console.warn(`[ratelimit] ${message}`);
  if (process.env.NODE_ENV === "production") {
    Sentry.captureMessage(`[ratelimit] ${message}`, "warning");
  }
}

export type RateLimitResult = { ok: true } | { response: NextResponse };

/**
 * Checks one bucket for one identifier.
 *
 * **Fails open**, deliberately (PLAN/rate-limiting.md §3): both when Upstash is
 * unconfigured and when a check throws. A limiter that turns a third-party blip into
 * "nobody at Dekka can log in" has done more damage than the abuse it prevents. The
 * tradeoff is stated rather than hidden — an unconfigured deploy warns, and a failing
 * check reports to Sentry.
 */
export async function rateLimit(
  bucket: Bucket,
  identifier: string
): Promise<RateLimitResult> {
  if (!configured) {
    warnUnconfiguredOnce();
    return { ok: true };
  }

  try {
    const { success, reset } = await limiterFor(bucket).limit(identifier);
    if (success) return { ok: true };

    // `reset` is a unix timestamp in ms; Retry-After is whole seconds, floored at 1 so
    // a sub-second remainder never becomes "retry immediately".
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    const response = jsonError("Too many requests", 429, { code: "RATE_LIMITED", retryAfter });
    response.headers.set("Retry-After", String(retryAfter));
    return { response };
  } catch (error) {
    console.error(`[ratelimit] check failed for ${bucket}`, error);
    Sentry.captureException(error, { tags: { bucket, stage: "ratelimit" } });
    return { ok: true };
  }
}

/**
 * Is this identifier still under its limit, **without** spending an attempt?
 *
 * Exists for the sign-in path: the email bucket must only be consumed by *failed*
 * attempts, or a member signing in legitimately on their phone and laptop burns their
 * own allowance. So the check and the charge are separate calls — peek here, then
 * `consumeRateLimit()` only once the password is known to be wrong.
 *
 * Fails open for the same reasons `rateLimit()` does.
 */
export async function peekRateLimit(
  bucket: Bucket,
  identifier: string
): Promise<boolean> {
  if (!configured) {
    warnUnconfiguredOnce();
    return true;
  }
  try {
    const { remaining } = await limiterFor(bucket).getRemaining(identifier);
    return remaining > 0;
  } catch (error) {
    console.error(`[ratelimit] peek failed for ${bucket}`, error);
    Sentry.captureException(error, { tags: { bucket, stage: "ratelimit-peek" } });
    return true;
  }
}

/**
 * Spends one attempt against a bucket, ignoring whether it was the one that tipped over
 * the edge — the caller has already decided to reject on other grounds. Pairs with
 * `peekRateLimit()`.
 */
export async function consumeRateLimit(
  bucket: Bucket,
  identifier: string
): Promise<void> {
  if (!configured) return;
  try {
    await limiterFor(bucket).limit(identifier);
  } catch (error) {
    console.error(`[ratelimit] consume failed for ${bucket}`, error);
    Sentry.captureException(error, { tags: { bucket, stage: "ratelimit-consume" } });
  }
}

/**
 * Best-effort client IP from proxy headers.
 *
 * Worth being honest about: `x-forwarded-for` is trivially spoofable unless the app sits
 * behind a proxy that overwrites it (Vercel does). So IP-keyed limits are a speed bump
 * against casual abuse, not a defence against someone rotating the header. The
 * account-keyed buckets are the ones that actually hold, because their key comes from
 * the session or the submitted credentials.
 *
 * A request with no resolvable IP shares the single "unknown" bucket rather than being
 * exempt — otherwise stripping headers would buy an unlimited allowance.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Exposed for scripts/check-ratelimit.ts. */
export const __buckets = BUCKETS;
export const __configured = configured;
