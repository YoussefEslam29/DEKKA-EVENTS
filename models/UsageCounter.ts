import mongoose, { Schema, model, models } from "mongoose";
import { USAGE_METRICS, type UsageMetric } from "@/lib/constants";

/**
 * An anonymous daily total (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.1): one row per metric per
 * Cairo day (per item, for menu views), incremented in place. **Nothing else, on
 * purpose:** no user, IP address, cookie, user agent or time finer than the day, so no
 * number here can be traced back to anyone. `check:owner-tools` reads this file to keep
 * it that way.
 */
export interface IUsageCounter {
  _id: mongoose.Types.ObjectId;
  metric: UsageMetric;
  /** "YYYY-MM-DD", Cairo. */
  day: string;
  /** The menu item, for `menu_item_view` only. */
  item?: mongoose.Types.ObjectId;
  count: number;
}

const UsageCounterSchema = new Schema<IUsageCounter>(
  {
    metric: { type: String, enum: USAGE_METRICS, required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    item: { type: Schema.Types.ObjectId, ref: "MenuItem" },
    count: { type: Number, default: 0 },
  },
  { versionKey: false }
);

// One row per (metric, day, item); every write is an upsert on exactly this key.
UsageCounterSchema.index({ metric: 1, day: 1, item: 1 }, { unique: true });

export const UsageCounter =
  (models.UsageCounter as mongoose.Model<IUsageCounter>) ||
  model<IUsageCounter>("UsageCounter", UsageCounterSchema);
