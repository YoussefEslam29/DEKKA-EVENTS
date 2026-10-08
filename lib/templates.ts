/**
 * Event templates (`PLAN/DEKKA_PWA_APP.md` §4) — the pure half, shared by the
 * API routes, the admin screens and `scripts/check-templates.ts`. No Mongoose,
 * so client components can import it.
 */
import { fromLocalInputValue, toLocalInputValue } from "@/lib/format";

/**
 * The fields a template carries into an event — exactly these, nothing else.
 * This one list is what "Save as template" copies out of an event and what
 * `buildEventFromTemplate` copies back in, so the two directions can't drift.
 * Deliberately absent: `startsAt`, `status` and `doorsOpenAt`, which belong to
 * one occurrence, not to the night in general.
 */
export const TEMPLATE_EVENT_FIELDS = [
  "titleAr",
  "titleEn",
  "descriptionAr",
  "descriptionEn",
  "locationAr",
  "locationEn",
  "mapUrl",
  "coverImage",
  "isPoster",
  "price",
  "capacity",
  "paymentMethods",
  "instapayNumber",
  "termsAr",
  "termsEn",
] as const;

export type TemplateEventField = (typeof TEMPLATE_EVENT_FIELDS)[number];

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** "HH:mm", 24-hour — what `<input type="time">` produces. */
export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A real calendar date in "YYYY-MM-DD" form — rejects 2026-02-30 and 2026-13-01. */
export function isRealDate(date: string): boolean {
  const match = DATE.exec(date);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * The instant a date + time means *in the cafe's timezone* — "20:00" is 8pm in
 * Cairo wherever the admin happens to be, the same rule `EventForm` follows
 * (it goes through the same `fromLocalInputValue`). `null` for anything that
 * isn't a real date and time.
 */
export function startsAtFor(date: string, time: string): Date | null {
  if (!isRealDate(date) || !TIME_OF_DAY.test(time)) return null;
  return fromLocalInputValue(`${date}T${time}`);
}

/**
 * The same cafe wall-clock time `days` calendar days later: "Wednesday 20:00 in Cairo"
 * becomes "next Wednesday 20:00 in Cairo", even across Egypt's DST change. Adding
 * `7 * 24h` (or `setDate` in the browser's own timezone, as Duplicate used to) drifts an
 * hour across the change, or by the admin's offset when they're abroad
 * (`PLAN/SITE_ROADMAP.md` I4).
 */
export function shiftCafeDays(instant: string | Date, days: number): Date | null {
  const local = toLocalInputValue(instant); // "YYYY-MM-DDTHH:mm", cafe time
  if (!local) return null;
  const [y, m, d] = local.slice(0, 10).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  return startsAtFor(day, local.slice(11, 16));
}

/**
 * The new event's fields, built from a template on the server. Always a draft:
 * the existing Publish transition stays the single path that announces a night
 * (and fans out the push notification), so making an event from a template
 * can never notify anyone by itself.
 */
export function buildEventFromTemplate<T extends Record<TemplateEventField, unknown>>(
  template: T,
  startsAt: Date
) {
  const fields = Object.fromEntries(
    TEMPLATE_EVENT_FIELDS.map((key) => [key, template[key]])
  ) as Pick<T, TemplateEventField>;
  return {
    ...fields,
    // "Unlimited" is stored as null on events, never as a missing field.
    capacity: (template.capacity ?? null) as T["capacity"] | null,
    startsAt,
    status: "draft" as const,
  };
}

/**
 * What "Save as template" captures from an event: the reusable fields, plus
 * the time of day it started (in cafe time) as the template's usual time.
 */
export function templateFieldsFromEvent<T extends Record<TemplateEventField, unknown>>(
  event: T & { startsAt: string }
) {
  const fields = Object.fromEntries(
    TEMPLATE_EVENT_FIELDS.map((key) => [key, event[key]])
  ) as Pick<T, TemplateEventField>;
  // toLocalInputValue gives "YYYY-MM-DDTHH:mm" in cafe time; keep the time.
  const defaultTime = toLocalInputValue(event.startsAt).slice(11, 16) || "20:00";
  return { ...fields, defaultTime };
}
