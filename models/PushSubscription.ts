import mongoose, { Schema, model, models } from "mongoose";

/**
 * One row per browser/device, not per user (`PLAN/LOG_SIGN_AUTH_IN.md` §6) —
 * someone with the site open on a phone and a laptop should get notified on
 * both, so `endpoint` (the push service URL the browser handed back) is the
 * unique key, not `user`. Re-subscribing the same browser upserts instead of
 * duplicating (see `POST /api/push/subscribe`).
 */
export interface IPushSubscription {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 500 },
      auth: { type: String, required: true, maxlength: 500 },
    },
  },
  { timestamps: true }
);

export const PushSubscription =
  (models.PushSubscription as mongoose.Model<IPushSubscription>) ||
  model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
