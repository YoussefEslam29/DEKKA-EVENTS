// Password-reset token generation and verification — see PLAN/password-reset.md.
//
// Kept out of the two route files because both need it and the rules below are the
// security-critical part of the feature; one place to read them, one place to change
// them.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 30 minutes, per Before_Deployment.md §5. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * 32 random bytes as hex (64 chars).
 *
 * `randomBytes` and not a UUID: a v4 UUID carries only 122 bits and, more importantly,
 * invites the assumption that any UUID will do — a v1/v7 UUID derived from time and
 * node id would be partly predictable, which for a credential that grants account
 * takeover is fatal.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256, hex.
 *
 * Not bcrypt, and that difference is intentional. bcrypt is deliberately slow because
 * user passwords are low-entropy and must resist offline brute force. This token is 256
 * bits of CSPRNG output — there is nothing to brute force — so the slow hash would buy
 * no security while adding ~100ms to a path that is also an enumeration-timing
 * surface. A fast hash is the right tool for a high-entropy secret.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two hex hashes.
 *
 * The lookup is by hash so a plain `===` would already be hard to exploit, but this
 * costs nothing and removes the question entirely. Length is checked first because
 * `timingSafeEqual` throws on mismatched buffers.
 */
export function resetTokenMatches(candidateHash: string, storedHash: string): boolean {
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Absolute expiry for a token minted now. */
export function resetTokenExpiry(now = Date.now()): Date {
  return new Date(now + RESET_TOKEN_TTL_MS);
}

/**
 * The email body. Plain text, bilingual — Arabic first, matching the app's
 * Arabic-default identity, with English beneath.
 *
 * Not routed through `lib/i18n/dictionaries.ts` deliberately: an email is read outside
 * the app, hours later, possibly on a device with a different language than the one the
 * request came from. There is no locale to honour, so it carries both — the same
 * reasoning as the push payload in `app/api/events/[id]/route.ts`.
 */
export function resetEmailBody(link: string): { subject: string; text: string } {
  return {
    subject: "إعادة تعيين كلمة السر / Reset your Dekka password",
    text: [
      "طلبت إعادة تعيين كلمة السر لحسابك في دكة.",
      "افتح الرابط ده خلال ٣٠ دقيقة:",
      "",
      link,
      "",
      "لو مش إنت اللي طلبت ده، تجاهل الرسالة — حسابك زي ما هو.",
      "",
      "—",
      "",
      "You asked to reset your Dekka password.",
      "Open this link within 30 minutes:",
      "",
      link,
      "",
      "If this wasn't you, ignore this email — your account is unchanged.",
    ].join("\n"),
  };
}
