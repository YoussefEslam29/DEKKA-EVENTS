import type { UserRole } from "@/lib/constants";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      phone: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    phone?: string;
    /** The account's `sessionVersion` when this session was issued (lib/session-check.ts). */
    sv?: number;
    /** When this session was last checked against the database (ms since epoch). */
    checkedAt?: number;
  }
}
