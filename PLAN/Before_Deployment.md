# Before Deployment — Dekka Pre-Launch Security & Ops Checklist

Written 2026-08-30, against the codebase as it stands (`developer-guide.md`, `HANDOFF.md`,
and everything under `PLAN/` read in full first). This is the gate the app has to pass
before it goes live on Vercel with real users hitting it.

Each of the 10 items below gets the same treatment: **what's actually true in the code
today** (with file references, not guesses), **the risk if you ship as-is**, **what
"done" looks like**, and **the concrete steps to close the gap**. Three items are
already solid. Four need real new work. Three are audits — go confirm the pattern
already in place was actually followed everywhere.

At the bottom: the decisions we locked in together, the build order, and a ready-to-paste
prompt for Claude Code (Opus) in VS Code.

---

## Status at a glance

> **Status as of 2026-08-31:** phases 1-5 are built and committed. Two deviations
> from this document were deliberate and are explained where they occur - most
> importantly, **the TTL index §5 and §7 ask for would delete user accounts** and
> was rejected (see `models/User.ts` and `PLAN/password-reset.md` §1). What remains
> is operational, not code: an Upstash account, a verified sending domain, and the
> §10 rollback drill.

| # | Item | State |
|---|---|---|
| 1 | Authorization (own-data access) | ✅ **Audited — no gaps.** Every owner-scoped route checks ownership, not just role |
| 2 | Input validation | ✅ **Audited — one gap, fixed.** `submissionUpdateSchema` was the only `$set`-feeding schema not `.strict()` |
| 3 | CORS policy | ✅ **Documented** in `developer-guide.md` §3 rule 7 — same-origin only, never add a wildcard |
| 4 | Rate limiting | ✅ **Built** (Upstash, 8 buckets). ⚠️ No real 429 observed yet — needs an Upstash account |
| 5 | Password reset security | ✅ **Built** and verified against the live DB. ⚠️ **Dormant** — no verified sending domain, so no email can be delivered |
| 6 | Frontend error handling | ✅ `global-error.tsx` added; 429s render inline in every form that can hit one |
| 7 | Database indexes | ✅ **Audited live.** All present, no TTL index anywhere. 4 redundant single-field indexes found, left alone |
| 8 | Logging | ✅ **Built** (Sentry, errors only) and **proven end-to-end** with a real DSN |
| 9 | Alerts | ✅ Sentry issue alert + Vercel deploy-failure. Uptime monitor pending deploy (`/api/health` is built) |
| 10 | Rollback strategy | ⚠️ Unchanged — Vercel-native, still not documented or drilled |

---

## 1. Authorization — users can only reach their own data

**What's actually there:** `lib/rbac.ts` is the whole authorization layer —
`currentUser()`, `hasRole()`, `guard(min)`. Every API route is supposed to call
`guard(min)` (role check) and, separately, an **ownership check** — `developer-guide.md`
§3.3 is explicit: *"Role answers 'what kind of user is this', not 'do they own this
row'."* The one documented example: a member can cancel their own reservation because
the route checks `reservation.user === currentUser().id`, not just that the caller is
*a* member.

**Risk if shipped unaudited:** a role check without an ownership check is the classic
IDOR (insecure direct object reference) bug — a signed-in member hitting
`/api/reservations/<someone-else's-id>` with the right role but wrong identity. This
class of bug is invisible in normal manual testing because you're always testing with
your own data.

**Done looks like:** every route that reads or writes a specific document owned by a
specific user has an explicit ownership check alongside its role check, and that's been
verified route-by-route, not assumed from the pattern being "established."

**Steps:**
- List every API route under `app/api/**/route.ts` and `[id]/route.ts` that touches
  user-owned data: reservations, account, push subscriptions, band submissions (if
  submitters can view/edit their own).
- For each, confirm: (a) `guard()` or `currentUser()` runs first, (b) if the resource
  has an owner field, the handler compares it to `currentUser().id` before reading or
  mutating — **not just after a role check passes**.
- Pay specific attention to `/api/account/*` (must only ever act on the caller's own
  document, never take an id from the body) and `/api/reservations/*` (cancel path is
  the one explicitly documented — confirm PATCH/DELETE both re-check ownership, not
  just the original POST).
- Confirm admin/staff routes that are allowed to touch *any* row (e.g. the door
  check-in table) are the ones actually meant to be role-only, not owner-only — don't
  add ownership checks where the whole point is that staff act on other people's rows.

---

