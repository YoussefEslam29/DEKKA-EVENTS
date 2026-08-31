// POST /api/auth/forgot-password — mints a reset token and emails it (public).
// See PLAN/password-reset.md.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, parseBody } from "@/lib/api";
import { requestPasswordResetSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { emailEnabled, sendEmail } from "@/lib/email";
import {
  generateResetToken,
  hashResetToken,
  resetEmailBody,
  resetTokenExpiry,
} from "@/lib/password-reset";

/**
 * The single response this endpoint ever gives on a well-formed request.
 *
 * **No user enumeration**: identical body and status whether or not the address has an
 * account, whether or not that account has a password, and whether or not the email
 * actually sent. Any variation here — a 404, a different message, even a different
 * `details` key — turns this endpoint into a "does this person have a Dekka account"
 * oracle for anyone with a list of emails.
 */
function genericAccepted() {
  return NextResponse.json({ data: { sent: true } }, { status: 202 });
}

export async function POST(request: Request) {
  return handle("POST /api/auth/forgot-password", async () => {
    // Two buckets, both tight. This is the only endpoint in the app that sends email
    // on an anonymous request, making it both an inbox-spam vector against a real
    // person and a cost vector against the Resend quota. IP first, since that is the
    // one an attacker cannot vary for free.
    const ip = clientIp(request);
    const byIp = await rateLimit("forgot-password-ip", ip);
    if ("response" in byIp) return byIp.response;

    const parsed = await parseBody(request, requestPasswordResetSchema);
    if ("response" in parsed) return parsed.response;
    const { email } = parsed.data;

    // Per-address too: without it, one attacker rotating IPs could carpet-bomb a
    // single person's inbox. Charged before the lookup so it applies to unknown
    // addresses as well, keeping the timing and the behaviour uniform.
    const byEmail = await rateLimit("forgot-password-email", email);
    if ("response" in byEmail) return byEmail.response;

    // Nothing below may change the response. Every early return is `genericAccepted()`.
    if (!emailEnabled) {
      console.warn("[forgot-password] email is not configured — no link was sent");
      return genericAccepted();
    }

    await connectDB();
    const user = await User.findOne({ email }).select("+passwordHash").lean();

    // An OAuth-only account has no password to reset. Silently no-op rather than
    // explaining that — "this address signs in with Google" is exactly the kind of
    // fact this endpoint must not disclose. Such a user still has a working route in:
    // sign in with the provider, then set a password from /account.
    if (user?.passwordHash) {
      const token = generateResetToken();

      // Storing the hash overwrites any previous one, which is what makes a new
      // request invalidate an older, unused link — an attacker who intercepted the
      // first email cannot use it once the real user asks for another.
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetTokenHash: hashResetToken(token),
            resetTokenExpiresAt: resetTokenExpiry(),
          },
        }
      );

      // Built from the request's own origin rather than a configured base URL: this
      // has to be right on a preview deploy, a custom domain and localhost alike, and
      // a wrong origin here produces a link that silently 404s.
      const link = `${new URL(request.url).origin}/reset-password?token=${token}`;
      const { subject, text } = resetEmailBody(link);

      // Result deliberately ignored for the response — a send failure is logged and
      // reported inside sendEmail(), but must not be visible to the caller.
      await sendEmail({ to: email, subject, text });
    }

    return genericAccepted();
  });
}
