// Email ownership (`PLAN/SITE_ROADMAP.md` S3, P-ID): the pure half. No database and no
// Next.js, so `scripts/check-identity.ts` can test every rule directly.
//
// Why this exists: an address typed into the sign-up form proves nothing. Without a
// check, (a) whoever registered a staff member's address first got the staff role from
// STAFF_EMAILS, and (b) once Google sign-in is on, a Google login was merged into any
// existing account with the same email, so a person who pre-registered someone else's
// address kept a working password on that person's account.

/** A verification link stays good for a day; it's sent at sign-up, read whenever. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function verifyTokenExpiry(now = Date.now()): Date {
  return new Date(now + VERIFY_TOKEN_TTL_MS);
}

/**
 * Does this provider vouch that the person owns the email it handed us? Google and Apple
 * say so explicitly in the profile; Facebook only ever returns an address the person has
 * confirmed with Facebook.
 */
export function providerVerifiedEmail(provider: string, profile: unknown): boolean {
  const p = (profile ?? {}) as { email_verified?: unknown };
  switch (provider) {
    case "google":
      return p.email_verified === true;
    case "apple":
      return p.email_verified === true || p.email_verified === "true";
    case "facebook":
      return true;
    default:
      return false;
  }
}

export type OAuthLinkDecision = "create" | "link" | "refuse";

/**
 * What a social sign-in may do with the account already holding its email:
 * - no account yet → create one (its email is verified by the provider);
 * - an account that's verified, or has no password at all (it was made by a provider)
 *   → link to it;
 * - an unverified password account → refuse. The person who owns the address can sign
 *   in with that password and verify, or reset the password (which verifies), and then
 *   link. Linking blindly is the pre-hijack this exists to stop.
 * A provider that won't vouch for the email is refused outright.
 */
export function oauthLinkDecision(
  existing: { hasPassword: boolean; emailVerified: boolean } | null,
  providerVerified: boolean
): OAuthLinkDecision {
  if (!providerVerified) return "refuse";
  if (!existing) return "create";
  if (existing.emailVerified || !existing.hasPassword) return "link";
  return "refuse";
}

/** The verification email: plain text, Arabic first, both languages (no locale to honour). */
export function verifyEmailBody(link: string): { subject: string; text: string } {
  return {
    subject: "أكّد إيميلك / Confirm your email for Dekka",
    text: [
      "أهلاً بيك في دكة!",
      "افتح الرابط ده عشان تأكد إن الإيميل ده بتاعك (صالح ٢٤ ساعة):",
      "",
      link,
      "",
      "لو مش إنت اللي عملت الحساب، تجاهل الرسالة.",
      "",
      "—",
      "",
      "Welcome to Dekka!",
      "Open this link to confirm this email is yours (valid for 24 hours):",
      "",
      link,
      "",
      "If you didn't create this account, ignore this email.",
    ].join("\n"),
  };
}

/** F3: the "we got your pitch" note to a band. */
export function pitchReceivedEmailBody(bandName: string): { subject: string; text: string } {
  return {
    subject: "وصلنا عرضك / We got your pitch — Dekka",
    text: [
      `أهلاً ${bandName}،`,
      "عرضك وصل لدكة، وهنراجعه ونرد عليك على الإيميل ده.",
      "",
      "—",
      "",
      `Hi ${bandName},`,
      "Your pitch reached Dekka. We'll look at it and get back to you at this address.",
    ].join("\n"),
  };
}

/** F3: the admin's explicit "email the band" message for a decided pitch. */
export function pitchDecisionEmailBody(
  bandName: string,
  status: "approved" | "declined"
): { subject: string; text: string } {
  if (status === "approved") {
    return {
      subject: "عرضك اتقبل! / Your pitch is in — Dekka",
      text: [
        `أهلاً ${bandName}،`,
        "عرضك عجبنا! هنتواصل معاك قريب عشان نتفق على الميعاد والتفاصيل.",
        "",
        "—",
        "",
        `Hi ${bandName},`,
        "We loved your pitch! We'll be in touch soon to agree a date and the details.",
      ].join("\n"),
    };
  }
  return {
    subject: "بخصوص عرضك / About your pitch — Dekka",
    text: [
      `أهلاً ${bandName}،`,
      "شكراً إنك بعتلنا. المرة دي مش هنقدر نستضيف العرض، بس ابعتلنا تاني في أي وقت.",
      "",
      "—",
      "",
      `Hi ${bandName},`,
      "Thanks for reaching out. We can't host this one, but please pitch us again any time.",
    ].join("\n"),
  };
}
