// Email ownership (`PLAN/SITE_ROADMAP.md` S3, P-ID): the server half. Sending the link,
// and recording that an address has been proven, which is also when an
// ADMIN_EMAILS/STAFF_EMAILS role is applied.
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { emailEnabled, sendEmail } from "@/lib/email";
import { bootstrapRole } from "@/lib/roles";
import { generateResetToken, hashResetToken } from "@/lib/password-reset";
import { verifyEmailBody, verifyTokenExpiry } from "@/lib/identity";
import { forgetSessionAccount } from "@/lib/session-check";

/**
 * Mints a fresh link (superseding any earlier one) and emails it. Returns whether an
 * email went out. A no-op without an email provider: the account simply stays
 * unverified, which costs it nothing but the role bootstrap and OAuth linking.
 */
export async function sendVerificationEmail(userId: string, origin: string): Promise<boolean> {
  if (!emailEnabled) return false;
  await connectDB();
  const user = await User.findById(userId).select("email emailVerifiedAt").lean();
  if (!user || user.emailVerifiedAt) return false;

  const token = generateResetToken();
  await User.updateOne(
    { _id: userId },
    { $set: { verifyTokenHash: hashResetToken(token), verifyTokenExpiresAt: verifyTokenExpiry() } }
  );
  const { subject, text } = verifyEmailBody(`${origin}/verify-email?token=${token}`);
  const result = await sendEmail({ to: user.email, subject, text });
  return result.ok;
}

/**
 * The address is proven. Stamps `emailVerifiedAt`, clears any verification token, and
 * applies the ADMIN_EMAILS/STAFF_EMAILS role the address is entitled to. That
 * promotion only ever happens here, once ownership is shown, never at sign-up.
 */
export async function markEmailVerified(user: {
  _id: Types.ObjectId | string;
  email: string;
  role?: string;
}): Promise<void> {
  await connectDB();
  const promoted = bootstrapRole(user.email.toLowerCase());
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerifiedAt: new Date(),
        ...(promoted && promoted !== user.role ? { role: promoted } : {}),
      },
      $unset: { verifyTokenHash: "", verifyTokenExpiresAt: "" },
    }
  );
  forgetSessionAccount(String(user._id));
}
