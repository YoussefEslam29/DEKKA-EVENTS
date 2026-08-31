/**
 * Proves `lib/sentry-scrub.ts` actually redacts this app's secrets.
 *
 * `Before_Deployment.md` §8 asks to "confirm nothing sensitive leaks into Sentry
 * events... verify rather than assume for this app's specific field names." This is
 * that verification, runnable, in the same spirit as `scripts/check-upload-pattern.ts`.
 *
 *   npm run check:sentry
 */
import type { ErrorEvent } from "@sentry/nextjs";
import { REDACTED, scrubEvent, scrubValue } from "../lib/sentry-scrub";

const SECRETS = [
  "hunter2",
  "s3cr3t-p4ss",
  "AtlasPassw0rd",
  "rw_tok_abcdef123456",
];

/** Every string anywhere in a value, so we can assert no secret survives. */
function allStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 12) return out;
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out, depth + 1));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => allStrings(v, out, depth + 1));
  return out;
}

const event = {
  message:
    "MongooseServerSelectionError: connect ECONNREFUSED " +
    "mongodb+srv://dekka_admin:AtlasPassw0rd@dekka.abc12.mongodb.net/dekka?retryWrites=true",
  exception: {
    values: [
      {
        type: "Error",
        value:
          "Redis auth failed for redis://default:s3cr3t-p4ss@eu2-cool-cat-12345.upstash.io:6379",
      },
    ],
  },
  request: {
    url: "https://dekka.example/api/register",
    cookies: { "authjs.session-token": "eyJhbGciOi.THIS_IS_A_SESSION_JWT.sig" },
    headers: { authorization: "Bearer rw_tok_abcdef123456", "user-agent": "Mozilla/5.0" },
    data: { email: "guest@example.test", password: "hunter2" },
  },
  extra: {
    body: {
      password: "hunter2",
      newPassword: "hunter2",
      confirmPassword: "hunter2",
      currentPassword: "hunter2",
      passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
      name: "Sara",
    },
    blobToken: "rw_tok_abcdef123456",
    nested: { deep: { deeper: { uri: "mongodb://u:AtlasPassw0rd@host/db" } } },
  },
  breadcrumbs: [
    { message: "connecting to mongodb+srv://u:AtlasPassw0rd@cluster.mongodb.net" },
  ],
} as unknown as ErrorEvent;

const scrubbed = scrubEvent(event);
const strings = allStrings(scrubbed);
const failures: string[] = [];

// 1. No secret value survives anywhere in the event.
for (const secret of SECRETS) {
  const leaked = strings.filter((s) => s.includes(secret));
  if (leaked.length) {
    failures.push(`secret ${JSON.stringify(secret)} survived in: ${JSON.stringify(leaked)}`);
  }
}

// 2. The collection-level fields are gone outright.
const req = (scrubbed as { request?: Record<string, unknown> }).request;
for (const key of ["cookies", "headers", "data"]) {
  if (req && key in req) failures.push(`request.${key} was not deleted`);
}

// 3. The host half of a URI is *kept* — "which cluster failed" is the debugging value
//    we are deliberately not throwing away.
if (!strings.some((s) => s.includes("dekka.abc12.mongodb.net"))) {
  failures.push("redaction destroyed the hostname; it should keep the host, drop the credentials");
}
if (!strings.some((s) => s.includes(`mongodb+srv://${REDACTED}@`))) {
  failures.push("credential URI was not rewritten to the expected redacted form");
}

// 4. Non-sensitive context survives, or the tool is useless.
if (!strings.includes("Sara")) failures.push("benign field 'name' was destroyed");
if (!strings.some((s) => s.includes("Mozilla/5.0") || s.includes("dekka.example"))) {
  // user-agent lives under `headers`, which is deleted wholesale — the URL must remain.
  failures.push("request.url was destroyed");
}

// 5. Cycles must not hang the walk.
const cyclic: Record<string, unknown> = { password: "hunter2" };
cyclic.self = cyclic;
try {
  scrubValue(cyclic);
} catch (error) {
  failures.push(`cyclic input threw: ${String(error)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log(
  "sentry-scrub: all checks pass — credential URIs rewritten, sensitive keys dropped, " +
    "request cookies/headers/body removed, benign context and hostnames preserved, cycles safe."
);
