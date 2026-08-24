# Fix: Password Reset + Event Reviews (FIX_AUTH_REVIEWS.md)

Plan for two requested additions: a real "forgot password" flow (today's `Forgot?` link
on the login screen is a dead link back to `/login`), and a review/rating feature on
events, restricted to members who actually attended. Written against the current code
(`app/(auth)/*`, `lib/auth.ts`, `models/User.ts`, `models/Reservation.ts`,
`models/CheckIn.ts`, `app/(site)/events/[id]/page.tsx`) after reading
`developer-guide.md` and every doc in `PLAN/`, per the repo's own instruction to do that
before touching a line. **Status: open questions answered below — this is the
implementation plan, not yet built.** Follows the same "decisions locked in →
per-section spec → implementation checklist" shape as `PLAN/FIX_ADMIN_DASH.md`.

Per this session's own project rule (Sonnet writes plans, Opus implements): nothing in
this file has been coded. Hand this to an Opus implementation session next.

## Decisions locked in

| # | Question | Answer |
|---|---|---|
| 1 | Build the real password-reset flow, or just hide the dead link? | **Build the real flow.** Needs an email-sending service — see §1. |
| 2 | Who can review an event? | **Only members who actually attended** — logged in, held a confirmed reservation for that event, *and* were checked in against it. Not "anyone logged in," not "anyone with a reservation who never showed." |
| 3 | Which email service | **Resend.** Simple API, generous free tier (3,000 emails/month), a first-class Next.js/React-Email story, and nothing else in this stack needs SMTP-level control. Needs a free Resend account + one API key in `.env.local` — same "optional until configured" pattern the OAuth providers already use in `lib/auth.ts` (a feature quietly no-ops instead of crashing when its env vars are blank). |

---

## 0. What "fix" means here, concretely

Two asks, mapped to sections below:

1. A working "I forgot my password" recovery path → **§1**
2. Star-rating + written reviews on events, gated to verified attendees → **§2**

Everything here stays inside the existing architecture from `developer-guide.md`: pages
in `app/(auth)/...` / `app/(site)/...`, API routes follow the `handle()` + `guard()` /
`currentUser()` + `parseBody()` pattern, reads that need more than `findById` go in
`lib/data.ts`, enums stay in `lib/constants.ts` (never import `@/models/*` from a client
component), every new label gets both `ar` and `en` keys in
`lib/i18n/dictionaries.ts`, RTL stays on logical Tailwind properties.

---

## 1. Password reset

**Today:** `AuthForm.tsx`'s password field renders a `Forgot?` link that points at
`/login` — i.e. nowhere. There is no reset-token model, no route, no email-sending
dependency anywhere in `package.json`. A member who forgets their password is
permanently locked out of that account (their only way back in would be signing up
again with a different email, or an admin manually clearing `passwordHash` in the
database).

**Fix:** a standard email-link reset flow, kept to the same "no PII leaked, single-use,
short-lived token" shape as any credentials system needs.

### 1a. New dependency + email helper

