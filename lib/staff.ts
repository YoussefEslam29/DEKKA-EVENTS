/**
 * The staff door picker's grouping (`PLAN/SITE_ROADMAP.md` X2). Pure, client-safe.
 */
import { dayKey, fromLocalInputValue } from "@/lib/format";
import { EVENT_DEFAULT_DURATION_MIN } from "@/lib/constants";

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
 * The instants a cafe night spans: 05:00 Cairo on its date to 05:00 the next morning.
 * Built from wall-clock strings through `fromLocalInputValue`, so Egypt's DST change
 * can't shift it by an hour.
 */
export function cafeNightBounds(now: Date): { key: string; start: Date; end: Date } {
  const key = cafeNightKey(now);
  const [y, m, d] = key.split("-").map(Number);
  const nextKey = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const hh = String(NIGHT_ROLLOVER_HOURS).padStart(2, "0");
  return {
    key,
    start: fromLocalInputValue(`${key}T${hh}:00`) ?? now,
    end: fromLocalInputValue(`${nextKey}T${hh}:00`) ?? now,
  };
}

/** Has a night that started at `startsAt` finished by `now`? (Events store no end.) */
export function hasEnded(startsAt: string | Date, now: Date): boolean {
  return now.getTime() >= new Date(startsAt).getTime() + EVENT_DEFAULT_DURATION_MIN * 60_000;
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
