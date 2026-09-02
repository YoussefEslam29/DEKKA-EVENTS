/**
 * Exercises `lib/mobile-token.ts` — the security-critical half of the mobile auth
 * bridge (`PLAN/DEKKA_MOBILE_APP.MD` §3) — with no database and no network.
 *
 *   npm run check:mobile-auth
 *
 * The properties asserted here are the ones that would be silently wrong rather
 * than obviously broken: that a mobile token and a web session cookie cannot be
 * swapped for each other, that expiry is actually enforced, and that the claims
 * are encrypted rather than merely encoded. The parts that need a live database
 * (no-enumeration response equality, a real sign-in, `guard()` accepting the
 * header) are listed as uncovered at the end rather than assumed.
 */

// Set before anything reads it. `lib/mobile-token.ts` reads AUTH_SECRET lazily,
// inside each call rather than at module load, so this lands ahead of first use
// even though ESM hoists the imports below. A fixed test value keeps results
// deterministic and means this script never touches the real secret.
process.env.AUTH_SECRET = "check-mobile-auth-fixed-test-secret-not-a-real-one";

import { encode } from "next-auth/jwt";
import {
  MOBILE_TOKEN_TTL_SECONDS,
  issueMobileToken,
  readBearerToken,
  verifyMobileToken,
} from "../lib/mobile-token";
import { mobileLoginSchema } from "../lib/validation";

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

const SECRET = process.env.AUTH_SECRET;
/** The salt NextAuth passes for its own session cookie in a non-HTTPS install. */
const SESSION_SALT = "authjs.session-token";
const MOBILE_SALT = "dekka.mobile-token";

const CLAIMS = {
  sub: "65f000000000000000000001",
  name: "Test Member",
  email: "member@example.com",
  role: "member" as const,
  phone: "01000000000",
};

