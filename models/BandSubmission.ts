import mongoose, { Schema, model, models } from "mongoose";

import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/constants";

export { SUBMISSION_STATUSES };
export type { SubmissionStatus };

/** Replaces the Google Form. Open to logged-out visitors — see README §Decisions. */
export interface IBandSubmission {
  _id: mongoose.Types.ObjectId;
  bandName: string;
  genre: string;
  contactName: string;
  email: string;
  phone: string;
  links: string[];
  preferredDates: string;
  pitch: string;
  status: SubmissionStatus;
  adminNote?: string;
  /** Present only when the musician happened to be signed in. */
  user?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BandSubmissionSchema = new Schema<IBandSubmission>(
  {
    bandName: { type: String, required: true, trim: true, maxlength: 160 },
    genre: { type: String, default: "", trim: true, maxlength: 120 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    links: { type: [String], default: [] },
    preferredDates: { type: String, default: "", maxlength: 300 },
    pitch: { type: String, default: "", maxlength: 3000 },
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: "pending",
      index: true,
    },
    adminNote: { type: String, maxlength: 1000 },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

BandSubmissionSchema.index({ status: 1, createdAt: -1 });

export const BandSubmission =
  (models.BandSubmission as mongoose.Model<IBandSubmission>) ||
  model<IBandSubmission>("BandSubmission", BandSubmissionSchema);
