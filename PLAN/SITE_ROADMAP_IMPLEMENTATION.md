# Site Roadmap — Implementation Plan

> Executes `PLAN/SITE_ROADMAP.md` (the spec, with the evidence for every finding). For phases
> P5–P7 the detailed spec is `PLAN/DEKKA_PWA_APP.md` §5 (4a/4b/4c); this file only records
> what changes against it. Inline execution in one session, committed phase by phase.

**Goal:** close every finding in `SITE_ROADMAP.md` §2 that code can close, build its features
(§3, PWA phase 4), and leave the owner-only items clearly listed.

**Architecture:** no new architecture. Every change follows the existing patterns:
`handle()` + `guard()` + `parseBody()`, `{ data }` / `{ error }`, Zod in `lib/validation.ts`,
reads in `lib/data.ts`, enums in `lib/constants.ts`, strings in both dictionaries, DB-free
`scripts/check-*.ts` with mutation runs, additive-and-optional schema changes only.

**Tech stack:** Next.js 16.3.x (App Router, Turbopack), React 19, Mongoose 9, Auth.js v5,
Zod 4, Tailwind v4. Node 24 (local and Vercel).

**Spec:** `PLAN/SITE_ROADMAP.md`; `PLAN/DEKKA_PWA_APP.md` §5.

## Global constraints

- Commit straight to `main`; no branches, no worktrees; **never push**.
- The dev server's `MONGODB_URI` is production. Write tests run only against the local
  `dekka_verify` database (`developer-guide.md` §11), after a marker proof.
- Schema changes are additive and optional; no index is dropped; a new unique index only on a
  field no existing document has.
- Every new public route: returns only what any guest can see, never varies by caller, has
  its own rate-limit bucket.
- Before using a Next.js API, read its page in `node_modules/next/dist/docs/`.
- Arabic first in every string pair, colloquial for guests, plain for admin/staff.
- Logical Tailwind properties only; touch targets ≥ 44px on anything new.

## Decisions locked (the roadmap's §7 defaults — none were answered, so defaults apply)

| # | Decision |
|---|---|
| Q1 | Sequencing A: P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7, with P-ID built after P2. |
| Q2 | No domain yet: P-ID is built **dormant**, exactly like password reset. It switches on when `RESEND_API_KEY` + `EMAIL_FROM` are set. |
| Q3 | Assume Atlas M0: `maxPoolSize: 10`. |
| Q4 | PWA §5.5 recommendations: `uqr` for the QR, demo mode as proposed, 3-hour calendar entries plus a Google Calendar link, `app_open` and `qr_scan` counters, daily hours with a per-day env override. |
| Q5 | Check-ins are voided, not deleted, with an edit log. |
| Q6 | Close-out prompt on the dashboard, no cron. |
| Q7 | Push only on the **first** publish of a night (`firstPublishedAt`). |
| Q8 | Reminders are built but **off** (`REMINDERS_ENABLED` unset) until Gate G1 passes on real phones. |
| Q9 | Production is read once (read-only) for pasted cover URLs before the image wildcard goes. |
| Q10 | §2.5 polish (gallery, morph, route transitions, `.dk-staff`) is parked. |

---

## P0 — Safe base

1. **Next + audit (S1).** Read `01-app/02-guides/upgrading/version-16.md`. `next` and
   `eslint-config-next` → `16.3.8` (exact pins, as today). `npm audit fix` (no `--force`).
   `sharp` → `^0.35.5`. Verify: `npm audit --omit=dev` shows 0 high/critical.
2. **Runtime (R4).** `"engines": { "node": ">=24 <25" }`; `@types/node` → `^24`; in-range
   minor bumps via `npm update`. Re-run every `check:*` (Zod moves; `stripDefaults` touches
   internals).
3. **CI (R1).** `npm run check:all` chains all `check:*`. `.github/workflows/ci.yml`: on push
   and PR to `main`, Node 24, `npm ci`, typecheck, lint, `check:all`, `next build` with dummy
   env; weekly `npm audit --omit=dev --audit-level=high`.
4. **Docs.** `developer-guide.md` §0 (Frankfurt confirmed live; rate limiting found inactive).

## P1 — Integrity

