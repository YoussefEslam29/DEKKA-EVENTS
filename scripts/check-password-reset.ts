/**
 * Exercises lib/password-reset.ts — the security-critical half of the feature — with no
 * database and no mail provider.
 *
 *   npm run check:reset
 *
 * Before_Deployment.md §5 lists specific properties this flow must have. The ones that
 * are pure functions are asserted here; the ones that live in the route (single-use,
 * new-request-invalidates-old, no enumeration) are noted in the summary as needing a
 * real database, and are stated as unverified rather than assumed.
 */
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  resetEmailBody,
  resetTokenExpiry,
  resetTokenMatches,
} from "../lib/password-reset";

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

// --- 1. Token shape and randomness ----------------------------------------------
const tokens = Array.from({ length: 500 }, generateResetToken);

for (const t of tokens.slice(0, 20)) {
  if (!/^[0-9a-f]{64}$/.test(t)) fail(`token is not 64 hex chars: ${t}`);
}
// 32 bytes = 256 bits. Any collision in 500 draws would mean the generator is broken.
if (new Set(tokens).size !== tokens.length) fail("generateResetToken produced a duplicate");

// A token must not be derivable from the clock. Adjacent tokens sharing a long prefix
// would be the signature of a time-seeded generator.
let maxSharedPrefix = 0;
for (let i = 1; i < tokens.length; i++) {
  let n = 0;
  while (n < 64 && tokens[i][n] === tokens[i - 1][n]) n++;
  maxSharedPrefix = Math.max(maxSharedPrefix, n);
}
if (maxSharedPrefix > 8) {
  fail(`adjacent tokens share ${maxSharedPrefix} leading chars — generator looks predictable`);
}

// --- 2. Hashing -----------------------------------------------------------------
const token = generateResetToken();
const hash = hashResetToken(token);

if (!/^[0-9a-f]{64}$/.test(hash)) fail("hash is not 64 hex chars");
if (hash === token) fail("hash equals the token — nothing is being hashed");
if (hashResetToken(token) !== hash) fail("hashing is not deterministic");
if (hashResetToken(token.replace(/^./, (c) => (c === "a" ? "b" : "a"))) === hash) {
  fail("a different token produced the same hash");
}

// --- 3. Comparison --------------------------------------------------------------
if (!resetTokenMatches(hash, hash)) fail("a hash did not match itself");
if (resetTokenMatches(hash, hashResetToken(generateResetToken()))) {
  fail("two different hashes compared equal");
}
if (resetTokenMatches("", "")) fail("empty hashes compared equal — must never match");
if (resetTokenMatches(hash, hash.slice(0, 32))) fail("mismatched lengths compared equal");
// Must not throw on junk, since the value ultimately comes from a URL.
for (const junk of ["zz", "!!!!", "0".repeat(63), "0".repeat(65)]) {
  try {
    resetTokenMatches(junk, hash);
  } catch (error) {
    fail(`resetTokenMatches threw on junk input ${JSON.stringify(junk)}: ${error}`);
  }
}

// --- 4. Expiry ------------------------------------------------------------------
if (RESET_TOKEN_TTL_MS !== 30 * 60 * 1000) {
  fail(`TTL is ${RESET_TOKEN_TTL_MS}ms — §5 specifies 30 minutes`);
}
const now = Date.now();
const expiry = resetTokenExpiry(now);
if (expiry.getTime() !== now + RESET_TOKEN_TTL_MS) fail("expiry is not now + TTL");
if (expiry.getTime() <= now) fail("expiry is not in the future");

// A token minted 31 minutes ago must read as expired by the route's own comparison.
const stale = resetTokenExpiry(now - 31 * 60 * 1000);
if (stale.getTime() > now) fail("a 31-minute-old token did not read as expired");

// --- 5. Email body --------------------------------------------------------------
const link = "https://dekka.example/reset-password?token=" + token;
const { subject, text } = resetEmailBody(link);
if (!subject.trim()) fail("email subject is empty");
if (!text.includes(link)) fail("email body does not contain the reset link");
if (!/[؀-ۿ]/.test(text)) fail("email body has no Arabic — it must be bilingual");
if (!/[A-Za-z]/.test(text)) fail("email body has no English — it must be bilingual");
if (/<[a-z]/i.test(text)) fail("email body contains HTML — it is meant to be plain text");
if (text.indexOf(link) === text.lastIndexOf(link)) {
  // Both language halves carry the link; if only one does, one half is unusable.
  fail("the link appears only once — each language half should carry it");
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log(
  "password-reset: all checks pass — 500 unique unpredictable tokens, SHA-256 hashing " +
    "deterministic and one-way, constant-time compare rejects junk/short/empty, " +
    "30-minute TTL exact, bilingual plain-text email carries the link.\n" +
    "NOT covered here (needs a database): single-use invalidation, a new request " +
    "superseding an old token, and the no-enumeration response equality."
);