## 2. Input validation & sanitization

**What's actually there:** this one is genuinely strong already. `lib/api.ts`'s
`parseBody(request, schema)` parses JSON and Zod-validates it in one step;
`developer-guide.md` §3.2 is direct: *"Never read `request.json()` and touch fields
directly — that's how mass assignment and NoSQL-injection-shaped payloads get through."*
Schemas live in one place (`lib/validation.ts`). Two specific hardenings already exist
in the codebase and are worth knowing about rather than re-discovering:
- `updateCheckInSchema` and similar "feeds a `$set`" schemas are `.partial().strict()`
  specifically so an unlisted key (`event`, `recordedBy`, `reservation`) can't reach the
  database.
- `stripDefaults()` in `lib/validation.ts` is a structural fix for a real Zod v4 bug
  that was silently blanking event fields — worth re-checking on any future Zod
  upgrade (`developer-guide.md` §7 flags this explicitly).
- Free-text search (`/admin/customers`) already escapes user input before it reaches
  a MongoDB regex.

**Risk if unaudited:** the *pattern* is sound, but a pattern is only as good as its
weakest follower — one new route that reads `request.json()` directly, or one schema
that isn't `.strict()` on a `$set` path, reopens mass assignment.

**Done looks like:** every route confirmed to go through `parseBody()` + a schema in
`lib/validation.ts`; every schema that feeds a `$set`/`findByIdAndUpdate` confirmed
`.strict()`; every `findById`/`findByIdAndUpdate` confirmed to validate the ObjectId
first (`isValidId()` in `lib/api.ts`).

**Steps:**
- Grep every route handler for `request.json()` — any hit that isn't inside
  `parseBody()` itself is a violation.
- Grep `lib/validation.ts` for every schema that's passed to a mutation route; confirm
  `.strict()` is present wherever the parsed object is spread or passed whole into
  a `$set`.
- Confirm every dynamic route (`[id]/route.ts`) validates the id with `isValidId()`
  before querying — a malformed id should be a clean `400`, not a Mongoose cast
  exception that falls through to the generic `500`.
- New surface to build (see §5): the forgot-password request/confirm endpoints need
  their own strict schemas the same way — email format on request, token + new
  password + confirm on the reset step.

---

## 3. CORS policy

**What's actually there:** nothing explicit — and that's correct, not a gap. Dekka is
one Next.js app; the browser talks to `/api/*` on the same origin it was served from.
Next.js API routes don't send `Access-Control-Allow-Origin` headers unless you add
them, so **the browser's same-origin policy already blocks every other website from
reading responses from `dekka`'s API using a signed-in visitor's cookies.** There is
no separate frontend deployed elsewhere, no mobile app, no third party consuming this
API today (confirmed — nothing in `next.config.ts` or any route sets CORS headers).

**Risk:** none from the *current* absence of CORS headers. The actual risk is someone
adding a wildcard `Access-Control-Allow-Origin: *` later "to fix a fetch error" without
understanding what it removes — that would let any website make authenticated
requests to Dekka's API on behalf of a signed-in visitor.

**Done looks like:** a one-line note in `developer-guide.md` recording *why* there's no
CORS config, so a future session (human or AI) doesn't "helpfully" add a wildcard the
first time it hits a cross-origin fetch error in some unrelated tool.

**Steps:**
- Add a short note to `developer-guide.md` §3 (Security Rules): *"No CORS headers are
  set anywhere, deliberately — the app is same-origin only. If a mobile app or a
  separately-hosted admin tool is ever built, add an explicit origin allowlist via
  middleware — never a wildcard `*`, since API routes read the session cookie."*
- No code change needed today.

---

## 4. Rate limiting

**What's actually there:** nothing. No rate-limiting package in `package.json`, no
middleware, no per-route throttling. Every endpoint — login, signup, reservations,
uploads — accepts unlimited requests from a single IP or account today.

**Decision locked in:** add **Upstash Redis** (free tier, installs as a Vercel
integration) with the `@upstash/ratelimit` package, giving a real distributed sliding-
window limiter that works correctly across serverless instances — not a fragile
in-memory counter that resets on every cold start.

**Risk if shipped as-is:** credential-stuffing against login, spam signups, reservation
spam that pollutes the door list on a real event night, and — once §5 exists — a
forgot-password endpoint that can be used to spam a real person's inbox or (if an SMTP/
email provider is metered) run up a bill.

