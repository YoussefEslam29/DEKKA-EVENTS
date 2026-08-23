import type { Locale } from "@/lib/i18n";

/**
 * Everything is displayed in the cafe's local time, regardless of where the
 * server or the visitor happens to be — a 9pm show is 9pm in Cairo.
 */
export const CAFE_TIMEZONE = process.env.NEXT_PUBLIC_CAFE_TIMEZONE || "Africa/Cairo";

const localeTag = (locale: Locale) => (locale === "ar" ? "ar-EG" : "en-GB");

export function formatDate(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: CAFE_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function formatShortDate(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: CAFE_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: CAFE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatMonth(month: string, locale: Locale): string {
  // `month` is "YYYY-MM"; the 15th avoids any timezone edge at month boundaries.
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** Day/month numerals for the date block on an event card. */
export function dateParts(date: Date | string, locale: Locale) {
  const d = new Date(date);
  const tag = localeTag(locale);
  return {
    day: new Intl.DateTimeFormat(tag, { timeZone: CAFE_TIMEZONE, day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat(tag, { timeZone: CAFE_TIMEZONE, month: "short" }).format(d),
    weekday: new Intl.DateTimeFormat(tag, { timeZone: CAFE_TIMEZONE, weekday: "long" }).format(d),
    year: new Intl.DateTimeFormat(tag, { timeZone: CAFE_TIMEZONE, year: "numeric" }).format(d),
  };
}

/** Locale-aware digits, so counts don't sit in Latin numerals beside Arabic dates. */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Offset between UTC and the cafe timezone at a given instant, in ms. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/**
 * Turns a stored instant into the `YYYY-MM-DDTHH:mm` string a
 * `<input type="datetime-local">` expects, expressed in cafe time.
 */
export function toLocalInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + timeZoneOffsetMs(d, CAFE_TIMEZONE));
  return shifted.toISOString().slice(0, 16);
}

/**
 * Inverse of `toLocalInputValue`: reads a wall-clock string as cafe time and
 * returns the matching instant, so admins type "20:00" and mean 20:00 in Cairo.
 */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  return new Date(naive.getTime() - timeZoneOffsetMs(naive, CAFE_TIMEZONE));
}

/** "YYYY-MM" key for the month an instant falls in, in cafe time. */
export function monthKey(date: Date | string): string {
  const d = new Date(date);
  const shifted = new Date(d.getTime() + timeZoneOffsetMs(d, CAFE_TIMEZONE));
  return shifted.toISOString().slice(0, 7);
}

/**
 * "YYYY-MM-DD" key for the calendar day an instant falls on, in cafe time.
 *
 * This is what the events calendar buckets by: a show at 1am must land on the
 * grid square for the night it belongs to in Cairo, not the UTC date the
 * instant happens to carry.
 */
export function dayKey(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + timeZoneOffsetMs(d, CAFE_TIMEZONE));
  return shifted.toISOString().slice(0, 10);
}

/** Shifts a "YYYY-MM" key by whole months, staying a valid key at year edges. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const zeroBased = (y * 12 + (m - 1)) + delta;
  return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, "0")}`;
}
