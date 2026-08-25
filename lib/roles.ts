// Env-based role bootstrap, shared by both account-creation paths.
//
// This lives in its own module rather than in `lib/auth.ts` so the register
// route can use it without pulling NextAuth's initialisation into that route.
// Server-only: it reads `process.env`, and both callers are server code.
import type { UserRole } from "@/lib/constants";

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
const staffEmails = parseEmailList(process.env.STAFF_EMAILS);

/**
 * The role an email is entitled to by `ADMIN_EMAILS`/`STAFF_EMAILS`, or `null`
 * for everyone else (who become plain members).
 *
 * Applied at account creation on both paths — OAuth (`lib/auth.ts`'s `signIn`
 * callback) and email/password (`app/api/register/route.ts`). The OAuth path
 * additionally re-applies it to an *existing* account on each sign-in, so
 * adding someone to `ADMIN_EMAILS` promotes them the next time they sign in
 * with a provider. Email/password sign-in does not re-check: a credentials
 * account created before its email was listed keeps whatever role the database
 * holds, and is promoted by editing that record (see `developer-guide.md` §3).
 *
 * Caller passes an already-lowercased email — both lists are lowercased here.
 */
export function bootstrapRole(email: string): UserRole | null {
  if (adminEmails.includes(email)) return "admin";
  if (staffEmails.includes(email)) return "staff";
  return null;
}
