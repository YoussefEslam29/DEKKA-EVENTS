// POST /api/auth/reset-password — spends a token and sets a new password (public).
// See PLAN/password-reset.md.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { hashResetToken, resetTokenMatches } from "@/lib/password-reset";

export async function POST(request: Request) {
  return handle("POST /api/auth/reset-password", async () => {
    const rl = await rateLimit("forgot-password-ip", clientIp(request));
    if ("response" in rl) return rl.response;

    const parsed = await parseBody(request, resetPasswordSchema);
    if ("response" in parsed) return parsed.response;
    const { token, newPassword, confirmPassword } = parsed.data;

    // Re-checked server-side even though the form compares them: the client check is
    // a UX affordance, never the boundary. Same rule as setPasswordSchema's route.
    if (newPassword !== confirmPassword) {
      return jsonError("PASSWORDS_DO_NOT_MATCH", 400);
    }

    const candidateHash = hashResetToken(token);

    await connectDB();
    // Looked up *by* the hash — the raw token is never stored, so this is the only way
    // to find its owner. `select` pulls the two reset fields, which are `select: false`
    // on the model and so absent from an ordinary query.
    const user = await User.findOne({ resetTokenHash: candidateHash })
      .select("+resetTokenHash +resetTokenExpiresAt")
      .lean();

    // One message for every failure mode — unknown token, already-spent token, expired
    // token. Distinguishing them would tell an attacker which guesses were once valid.
    const invalid = () => jsonError("INVALID_OR_EXPIRED_TOKEN", 400);

    if (!user?.resetTokenHash || !user.resetTokenExpiresAt) return invalid();
    if (!resetTokenMatches(candidateHash, user.resetTokenHash)) return invalid();

    // Expiry is enforced here, in code, rather than being left to any background
    // reaper. This is the check that actually stands between an expired link and an
    // account takeover, so it must not depend on a sweep that runs "eventually".
    if (user.resetTokenExpiresAt.getTime() <= Date.now()) return invalid();

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Single-use: the token fields are cleared in the same write that sets the
    // password, so a second submission of the same link fails even inside the
    // 30-minute window. `$unset` rather than setting null, so the partial-index-free
    // fields simply cease to exist.
    //
    // Matched on the hash as well as the id: if two requests race with the same link,
    // only the first finds the document still carrying that hash, and the second's
    // update matches nothing. The password is set once, not twice.
    const result = await User.updateOne(
      { _id: user._id, resetTokenHash: candidateHash },
      {
        $set: { passwordHash },
        $unset: { resetTokenHash: "", resetTokenExpiresAt: "" },
        // A reset proves control of the address, so make sure credentials sign-in is
        // listed — an OAuth-only account that later sets a password this way would
        // otherwise keep claiming it has no password login.
        $addToSet: { providers: "credentials" },
      }
    );

    if (result.modifiedCount === 0) return invalid();

    return NextResponse.json({ data: { reset: true } }, { status: 200 });
  });
}
