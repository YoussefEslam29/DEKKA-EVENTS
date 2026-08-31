/**
 * Exercises the parts of lib/ratelimit.ts that don't need Redis: the bucket table, the
 * IP resolver, and — the one that actually matters — that an unconfigured install fails
 * *open* rather than locking everyone out.
 *
 *   npm run check:ratelimit
 *
 * Deliberately not covered here (stated in PLAN/rate-limiting.md §8): behaviour under
 * real concurrent load, and whether Upstash's sliding window stays exact across
 * instances. That is Upstash's correctness, not this app's.
 */
import {
  __buckets,
  __configured,
  clientIp,
  consumeRateLimit,
  peekRateLimit,
  rateLimit,
  type Bucket,
} from "../lib/ratelimit";

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

function req(headers: Record<string, string>): Request {
  return new Request("https://dekka.example/api/x", { headers });
}

// --- 1. Every bucket has a sane limit and a parseable window ---------------------
const EXPECTED: Bucket[] = [
  "signin-email",
  "signin-ip",
  "register",
  "forgot-password-ip",
  "forgot-password-email",
  "reserve",
  "upload",
  "health",
];
for (const bucket of EXPECTED) {
  const spec = __buckets[bucket];
  if (!spec) {
    fail(`bucket "${bucket}" is missing from the table`);
    continue;
  }
  if (!Number.isInteger(spec.limit) || spec.limit <= 0) {
    fail(`bucket "${bucket}" has a nonsensical limit: ${spec.limit}`);
  }
  if (!/^\d+ [smh]$/.test(spec.window)) {
    fail(`bucket "${bucket}" has an unparseable window: ${spec.window}`);
  }
}
const extra = Object.keys(__buckets).filter((b) => !EXPECTED.includes(b as Bucket));
if (extra.length) fail(`unexpected buckets present (update this check): ${extra.join(", ")}`);

// --- 2. IP resolution -----------------------------------------------------------
const ipCases: Array<[Record<string, string>, string, string]> = [
  [{ "x-forwarded-for": "1.2.3.4" }, "1.2.3.4", "single x-forwarded-for"],
  [
    { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
    "1.2.3.4",
    "takes the first entry of a proxy chain",
  ],
  [{ "x-forwarded-for": "  1.2.3.4  " }, "1.2.3.4", "trims whitespace"],
  [{ "x-real-ip": "9.9.9.9" }, "9.9.9.9", "falls back to x-real-ip"],
  [
    { "x-forwarded-for": "1.2.3.4", "x-real-ip": "9.9.9.9" },
    "1.2.3.4",
    "prefers x-forwarded-for over x-real-ip",
  ],
  [{}, "unknown", "no headers shares the 'unknown' bucket, rather than being exempt"],
  [{ "x-forwarded-for": "" }, "unknown", "empty header is not treated as an IP"],
  [{ "x-forwarded-for": " , 5.6.7.8" }, "unknown", "empty first entry falls through"],
];
for (const [headers, expected, label] of ipCases) {
  const got = clientIp(req(headers));
  if (got !== expected) fail(`clientIp — ${label}: expected ${expected}, got ${got}`);
}

// --- 3. Unconfigured must fail OPEN ---------------------------------------------
// The whole point: a limiter that turns a missing env var into a total auth outage is
// worse than the abuse it prevents. This asserts the documented tradeoff really holds.
async function main() {
  if (__configured) {
    console.log(
      "note: UPSTASH_REDIS_REST_* are set in this environment, so the fail-open " +
        "assertions below are skipped (they only apply to an unconfigured install)."
    );
  } else {
    const r = await rateLimit("register", "1.2.3.4");
    if (!("ok" in r)) fail("unconfigured rateLimit() rejected — it must fail open");

    if (!(await peekRateLimit("signin-email", "someone@example.test"))) {
      fail("unconfigured peekRateLimit() returned false — it must fail open");
    }

    // Must not throw.
    await consumeRateLimit("signin-email", "someone@example.test");
  }

  if (failures.length) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(
    `ratelimit: all checks pass — ${EXPECTED.length} buckets valid, ` +
      `${ipCases.length} IP cases correct, unconfigured install fails open.`
  );
}

main();
