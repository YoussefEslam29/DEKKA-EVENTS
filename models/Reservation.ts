import { randomInt } from "node:crypto";
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

/** The door-code alphabet: no 0/O, 1/I/L, 2/Z, B/8 or S/5 to misread in a dim room. */
export const RESERVATION_CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3456789";

/**
 * A 6-character door code from a cryptographic source (`PLAN/SITE_ROADMAP.md` S10).
 * `Math.random()` is predictable enough that codes could be guessed in sequence. Use
 * `uniqueReservationCode()` to also rule out a clash with another guest that night.
 */
export function generateReservationCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += RESERVATION_CODE_ALPHABET[randomInt(RESERVATION_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * A door code no confirmed reservation for the same night already holds. With ~480M
 * codes a clash is vanishingly rare, but two guests showing the door the same code would
 * be a real mess, and checking costs one indexed query.
 */
export async function uniqueReservationCode(eventId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReservationCode();
    const taken = await Reservation.exists({ event: eventId, code, status: "confirmed" });
    if (!taken) return code;
  }
  return generateReservationCode();
}