**Done looks like:** a small `lib/ratelimit.ts` helper, following the exact shape of
`guard()` so it drops into existing routes with one line, applied to every
abuse-sensitive endpoint.

**Priority order for which routes get it first:**
1. `POST /api/auth/[...nextauth]` credentials sign-in path (brute force) — highest.
2. The new forgot-password request endpoint (§5) — highest, since it sends email.
3. `POST /api/register` (signup spam).
4. `POST /api/events/:id/reservations` (booking spam on a real event night).
5. `POST /api/uploads` (storage/bandwidth abuse).
6. `POST /api/push/subscribe` — lower priority, but free.

**Steps:**
- `npm install @upstash/ratelimit @upstash/redis`.
- Add the Upstash Redis integration from the Vercel dashboard (or create a database at
  upstash.com and copy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` into
  `.env.local` and Vercel's env vars).
- `lib/ratelimit.ts`: a `rateLimit(key, opts)` helper returning
  `{ ok: true } | { response: NextResponse }` (401/403-style shape, matching `guard()`)
  so a route does:
  ```ts
  const rl = await rateLimit(`register:${ip}`, { limit: 5, window: "10 m" });
  if ("response" in rl) return rl.response;
  ```
- Key by IP for anonymous endpoints (register, forgot-password) and by user id for
  authenticated ones where relevant.
- Return `429` with a `Retry-After` header, and a bilingual, user-readable message on
  the frontend forms that call these routes (see §6 — this is exactly the kind of
  "expected" error that should render as a clear inline message, not the generic
  error boundary).

---

## 5. Password reset security — 30-minute expiring links

**What's actually there: nothing.** This needed to be said plainly, because it's easy
to assume "password reset" already exists somewhere in an app that already has
login/signup/account pages. It doesn't. Confirmed by direct inspection:
- No `resetToken`/`resetTokenExpiry` field on `models/User.ts`.
- No `/api/auth/reset-password` or `/api/auth/forgot-password` route — `app/api/auth/`
  contains only NextAuth's `[...nextauth]` catch-all.
- No email-sending capability anywhere in the app — `.env.example` has no
  `RESEND_API_KEY`/`SENDGRID_API_KEY`/SMTP vars of any kind. The app has never sent an
  email to a user.
- The only existing password-adjacent flow is `/account` (`AccountForm.tsx`,
  `app/api/account/password/route.ts`) — a **logged-in** user setting or changing
  their own password. That's a different feature and stays as-is; it has no link, no
  token, no expiry, because it doesn't need one.

**Decision locked in:** build the real thing — a "forgot password" flow: request by
email → emailed link with a token → link expires in 30 minutes → single use →
sets a new password.

**Assumption flagged for confirmation:** email provider. **Resend** is the
recommendation — good free tier (3,000 emails/month, 100/day), a first-class Next.js
SDK, and no extra infrastructure. If there's already an email provider preference
(SendGrid, Postmark, Amazon SES, or the cafe's existing Google Workspace via SMTP),
say so before this gets built — swapping the provider later just means changing one
file (`lib/email.ts`), the token/expiry logic underneath doesn't change.

**Security requirements for the implementation** (this is the actual "what does 30-min
expiry mean" spec):

- **Token generation:** `crypto.randomBytes(32).toString("hex")` (node's `crypto`,
  already available — no new dependency). Never a predictable value (not a UUID
  derived from user id/time).
- **Never store the raw token.** Store its SHA-256 hash on the `User` document
  (`resetTokenHash`, `resetTokenExpiresAt`), the same "never store what you don't have
  to" instinct already applied to `passwordHash`. The raw token exists only in the
  emailed URL and briefly in memory when the reset route hashes the submitted token to
  compare.
- **Expiry:** `resetTokenExpiresAt = now + 30 minutes`, literally checked on every use
  (`if (Date.now() > user.resetTokenExpiresAt) → reject, generic error`). Add a Mongo
  **TTL index** on `resetTokenExpiresAt` so expired, unused tokens are actually purged
  from the database automatically rather than lingering as dead rows forever.
- **Single-use:** the reset route clears `resetTokenHash`/`resetTokenExpiresAt` the
  moment a reset succeeds — a second attempt with the same link fails even inside the
  30-minute window.
- **Requesting a new link invalidates the old one.** Generating a fresh token
  overwrites the stored hash — an attacker who intercepted an old, unused email link
  can't use it once a new one's been requested, and a user mashing "resend" can't end
  up with multiple valid links.
- **No user enumeration.** The "forgot password" request endpoint returns the exact
  same generic response ("if that email exists, we've sent a link") whether or not the
  email is registered, and takes roughly the same amount of time either way — don't let
  a 404-vs-200 or a timing difference tell an attacker which emails have accounts.
- **Rate limit this endpoint hard** (ties directly to §4 — highest priority route
  listed there) — it's the one place in the app that can send email and be triggered
  by an anonymous request.
- **The email itself:** plain, no HTML tracking pixels, the reset link as the only
  action, sent through the bilingual `t.auth.*` dictionary like every other
  user-facing string in this app (`developer-guide.md` §2's i18n rule applies to email
  copy too — this app has no English-only surfaces).
- **Known limitation to accept, not fix, right now:** NextAuth sessions here are JWTs
  (`developer-guide.md` §3.6 already notes the same limitation for role changes —
  "the person must sign out and back in"). A password reset does **not** invalidate
  any device that's already signed in with a valid session JWT. Real session
  revocation would mean moving to database sessions or adding a session-version stamp
  checked on every request — real work, and out of scope for this pass. Document it as
  a known gap in `developer-guide.md` §7, same honesty as the other tradeoffs already
  written up there, rather than silently shipping a false sense of security.

**New surface, sized:**
- `models/User.ts`: +2 optional fields (`resetTokenHash`, `resetTokenExpiresAt`, TTL
  index on the latter).
- `lib/validation.ts`: `requestPasswordResetSchema` (email), `resetPasswordSchema`
  (token, newPassword, confirmPassword — mirror the existing sign-up confirm-password
  UX from `AuthForm.tsx`).
- `lib/email.ts` (new): thin wrapper around the chosen provider's send call.
- `app/api/auth/forgot-password/route.ts` (new): rate-limited, generic response,
  generates + emails the token.
- `app/api/auth/reset-password/route.ts` (new): validates token + expiry, sets new
  `passwordHash`, clears the token fields.
- `app/(auth)/forgot-password/page.tsx` + `app/(auth)/reset-password/page.tsx` (new):
  same `AuthScreen` split-layout shell every other auth screen already uses
  (`components/auth/AuthScreen.tsx`) — this is not a new visual pattern, it's the
  existing one with a new form inside it.
- A "Forgot password?" link added to the existing login form (`AuthForm.tsx`).
- New env var: `RESEND_API_KEY` (or equivalent), `EMAIL_FROM` (e.g.
  `noreply@dekka.example` — needs a verified sending domain with whichever provider is
  chosen).

---

## 6. Error handling — unexpected frontend errors

**What's actually there:** `app/error.tsx` exists — a single, global error boundary.
`developer-guide.md` doesn't document a per-route-segment `error.tsx` pattern, and
grep confirms only the one global file. On the backend side, every API route already
returns the standardized `{ error, details? }` shape (`developer-guide.md` §2), and
`handle()` in `lib/api.ts` guarantees an unexpected server throw becomes a clean `500`
instead of a leaked stack trace — that half is solid.

**Gap:** there's a real difference between two kinds of frontend error, and right now
they likely both look the same to a user:
- **Expected errors** — a `429` from rate limiting, a `400` validation failure, a
  `PHONE_REQUIRED` from the reservation flow (this one's already handled well —
  `ReserveButton.tsx` catches it and links to `/account`, per `developer-guide.md` §7).
  These should render as a clear, in-place, bilingual message near the form —
  never the global error boundary.
- **Unexpected errors** — a component throwing during render, a network failure with
  no structured response. These are what `app/error.tsx` is for.

**Risk if unaudited:** a user hitting rate limiting (§4) or a validation failure (§2)
gets dumped into the generic "Something went wrong" boundary instead of an actionable
inline message — which reads as the app being broken, not as "you did something that
needs correcting," and generates support messages for things that aren't bugs.

**Steps:**
- Confirm `app/error.tsx` renders bilingually (via `t.*`, not hardcoded English) and
  offers a real recovery action (`reset()` retry, or a link home) — read the file and
  check both.
- Audit every client component that calls `fetch()` against an API route: does it
  distinguish a non-2xx JSON `{ error }` response (render inline, near the form) from a
  thrown/network exception (let the boundary or a local catch handle it)? The
  `PHONE_REQUIRED` handling in `ReserveButton.tsx` is the reference pattern — new code
  (especially the forgot-password forms and any rate-limited form) should match it, not
  reinvent it.
- Once §4 ships, specifically verify the `429` case renders as "please wait a moment
  and try again" inline, not a crash screen.
- Decide whether any specific high-traffic route segment (event booking, checkout-like
  flows) deserves its own local `error.tsx` in addition to the global one — likely not
  needed at this app's size, but worth a deliberate "no" rather than never considering
  it.

---

## 7. Database indexes — the fields actually queried, nothing else

**What's actually there — already solid.** Every model has indexes that map to a real
query pattern in `lib/data.ts`, not speculative ones:

| Model | Index | Backs |
|---|---|---|
| `Event` | `{ status: 1, startsAt: 1 }` compound | "published, soonest first" — the events hub |
| `Event` | `startsAt` | date-based lookups |
| `Reservation` | `{ event: 1, user: 1 }` unique | one reservation per user per event (also a data-integrity constraint, not just perf) |
| `Reservation` | `{ event: 1, status: 1 }` | per-event reservation lists |
| `Reservation` | `code` | reservation lookup by code |
| `CheckIn` | `{ event: 1, createdAt: -1 }` | door table, newest first |
| `BandSubmission` | `{ status: 1, createdAt: -1 }` | admin submissions queue |
| `User` | `role` | (implicit, used by role-based reads) |
| `User` | `email` unique | login lookup + the uniqueness constraint |
| `PushSubscription` | `user` | fan-out on publish |

This already follows the exact discipline you asked for — "most commonly queried
fields, nothing else" — `developer-guide.md` §4.1 states the rule explicitly and the
indexes present all trace to a real query in `lib/data.ts`. This is a **verification**
item, not a build item.

**One addition from §5:** `resetTokenExpiresAt` needs a **TTL index**
(`{ expireAfterSeconds: 0 }` on that date field) so expired tokens are actually reaped
by MongoDB rather than accumulating as dead rows — this is the one new index this
whole checklist calls for.

**Steps:**
- Confirm in Atlas (or via `db.collection.getIndexes()`) that every index above
  actually exists in the live cluster, not just in the Mongoose schema — a schema-level
  `index: true` only takes effect once Mongoose has synced it, and
  `autoIndex`/`syncIndexes` behavior differs between dev and how the app connects in
  production. Don't assume the schema file is the source of truth for what's live.
- Do **not** add speculative indexes "just in case" for this pass — that's the
  opposite of what was asked for, and every extra index has a real write-cost.

---

## 8. Logging — debuggable in prod, not expensive

**What's actually there:** `handle()` in `lib/api.ts` wraps every route so an
unexpected throw is `console.error`'d with a route label before returning a clean
`500`. That output lands in Vercel's function logs today. It works for "what broke
five minutes ago," but Vercel's log retention is short and there's no search, no
grouping of the same error across occurrences, and nothing that survives past the
retention window.

**Decision locked in:** add **Sentry**, free tier. Reasoning: real error tracking
(stack traces, grouping repeat errors into one issue instead of N log lines, breadcrumbs
leading up to the failure) for zero cost at this app's scale — the free tier (5,000
errors/month) is nowhere near a limit a cafe events app will hit under normal
operation, and it directly solves "debug in prod" without the ongoing cost worry,
because there's no metering to babysit at this volume.

**Keeping it cheap on purpose:**
- Set `tracesSampleRate` to `0` or very low (e.g. `0.05`) — performance tracing is the
  part of Sentry that consumes quota fastest and isn't what was asked for here (the
  ask was debugging errors, not performance monitoring). Error events, not
  transactions, are the budget to protect.
- Don't enable session replay — another quota-hungry feature not needed for a
  server-rendered admin/booking app.
- `console.error` stays as-is for local dev — Sentry only needs to fire in production
  (`process.env.NODE_ENV === "production"` / `process.env.VERCEL` check), so local
  development never touches the quota.

**Steps:**
- `npx @sentry/wizard@latest -i nextjs` (or manual install: `@sentry/nextjs`) —
  generates `sentry.server.config.ts`, `sentry.client.config.ts`,
  `sentry.edge.config.ts`, wraps `next.config.ts`.
- In `lib/api.ts`'s `handle()`, add `Sentry.captureException(error)` alongside the
  existing `console.error` — one call site, every route gets it for free, matching how
  every other cross-cutting concern in this codebase (`guard`, `parseBody`) is a
  shared helper, not something repeated per-route.
- Also wrap `app/error.tsx` and `app/global-error.tsx` (add the latter if it doesn't
  exist — it's what catches an error in the root layout itself) with
  `Sentry.captureException` so a frontend crash reaches the same place a backend one
  does.
- New env vars: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (build-time,
  for sourcemap upload — keep it out of `NEXT_PUBLIC_`).
- Confirm nothing sensitive leaks into Sentry events — no `passwordHash`, no full
  request bodies with a plaintext password field in flight during forgot-password/
  register/login. Sentry's default scrubbing catches common field names
  (`password`, `token`), but verify rather than assume for this app's specific field
  names.

---

## 9. Alerts — notified immediately when something breaks

**What's actually there:** nothing. Errors are logged (to Vercel, and after §8, to
Sentry) but nothing pushes a notification to a human. Right now the only way to learn
something's broken is to go looking.

**Decision locked in:** Sentry's own alerting covers "an application error just
happened" for free, since Sentry is already being added for §8 — no separate service
needed for that half.

**Steps:**
- In the Sentry project settings, create an **Issue Alert**: "A new issue is created"
  → notify by email (Sentry's default) immediately. Optionally also "issue regresses"
  (an error marked resolved happens again).
- Enable Vercel's own **Deployment Failed** notification (Vercel dashboard → project
  → Settings → Notifications) — this is a different failure mode than an application
  error: a build/deploy that never goes live at all. Sentry can't catch this because
  the broken code never runs. Zero cost, native to Vercel, easy to miss enabling.
- **Recommended addition, not explicitly asked for but worth a deliberate yes/no**:
  neither Sentry nor Vercel's deploy alert catches the site being *down* while the
  last deploy was healthy — DNS trouble, the MongoDB Atlas cluster being unreachable,
  a Vercel regional outage. An uptime monitor (UptimeRobot or Better Stack, both have
  a free tier — a ping every 5 minutes against the homepage) closes that last gap.
  This is the one item in this whole doc that's a suggestion rather than something
  already implied by what you asked for — say yes or no explicitly rather than it
  being silently skipped.
- Keep the alert channel to email only for the first pass unless there's already a
  Slack/Discord the owner actually watches — an alert that goes to a channel nobody
  checks is worse than no alert, because it creates false confidence.

---

## 10. Rollback strategy

**What's actually there:** nothing written down, but the underlying capability is
already there for free — Vercel deployments are immutable and every push to `main`
(per `developer-guide.md` §6's "commit directly to main, no branches" rule, and
Vercel's GitHub integration) creates a new one without deleting the last good one.
Rolling back is a platform feature, not something to build.

**The part that's actually missing** is the plan: what "healthy" means before you
promote a deploy, and the exact steps to reverse one once it's live and something's
wrong — written down *before* it's needed, not figured out live during an incident.

**Pre-deploy checklist (run locally before every push to `main`, since main auto-
deploys to production):**
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds locally
- [ ] No automated test suite exists (`HANDOFF.md` states this plainly) — so manual
      smoke-test the specific feature just built against a real `happened` event or a
      throwaway document, per the verification pattern already used throughout the
      Feature Log in `developer-guide.md` §8.
- [ ] Any new/changed `Event`/`User`/etc. field is **additive and optional** — this
      codebase's established convention (every Feature Log entry that touched the
      schema added "one or two new optional fields," never renamed or removed one in
      the same change). This is what makes rollback safe on the data side: an older
      deployment's code simply ignores a newer optional field it doesn't know about,
      and a rolled-back deploy never crashes on missing data a newer version wrote.
      **Don't break this convention** — a rename or a required-field addition in the
      same deploy as a rollback risk is a self-inflicted one.
- [ ] Any new env var (this doc adds several: Upstash, Resend, Sentry) is set in
      **Vercel's** environment variables, not just `.env.local` — a deploy that needs
      an env var the production environment doesn't have yet will fail at runtime, not
      at build time, and won't be caught by the checklist above.

**Post-deploy smoke test (run against production immediately after every deploy that
touches auth, reservations, or payments-adjacent flows):**
- [ ] Sign in (credentials) works.
- [ ] Sign in (Google, if configured) works.
- [ ] A reservation can be created and shows up on the door table.
- [ ] Admin's "Show Analysis Report" PDF still generates (this is the one route
      already flagged as unverified on a real Vercel deploy — `developer-guide.md`
      §7's `@sparticuz/chromium` note — worth an explicit check after *any* deploy
      that touches dependencies, not just report-related changes).
- [ ] Once §5 ships: request a password reset, confirm the email arrives, confirm the
      link works, confirm it's rejected after 30 minutes or a second use.

**Rollback steps, written down for the actual moment you need them:**
1. Go to the Vercel dashboard → the project → **Deployments**.
2. Find the last deployment known to be healthy (before the one that broke something).
3. Open its "..." menu → **Promote to Production** (works on every Vercel plan — the
   separate "Instant Rollback" button is a Pro-plan convenience for the same action,
   not a different capability).
4. Alternative from a terminal: `vercel rollback` (prompts for which deployment) —
   useful if the dashboard is slow to load during an actual incident.
5. **This rolls back code, not data.** If the broken deploy already wrote bad data
   (not just broken code) before being caught, rolling back the deployment does not
   undo those writes — that's a separate, manual data-fix, and it's exactly why
   `MONGODB_URI` pointing at the live cluster (`HANDOFF.md` §"Standing rules") makes
   every write in every manual test something to treat as real and irreversible until
   proven otherwise.
6. After rolling back, re-run the post-deploy smoke test against the *restored*
   deployment before considering the incident closed — a rollback that also doesn't
   work is the worst version of this situation.

**Steps to actually do before shipping:**
- Paste the two checklists above into `developer-guide.md` (or keep them living here,
  linked from there) so they're not lost after this session.
- Do one practice rollback against a real (harmless) deploy now, while there's no
  pressure, so the first time isn't during an actual incident.

---

## Decisions locked in from this brainstorm

| # | Question | Decision |
|---|---|---|
| 1 | Password reset scope | Build a real forgot-password email flow (new feature — see §5) |
| 2 | Rate limiting infra | Upstash Redis (Vercel integration, free tier) + `@upstash/ratelimit` |
| 3 | Logging/alerts tool | Sentry, free tier, error tracking only (tracing/replay off to protect quota) |
| 4 | Doc scope | Full audit + build plan (this document) |
| — | Email provider (flagged assumption) | Resend recommended — confirm or redirect before §5 is built |

---

## Build order

Ordered by dependency and risk, not by the order items appear above:

1. **§8 Logging (Sentry)** first — no dependencies on anything else, and every
   subsequent build step benefits from having real error visibility while it's being
   tested.
2. **§9 Alerts** — five minutes once Sentry exists (§8); do it in the same session.
3. **§4 Rate limiting (Upstash)** — needed *before* §5 ships, since the forgot-password
   endpoint is the single most abuse-sensitive route being added and should never go
   live unlimited even for a day.
4. **§5 Password reset** — the real new feature. Depends on §4 being in place first.
5. **§1 / §2 / §7 audits** — can happen in parallel with the above; they're read-only
   review passes over existing code, not blocked by anything.
6. **§3 CORS documentation** and **§10 rollback documentation** — five-minute
   doc-only additions, do these last as cleanup.
7. **§6 Error handling audit** — do this after §4 and §5 exist, since part of the audit
   is specifically checking how the new rate-limit and reset-flow errors render on the
   frontend.

This also matches how this codebase already works (`developer-guide.md` §5's "Feature
loop": short plan, one thing built and reviewed before the next) — don't build all of
§4/§5/§8 in one uninterrupted pass; ship and verify each before starting the next.

---

## Prompt for Claude Code (Opus) in VS Code

Copy everything in the fenced block below as-is. It's written to be handed to Opus
directly in VS Code, one phase at a time — paste the whole thing to start, and it's
structured so Opus builds §8 → §9 → §4 → §5 → the three audits, stopping for your
review between phases rather than running all of it unattended.

```
You're working in the Dekka repo. Before touching anything, read developer-guide.md,
PLAN/idea.md, and PLAN/Before_Deployment.md in full — Before_Deployment.md is the spec
for everything below; don't re-derive it from scratch, follow it.

Hard rules from developer-guide.md, restated because they're easy to violate by default:
- No branches, no worktrees. Commit directly to main. (This overrides any instinct to
  branch before a change — see developer-guide.md §6/§7 for why.)
- MONGODB_URI is the live production database. Never run scripts/seed.ts against it.
  Test new code paths against real (harmless) documents or throwaway ones you clean up,
  the same way every entry in the Feature Log describes doing.
- Every write goes through parseBody() + a Zod schema in lib/validation.ts. Every
  protected route goes through guard()/currentUser(). Every schema that feeds a $set
  is .strict(). No new pattern gets invented where an existing one (guard, handle,
  parseBody, the { data } / { error, details? } response shape) already fits.
- There is no test suite. Verification is: npm run typecheck, npm run lint, npm run
  build, all clean — plus manual exercise of the actual new code path, and a short
  note of what you verified and how, in the style of developer-guide.md §8's Feature
  Log entries.
- Before building anything non-trivial, write a short plan.md in PLAN/ first
  (developer-guide.md §5's "Feature loop"), the same shape as PLAN/authorization-UI.md.
- Update developer-guide.md's Known Gaps (§7) and Feature Log (§8) when you're done
  with each phase — a feature isn't finished until the docs reflect it.

Build in this order. Stop after each phase and wait for me before starting the next —
I want to review and test each one before you build on top of it.

PHASE 1 — Logging (Before_Deployment.md §8)
Add Sentry (@sentry/nextjs) for error tracking only. tracesSampleRate near 0, no
session replay — this is about catching and grouping real errors cheaply, not
performance monitoring. Wire lib/api.ts's handle() to also call
Sentry.captureException alongside the existing console.error. Add/confirm
app/global-error.tsx exists and reports to Sentry too. List every new env var you
need me to set in Vercel.

PHASE 2 — Alerts (Before_Deployment.md §9)
This is mostly configuration, not code: tell me exactly what to click in the Sentry
dashboard (issue alert on new issues) and the Vercel dashboard (deployment-failed
notification). If there's any code-side piece (e.g. confirming Sentry's alerting
config as code), do that; otherwise just give me the checklist.

PHASE 3 — Rate limiting (Before_Deployment.md §4)
Add @upstash/ratelimit + @upstash/redis. Build lib/ratelimit.ts as a helper shaped
like guard() — returns { ok: true } | { response: NextResponse }, so it drops into a
route in one line. Apply it to, in this order: the credentials sign-in path, POST
/api/register, POST /api/events/:id/reservations, POST /api/uploads. (Skip the
forgot-password endpoint in this phase — it doesn't exist yet, that's phase 4; note
where it'll need to be added.) Tell me exactly what to set up in the Upstash/Vercel
dashboard and which env vars to add.

PHASE 4 — Password reset (Before_Deployment.md §5)
Build the full forgot-password flow exactly as specified in §5: token generation,
hashed storage with 30-minute expiry (TTL-indexed), single-use, invalidates prior
tokens on a new request, no user enumeration on the request endpoint, rate-limited
using the lib/ratelimit.ts helper from phase 3. Use Resend for email unless I've told
you otherwise by then. New pages follow the existing AuthScreen split-layout shell —
don't invent a new visual pattern. Email copy and all new UI strings go through
lib/i18n/dictionaries.ts (ar + en), like everything else in this app. Explicitly note
in your summary that this does not invalidate already-issued session JWTs (known,
accepted limitation, same as the existing role-change behavior) — don't silently build
around it or oversell what it protects against.

PHASE 5 — Three audits (Before_Deployment.md §1, §2, §7)
Read-only review, no refactor unless you find an actual bug:
- §1: every API route touching user-owned data — confirm role check AND ownership
  check are both present, not just role.
- §2: every route confirmed to use parseBody() + a schema; every $set-feeding schema
  confirmed .strict(); every dynamic route confirmed to validate its ObjectId first.
- §7: confirm every index listed in Before_Deployment.md §7 actually exists in the
  live Atlas cluster (not just the Mongoose schema file), and add the one new TTL
  index §5 needs on resetTokenExpiresAt.
Report findings as a plain list: confirmed-fine vs. actual bugs found and fixed. Don't
add new indexes or ownership checks speculatively where the audit didn't find a real
gap — Before_Deployment.md §7 is explicit that over-indexing is exactly what to avoid.

After phase 5, update Before_Deployment.md's "Status at a glance" table at the top to
reflect what's now actually built, and update developer-guide.md §7/§8 per the rules
above.
```

---

## What's still your call

- **Email provider** for §5 — Resend is the recommendation baked into the prompt
  above; say the word if it should be something else before Phase 4 runs.
- **Uptime monitoring** (§9) — the one genuinely optional addition in this whole doc.
  Not in the build prompt above; add "and also set up an uptime monitor on
  UptimeRobot/Better Stack pinging the homepage every 5 minutes" to Phase 2 if you
  want it.
- **Alert channel** — email-only is what's specified above. If there's a Slack/Discord
  you actually watch day-to-day, Sentry supports piping alerts there too — cheap to
  add, just needs the integration connected in Sentry's dashboard.
