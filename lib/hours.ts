/**
 * "Open now / closes at" (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b.1). Pure and client-safe.
 *
 * Hours are Cairo wall-clock times, read through `Intl` like the rest of `lib/format.ts`,
 * so nothing hard-codes an offset and Egypt's clock changes need no special case. A
 * closing time earlier than the opening time means after midnight: "10:00-01:00" is open
 * until 1am the *next* morning, so at 00:30 on Saturday the window that matters is
 * Friday's.
 */
import { CAFE_TIMEZONE, formatTimeOfDay } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/** One day's opening, "HH:MM" each; `null` for a closed day. */
export type DayHours = { opens: string; closes: string } | null;
/** Seven days, Sunday first. */
export type WeekHours = DayHours[];

export const DEFAULT_OPENING_HOURS = "10:00-01:00";
/** Within this many minutes of closing, "Open now" becomes "Closing soon". */
export const CLOSING_SOON_MIN = 60;

const RANGE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

function parseDay(text: string): DayHours | undefined {
  const value = text.trim().toLowerCase();
  if (value === "closed") return null;
  const m = RANGE.exec(value);
  return m ? { opens: `${m[1]}:${m[2]}`, closes: `${m[3]}:${m[4]}` } : undefined;
}

/**
 * `NEXT_PUBLIC_OPENING_HOURS`: one range for every day ("10:00-01:00"), or seven
 * comma-separated ranges or `closed`, Sunday first. Ramadan hours can then change without
 * a deploy. Anything malformed falls back to the default rather than showing nonsense.
 */
export function parseOpeningHours(value: string | undefined): WeekHours {
  const every = (day: DayHours) => Array.from({ length: 7 }, () => day);
  const fallback = every(parseDay(DEFAULT_OPENING_HOURS)!);
  if (!value?.trim()) return fallback;
  const parts = value.split(",");
  if (parts.length === 1) {
    const day = parseDay(parts[0]);
    return day === undefined ? fallback : every(day);
  }
  if (parts.length !== 7) return fallback;
  const days = parts.map(parseDay);
  return days.some((d) => d === undefined) ? fallback : (days as DayHours[]);
}

export type OpenStatus = {
  state: "open" | "closingSoon" | "closed";
  /** Open: when it closes, "HH:MM". */
  until?: string;
  /** Closed: when it next opens, "HH:MM"; unset if it never does. */
  opensAt?: string;
  /** Closed: days from today until then (0 = later today). */
  opensInDays?: number;
  /** Closed: that day's weekday, 0 = Sunday. */
  opensWeekday?: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Weekday (0 = Sunday) and minutes since midnight on the cafe's wall clock. */
export function cairoClock(now: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAFE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: WEEKDAYS.indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function openStatus(now: Date, hours: WeekHours): OpenStatus {
  const { weekday, minutes } = cairoClock(now);
  const open = (closes: string, left: number): OpenStatus => ({
    state: left <= CLOSING_SOON_MIN ? "closingSoon" : "open",
    until: closes,
  });

  // Yesterday's window running past midnight.
  const yesterday = hours[(weekday + 6) % 7];
  if (yesterday && minutesOf(yesterday.closes) <= minutesOf(yesterday.opens) && minutes < minutesOf(yesterday.closes)) {
    return open(yesterday.closes, minutesOf(yesterday.closes) - minutes);
  }

  const today = hours[weekday];
  if (today) {
    const opens = minutesOf(today.opens);
    const closes = minutesOf(today.closes);
    const overnight = closes <= opens;
    if (minutes >= opens && (overnight || minutes < closes)) {
      return open(today.closes, overnight ? 24 * 60 - minutes + closes : closes - minutes);
    }
    if (minutes < opens) return { state: "closed", opensAt: today.opens, opensInDays: 0, opensWeekday: weekday };
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = hours[(weekday + ahead) % 7];
    if (day) return { state: "closed", opensAt: day.opens, opensInDays: ahead, opensWeekday: (weekday + ahead) % 7 };
  }
  return { state: "closed" };
}

type VisitCopy = {
  openUntil: string;
  closingSoon: string;
  closedOpensAt: string;
  closedOpensTomorrow: string;
  closedOpensOn: string;
  closed: string;
};

/** The pill's words. Colour is never the only signal, so the words carry the state. */
export function openStatusText(status: OpenStatus, locale: Locale, copy: VisitCopy): string {
  if (status.state !== "closed") {
    const time = formatTimeOfDay(status.until!, locale);
    return (status.state === "open" ? copy.openUntil : copy.closingSoon).replace("{time}", time);
  }
  if (!status.opensAt) return copy.closed;
  const time = formatTimeOfDay(status.opensAt, locale);
  if (status.opensInDays === 0) return copy.closedOpensAt.replace("{time}", time);
  if (status.opensInDays === 1) return copy.closedOpensTomorrow.replace("{time}", time);
  // 4 January 2026 was a Sunday: any date that day plus n is weekday n.
  const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 0, 4 + (status.opensWeekday ?? 0)))
  );
  return copy.closedOpensOn.replace("{day}", day).replace("{time}", time);
}
