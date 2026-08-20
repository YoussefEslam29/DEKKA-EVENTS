import mongoose, { Schema, model, models } from "mongoose";

import { RESERVATION_STATUSES, type ReservationStatus } from "@/lib/constants";

export { RESERVATION_STATUSES };
export type { ReservationStatus };

/**
 * A held spot. No money moves here — the guest pays cash/InstaPay at the door,
 * which staff record separately as a CheckIn.
 */
export interface IReservation {
  _id: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  /** Snapshot of the member's details at reservation time, for the door list. */
  name: string;
  phone: string;
  /** Short human-readable code the guest shows at the door. */
  code: string;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    code: { type: String, required: true, uppercase: true, maxlength: 12 },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "confirmed",
      index: true,
    },
  },
  { timestamps: true }
);

// One member holds at most one spot per event; re-reserving revives the old row.
ReservationSchema.index({ event: 1, user: 1 }, { unique: true });
ReservationSchema.index({ event: 1, status: 1 });
ReservationSchema.index({ code: 1 });

export const Reservation =
  (models.Reservation as mongoose.Model<IReservation>) ||
  model<IReservation>("Reservation", ReservationSchema);

/** Generates a 6-character door code with no easily-confused characters. */
export function generateReservationCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
