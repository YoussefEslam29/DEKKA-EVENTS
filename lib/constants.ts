/**
 * Shared enums and union types with **no runtime dependencies**.
 *
 * The Mongoose models re-export these, but client components must import from
 * here: importing from `@/models/*` would pull mongoose (and the whole MongoDB
 * driver) into the browser bundle.
 */

export const USER_ROLES = ["member", "staff", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Event lifecycle, per idea.md §7. Only `published` accepts reservations. */
export const EVENT_STATUSES = [
  "draft",
  "published",
  "closed",
  "happened",
  "archived",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The statuses a guest may see. Every public route and page filters on exactly these. */
export const PUBLIC_EVENT_STATUSES: EventStatus[] = ["published", "closed", "happened", "archived"];

/**
 * Where an event may go from each status (`PLAN/SITE_ROADMAP.md` I1). One table, read by
 * both `PATCH /api/events/:id` (which refuses anything else with `INVALID_TRANSITION`)
 * and `EventAdminActions` (which only offers these buttons), so the two can't disagree.
 *
 * What it rules out, and why:
 * - `happened`/`archived` → `published`: re-announcing a past night. Re-opening goes
 *   `happened → closed → published`, deliberately two steps.
 * - `happened`/`archived` → `draft`: the monthly report and the PDF only count non-draft
 *   nights, so this made a night's takings vanish from the books.
 * Moving *to* `draft` additionally requires no reservations and no door records; the
 * route checks that, since it needs the database.
 */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["published"],
  published: ["closed", "happened", "draft"],
  closed: ["published", "happened", "draft"],
  happened: ["archived", "closed"],
  archived: ["happened"],
};

/** Staying put is always allowed: a PATCH that resends the current status is an edit. */
export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return from === to || EVENT_TRANSITIONS[from].includes(to);
}

/**
 * How long a night lasts, for anything that needs an end: events store only a start.
 * The calendar entry's end, the "on now" window and the structured data's `endDate`
 * all read this one number (`PLAN/DEKKA_PWA_APP.md` §5.1, owner question Q3).
 */
export const EVENT_DEFAULT_DURATION_MIN = 180;

/** What the door log records (`CheckInAudit.action`). */
export const CHECKIN_AUDIT_ACTIONS = ["create", "update", "void"] as const;
export type CheckInAuditAction = (typeof CHECKIN_AUDIT_ACTIONS)[number];

export const PAYMENT_METHODS = ["cash", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Optional, staff-entered at the door — for the event analysis report. */
export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const RESERVATION_STATUSES = ["confirmed", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const SUBMISSION_STATUSES = ["pending", "approved", "declined"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Labels a cafe-menu item can carry (`PLAN/DEKKA_PWA_APP.md` §3) — how it's
 * served and who it suits. Keys double as dictionary keys under
 * `t.cafeMenu.tags`, so add a translation alongside any new value.
 */
export const MENU_TAGS = ["hot", "cold", "vegan", "vegetarian", "sugarFree", "caffeineFree"] as const;
export type MenuTag = (typeof MENU_TAGS)[number];

/**
 * What a saved event template is (`PLAN/DEKKA_PWA_APP.md` §4) — an evening show
 * or a daytime activity. Display only: both produce the same kind of `Event`;
 * this just picks the icon and the label on the template's button.
 */
export const EVENT_TEMPLATE_KINDS = ["night", "activity"] as const;
export type EventTemplateKind = (typeof EVENT_TEMPLATE_KINDS)[number];

/**
 * The privacy-safe counters (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.1): anonymous daily totals,
 * nothing about who. `menu_item_view` is per item; the rest are plain tallies.
 * - `menu_item_view`: a card at least half on screen for a second, once per page load.
 * - `install_prompt_shown` / `_accepted`: the install strip or /get-app panel actually
 *   visible, and Chromium's "accepted" (iPhones give websites no such signal).
 * - `app_open`: a launch of the installed app; the one install signal iPhones give.
 * - `qr_scan`: an arrival at /get-app?from=qr, from the table poster.
 */
export const TALLY_METRICS = ["install_prompt_shown", "install_prompt_accepted", "app_open", "qr_scan"] as const;
export const USAGE_METRICS = ["menu_item_view", ...TALLY_METRICS] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];
