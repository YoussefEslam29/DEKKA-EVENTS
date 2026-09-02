/**
 * Bearer tokens for the native mobile app — `PLAN/DEKKA_MOBILE_APP.MD` §3.
 *
 * NextAuth issues a browser session as an httpOnly cookie, which a native app
 * cannot hold or send the way a browser tab does. This module issues the same
 * *kind* of credential over a different channel: the identical
 * `@auth/core/jwt` encode/decode that NextAuth uses for its session cookie, the
 * identical `AUTH_SECRET`, and a payload shaped like the session JWT's — carried
 * in an `Authorization: Bearer` header instead of a cookie.
 *
 * No new user table, no parallel auth system, and no new env var: per §3's
 * closing rule, the app is a new *client* of the existing identity system, not a
 * second one.
 */
import { encode, decode } from "next-auth/jwt";
import type { UserRole } from "@/lib/constants";

/**
 * Derives a different encryption key than the session cookie does, deliberately.
 *
 * `encode`/`decode` derive their key with HKDF over (`secret`, `salt`), and
 * NextAuth passes its *cookie name* as the salt. Passing a different salt here
 * means the two credentials cannot be substituted for each other in either
 * direction: a mobile token pasted into a browser as a session cookie fails to
 * decrypt, and a session cookie lifted from a browser is not a usable Bearer
 * token. Same secret, same algorithm, two non-interchangeable credentials — it
 * costs one string, and it means a leak of one channel is not automatically a
 * leak of the other.
 *
 * Changing this string invalidates every issued mobile token at once (every app
 * user signs in again). That is the intended lever if mass revocation is ever
 * needed — see the no-revocation note in `developer-guide.md` §7.
 */
const MOBILE_TOKEN_SALT = "dekka.mobile-token";

/**
 * 30 days, matching NextAuth's own default session age, so the two channels
 * expire on the same schedule rather than for two different reasons.
 *
 * There is no refresh token in v1: at 30 days the app asks for the password
 * again. Recorded as a known gap rather than half-built.
 */
export const MOBILE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * The claims carried in a mobile token — deliberately the same fields
 * `lib/auth.ts`'s `jwt`/`session` callbacks put on the web session, so
 * `currentUser()` can build an identical `SessionUser` from either channel and
 * no downstream code can tell (or needs to tell) them apart.
 */
export type MobileTokenClaims = {
  sub: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  phone: string;
  /**
   * Structural assertion, not a security boundary — the salt above is what
   * actually separates the channels. This exists so that if a future refactor
   * ever collapses the two salts into one, a web session cookie still fails the
   * explicit check below instead of silently becoming a valid Bearer token.
   */
  channel: "mobile";
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Fails closed, unlike the optional-env features in `developer-guide.md` §7.
    // Those degrade to "off"; auth degrading to "off" would mean issuing tokens
    // signed with nothing. NextAuth cannot run without this variable either, so
    // an install in this state is already not serving sessions.
    throw new Error(
      "AUTH_SECRET is not set — cannot issue or verify mobile tokens."
    );
  }
  return secret;
}

/** Issues a bearer token for an already-authenticated user. */
export async function issueMobileToken(
  claims: Omit<MobileTokenClaims, "channel">
): Promise<{ token: string; expiresAt: string }> {
  const token = await encode<MobileTokenClaims>({
    token: { ...claims, channel: "mobile" },
    secret: authSecret(),
    salt: MOBILE_TOKEN_SALT,
    maxAge: MOBILE_TOKEN_TTL_SECONDS,
  });

  // `encode` stamps `exp` as its own `(Date.now() / 1000) | 0` plus maxAge, so
  // this is the same second. Returned so the app can expire the token locally
  // and re-prompt, rather than discovering it by collecting a 401 mid-action.
  const expiresAt = new Date(
    (Math.floor(Date.now() / 1000) + MOBILE_TOKEN_TTL_SECONDS) * 1000
  ).toISOString();

  return { token, expiresAt };
}

/**
 * Verifies a bearer token, returning its claims or `null`.
 *
 * Never throws for an untrusted input: `decode` rejects a tampered, expired, or
 * wrong-salt token by throwing, and every one of those is simply "not signed
 * in" to a caller. Expiry is enforced inside `decode` by `jose` (15s clock
 * tolerance), not re-checked here.
 */
export async function verifyMobileToken(
  token: string
): Promise<MobileTokenClaims | null> {
  try {
    const claims = await decode<MobileTokenClaims>({
      token,
      secret: authSecret(),
      salt: MOBILE_TOKEN_SALT,
    });

    if (!claims?.sub || claims.channel !== "mobile") return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Pulls the token out of an `Authorization` header value.
 *
 * The scheme is matched case-insensitively (RFC 7235 §2.1 makes it so) and the
 * value must be non-empty, so a bare `Authorization: Bearer` is treated as no
 * credential rather than as an empty one.
 */
export function readBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer[ ]+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
