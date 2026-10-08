/**
 * The staff door picker's grouping (`PLAN/SITE_ROADMAP.md` X2). Pure, client-safe.
 */
import { dayKey } from "@/lib/format";

/**
 * A cafe night runs until 05:00 the next morning: a 00:30 show belongs to the evening
 * before, and at 00:30 the door is still working "tonight", not tomorrow.
 */
export const NIGHT_ROLLOVER_HOURS = 5;

/** The Cairo calendar date of the night an instant belongs to. */
export function cafeNightKey(instant: Date | string): string {
  return dayKey(new Date(new Date(instant).getTime() - NIGHT_ROLLOVER_HOURS * 3600_000));
}

/**
 * Tonight first (what the door is here for), then what's coming up, soonest first, then
 * earlier nights, newest first, for fixing up a door table after the fact.
 */
export function groupStaffEvents<T extends { startsAt: string }>(events: T[], now: Date) {
  const tonightKey = cafeNightKey(now);
  const tonight: T[] = [];
  const upcoming: T[] = [];
  const earlier: T[] = [];
  for (const event of events) {
    if (cafeNightKey(event.startsAt) === tonightKey) tonight.push(event);
    else if (new Date(event.startsAt).getTime() > now.getTime()) upcoming.push(event);
    else earlier.push(event);
  }
  const at = (e: T) => new Date(e.startsAt).getTime();
  tonight.sort((a, b) => at(a) - at(b));
  upcoming.sort((a, b) => at(a) - at(b));
  earlier.sort((a, b) => at(b) - at(a));
  return { tonight, upcoming, earlier };
}
