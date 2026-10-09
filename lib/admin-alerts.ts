// Push alerts to the admins' own devices (PLAN/SITE_ROADMAP.md F2): a band pitched, a night
// filled up. Server-only. Called from `after()`, once the guest already has their answer, so
// a slow push service never holds up a pitch or a reservation.
import * as Sentry from "@sentry/nextjs";
import { User } from "@/models/User";
import { PushSubscription } from "@/models/PushSubscription";
import { sendToSubscriptions, type PushPayload } from "@/lib/push";

/** Never throws: an alert that can't go out is reported, not surfaced. */
export async function notifyAdmins(payload: PushPayload, stage: string): Promise<void> {
  try {
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    if (admins.length === 0) return;
    const subs = await PushSubscription.find({ user: { $in: admins.map((a) => a._id) } })
      .select("endpoint keys")
      .lean();
    if (subs.length === 0) return;
    await sendToSubscriptions(subs, payload, stage);
  } catch (err) {
    console.error(`[push] ${stage} failed`, err);
    Sentry.captureException(err, { tags: { stage } });
  }
}

// Bilingual on one line, like every push here: the OS shows it outside the page.
export const pitchAlert = (bandName: string): PushPayload => ({
  title: "New pitch / عرض جديد",
  body: bandName,
  url: "/admin/submissions",
});

export const nightFullAlert = (night: { id: string; titleAr: string; titleEn: string }): PushPayload => ({
  title: "Night full / الليلة اتملت",
  body: night.titleEn || night.titleAr,
  url: `/admin/events/${night.id}`,
});
