// GET /api/cron/reminders — the "tonight at Dekka" push (PLAN/SITE_ROADMAP.md F1).
//
// Vercel Cron calls it once a day (vercel.json; the Hobby plan allows daily only), early
// enough that every night still lies ahead. Guarded by CRON_SECRET, not a session: it's a
// machine calling. Does nothing unless REMINDERS_ENABLED=1 (lib/reminders.ts).
//
// Once per reservation, however often it runs: each night's unreminded confirmed rows are
// first stamped with this run's own `remindedAt`, then only the rows carrying that stamp
// are sent to. A retry or an overlapping run finds nothing left to claim.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { Reservation } from "@/models/Reservation";
import { PushSubscription } from "@/models/PushSubscription";
import { handle, jsonError } from "@/lib/api";
import { pushConfigured, sendToSubscriptions } from "@/lib/push";
import { cafeNightBounds, hasEnded } from "@/lib/staff";
import { cronAuthorized, reminderPayload, remindersEnabled } from "@/lib/reminders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handle("GET /api/cron/reminders", async () => {
    if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
      return jsonError("Unauthorized", 401);
    }
    if (!remindersEnabled()) return NextResponse.json({ data: { skipped: "disabled" } });
    if (!pushConfigured) return NextResponse.json({ data: { skipped: "push not configured" } });

    const now = new Date();
    const { key, start, end } = cafeNightBounds(now);
    await connectDB();
    const nights = (
      await Event.find({ status: { $in: ["published", "closed"] }, startsAt: { $gte: start, $lt: end } })
        .select("titleAr titleEn startsAt")
        .lean()
    ).filter((night) => !hasEnded(night.startsAt, now));

    const totals = { night: key, nights: nights.length, reminded: 0, sent: 0, removed: 0, failed: 0 };
    for (const night of nights) {
      const stamp = new Date();
      await Reservation.updateMany(
        { event: night._id, status: "confirmed", remindedAt: { $exists: false } },
        { $set: { remindedAt: stamp } }
      );
      const claimed = await Reservation.find({ event: night._id, remindedAt: stamp }).select("user").lean();
      if (claimed.length === 0) continue;
      totals.reminded += claimed.length;

      const subs = await PushSubscription.find({ user: { $in: claimed.map((r) => r.user) } })
        .select("endpoint keys")
        .lean();
      const counts = await sendToSubscriptions(subs, reminderPayload(night), "push-reminder");
      totals.sent += counts.sent;
      totals.removed += counts.removed;
      totals.failed += counts.failed;
    }
    return NextResponse.json({ data: totals });
  });
}
