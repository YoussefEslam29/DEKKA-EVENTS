// "Tonight at Dekka" reminders (`PLAN/SITE_ROADMAP.md` F1): the parts of the cron route
// that need no database, kept here so `check:event-night` can test them.
import { timingSafeEqual } from "node:crypto";
import { formatTime } from "@/lib/format";
import type { PushPayload } from "@/lib/push";

/**
 * Built but off until Gate G1 has shown that push actually arrives on real phones
 * (decision Q8): the cron route does nothing unless the owner sets `REMINDERS_ENABLED=1`.
 */
export function remindersEnabled(): boolean {
  return process.env.REMINDERS_ENABLED === "1";
}

/**
 * Vercel Cron calls with `Authorization: Bearer $CRON_SECRET`. No secret configured means
 * nobody gets in (not everybody), and the comparison takes the same time however much of
 * a guess is right.
 */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * One bilingual line, like the "new night" push (`app/api/events/[id]/route.ts`): the OS
 * shows it outside the page, where there's no language toggle. Opens My Events, where
 * tonight's door code is one tap away.
 */
export function reminderPayload(night: { titleAr: string; titleEn: string; startsAt: Date | string }): PushPayload {
  return {
    title: "Tonight at Dekka / الليلة في دكة",
    body: `${night.titleEn || night.titleAr} · ${formatTime(night.startsAt, "en")}`,
    url: "/my-events",
  };
}
