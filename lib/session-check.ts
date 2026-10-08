// Session revocation (`PLAN/SITE_ROADMAP.md` S8). Sessions are self-contained JWTs, so on
// their own they can't be taken back: a password reset didn't evict a stolen session, a
// role change waited for a re-login, and a deleted account kept working until the cookie
// expired. Every session now carries the account's `sessionVersion` (`sv`), and the
// `jwt` callback in lib/auth.ts re-checks it against the database every few minutes.
// Bumping `User.sessionVersion` therefore ends every existing session.
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import type { UserRole } from "@/lib/constants";

/** How long a session goes between re-checks against the database. */
export const SESSION_RECHECK_MS = 5 * 60 * 1000;

/**
 * How long one instance remembers an account's current version. Server components can't
 * write cookies, so a session's `checkedAt` usually can't be refreshed and an old cookie
 * re-checks on every request; this keeps that to one database read per account per
 * minute per instance. It is also the worst-case delay for a revocation to land.
 */
export const SESSION_CACHE_MS = 60 * 1000;

export type SessionAccount = {
  id: string;
  name: string;
  email: string;
  image: string;
  role: UserRole;
  phone: string;
  sessionVersion: number;
};

/** Pure: is it time to look at the database again? */
export function needsRecheck(checkedAt: unknown, now: number): boolean {
  return typeof checkedAt !== "number" || now - checkedAt > SESSION_RECHECK_MS;
}

/**
 * Pure: does this session still belong to a live account at its current version? An
 * absent version on either side counts as 0, so sessions and accounts from before this
 * existed keep working, and nobody is signed out by the deploy that introduced it.
 */
export function sessionStillValid(tokenVersion: unknown, account: Pick<SessionAccount, "sessionVersion"> | null): boolean {
  if (!account) return false;
  const tokenSv = typeof tokenVersion === "number" ? tokenVersion : 0;
  return tokenSv === (account.sessionVersion ?? 0);
}

const cache = new Map<string, { at: number; account: SessionAccount | null }>();

/** Forget one account here (call after bumping its version on this instance). */
export function forgetSessionAccount(id: string) {
  cache.delete(id);
}

/**
 * The account behind a session, or `null` if it no longer exists. Cached per instance for
 * `SESSION_CACHE_MS` unless `fresh` is set (a sign-in or an explicit session update).
 */
export async function loadSessionAccount(
  id: string,
  { fresh = false }: { fresh?: boolean } = {}
): Promise<SessionAccount | null> {
  const now = Date.now();
  const hit = cache.get(id);
  if (!fresh && hit && now - hit.at < SESSION_CACHE_MS) return hit.account;

  await connectDB();
  const doc = /^[0-9a-f]{24}$/i.test(id)
    ? await User.findById(id).select("name email image role phone sessionVersion").lean()
    : null;
  const account: SessionAccount | null = doc
    ? {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        image: doc.image ?? "",
        role: doc.role,
        phone: doc.phone ?? "",
        sessionVersion: doc.sessionVersion ?? 0,
      }
    : null;

  if (cache.size > 1000) cache.clear(); // a cafe's worth of members; never grows unbounded
  cache.set(id, { at: now, account });
  return account;
}
