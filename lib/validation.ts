import { z } from "zod";
import {
  EVENT_STATUSES,
  PAYMENT_METHODS,
  SUBMISSION_STATUSES,
} from "@/lib/constants";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).optional().default("");

export const registerSchema = z.object({
  name: trimmed(120).min(2),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: trimmed(30).min(6),
  password: z.string().min(8).max(200),
});

/**
 * `PATCH /api/account` (`PLAN/LOG_SIGN_AUTH_IN.md` §5b) — name/phone/photo,
 * one section of the form saved at a time, so every field is optional.
 *
 * `.strict()` matters here: the parsed result feeds a `$set` directly, so an
 * unlisted key (`email`, `role`, `providers`, `passwordHash`) reaching it
 * would be exactly the mass-assignment hole `parseBody` exists to close.
 * Email is deliberately absent — it is shown but not editable (§5b item 5).
 */
export const updateAccountSchema = z
  .object({
    name: trimmed(120).min(2),
    phone: trimmed(30).min(6),
    // Matches User.image's own `maxlength: 500` (models/User.ts) — a value
    // over 500 that still passed here would fail Mongoose's validator
    // instead, and `handle()` turns that into an opaque 500 rather than a
    // clean 400.
    image: z.string().trim().max(500),
  })
  .partial()
  .strict();

/**
 * `PATCH /api/account/password` — set (Google-only account) or change
 * (account already has a hash) password, per §4b/§5b item 4.
 *
 * `currentPassword` is optional at the schema level; the route decides
 * whether it is actually required, based on whether the account has a
 * `passwordHash` yet. `newPassword`/`confirmPassword` are re-checked here
 * even though the client already compared them — same rule as §2's
 * confirm-password field: the client check is a UX guard, never the security
 * boundary.
 */
