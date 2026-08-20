import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  phone: string;
};

/** Current signed-in user, or null for guests. */
export async function currentUser(): Promise<SessionUser | null> {
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
