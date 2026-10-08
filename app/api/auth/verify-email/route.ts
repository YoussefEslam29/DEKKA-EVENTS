// POST /api/auth/verify-email — (re)send the signed-in member's verification link.
// See lib/verification.ts and PLAN/SITE_ROADMAP.md S3.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { rateLimit } from "@/lib/ratelimit";
import { emailEnabled } from "@/lib/email";
import { sendVerificationEmail } from "@/lib/verification";

export async function POST(request: Request) {
  return handle("POST /api/auth/verify-email", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    // Each request sends an email to the account's own address, so this is mostly a
    // guard on the mail provider's quota.
    const rl = await rateLimit("verify-email", auth.user.id);
    if ("response" in rl) return rl.response;

    if (!emailEnabled) return jsonError("EMAIL_DISABLED", 503);

    await connectDB();
    const user = await User.findById(auth.user.id).select("emailVerifiedAt").lean();
    if (!user) return jsonError("Not found", 404);
    if (user.emailVerifiedAt) return NextResponse.json({ data: { alreadyVerified: true } });

    // Built from the request's own origin, like the reset link: right on a preview, a
    // custom domain and localhost alike.
    const sent = await sendVerificationEmail(auth.user.id, new URL(request.url).origin);
    if (!sent) return jsonError("EMAIL_FAILED", 502);
    return NextResponse.json({ data: { sent: true } }, { status: 202 });
  });
}
