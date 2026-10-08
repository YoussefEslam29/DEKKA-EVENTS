// POST /api/auth/verify-email/confirm — spend a verification token (public).
// See lib/verification.ts and PLAN/SITE_ROADMAP.md S3.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { verifyEmailConfirmSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { hashResetToken, resetTokenMatches } from "@/lib/password-reset";
import { markEmailVerified } from "@/lib/verification";

export async function POST(request: Request) {
  return handle("POST /api/auth/verify-email/confirm", async () => {
    const rl = await rateLimit("verify-email-ip", clientIp(request));
    if ("response" in rl) return rl.response;

    const parsed = await parseBody(request, verifyEmailConfirmSchema);
    if ("response" in parsed) return parsed.response;

    const candidateHash = hashResetToken(parsed.data.token);
    await connectDB();
    const user = await User.findOne({ verifyTokenHash: candidateHash })
      .select("+verifyTokenHash +verifyTokenExpiresAt email role")
      .lean();

    // One answer for unknown, used and expired tokens alike, as with password reset.
    const invalid = () => jsonError("INVALID_OR_EXPIRED_TOKEN", 400);
    if (!user?.verifyTokenHash || !user.verifyTokenExpiresAt) return invalid();
    if (!resetTokenMatches(candidateHash, user.verifyTokenHash)) return invalid();
    if (user.verifyTokenExpiresAt.getTime() <= Date.now()) return invalid();

    await markEmailVerified(user);
    return NextResponse.json({ data: { verified: true } });
  });
}
