// PATCH /api/account/password — set (Google-only account) or change
// (account already has a hash) the signed-in member's own password, per
// PLAN/LOG_SIGN_AUTH_IN.md §4b/§5b item 4. Ownership is implicit — always the
// session's own user, never an `:id` param.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { setPasswordSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  return handle("PATCH /api/account/password", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, setPasswordSchema);
    if ("response" in parsed) return parsed.response;
    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    // §2's rule applies here too: the client already compared these, but the
    // server never trusts the client alone for anything it writes.
    if (newPassword !== confirmPassword) {
      return jsonError("PASSWORD_MISMATCH", 400);
    }

    await connectDB();
    // `passwordHash` is `select: false` — pull it in explicitly, exactly like
    // `authorize()` in lib/auth.ts does, and keep the real document (not
    // `.lean()`) since we need to `.save()` the new hash back.
    const user = await User.findById(auth.user.id).select("+passwordHash");
    if (!user) return jsonError("Not found", 404);

    // Only an account that already has a password needs to prove it knows
    // the current one — a Google-only account has none to prove yet (§4b).
    if (user.passwordHash) {
      const ok =
        currentPassword != null &&
        (await bcrypt.compare(currentPassword, user.passwordHash));
      if (!ok) return jsonError("CURRENT_PASSWORD_INVALID", 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    if (!user.providers.includes("credentials")) {
      user.providers.push("credentials");
    }
    await user.save();

    return NextResponse.json({ data: { ok: true } });
  });
}
