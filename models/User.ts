import mongoose, { Schema, model, models } from "mongoose";

import { USER_ROLES, type UserRole } from "@/lib/constants";

export { USER_ROLES };
export type { UserRole };

/**
 * One account per person. OAuth sign-ins (Google/Facebook) are upserted into the
 * same collection as email/password members so roles live in exactly one place.
 */
export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  /** Absent for accounts that only ever signed in through Google/Facebook. */
  passwordHash?: string;
  image?: string;
  providers: string[];
  role: UserRole;
  /**
   * SHA-256 of the password-reset token — never the token itself. Same instinct as
   * `passwordHash`: a database dump must not hand anyone a working reset link.
   * `select: false`, so it never rides along on an ordinary user query.
   */
  resetTokenHash?: string;
  /** When the current reset token stops working. TTL-indexed below. */
  resetTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    passwordHash: { type: String, select: false },
    image: { type: String, maxlength: 500 },
    providers: { type: [String], default: ["credentials"] },
    role: { type: String, enum: USER_ROLES, default: "member", index: true },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

/**
 * NO TTL INDEX HERE — and that is a deliberate rejection of what
 * `PLAN/Before_Deployment.md` §5/§7 asks for. Read this before "fixing" it.
 *
 * That doc calls for "a Mongo TTL index on `resetTokenExpiresAt` so expired, unused
 * tokens are purged automatically rather than lingering as dead rows forever."
 * Applied to *this* collection that instruction destroys user accounts: a MongoDB TTL
 * index deletes **the whole document**, never a single field. Every member who ever
 * requested a password reset would have their account silently deleted 30 minutes
 * later — along with, by cascade of meaning, their reservation history.
 *
 * The doc's underlying worry doesn't actually apply here either. There are no "dead
 * rows" to reap: this is two optional, `select: false` fields on a document that has
 * every reason to keep existing. They are overwritten by the next reset request and
 * cleared on a successful one, so at most one stale hash sits on a user at a time,
 * and an expired hash is inert because the reset route checks expiry explicitly.
 *
 * If auto-purging is ever genuinely wanted, the correct shape is a separate
 * `PasswordResetToken` collection whose documents are *entirely* ephemeral — which is
 * what TTL indexes are for. That was judged not worth a collection for two fields.
 */

export const User =
  (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