1. **Lifecycle (I1).** `EVENT_TRANSITIONS` in `lib/constants.ts`:
   `draft→[published]`, `published→[closed, happened, draft]`,
   `closed→[published, happened, draft]`, `happened→[archived, closed, published]`,
   `archived→[happened]`. `canTransition(from, to)`. Moving *to* `draft` additionally needs
   0 confirmed reservations and 0 live check-ins (`409 EVENT_HAS_RECORDS`). `PATCH` returns
   `409 INVALID_TRANSITION`. New optional `Event.firstPublishedAt`; push fires only on a
   transition into `published` when it is unset, and sets it.
   `EventAdminActions` offers buttons from the table and shows the 409 inline.
2. **Delete protection (I2).** `DELETE /api/events/:id` refuses `happened`/`archived` or any
   check-in (`409 EVENT_HAS_RECORDS`). The confirm text names the reservation count.
3. **Void + audit (I3).** `CheckIn.voidedAt/voidedBy/voidedReservation` (on void the
   `reservation` link moves to `voidedReservation`, so the existing unique partial index lets
   the guest be checked in again). New `CheckInAudit` collection
   `{ checkIn, event, action: create|update|void, by, byName, changes[{field, from, to}] }`,
   index `{ event: 1, createdAt: -1 }`. Written by POST/PATCH/DELETE. Every reader excludes
   voided rows (`getCheckIns`, `getAllCheckIns`, `getEventReservations`, `getMonthlyReport`,
   `getEventReportData`). Admin event page shows the log. `DoorTable` confirms before
   removing and says edits are recorded.
4. **Cairo time (I4).** Staff picker uses `dayKey`; `DuplicateEventButton` uses a new pure
   `shiftCafeDays(iso, days)` in `lib/templates.ts` (built on `dayKey` + `startsAtFor`).
5. **Close-out prompt (I5).** `getNightsToCloseOut()` — `published|closed`, started more than
   6 hours ago. A card on `/admin` lists them, each with a one-tap *Mark happened*.
6. **Page-level auth (S2).** `requireRole(min)` in `lib/rbac.ts` (redirects like the layouts).
   Called first in every `page.tsx` under `app/(site)/admin` and `app/(site)/staff`. Prove the
   gap first with a crafted RSC request on the local build; re-run after the fix.
7. **`scripts/check-integrity.ts`** (`check:integrity`): transition table, `canTransition`,
   `shiftCafeDays` across DST, every admin/staff page calls `requireRole` (source scan), every
   check-in reader filters `voidedAt` (source scan), the DELETE route filters records.
   Mutation runs: allow `happened→draft`, drop one `requireRole`, drop one void filter.

## P2 — Hardening

1. **Push (S5).** `lib/push.ts`: `PUSH_HOST_ALLOWLIST` + `isAllowedPushEndpoint()`, `sendToSubscriptions()`
   in batches of 50. Subscribe route: allowlist (400 `PUSH_ENDPOINT_NOT_ALLOWED`), bucket
   `push-subscribe` (per user), cap 10 devices per user (oldest dropped). Publish fan-out moves
   into `after()`.
2. **Headers (S6).** `poweredByHeader: false`; on `/(.*)`: nosniff, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`, and a
   `Content-Security-Policy-Report-Only` built by `lib/csp.ts` (report-uri derived from the
   Sentry DSN when present). `X-Robots-Tag: noindex` on `/admin`, `/staff`. `check:config`
   asserts them.
3. **Image proxy (S7).** Read production once. `coverImage` (events and templates) must match
   `UPLOAD_IMAGE_PATTERN`; `EventForm`/`TemplateForm` lose the paste box. Delete the `**`
   remote pattern (unless the read finds pasted URLs: then those exact hosts, listed).
4. **Revocation (S8).** `User.sessionVersion` (optional, absent = 0). `jwt` callback stores
   `sv` + `checkedAt`; every 5 minutes re-reads role/name/phone/image/`sessionVersion`; a
   missing user or changed version ends the session. Bumped on password reset, password
   change (the changing device refreshes itself via `update()`), and by `set-role.ts`. The
   mobile bearer path checks the same version.
5. **Uploads (S9).** `lib/image-processing.ts`: magic-byte sniff, `sharp` re-encode (auto-rotate,
   strip metadata, fit inside 2000px). `sharp` moves to `dependencies`. `releaseUpload(url)` in
   `lib/storage.ts` deletes a blob only when no Event, EventTemplate, MenuItem or User still
   references it; called on replace/delete.
6. **Small ones (S10, R2).** `crypto.randomInt` door codes, retried until unique among the
   event's reservations; band links: http(s) only, `https://` prepended when no scheme;
   buckets `password-change`; `maxPoolSize: 10`, `serverSelectionTimeoutMS: 10000`.
