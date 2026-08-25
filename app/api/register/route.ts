// POST /api/register — create an email/password member account (public).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { bootstrapRole } from "@/lib/roles";

export async function POST(request: Request) {
  return handle("POST /api/register", async () => {
    const parsed = await parseBody(request, registerSchema);
    if ("response" in parsed) return parsed.response;
    const { name, email, phone, password } = parsed.data;

    await connectDB();
    // `passwordHash` is `select: false` on the model — pull it in explicitly so
    // we can tell an OAuth-only account (no hash) from one that already has a
    // password, per PLAN/LOG_SIGN_AUTH_IN.md §4a.
    const existing = await User.findOne({ email }).select("+passwordHash").lean();
    if (existing) {
      if (!existing.passwordHash) {
        // OAuth-only account: point the signup form at the provider(s) already
        // on file instead of a dead-end "email taken" message.
        return jsonError("EMAIL_TAKEN_OAUTH", 409, { providers: existing.providers });
      }
      return jsonError("EMAIL_TAKEN", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      providers: ["credentials"],
      // Same env bootstrap the OAuth path applies, so a staff/admin invited by
      // email gets their role by signing up normally — previously this was
      // hardcoded to "member" and `ADMIN_EMAILS` silently did nothing here.
      role: bootstrapRole(email) ?? "member",
    });

    // Never echo the hash back, even to the account's own owner.
    return NextResponse.json(
      { data: { id: String(user._id), name: user.name, email: user.email } },
      { status: 201 }
    );
  });
}
