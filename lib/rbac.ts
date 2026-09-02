import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/constants";
import { readBearerToken, verifyMobileToken } from "@/lib/mobile-token";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  phone: string;
};

/**
 * The mobile app's half of `currentUser()` — `PLAN/DEKKA_MOBILE_APP.MD` §3.
 *
 * Returns `null` rather than throwing for anything that isn't a usable bearer
 * credential, so the cookie path below runs exactly as it always has. This is
 * added *alongside* the web session, never in place of it.
 */
async function bearerUser(): Promise<SessionUser | null> {
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get("authorization");
  } catch {
    // `headers()` needs a request scope. Every caller today has one (`auth()`
    // reads cookies and needs the same scope), but a future call from outside
    // one should fall through to the cookie path rather than throw a brand-new
    // kind of error out of an authorization check.
    return null;
  }

  const token = readBearerToken(authorization);
  if (!token) return null;

  const claims = await verifyMobileToken(token);
  if (!claims) return null;

  // Same shape the session branch builds, so nothing downstream can tell which
  // channel a request arrived on — or has to.
  return {
    id: claims.sub,
    name: claims.name,
    email: claims.email,
    role: claims.role ?? "member",
    phone: claims.phone ?? "",
  };
}

/**
 * Current signed-in user, or null for guests.
 *
 * Reads either credential: the mobile app's `Authorization: Bearer <token>`
 * (§3's auth bridge) or the NextAuth session cookie a browser sends. Because
 * every protected surface in the app already funnels through this one function,
 * teaching it the bearer header is what gives the app access to the whole
 * existing API — no route needed changing, `guard()` included.
 */
export async function currentUser(): Promise<SessionUser | null> {
  // Bearer first: a request carrying an explicit `Authorization` header is
  // asking to act as that token, so it outranks any ambient cookie. In practice
  // only ever one is present — the app sends no cookies, a browser sends no
  // `Authorization` header — but "explicit beats ambient" is a cheaper rule to
  // fix now than to discover the hard way later.
  const viaBearer = await bearerUser();
  if (viaBearer) return viaBearer;

  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role ?? "member",
    phone: session.user.phone ?? "",
  };
}

const RANK: Record<UserRole, number> = { member: 0, staff: 1, admin: 2 };

/** True when the user's role is at least `min` (admin outranks staff). */
export function hasRole(user: SessionUser | null, min: UserRole): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[min];
}

/**
 * Guard for API route handlers. Returns either the user or a ready-to-return
 * 401/403 response, so callers stay a single `if ("response" in guard)` check.
 *
 * Covers both credentials by construction, since it resolves the caller through
 * `currentUser()` above — a route guarded before the mobile app existed guards
 * the app's requests too, with no per-route change.
 */
export async function guard(
  min: UserRole
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await currentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasRole(user, min)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user };
}