export const setPasswordSchema = z
  .object({
    currentPassword: z.string().max(200).optional(),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .strict();

/**
 * `POST /api/push/subscribe` (`PLAN/LOG_SIGN_AUTH_IN.md` §6) — the browser's
 * own `PushSubscription.toJSON()` shape, unchanged. `.strict()` for the same
 * mass-assignment reason as every other schema here: this feeds a Mongoose
 * write, so an unlisted key has no business reaching it.
 */
export const pushSubscribeSchema = z
  .object({
    endpoint: z.string().trim().url().max(1000),
    keys: z
      .object({
        p256dh: z.string().trim().min(1).max(500),
        auth: z.string().trim().min(1).max(500),
      })
      .strict(),
  })
  .strict();

/** `DELETE /api/push/subscribe` — just the one device being unsubscribed. */
export const pushUnsubscribeSchema = z
  .object({
    endpoint: z.string().trim().url().max(1000),
  })
  .strict();

const eventCore = {
  titleAr: trimmed(160).min(1),
  titleEn: trimmed(160).min(1),
  descriptionAr: optionalText(4000),
  descriptionEn: optionalText(4000),
  locationAr: optionalText(240),
  locationEn: optionalText(240),
  mapUrl: z.string().trim().max(800).optional().default(""),
  coverImage: z.string().trim().max(800).optional().default(""),
  isPoster: z.boolean().optional().default(false),
  startsAt: z.string().datetime({ offset: true }),
  doorsOpenAt: z.string().datetime({ offset: true }).nullish(),
  price: z.number().min(0).max(1_000_000),
  capacity: z.number().int().min(1).max(100_000).nullish(),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
  instapayNumber: optionalText(60),
  termsAr: optionalText(4000),
  termsEn: optionalText(4000),
  status: z.enum(EVENT_STATUSES).default("draft"),
};

/**
 * Strips every `.default(...)` off a Zod object shape, keeping each field's
 * own type/constraints (enum values, `min`/`max`, etc.) via `.removeDefault()`.
 *
 * Why this exists (Task 5 fix round 1 — Critical): in Zod v4, `.partial()`
 * does **not** stop a field's `.default(...)` from firing when that key is
 * completely absent from the input — confirmed against the installed `zod`
 * package (see the Task 5 report). `eventCore` above has *ten* defaulted
 * fields (`descriptionAr`/`descriptionEn`/`locationAr`/`locationEn`/
 * `instapayNumber`/`termsAr`/`termsEn` via `optionalText()`, `mapUrl`/
 * `coverImage` via `.default("")`, `isPoster` via `.default(false)`, plus
 * `status`). Building `updateEventSchema` straight from `eventCore.partial()`
 * meant a status-only `PATCH` — exactly what `EventAdminActions.tsx` sends on
 * every Publish/Close/Reopen click (`{status: next}`, nothing else) — parsed
 * to all nine other fields resolving to their create-time defaults (`""`,
 * `false`), and `PATCH /api/events/:id`'s passthrough loop writes every key
 * `parseBody` hands back that isn't `undefined`. In production that would
 * silently blank an event's description, location, map URL, cover image,
 * poster flag, Instapay number, and terms — in both languages — on an
 * ordinary status toggle, then fire this task's push notification announcing
 * the now-gutted event.
 *
 * A first attempt at this fix re-declared just `status` without its default
 * before `.partial()` — correct for `status` alone, but left the other nine
 * fields exposed, since each carried its own separate `.default(...)`. This
 * version fixes the *class* of bug instead of one field: `updateEventSchema`
 * is built by stripping defaults off `eventCore`'s current shape
 * automatically, so a field added to `eventCore` later — defaulted or not —
 * can never reintroduce this without anyone having to remember to special-case
 * it here. `createEventSchema` is untouched and still applies every default,
 * exactly as before.
 */
function stripDefaults<Shape extends z.ZodRawShape>(shape: Shape): Shape {
  const stripped = {} as Shape;
  for (const key of Object.keys(shape) as (keyof Shape)[]) {
    const field = shape[key];
    stripped[key] = (
      field instanceof z.ZodDefault ? field.removeDefault() : field
    ) as Shape[typeof key];
  }
  return stripped;
}

export const createEventSchema = z.object(eventCore);
/** Every field optional — admins save one section of the form at a time.
 * Built from `eventCore` with every default stripped (see `stripDefaults`
 * above) so an omitted key means "leave this field alone," never "reset it
 * to its create-time default." */
export const updateEventSchema = z.object(stripDefaults(eventCore)).partial();

export const checkInSchema = z.object({
  name: trimmed(120).min(1),
  phone: trimmed(30).min(4),
  paymentMethod: z.enum(PAYMENT_METHODS),
  amount: z.number().min(0).max(1_000_000),
  reservationId: z.string().trim().max(40).optional(),
  note: optionalText(300),
});

/**
 * Correcting a door entry after the fact (`PLAN/FIX_ADMIN_DASH.md` §2b). Every
 * field optional, because the spreadsheet grid saves one cell at a time.
 *
 * `.strict()` matters here: this result feeds a `$set`, so an unlisted key
 * (`event`, `recordedBy`, `reservation`) reaching it would be exactly the
 * mass-assignment hole `parseBody` exists to close. Rejecting the request is
 * safer than silently dropping the key.
 */
export const updateCheckInSchema = z
  .object({
    name: trimmed(120).min(1),
    phone: trimmed(30).min(4),
    paymentMethod: z.enum(PAYMENT_METHODS),
    amount: z.number().min(0).max(1_000_000),
    note: optionalText(300),
  })
  .partial()
  .strict();

export const submissionSchema = z.object({
  bandName: trimmed(160).min(1),
  genre: optionalText(120),
  contactName: trimmed(120).min(1),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: optionalText(30),
  links: z.array(z.string().trim().max(400)).max(10).optional().default([]),
  preferredDates: optionalText(300),
  pitch: optionalText(3000),
});

export const submissionUpdateSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type UpdateCheckInInput = z.infer<typeof updateCheckInSchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
