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
  },
  { timestamps: true }
);

export const User =
  (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
