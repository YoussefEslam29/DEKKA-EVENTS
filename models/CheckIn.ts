import mongoose, { Schema, model, models } from "mongoose";
import {
  PAYMENT_METHODS,
  GENDERS,
  type PaymentMethod,
  type Gender,
} from "@/lib/constants";

/**
 * One row of the door table for an event night. This — not Reservation — is the
 * record of money taken, so the monthly earnings report rolls up from here.
 */
export interface ICheckIn {
  _id: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
  amount: number;
  /** Optional, staff-entered at the door — feeds the event analysis report
   * (e.g. confirming a female-only night). `null` when not recorded. */
  gender?: Gender | null;
  /** Set when staff checked someone in off the reservation list. */
  reservation?: mongoose.Types.ObjectId | null;
  /** Which staff member logged the entry. */
  recordedBy: mongoose.Types.ObjectId;
  note?: string;
  /**
   * Set when the row is removed from the door table (`PLAN/SITE_ROADMAP.md` I3). Door rows
   * are the record of cash taken, so a removal voids rather than deletes: every reader
   * filters `voidedAt: null`, and the door log keeps who did it. Absent on live rows.
   */
  voidedAt?: Date | null;
  voidedBy?: mongoose.Types.ObjectId | null;
  /**
   * The reservation this row had consumed, moved here on void. `reservation` itself is
   * cleared so the unique partial index below frees the guest to be checked in again.
   */
  voidedReservation?: mongoose.Types.ObjectId | null;
  /**
   * The door phone's id for this entry (`lib/door-queue.ts`, roadmap R3). Unique, so a
   * resend after a dropped connection can't record the same person twice. Absent on
   * rows from before the queue and on entries the admin adds.
   */
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CheckInSchema = new Schema<ICheckIn>(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 0 },
    gender: { type: String, enum: GENDERS, default: null },
    reservation: { type: Schema.Types.ObjectId, ref: "Reservation", default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, maxlength: 300 },
    // All three optional and default-free: existing rows stay exactly as they are.
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidedReservation: { type: Schema.Types.ObjectId, ref: "Reservation" },
    clientId: { type: String, maxlength: 64 },
  },
  { timestamps: true }
);

CheckInSchema.index({ event: 1, createdAt: -1 });
// A reserved guest is only walked through the door once.
CheckInSchema.index(
  { reservation: 1 },
  { unique: true, partialFilterExpression: { reservation: { $type: "objectId" } } }
);

// One row per door-phone entry (roadmap R3). Sparse, so the many rows without a clientId
// don't collide; safe to build on the live collection, since no existing row has the field.
CheckInSchema.index({ clientId: 1 }, { unique: true, sparse: true });

export const CheckIn =
  (models.CheckIn as mongoose.Model<ICheckIn>) ||
  model<ICheckIn>("CheckIn", CheckInSchema);
