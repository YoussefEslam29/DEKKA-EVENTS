import mongoose, { Schema, model, models } from "mongoose";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";

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
  /** Set when staff checked someone in off the reservation list. */
  reservation?: mongoose.Types.ObjectId | null;
  /** Which staff member logged the entry. */
  recordedBy: mongoose.Types.ObjectId;
  note?: string;
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
    reservation: { type: Schema.Types.ObjectId, ref: "Reservation", default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

CheckInSchema.index({ event: 1, createdAt: -1 });
// A reserved guest is only walked through the door once.
CheckInSchema.index(
  { reservation: 1 },
  { unique: true, partialFilterExpression: { reservation: { $type: "objectId" } } }
);

export const CheckIn =
  (models.CheckIn as mongoose.Model<ICheckIn>) ||
  model<ICheckIn>("CheckIn", CheckInSchema);