7. **`scripts/check-hardening.ts`** (`check:hardening`): allowlist cases, CSP contents,
   magic-byte sniffing, link normalisation, door-code alphabet/uniqueness loop, session
   revalidation decision (`sessionStillValid()` pure helper). Mutations for each.

## P-ID — Identity (dormant until email exists)

1. `User.emailVerifiedAt` (optional). OAuth sign-ups set it (Google only when the profile says
   `email_verified`).
2. Verification tokens reuse the password-reset machinery (hash, 24h expiry, single use) in a
   separate pair of fields. `POST /api/auth/verify-email` (request, signed in) and
   `POST /api/auth/verify-email/confirm` (public, token); page `/verify-email`; banner on
   `/account` when unverified and email is enabled.
3. **Linking rule:** an OAuth sign-in may attach to an existing account only if that account
   is verified or has no password; otherwise the sign-in is refused with
   `?error=OAuthAccountNotLinked`, shown on `/login`.
4. **Role bootstrap:** `ADMIN_EMAILS`/`STAFF_EMAILS` apply on verification (or OAuth with a
   verified email), not at credentials sign-up. A successful password reset also verifies.
5. **F3:** acknowledgement email to the band on submit; an explicit "Email the band" button
   on approved/declined pitches. Both no-ops without email.
6. **F7:** `GET /api/account/export` (JSON), `DELETE /api/account` (password re-entry, or
   typing the email for an OAuth-only account): reservations anonymised, push subscriptions
   deleted, pitches unlinked, user deleted. Privacy text updated; date bumped.
7. `scripts/check-identity.ts`.

## P3 — Door night

1. **Offline queue (R3).** `CheckIn.clientId` (optional, unique sparse — no existing document
   has it). `checkInSchema.clientId` (uuid). POST is idempotent on `clientId` (returns the
   existing row; handles the E11000 race). `lib/door-queue.ts` (localStorage, try/catch,
   per event): pending rows render with "pending sync", retry on `online`, on focus and every
   15s; a 4xx keeps the row with its error and a remove control. (localStorage instead of the
   roadmap's IndexedDB: the data is tiny and the sync API is simpler.)
2. **Tonight first (X2).** Staff picker groups Tonight / Coming up / Earlier.
3. `scripts/check-door.ts`.

## P4 — Found and shared

1. `site.url` (`NEXT_PUBLIC_SITE_URL` or the vercel.app URL). Root `metadataBase`, title
   template, default Open Graph. Per-page `metadata` for public pages; `noindex` on private
   ones. `app/robots.ts`, `app/sitemap.ts` (public routes + public events).
2. JSON-LD: `CafeOrCoffeeShop` on `/` and `/about`, `Event` on event pages (`lib/jsonld.ts`).
3. Homepage: **Next night** card under the hero (soonest upcoming event that isn't today),
   **visit** section (address, hours, directions, Instagram follow card).
4. `scripts/check-seo.ts`.

## P5 — Event night (PWA 4a, as specified) + F4 + F1

As `DEKKA_PWA_APP.md` §5.2, plus: cancel from My Events (F4); reminders (F1): `vercel.json`
cron once a day (Hobby allows daily only), `GET /api/cron/reminders` guarded by
`CRON_SECRET`, sends "tonight at Dekka" to members holding a confirmed reservation for a
night on today's Cairo date, idempotent via `Reservation.remindedAt`, and does nothing unless
`REMINDERS_ENABLED=1`.

## P6 — Cafe life (PWA 4b, as specified)

As `DEKKA_PWA_APP.md` §5.3. The homepage visit section from P4 gains `OpenStatus` and
`DirectionsLink`. `sw.js` → `v3`.

## P7 — Owner tools (PWA 4c, as specified) + F2 + F5

As `DEKKA_PWA_APP.md` §5.4, plus admin alerts (F2: push to admin devices on a new pitch and
when a night fills, through `lib/push.ts`) and CSV export (F5: monthly report and customers,
admin-guarded, UTF-8 with BOM so Excel reads Arabic).

## Verification per phase

typecheck, lint, `check:all`, `next build`; the phase's new check script with its mutation
runs; and an end-to-end run against `dekka_verify` on a production build for every phase that
writes data or changes a screen, in Arabic and English, at 390px and 1280px, with scroll width
measured. Feature Log entry with Verification / Not verified; §0 and §7 updated; commit.
