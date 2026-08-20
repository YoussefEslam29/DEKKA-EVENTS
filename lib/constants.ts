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

export const PAYMENT_METHODS = ["cash", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RESERVATION_STATUSES = ["confirmed", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const SUBMISSION_STATUSES = ["pending", "approved", "declined"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