async function main() {
  // --- 1. Round trip ------------------------------------------------------------
  const { token, expiresAt } = await issueMobileToken(CLAIMS);

  const decoded = await verifyMobileToken(token);
  if (!decoded) {
    fail("a freshly issued token did not verify");
  } else {
    if (decoded.sub !== CLAIMS.sub) fail(`sub round-tripped wrong: ${decoded.sub}`);
    if (decoded.email !== CLAIMS.email) fail("email did not round-trip");
    if (decoded.role !== CLAIMS.role) fail("role did not round-trip");
    if (decoded.phone !== CLAIMS.phone) fail("phone did not round-trip");
    if (decoded.channel !== "mobile") fail("channel claim missing from a real token");
  }

  // --- 2. The claims are encrypted, not just encoded -----------------------------
  // A256CBC-HS512 JWE: none of this should be readable out of the token string.
  // If this ever fails, the token has become a signed-but-public JWT and it is
  // handing anyone who intercepts it the member's email and role.
  for (const [label, secret] of [
    ["email", CLAIMS.email],
    ["user id", CLAIMS.sub],
    ["phone", CLAIMS.phone],
  ] as const) {
    if (token.includes(secret)) fail(`${label} appears in plaintext inside the token`);
  }
  const b64 = Buffer.from(token, "base64").toString("utf8");
  if (b64.includes(CLAIMS.email)) fail("email is recoverable by base64-decoding the token");

  // --- 3. Expiry ----------------------------------------------------------------
  if (MOBILE_TOKEN_TTL_SECONDS !== 30 * 24 * 60 * 60) {
    fail(`TTL is ${MOBILE_TOKEN_TTL_SECONDS}s, expected 30 days`);
  }

  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) {
    fail(`expiresAt is not a parseable date: ${expiresAt}`);
  } else {
    const driftSeconds = Math.abs(
      (expiryMs - Date.now()) / 1000 - MOBILE_TOKEN_TTL_SECONDS
    );
    if (driftSeconds > 5) {
      fail(`expiresAt is ${driftSeconds}s away from the real TTL`);
    }
  }

  // An already-expired token must not verify. `decode` allows 15s of clock
  // tolerance, so this is stamped well past it.
  const expired = await encode({
    token: { ...CLAIMS, channel: "mobile" },
    secret: SECRET,
    salt: MOBILE_SALT,
    maxAge: -600,
  });
  if (await verifyMobileToken(expired)) fail("an expired token verified");

  // --- 4. The two channels cannot be swapped ------------------------------------
  // This is the property the separate salt exists to buy. A session cookie value
  // lifted from a browser must not work as a bearer token.
  const sessionShaped = await encode({
    token: { ...CLAIMS, channel: "mobile" },
    secret: SECRET,
    salt: SESSION_SALT,
    maxAge: MOBILE_TOKEN_TTL_SECONDS,
  });
  if (await verifyMobileToken(sessionShaped)) {
    fail("a token minted with the session-cookie salt verified as a mobile token");
  }

  // ...and the reverse: a mobile token must not decrypt with the session salt,
  // so it cannot be pasted into a browser's cookie jar to impersonate the member
  // on the website.
  const { decode } = await import("next-auth/jwt");
  let mobileReadAsSession: unknown = null;
  try {
    mobileReadAsSession = await decode({ token, secret: SECRET, salt: SESSION_SALT });
  } catch {
    mobileReadAsSession = null; // expected: wrong derived key
  }
  if (mobileReadAsSession) fail("a mobile token decoded as a web session cookie");

  // --- 5. The channel claim is checked ------------------------------------------
  // Right salt, wrong channel — the structural backstop described in
  // `lib/mobile-token.ts`. If the salts are ever unified by a refactor, this is
  // what still rejects a web session.
  const wrongChannel = await encode({
    token: { ...CLAIMS, channel: "web" },
    secret: SECRET,
    salt: MOBILE_SALT,
    maxAge: MOBILE_TOKEN_TTL_SECONDS,
  });
  if (await verifyMobileToken(wrongChannel)) fail("a non-mobile channel claim verified");

  // A token carrying no subject is not an identity, whatever else it says.
  const noSub = await encode({
    token: { channel: "mobile", role: "admin" },
    secret: SECRET,
    salt: MOBILE_SALT,
    maxAge: MOBILE_TOKEN_TTL_SECONDS,
  });
  if (await verifyMobileToken(noSub)) fail("a token with no `sub` verified");

  // --- 6. Tampering and junk -----------------------------------------------------
  const flip = (c: string) => (c === "a" ? "b" : "a");
  const tampered = token.slice(0, -1) + flip(token.slice(-1));
  if (await verifyMobileToken(tampered)) fail("a tampered token verified");

  // Swapping the JWE ciphertext segment between two tokens must not verify —
  // A256CBC-HS512 authenticates the whole thing, so this should fail the tag.
  const other = await issueMobileToken({ ...CLAIMS, sub: "65f000000000000000000002" });
  const parts = token.split(".");
  const otherParts = other.token.split(".");
  if (parts.length === 5 && otherParts.length === 5) {
    const spliced = [parts[0], parts[1], parts[2], otherParts[3], parts[4]].join(".");
    if (await verifyMobileToken(spliced)) fail("a spliced token verified");
  } else {
    fail(`token is not a 5-part JWE (got ${parts.length} parts)`);
  }

  for (const junk of ["", "   ", "not.a.token", "a.b.c.d.e", "null", "undefined"]) {
    if (await verifyMobileToken(junk)) fail(`junk token verified: ${JSON.stringify(junk)}`);
  }

  // A token signed with a different secret entirely — i.e. another deploy's.
  const foreign = await encode({
    token: { ...CLAIMS, channel: "mobile" },
    secret: "a-completely-different-secret-value-here",
    salt: MOBILE_SALT,
    maxAge: MOBILE_TOKEN_TTL_SECONDS,
  });
  if (await verifyMobileToken(foreign)) fail("a token signed with a foreign secret verified");

  // --- 7. Authorization header parsing -------------------------------------------
  const ACCEPT: [string, string, string][] = [
    ["standard", "Bearer abc123", "abc123"],
    ["lowercase scheme", "bearer abc123", "abc123"],
    ["mixed case scheme", "BeArEr abc123", "abc123"],
    ["extra spaces between", "Bearer    abc123", "abc123"],
    ["surrounding whitespace", "   Bearer abc123   ", "abc123"],
  ];
  for (const [label, header, expected] of ACCEPT) {
    const got = readBearerToken(header);
    if (got !== expected) fail(`readBearerToken(${label}) gave ${JSON.stringify(got)}`);
  }

  const REJECT: [string, string | null | undefined][] = [
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["scheme only", "Bearer"],
    ["scheme and space only", "Bearer "],
    ["wrong scheme", "Basic abc123"],
    ["scheme as a prefix of another", "BearerToken abc123"],
    ["no scheme", "abc123"],
  ];
  for (const [label, header] of REJECT) {
    const got = readBearerToken(header);
    if (got !== null) fail(`readBearerToken(${label}) should be null, got ${JSON.stringify(got)}`);
  }

  // --- 8. The login schema --------------------------------------------------------
  const good = mobileLoginSchema.safeParse({
    email: "  MEMBER@Example.COM ",
    password: "whatever they typed",
  });
  if (!good.success) {
    fail("a valid login body was rejected");
  } else if (good.data.email !== "member@example.com") {
    fail(`email was not trimmed and lowercased: ${JSON.stringify(good.data.email)}`);
  }

  // `.strict()` — an unlisted key must be rejected, not quietly dropped.
  const extra = mobileLoginSchema.safeParse({
    email: "member@example.com",
    password: "x",
    role: "admin",
  });
  if (extra.success) fail("mobileLoginSchema accepted an unlisted key (`role`)");

  for (const [label, body] of [
    ["missing password", { email: "member@example.com" }],
    ["missing email", { password: "x" }],
    ["malformed email", { email: "not-an-email", password: "x" }],
    ["empty password", { email: "member@example.com", password: "" }],
    ["oversized password", { email: "member@example.com", password: "x".repeat(201) }],
  ] as const) {
    if (mobileLoginSchema.safeParse(body).success) {
      fail(`mobileLoginSchema accepted ${label}`);
    }
  }

  // A short password must still be *accepted* — this validates against an
  // existing hash rather than setting a new one, so a `min(8)` here would turn a
  // wrong-password 401 into a confusing 400 for an older account.
  if (!mobileLoginSchema.safeParse({ email: "member@example.com", password: "short" }).success) {
    fail("mobileLoginSchema rejected a short password — it should reach the hash compare");
  }
}

main().then(() => {
  if (failures.length) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }

  console.log(
    "mobile-auth: all checks pass — claims round-trip, payload is encrypted (email/id/phone " +
      "not recoverable from the token), 30-day TTL exact and expiry enforced, the mobile and " +
      "web salts are non-interchangeable in both directions, the channel claim and `sub` are " +
      "required, tampered/spliced/foreign-secret/junk tokens all reject, Bearer parsing " +
      "accepts 5 shapes and rejects 8, and the login schema is strict.\n" +
      "NOT covered here (needs a database or a running server): the no-enumeration response " +
      "equality between an unknown email and a wrong password, a real sign-in against a real " +
      "hash, and `guard()`/`currentUser()` actually honouring the header on a live route — " +
      "those were exercised by hand against the dev server, see developer-guide.md §8."
  );
});
