// POST /api/stats — the anonymous counters' beacon (PLAN/DEKKA_PWA_APP.md §5.4, 4c.1).
//
// A public route on developer-guide.md §3 rule 9's terms: it never reads the session or a
// cookie, so it can't learn who is counting; it is rate-limited per IP, on a SHA-256 of
// the address so even the limiter never holds it. Item views only count for menu items
// that exist, so junk ids can't create junk rows. Answers 204 either way.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import type { AnyBulkWriteOperation, Types } from "mongoose";
import { UsageCounter, type IUsageCounter } from "@/models/UsageCounter";
import type { UsageMetric } from "@/lib/constants";
import { MenuItem } from "@/models/MenuItem";
import { handle, parseBody } from "@/lib/api";
import { statsSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { dayKey } from "@/lib/format";

type Key = { metric: UsageMetric; day: string; item: Types.ObjectId | null };

/** `$inc` one row, creating it on first use; one retry if two first uses race the unique index. */
async function bump(keys: Key[]) {
  if (keys.length === 0) return;
  const ops = keys.map((filter) => ({
    updateOne: { filter, update: { $inc: { count: 1 } }, upsert: true },
  })) as AnyBulkWriteOperation<IUsageCounter>[];
  try {
    await UsageCounter.bulkWrite(ops, { ordered: false });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    await UsageCounter.bulkWrite(ops, { ordered: false });
  }
}

export async function POST(request: Request) {
  return handle("POST /api/stats", async () => {
    const ipHash = createHash("sha256").update(clientIp(request)).digest("hex");
    const rl = await rateLimit("stats-ip", ipHash);
    if ("response" in rl) return rl.response;

    const parsed = await parseBody(request, statsSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const day = dayKey(new Date());
    if (parsed.data.metric === "menu_item_view") {
      const real = await MenuItem.find({ _id: { $in: parsed.data.items } }).select("_id").lean();
      await bump(real.map((doc) => ({ metric: "menu_item_view", day, item: doc._id })));
    } else {
      await bump([{ metric: parsed.data.metric, day, item: null }]);
    }
    return new NextResponse(null, { status: 204 });
  });
}
