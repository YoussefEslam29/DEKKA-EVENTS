import mongoose, { Schema, model, models } from "mongoose";
import { CHECKIN_AUDIT_ACTIONS, type CheckInAuditAction } from "@/lib/constants";

/**
 * The door log (`PLAN/SITE_ROADMAP.md` I3): one row per check-in, edit or removal on the
 * door table. Door rows are the record of cash taken and any staff account can change
 * them, so the owner gets to see who changed what, and when.
 *
 * Append-only by convention: nothing in the app updates or deletes these. `byName` is a
 * snapshot, so the log still reads correctly after a staff account is renamed or deleted.
 */
export type AuditChange = { field: string; from: unknown; to: unknown };

export interface ICheckInAudit {
  _id: mongoose.Types.ObjectId;
  checkIn: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  action: CheckInAuditAction;
  by: mongoose.Types.ObjectId;
  byName: string;
  /** Field-by-field for an edit; the row's values for a check-in or a removal. */
  changes: AuditChange[];
  createdAt: Date;
}

const CheckInAuditSchema = new Schema<ICheckInAudit>(
  {
    checkIn: { type: Schema.Types.ObjectId, ref: "CheckIn", required: true },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    action: { type: String, enum: CHECKIN_AUDIT_ACTIONS, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    byName: { type: String, default: "", maxlength: 120 },
    changes: {
      type: [{ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed, _id: false }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The admin event page reads one night's log, newest first.
CheckInAuditSchema.index({ event: 1, createdAt: -1 });

export const CheckInAudit =
  (models.CheckInAudit as mongoose.Model<ICheckInAudit>) ||
  model<ICheckInAudit>("CheckInAudit", CheckInAuditSchema);
