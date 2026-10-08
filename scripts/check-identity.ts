/**
 * `npm run check:identity` — DB-free assertions for the identity phase
 * (`PLAN/SITE_ROADMAP.md` S3, F3, F7): who may be linked to whom, when a role is earned,
 * and what deleting an account must and mustn't touch.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  oauthLinkDecision,
  providerVerifiedEmail,
  verifyEmailBody,
  pitchDecisionEmailBody,
  pitchReceivedEmailBody,
  VERIFY_TOKEN_TTL_MS,
} from "../lib/identity";
import { deleteAccountSchema, verifyEmailConfirmSchema } from "../lib/validation";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}

// --- Which providers vouch for an address --------------------------------------------
check(providerVerifiedEmail("google", { email_verified: true }), "Google with email_verified");
check(!providerVerifiedEmail("google", { email_verified: false }), "Google without it is not trusted");
check(!providerVerifiedEmail("google", {}), "Google with nothing is not trusted");
check(providerVerifiedEmail("apple", { email_verified: "true" }), "Apple's string 'true'");
check(providerVerifiedEmail("facebook", {}), "Facebook only returns confirmed emails");
check(!providerVerifiedEmail("credentials", { email_verified: true }), "credentials never vouch");

// --- The linking rule: the pre-hijack is refused ---------------------------------------
check(oauthLinkDecision(null, true) === "create", "no account: create");
check(oauthLinkDecision({ hasPassword: true, emailVerified: true }, true) === "link", "verified password account: link");
check(oauthLinkDecision({ hasPassword: false, emailVerified: false }, true) === "link", "provider-made account: link");
check(
  oauthLinkDecision({ hasPassword: true, emailVerified: false }, true) === "refuse",
  "UNVERIFIED password account: refuse (someone else may have registered this address)"
);
check(oauthLinkDecision(null, false) === "refuse", "a provider that won't vouch: refuse");
check(oauthLinkDecision({ hasPassword: false, emailVerified: true }, false) === "refuse", "…even for an existing account");

const auth = read("lib/auth.ts");
check(/oauthLinkDecision\(/.test(auth) && /providerVerifiedEmail\(account\.provider, profile\)/.test(auth), "signIn uses the linking rule");
check(/if \(decision === "refuse"\) return "\/login\?error=AccountNotLinked"/.test(auth), "a refused link goes back to /login with a reason");
check(/emailVerifiedAt = new Date\(\)/.test(auth) && /emailVerifiedAt: new Date\(\)/.test(auth), "a provider sign-in marks the address verified");

// --- Roles are earned by verification, not by typing an address -----------------------
const register = read("app/api/register/route.ts");
check(/role: "member",/.test(register), "sign-up always creates a member");
check(!/bootstrapRole/.test(register), "sign-up never applies ADMIN_EMAILS/STAFF_EMAILS");
check(/sendVerificationEmail\(/.test(register), "sign-up sends the verification link");
const verification = read("lib/verification.ts");
check(/const promoted = bootstrapRole\(user\.email\.toLowerCase\(\)\)/.test(verification), "verifying applies the env role");
check(/emailVerifiedAt: new Date\(\)/.test(verification), "verifying stamps emailVerifiedAt");
const confirm = read("app/api/auth/verify-email/confirm/route.ts");
check(/verifyTokenExpiresAt\.getTime\(\) <= Date\.now\(\)/.test(confirm), "an expired link is refused");
check(/resetTokenMatches\(candidateHash, user\.verifyTokenHash\)/.test(confirm), "the token is compared in constant time");
check(/rateLimit\("verify-email-ip"/.test(confirm), "confirming is rate-limited");
const reset = read("app/api/auth/reset-password/route.ts");
check(/emailVerifiedAt: new Date\(\)/.test(reset) && /bootstrapRole\(/.test(reset), "a spent reset link verifies and applies the role");
check(VERIFY_TOKEN_TTL_MS === 24 * 60 * 60 * 1000, "verification links last a day");
check(verifyEmailConfirmSchema.safeParse({ token: "a".repeat(64) }).success, "a 64-hex token parses");
check(!verifyEmailConfirmSchema.safeParse({ token: "a".repeat(63) }).success, "a short token is refused");
check(!verifyEmailConfirmSchema.safeParse({ token: "a".repeat(64), userId: "x" }).success, "the confirm schema is strict");
const mail = verifyEmailBody("https://dekka.test/verify-email?token=abc");
check(mail.text.split("https://dekka.test/verify-email?token=abc").length === 3, "the link appears in both languages");
check(/[؀-ۿ]/.test(mail.subject) && /Confirm/.test(mail.subject), "the subject is bilingual");

// --- F3: emails to bands ----------------------------------------------------------------
check(/Band A/.test(pitchReceivedEmailBody("Band A").text), "the acknowledgement names the band");
check(pitchDecisionEmailBody("B", "approved").subject !== pitchDecisionEmailBody("B", "declined").subject, "approved and declined read differently");
const notify = read("app/api/submissions/[id]/notify/route.ts");
check(/guard\("admin"\)/.test(notify), "emailing a band is admin-only");
check(/"NOT_DECIDED", 409/.test(notify), "an undecided pitch can't be emailed");
check(/if \(!emailEnabled\) return jsonError\("EMAIL_DISABLED", 503\)/.test(notify), "no email provider: a clear 503");

// --- F7: export and deletion ------------------------------------------------------------
const exportRoute = read("app/api/account/export/route.ts");
check(/guard\("member"\)/.test(exportRoute) && /findById\(auth\.user\.id\)/.test(exportRoute), "export is the caller's own data only");
check(!/passwordHash|resetTokenHash|verifyTokenHash/.test(exportRoute), "export never includes hashes");
const account = read("app/api/account/route.ts");
check(/bcrypt\.compare\(parsed\.data\.password, user\.passwordHash\)/.test(account), "deletion re-checks the password");
check(/parsed\.data\.confirmEmail !== user\.email/.test(account), "a password-less account types its email");
check(/"LAST_ADMIN", 409/.test(account), "the last admin can't delete themselves");
check(/Reservation\.updateMany\(\{ user: user\._id \}, \{ \$set: \{ name: REDACTED, phone: REDACTED \} \}\)/.test(account), "reservations are anonymised, not deleted");
check(/CheckIn\.updateMany\(\{ _id: \{ \$in: checkInIds \} \}, \{ \$set: \{ name: REDACTED, phone: REDACTED \} \}\)/.test(account), "linked door rows are anonymised");
check(!/CheckIn\.(deleteMany|deleteOne)/.test(account), "door rows (the cash record) are never deleted");
check(/PushSubscription\.deleteMany\(\{ user: user\._id \}\)/.test(account), "push devices are deleted");
check(/BandSubmission\.updateMany\(\{ user: user\._id \}, \{ \$set: \{ user: null \} \}\)/.test(account), "pitches are unlinked");
check(/rateLimit\("account-delete"/.test(account), "deletion is rate-limited");
check(deleteAccountSchema.safeParse({ password: "x" }).success, "delete schema takes a password");
check(!deleteAccountSchema.safeParse({ password: "x", userId: "y" }).success, "…and nothing it doesn't know");

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error(`\ncheck-identity: ${failures.length} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-identity: all ${passes} checks pass — a social sign-in never merges into an unverified password account; env roles come only with a proven address; bands get emails only by an admin's choice; deleting an account anonymises the records and never touches the cash.`
);