- Add `resend` to `package.json`.
- New `lib/email.ts` — one small `sendPasswordResetEmail(to, resetUrl, locale)`
  function wrapping the Resend SDK. No-ops (logs a warning, doesn't throw) when
  `RESEND_API_KEY` is blank, mirroring how `enabledOAuthProviders` in `lib/auth.ts`
  already treats an unconfigured provider as "hidden," not "broken" — so a dev
  environment without a Resend key doesn't crash signup/login, it just can't actually
  send the email (the API route still returns success either way; see 1c on why).
- Email body: plain, bilingual (English above, Arabic below — same pattern as
  `BilingualLabel` everywhere else), the brand's `gold-accent`/`ink-black` colors as
  inline styles (email clients don't load Tailwind), one button linking to
  `${AUTH_URL}/reset-password?token=...`. No new templating library — a template
  string is plenty for one email.
- New env vars in `.env.example`: `RESEND_API_KEY=`, `EMAIL_FROM=` (e.g. `Dekka
  <noreply@yourdomain.com>` — Resend requires a verified sending domain in production;
  their sandbox `onboarding@resend.dev` works for local testing with no domain setup).

### 1b. New model: `models/PasswordResetToken.ts`

A separate collection rather than fields bolted onto `User`, so a token's lifecycle
(created, consumed, expired) doesn't touch the user document at all:

```ts
interface IPasswordResetToken {
  _id: ObjectId;
  user: ObjectId;       // ref User
  tokenHash: string;    // sha256 of the raw token — the raw value is never stored
  expiresAt: Date;       // now + 1 hour
  usedAt?: Date | null;  // set once consumed; a used token is never valid again
  createdAt: Date;
}
```

- `tokenHash` + a Mongo **TTL index on `expiresAt`** (`expireAfterSeconds: 0`) — expired
  rows delete themselves, no cron/cleanup job needed.
- The raw token (sent in the email link) is a random 32-byte value, base64url-encoded;
  only its SHA-256 hash is stored, so a database read alone can never produce a working
  reset link (same reason passwords are hashed, not stored plain).

### 1c. Two new API routes

- **`POST /api/auth/forgot-password`** — body `{ email }`. Looks up the user; if found,
  deletes any existing unused tokens for that user (one live token at a time) and
  creates a fresh one, then calls `sendPasswordResetEmail`. **Always returns the same
  generic `{ data: { sent: true } }` response whether or not the email exists** —
  this is the one deliberate deviation from this codebase's usual style (the register
  route *does* say `EMAIL_TAKEN` outright), because leaking "this email has an account"
  on a *reset* endpoint is a real enumeration risk in a way it isn't on signup. No auth
  guard needed — this route has to work for logged-out people by definition.
- **`POST /api/auth/reset-password`** — body `{ token, password }`. Hashes the incoming
  token, looks up an unexpired/unused `PasswordResetToken`, loads the linked `User`,
  hashes the new password with `bcrypt` (same `12` rounds `lib/auth.ts` already uses),
  updates `passwordHash`, marks the token `usedAt`. Returns a generic error for any
  invalid/expired/reused token — never reveals which case it was.
- Both validated by new Zod schemas in `lib/validation.ts`
  (`forgotPasswordSchema { email }`, `resetPasswordSchema { token, password: min(8) }` —
  same 8-character floor `AuthForm.tsx` already enforces client-side for signup).

### 1d. Two new pages

- **`app/(auth)/forgot-password/page.tsx`** — reuses the same split-screen
  `AuthScreen`-style shell (new `mode`, or a small sibling component — implementer's
  call) with just an email field and a submit button. On success, shows "If that email
  has an account, we've sent a reset link" regardless of what happened server-side
  (matches 1c's non-leaking response).
- **`app/(auth)/reset-password/page.tsx`** — reads `?token=` from the URL, shows a new
  password field (+ confirm field, client-side match check) and a submit button. On
  success, redirects to `/login` with a "Password updated, sign in" message. An
  invalid/expired token shows a plain error state with a link back to
  `/forgot-password` to request a new one — no attempt to auto-retry.
- `AuthForm.tsx`'s existing `Forgot?` link changes from `href="/login"` to
  `href="/forgot-password"` — the one-line fix that makes the rest of this section
  matter.

---

## 2. Event reviews — gated to verified attendees

**Today:** no review, rating, or comment model exists anywhere in the codebase. Nothing
on the event detail page (`app/(site)/events/[id]/page.tsx`) reflects what past
attendees thought.

**Fix:** a star rating (1–5) + optional short comment, one per member per event, only
submittable by someone who can be proven to have actually been there.

### 2a. Why "attended," not just "logged in" or "reserved," is checkable at all

Two existing models make the real gate possible without inventing new tracking:

- `Reservation` already links `{ event, user }` — proof someone (the account holder
  specifically, not a name typed at the door) held a confirmed spot.
- `CheckIn.reservation` is set "when staff checked someone in off the reservation
  list" — proof that spot was actually used, not just booked and skipped.

So **attended** = a `Reservation` exists for `{ event, user: <me>, status: "confirmed"
}`, **and** a `CheckIn` exists with `reservation` pointing at that reservation's `_id`.

**Known limitation, worth stating up front rather than discovering later:** a walk-in
who never reserved (staff just took their name/phone/payment at the door) has no `User`
link on their `CheckIn` at all — there's no way to connect that visit back to an
account, so a walk-in guest cannot leave a review even if they truly attended, unless
they also held a reservation. This is the same kind of accepted tradeoff as the
capacity-check note already in `developer-guide.md` §7 — fixing it would mean asking
every walk-in for their account at the door, which defeats the point of a walk-in.

### 2b. New model: `models/Review.ts`

```ts
interface IReview {
  _id: ObjectId;
  event: ObjectId;     // ref Event
  user: ObjectId;      // ref User
  rating: number;       // 1-5, integer
  comment?: string;     // optional, maxlength 1000
  createdAt: Date;
  updatedAt: Date;
}
```

- Unique index on `{ event: 1, user: 1 }` — one review per member per event; a second
  submission edits the first rather than creating a duplicate (same "re-reserving
  revives the old row" spirit as `Reservation`'s own unique index).
- No moderation/approval queue for v1 (matches this codebase's existing "ship the
  simple version, note the tradeoff" pattern) — a review posts immediately. Admins can
  still delete a review outright (see 2d) if something inappropriate gets posted; there
  is no edit-by-admin, only delete.

### 2c. Read helper: `lib/data.ts`

- `getEventReviews(eventId, { limit })` — reviews for one event, newest first, joined
  to `User` for the reviewer's display name (never the email/phone), capped like every
  other list helper in this file (same "paginate later if it's ever needed" note as
  `getAllCheckIns`/`getAllReservations`). Also returns the average rating and count,
  computed with a `$group` in the same aggregation rather than a second query.
- `canReview(eventId, userId)` — the 2a eligibility check, plus `event.startsAt` must
  already be in the past (reviewing a show that hasn't happened yet makes no sense) and
  the member must not already have a review on file (if they do, the UI shows their
  existing review in an editable state instead of a fresh empty form).

### 2d. API routes

- **`POST /api/events/[id]/reviews`** — `currentUser()` required (any logged-in
  member — no `guard("staff")`/`guard("admin")` role check, this is a member-facing
  action). Re-checks `canReview` server-side regardless of what the UI showed (never
  trust the client for the eligibility gate). Body validated by a new `reviewSchema`
  in `lib/validation.ts` (`rating: z.number().int().min(1).max(5)`, `comment:
  optionalText(1000)`). Upserts on the unique `{event, user}` index — same request
  shape handles "first review" and "edit my review."
- **`DELETE /api/events/[id]/reviews/[reviewId]`** — the review's own author, **or**
  `guard("admin")`, may delete. Anyone else gets a 403.

### 2e. UI on the event detail page

- Above/beside the existing facts block on `app/(site)/events/[id]/page.tsx`: average
  rating (stars + numeric, e.g. "4.6 · 12 reviews") and the review list (reviewer name,
  stars, comment, relative date) — this only renders once the event has actually
  happened (`event.startsAt < now`); an upcoming event shows no rating section at all
  rather than an empty one.
- If `canReview` is true for the signed-in visitor: a small inline form (star picker +
  optional comment textarea + submit) sits above the list — pre-filled with their
  existing review if they've already left one, so resubmitting is editing, not
  duplicating.
- If the visitor isn't signed in, or is signed in but didn't attend: no form, just the
  existing reviews (if any) — no dead "log in to review" nag competing with the event
  info for attention, matching this codebase's existing "guests are never blocked, just
  gently guided" tone from `authorization-UI.md` §7.
- Star input/display: a small new `components/ui/StarRating.tsx` (read-only display
  mode + interactive picker mode in one component) — `pressable` tap feedback (§1 motion
  system from `FIX_ADMIN_DASH.md`, already in this codebase) on the interactive stars,
  44px+ touch targets.
- Entrance uses the existing `fadeUp`/`staggerItem` motion presets from `lib/motion.ts`
  — no new animation vocabulary needed, this section just adopts what §1 of
  `FIX_ADMIN_DASH.md` already built.

### 2f. Out of scope for this pass (flag, don't build)

- No average-rating badge on event *cards* in the Events Hub list — only on the detail
  page. Worth adding later once there's enough review volume for it to mean anything;
  premature on a brand-new feature with zero data.
- No photo uploads on reviews, no "helpful/not helpful" voting, no admin reply-to-review
  — matches the same v1-scope discipline as the "out of scope" list already in
  `developer-guide.md` §7 (online payments, loyalty, waitlists, etc.).

---

## Implementation checklist

Everything below is scoped; no remaining open questions.

- [ ] **Deps:** add `resend` to `package.json`.
- [ ] **§1a** `lib/email.ts` — `sendPasswordResetEmail()`, no-ops without
      `RESEND_API_KEY`. New env vars in `.env.example`: `RESEND_API_KEY`, `EMAIL_FROM`.
- [ ] **§1b** New `models/PasswordResetToken.ts` with a TTL index on `expiresAt`.
- [ ] **§1c** `lib/validation.ts`: `forgotPasswordSchema`, `resetPasswordSchema`. New
      `app/api/auth/forgot-password/route.ts` and
      `app/api/auth/reset-password/route.ts`.
- [ ] **§1d** New `app/(auth)/forgot-password/page.tsx` and
      `app/(auth)/reset-password/page.tsx`. Update `AuthForm.tsx`'s `Forgot?` link to
      `/forgot-password`.
- [ ] **§2b** New `models/Review.ts`, unique `{event, user}` index.
- [ ] **§2c** `lib/data.ts`: `getEventReviews(eventId, { limit })`, `canReview(eventId,
      userId)`.
- [ ] **§2d** `lib/validation.ts`: `reviewSchema`. New
      `app/api/events/[id]/reviews/route.ts` (`POST`, upsert) and
      `app/api/events/[id]/reviews/[reviewId]/route.ts` (`DELETE`).
- [ ] **§2e** New `components/ui/StarRating.tsx` (display + interactive modes). Update
      `app/(site)/events/[id]/page.tsx`: average rating, review list, conditional
      review form for eligible attendees.
- [ ] **i18n:** add both `ar`/`en` keys for every new label — forgot/reset password
      screens and their errors, review form labels, star rating aria-labels, "N
      reviews" pluralization — to `lib/i18n/dictionaries.ts`.
- [ ] **Docs:** once shipped, add a "Password reset + Event reviews" entry to
      `developer-guide.md` §8 (Feature Log), and fold the walk-in-can't-review
      limitation (§2a) plus the no-moderation-queue decision (§2b) into §7 (Known
      Gaps).

**Order:** §1 (password reset) first — it's fully self-contained, touches no shared
component besides one link-href change, and unblocks real users who are locked out
today. Within §1: the model + email helper (1a, 1b) before the routes (1c), the routes
before the pages (1d) — same dependency order as this repo's own "Quick Reference"
checklist in `developer-guide.md` §9. Then §2 (reviews): model → read helper → routes →
UI, same order. Nothing in §2 depends on anything in §1, so if two implementation
sessions run in parallel, splitting here is safe — they touch entirely disjoint files.

---

## Before this ships to real users

Two things outside this doc's scope but worth flagging while on the subject of
launch-readiness, since they were already noted as known gaps in `developer-guide.md`
§7 and both affect features described here or nearby:

- **Uploaded event posters currently write to local disk** (`app/api/uploads/route.ts`)
  — fine for `next dev` or a single persistent server, but breaks on Vercel's
  read-only/ephemeral filesystem. Not addressed by this doc; swap in real object
  storage (Vercel Blob, S3, etc.) before deploying there.
- **`next.config.ts` allows images from any HTTPS host** — worth narrowing to your
  actual image hosts (your object storage host, plus Google/Facebook's avatar CDNs for
  OAuth profile pictures) before launch.
