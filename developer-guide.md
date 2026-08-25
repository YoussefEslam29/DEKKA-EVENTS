# Dekka — Developer Guide

Read this before writing any code on this project. It's the technical counterpart to
[`PLAN/idea.md`](PLAN/idea.md) (what we're building) and [`design-system/`](design-system/)
(how it looks) — this file is *how it's built*: architecture, patterns, rules, and the
things that have already bitten us once and shouldn't again.

If you're an AI agent picking up this codebase cold: read `PLAN/idea.md`,
`design-system/README.md`, and this file, in that order, before touching a single line.

---

## 1. Architecture & Folder Layout

Standard Next.js App Router project, MVP-style (not a modular-enterprise split — the
domain is small enough that one flat `models/` and `lib/` works fine).

```
app/
  (auth)/            route group — /login, /signup — no navbar/footer, full-bleed split screen
  (site)/            route group — everything else, wrapped in Navbar + Footer
    admin/           admin dashboard (role: admin)
    staff/           door check-in tool (role: staff or admin)
    events/[id]/     public event detail
    my-events/       member's reservations
    submit-show/     public band/artist application
    about/           cafe info, socials, map
  api/               REST-ish route handlers, one folder per resource
components/
  ui/                shared primitives: Button, TextField, Card, LogoBadge, etc.
  layout/            Navbar, Footer
  auth/              AuthScreen (the split-layout shell)
lib/
  auth.ts            NextAuth config + providers
  rbac.ts             currentUser() / hasRole() / guard() — the authorization layer
  db.ts              cached Mongoose connection
  api.ts             parseBody() / handle() / jsonError() — the API route helpers
  validation.ts      every Zod schema, one place
  constants.ts       shared enums (role, status, payment method) — NO mongoose import
  data.ts            read-side query helpers (e.g. getEventReservations)
  i18n/              dictionaries.ts (ar + en), locale resolution
  site.ts            cafe-level config (socials, address, hours) — env-overridable
models/              one Mongoose model per collection: User, Event, Reservation, CheckIn, BandSubmission
PLAN/                idea.md (product) + one spec doc per major feature (e.g. authorization-UI.md)
design-system/       colors, typography, spacing, components, brand assets, tone of voice
IMGS/                raw brand source files (before processing)
public/brand/        processed, web-ready brand assets (regenerate via `npm run brand:assets`)
```

**Where a new feature's files go:** page(s) in `app/(site)/...`, API routes in
`app/api/...`, a Mongoose model in `models/` if it's a new collection, a Zod schema in
`lib/validation.ts`, shared UI in `components/ui/` only if more than one screen needs it
— otherwise keep it local to the route.

---

## 2. Design Patterns This Codebase Uses

### Auth & authorization — `lib/rbac.ts`

Every protected surface goes through the same three functions:

```ts
currentUser()       // → SessionUser | null, reads the NextAuth session
hasRole(user, min)  // → boolean, role-rank check (member=0, staff=1, admin=2)
guard(min)          // → { user } | { response }  — for API routes specifically
```

**Server layouts** (`app/(site)/admin/layout.tsx`, `.../staff/layout.tsx`) call
`currentUser()` + `hasRole()` directly and `redirect()` if the check fails — this is
the *only* gate for page access. There is no middleware doing this; if you add a new
protected route group, you must add the same check to its layout.

**API routes** call `guard("staff")` (or `"admin"`) at the top of the handler and
early-return its `response` if present:

```ts
const auth = await guard("staff");
if ("response" in auth) return auth.response;
```

### Data mutation — every write path looks the same

```ts
export async function POST(request: Request, { params }: Params) {
  return handle("POST /api/events/:id/reservations", async () => {
    const auth = await guard("member"); // or currentUser() directly, see below
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, someSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    // ...do the write...
    return NextResponse.json({ data: result }, { status: 201 });
  });
}
```

- `handle(label, fn)` (`lib/api.ts`) wraps the whole handler so an unexpected throw
  becomes a logged `500` instead of a leaked stack trace.
- `parseBody(request, schema)` (`lib/api.ts`) parses JSON **and** validates it against
  a Zod schema in one step — handlers never read raw `body.field` directly. That's a
  deliberate anti-injection/anti-mass-assignment measure (see §3).
- Every response is `{ data: ... }` on success or `{ error, details? }` on failure —
  never a bare value. Frontend code can rely on that shape everywhere.

### Reads — `lib/data.ts`

Query helpers that do more than a one-line `Model.find()` (joins, aggregation, shaping
for a specific screen) live in `lib/data.ts`, not inline in the route handler or the
page component. Simple lookups (`Event.findById(id)`) stay inline.

### Database connection — `lib/db.ts`

One cached connection via `globalThis`, guarding against Next.js dev-mode hot-reload
opening a new pool every save. Always `await connectDB()` before a query — it's a
no-op if already connected.

### Client/server boundary — `lib/constants.ts`

Enums and union types with **zero runtime dependencies** live in `lib/constants.ts`.
Client components import roles/statuses/payment-methods from there, never from
`@/models/*` — importing a model file pulls Mongoose (and the whole MongoDB driver)
into the browser bundle. Models re-export the same constants for server-side
convenience, but the client never imports the model directly.

### i18n / bilingual

- `lib/i18n/dictionaries.ts` holds both the Arabic and English dictionaries, in one
  file, with the English object type-checked against the Arabic one — a missing key
  is a **compile error**, not a silently blank string in production.
- Locale lives in a cookie (`dekka_locale`); the root layout sets `lang`/`dir` from it.
- Use Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`) — never
  `pl-`/`pr-`/`ml-`/`mr-`. RTL is not a retrofit here; physical properties break the
  Arabic layout immediately.
- Anywhere the UI shows a shared label (field label, button, heading), follow the
  `English / العربية` bilingual pattern via the `BilingualLabel` component — see
  `design-system/02-typography.md` and `04-components.md`.

### Times

Everything renders in `NEXT_PUBLIC_CAFE_TIMEZONE` (default `Africa/Cairo`) via helpers
in `lib/format.ts`, not the server's local timezone or the browser's. Admin
`datetime-local` inputs are converted both ways so typing `20:00` always means 20:00 in
Cairo, regardless of where the admin physically is.

---

## 3. Security Rules — always do these

1. **Every API route is guarded.** `guard(min)` for role-gated routes, `currentUser()`
   + a manual null-check for "any signed-in user" routes. No exceptions — a route with
   no auth check is a bug, not a shortcut.
2. **Every write is Zod-validated**, via `parseBody()`, against a schema in
   `lib/validation.ts`. Never read `request.json()` and touch fields directly — that's
   how mass assignment and NoSQL-injection-shaped payloads get through.
3. **Ownership checks, not just role checks.** A member can cancel *their own*
   reservation, not any reservation — check `reservation.user === currentUser().id`
   even after confirming the role is `member`. Role answers "what kind of user is
   this", not "do they own this row".
4. **Passwords:** bcrypt-hashed (`lib/auth.ts`), the hash field is `select: false` on
   the `User` model and only pulled in explicitly (`.select("+passwordHash")`) inside
   the credentials `authorize()` call — it never comes back on a normal `User` query.
5. **OAuth providers degrade safely.** A provider with no credentials configured
   (`enabledOAuthProviders` in `lib/auth.ts`) simply doesn't render its button, rather
   than rendering a button that dead-ends at a broken callback.
6. **Admin bootstrap is env-based, applied per path.** `ADMIN_EMAILS`/`STAFF_EMAILS`
   (`lib/roles.ts`) set a role at account creation on both paths — credentials
   (`app/api/register/route.ts`) and OAuth (`lib/auth.ts`'s `signIn` callback) — but
   the OAuth path also *re-applies* the bootstrap on every subsequent sign-in, so
   adding an email to a list promotes an existing account next time it signs in with
   a provider; the credentials path checks only once, at signup. Either way, roles
   live in the database from then on — to change an existing account's role, run
   `scripts/set-role.ts <email> <role>` (the person must sign out and back in;
   sessions are JWTs). Don't re-introduce env-based role checks anywhere else in the
   app.

---

## 4. Performance Rules

1. **Indexes match the actual query shape.** `Event` has a compound
   `{ status: 1, startsAt: 1 }` index because the events hub always queries "published,
   soonest first" — if you add a new common query pattern, add the matching index next
   to the schema, not as an afterthought.
2. **`.lean()` on read-only queries.** Anywhere a document is read and not saved back
   (`User.findOne(...).lean()`, `Event.findById(id).lean()`), use `.lean()` — you get a
   plain object instead of a full Mongoose document, which is both faster and prevents
   accidentally calling `.save()` on something you only meant to read.
3. **No N+1.** If a screen needs a list plus a per-item count or join (e.g. events plus
   their reservation counts), do it as one aggregation/query in `lib/data.ts`, not a
   loop of per-item queries.
4. **Capacity is checked read-then-write, deliberately, not atomically** (see
   `events/[id]/reservations/route.ts`). This is a known, accepted tradeoff at cafe
   scale — don't "fix" it with a transaction unless the scale assumption changes;
   simplicity here was a conscious choice, documented in the code.

---

## 5. Modularity — how to keep new code consistent with what's here

- **One job per file.** Small, focused files (this is why `components/ui/` has eight
  small files instead of one big `components.tsx`) — easier to read, easier for an AI
  agent to edit without collateral damage elsewhere.
- **Reuse the primitives before styling anything new.** Almost every screen in this app
  is `PageHeader` + `Card` + `TextField`/`Field` primitives + `Button` + `Badge`. Check
  `design-system/04-components.md` before writing new markup.
- **Standardized response shape** (`{ data }` / `{ error, details? }`) and **standardized
  guard pattern** (`{ user } | { response }`) mean any new API route reads like every
  existing one. Don't invent a new shape for a new route.
- **Feature loop:** for anything non-trivial, write a short `plan.md` in `PLAN/` before
  building (see `PLAN/authorization-UI.md` for the template — brand assets, tokens,
  layout spec, component list, open questions), and note what shipped + any decisions
  locked in in this file's changelog-style sections or the root README, so the next
  session (human or AI) isn't rediscovering context from scratch.

---

## 6. What to Avoid

**Workflow**
- **Don't create feature branches or git worktrees for implementation work —
  commit directly to `main`.** This is a solo project; the owner finds
  multiple branches confusing to track and wants everything in one place.
  This overrides any default instinct (including a process/skill that would
  normally isolate work on a branch before merging) to branch before a large
  change — skip that step here and build on `main` directly. See §7's
  worktree note below for the specific incident that first taught this the
  hard way.

**Frontend**
- Don't use physical Tailwind spacing (`pl-`, `mr-`, etc.) — logical properties only.
- Don't put the raw logo on a dark background without `LogoBadge` — it's dark ink and
  disappears on `ink-black` (see `design-system/05-brand-assets.md`).
- Don't hand-pick colors for a new admin/staff screen — wrap it in `.dk-workspace` and
  the shared primitives flip to the cream theme automatically.
- Don't translate bilingual labels literally — see `design-system/06-tone-of-voice.md`;
  match the feeling, not the words, when writing new Arabic/English copy pairs.

**Backend**
- Don't import `@/models/*` from a client component — it pulls Mongoose into the
  browser bundle. Import shared enums from `lib/constants.ts` instead.
- Don't skip `guard()`/`currentUser()` on a new API route "because it's simple" — every
  route gets a check, even read-only ones that only need to hide drafts from the
  public.
- Don't read `request.json()` fields directly — always through `parseBody()` + a
  Zod schema.
- Don't add a new role check inline — extend `RANK`/`hasRole()` in `lib/rbac.ts` if the
  role model itself needs to change.
- Don't widen `next.config.ts`'s `remotePatterns` further than it already is (currently
  any HTTPS host, because cover images are admin-typed URLs) without first considering
  narrowing it to a specific image host — it's flagged as a known gap already, not a
  green light to loosen it more.

---

## 7. Known Gaps (carried over from README — keep this list current)

- Capacity is checked read-then-write, not atomically (§4.4 — accepted tradeoff).
- `next.config.ts` allows images from any HTTPS host (§6 — flagged, not yet narrowed).
- Admin-uploaded posters (`app/api/uploads/route.ts`) are written straight to
  `public/uploads/events/` on local disk — fine for `next dev`/a single persistent
  server, but a typical serverless host (e.g. Vercel) has a read-only/ephemeral
  filesystem at runtime, so uploads would silently fail or vanish between
  invocations there. Swap in real object storage (Vercel Blob, S3, etc.) before
  deploying to one; `coverImage` already just stores a URL string, so the schema
  needs no change, only the upload route's write target. There's also no cleanup of
  orphaned files when a poster is replaced or an event is deleted — accepted for now,
  same spirit as the capacity tradeoff above.
- Out of scope for v1 per `PLAN/idea.md` §8: online payments, loyalty, non-event table
  bookings, push reminders, waitlists, QR check-in.
- No MCP servers (Context7/Tavily) wired up yet — would remove guesswork on Next.js/
  Mongoose/Auth.js API calls for future feature work.
- **Don't build in a `.claude/worktrees/` git worktree on this repo.** §1/§6/§7 of the
  admin-dash work were built that way in an earlier session, committed to a branch
  called `worktree-fix-admin-dash`, and then the worktree directory was cleaned up —
  leaving `main` looking as if nothing had ever been built while the commits sat on a
  branch (and on `origin`) nobody was looking at. They have since been brought onto
  `main` by writing the files out directly. If a worktree is used again, merge the
  branch back the same day.
- **`git` writes can fail from a mounted/bridged filesystem.** On that same session
  every `git` command that takes the index lock failed to *remove* it afterwards
  ("unable to unlink `.git/index.lock`: Operation not permitted"), which jams every
  subsequent git command with "Another git process seems to be running". If that
  happens, delete `.git/index.lock` from a normal terminal on the machine itself.
- Chart colours in `components/ReportCharts.tsx` are hardcoded hex copied from the
  `@theme` block in `app/globals.css` — recharts needs values, not classes. They are
  the one place a token change has to be mirrored by hand.
- `getAllCheckIns` / `getAllReservations` cap at a few hundred rows rather than
  paginating — same "simple until the scale assumption changes" tradeoff as the
  capacity check. If Dekka ever outgrows one screen of history, that is where to add
  paging.
- No per-feature `plan.md`/`feature-docs.md` pairs exist yet for anything after the
  auth screens — only `PLAN/authorization-UI.md` follows that pattern today. Worth
  backfilling short ones for Events Hub, Reservations, Submit-a-Show, Admin Dashboard,
  Door Check-in, and Monthly Report so the next session has the same context this file
  gives for auth.
- ~~Auth/account gaps~~ — **built**, see §8's "Login/Sign-up/Account fix" entry.
  What remains operational, not code: `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` still
  have to be created in Google Cloud Console and set in `.env.local` (and Vercel)
  before the Google button renders at all — `enabledOAuthProviders` hides it
  deliberately when they're blank.
- **Google accounts have no phone number.** Google never supplies one, so a
  Google signup lands with `phone` empty while
  `app/api/events/[id]/reservations/route.ts` requires one for the door list.
  `ReserveButton.tsx` now catches that (`PHONE_REQUIRED` → a message plus a link
  to `/account`), so it's a detour rather than a dead end — but the member still
  can't reserve until they fill it in. If that friction ever matters, the fix is
  to ask for a phone once, right after the first OAuth sign-in, rather than at
  the moment they try to reserve.
- **Push delivery to a real device was never verified end-to-end.** The pipeline
  was exercised over HTTP (subscribe → publish transition → fan-out → 404/410
  cleanup → unsubscribe), but nothing drove an actual browser permission dialog
  or confirmed a notification arriving on a phone. The Push API also requires
  HTTPS outside `localhost`. Confirm on the first real deploy.
- **`stripDefaults()` in `lib/validation.ts` touches Zod internals**
  (`instanceof z.ZodDefault`, `.removeDefault()`). It's the structural guard that
  stops `updateEventSchema` re-introducing the default-leak bug described in §8,
  and it's deliberately mechanical so a newly added `eventCore` field can't
  reintroduce it. Worth re-checking on a Zod major/minor upgrade.

---

## 8. Feature Log

Short "what shipped" notes for anything implemented from a `PLAN/fix_*.md` spec, so
the next session doesn't have to diff `git log` to understand intent. Newest first.

### Login/Sign-up/Account fix — `PLAN/LOG_SIGN_AUTH_IN.md`

All six sections built, each reviewed independently before the next started.
Two bugs found along the way were *not* in the plan — see the end.

- **§1/§2 Confirm-password.** `AuthForm.tsx` gains `confirmPassword` (sign-up
  only, reusing `PasswordField` so the eye-toggle comes free) with a client-side
  mismatch guard before the fetch. `confirmPassword` is **deliberately never
  sent** — the payload is rebuilt as an explicit object literal rather than
  `JSON.stringify(form)`, which is what keeps it structurally out of the request
  rather than merely stripped. A `Check` fades in via `AnimatePresence` +
  `DURATION.press` the moment the two match. Social buttons became
  `motion.button` + `buttonStyles(...)` rather than a `motion.create(Button)`
  wrapper — framer-motion's typing collapses custom CVA props when the tag is a
  literal DOM tag, and `Button` has no `forwardRef`, so the class output is
  identical.
- **§4a Duplicate-account error.** `POST /api/register` now distinguishes an
  OAuth-only account (no `passwordHash`) from a password account, returning
  `EMAIL_TAKEN_OAUTH` with the `providers` on file. `AuthForm.tsx` renders the
  matching social button *inline with the error* — the error block itself is the
  fix, not prose pointing at a button elsewhere. The reverse direction (Google
  sign-in onto an existing password account) already linked correctly in
  `lib/auth.ts` and was left alone.
- **§5/§4b `/account`.** New page gated exactly like `my-events/page.tsx`
  (`currentUser()` + `redirect`, no middleware). `AccountForm.tsx` covers photo,
  name/phone, a read-only "signed in with" line, and password — **set** (no
  current-password step) when `passwordHash` is absent, **change** (bcrypt-compare
  required) when it exists. That branch is decided **server-side from the database**,
  never from a client flag, so a client omitting `currentPassword` can't downgrade
  itself into the set path. `getAccountUser`/`AccountDTO` in `lib/data.ts` reads
  the hash only to compute `hasPassword: boolean` and builds the DTO field-by-field
  — the hash never reaches the browser. Both new schemas are `.strict()` because
  their output feeds a `$set`. `/api/uploads` widened admin→member for avatars;
  event-poster callers stay admin-gated a layer up.
- **§3 Auth hero photos.** `heroImage(mode)` resolves mode-specific →
  shared → `BrandHeroFallback`, with env overrides at each tier. No photos exist
  yet, so both screens still render the gradient — that path was explicitly
  verified, since it is currently the *only* path. `prepare-brand-assets.ts`
  processes the two new sources only if present.
- **§6 Push notifications.** `web-push` + `models/PushSubscription.ts` (one row
  per device, `endpoint` unique-indexed), `public/sw.js`, `PushOptIn.tsx`, and
  `POST`/`DELETE /api/push/subscribe`. **The permission prompt can only fire from
  an explicit tap** — `Notification.requestPermission()` exists at exactly one
  call site, behind an `onClick`, never in an effect; `useSyncExternalStore` reads
  `Notification.permission` without an SSR hydration mismatch. This matters
  because a prompt fired unprompted is denied once and then silenced by the
  browser permanently, unrecoverable from the app. The publish fan-out reads the
  prior status first so a re-save of an already-published event never re-notifies,
  and the whole block is wrapped so a `web-push` failure cannot turn a successful
  publish into a 500. Dead endpoints are deleted on 404/410. The post-auth toast
  is scoped to credentials sign-in only; the `/account` banner covers OAuth-only
  members.

**Two bugs found that the plan didn't know about:**

- **`ADMIN_EMAILS`/`STAFF_EMAILS` silently did nothing on email/password signup.**
  `app/api/register/route.ts` hardcoded `role: "member"`; only the OAuth path
  applied the env bootstrap. So inviting a staff member by email and having them
  sign up normally produced a plain member with no indication why. `bootstrapRole()`
  now lives in `lib/roles.ts` and is shared by both paths, so they cannot drift
  again. **Note the asymmetry that remains, deliberately:** the OAuth path
  re-applies the bootstrap on *every* sign-in (so adding an email to `ADMIN_EMAILS`
  promotes them next time they use Google), while the credentials path applies it
  only at account creation. `lib/auth.ts`'s old comment claimed "first sign-in
  only" for both, which was never true. Changing a role on an existing account is
  `scripts/set-role.ts <email> <role>` — and the person must sign out and back in,
  because sessions are JWTs carrying the role.
- **`updateEventSchema` silently blanked event content on every Publish click.**
  In Zod v4 — unlike v3 — `.partial()` does *not* suppress `.default(...)` on an
  absent key. `eventCore` has ten defaulted fields, so parsing
  `{ status: "published" }` (exactly what `EventAdminActions.tsx` sends) returned
  nine more fields defaulted to `""`/`false`, and the route's passthrough loop
  wrote them all — wiping description, location, map URL, cover image, poster
  flag, Instapay number and terms, in both languages, on an ordinary status
  toggle. Nothing was `required` in the model, so `runValidators` never caught it.
  Fixed with `stripDefaults()` (see §7): it strips defaults from `eventCore`'s
  shape structurally, so a future defaulted field cannot reintroduce the bug —
  a per-field fix was rejected precisely because it would depend on the next
  person remembering. `createEventSchema` still applies its defaults normally.
  **This bug pre-dated this work**; the owner's `events` collection was empty at
  the time, so no real content was lost.

**Verification note, stated plainly:** this repo has no automated test suite, so
every claim above rests on typecheck, lint, and manual exercise of the real code
paths (HTTP calls against the live dev server, DB-free Zod reproductions,
throwaway documents cleaned up afterwards). The one thing *not* proven is a push
notification arriving on a real device — see §7.

### Admin dashboard fix — `PLAN/FIX_ADMIN_DASH.md`

Seven sections, built in the order the plan set out. Two of them (§1 motion, §6 nav,
§7 back button) were built in an earlier session inside a git worktree at
`.claude/worktrees/fix-admin-dash` and never merged — see the note at the end.

- **§1 Motion system.** `framer-motion` added. `lib/motion.ts` is the whole motion
  vocabulary — `fadeUp`, `staggerContainer`/`staggerItem`, `pressable`, `tabIndicator`
  — and every preset is a *function of* `useReducedMotion()`, with that argument
  required rather than optional so a call site cannot skip the accessibility branch.
  Under reduced motion entrances land instantly and `pressable` registers no gestures
  at all. `components/ui/Motion.tsx` wraps them as thin `"use client"` shells
  (`FadeUp`, `Stagger`, `StaggerItem`, `StaggerRows`, `StaggerRow`) so a *server*
  page can animate its shell without becoming a client component. `Card` moved out of
  `Surface.tsx` into its own `components/ui/Card.tsx` for the same reason — it is the
  one surface primitive that needs to be a client component — and is re-exported from
  `Surface` so no import site changed. Everything is transform/opacity only.
- **§2a `components/ui/DataGrid.tsx`.** The spreadsheet: a real `<table>` whose cells
  become inputs in place. Tab walks the row (and wraps onto the next), Enter commits
  and drops one row down, Esc reverts, blur commits. It knows nothing about check-ins
  or fetch — callers pass `columns` plus an `onCommit(rowId, columnKey, value)` that
  resolves `true`/`false`. Unchanged values never reach the network. Cells are 44px
  tall even in edit mode so the door still works one-handed on a phone.
- **§2b Editable door table.** New `PATCH /api/checkins/[id]` beside the existing
  `DELETE`, `guard("staff")`, validated by `updateCheckInSchema` in `lib/validation.ts`
  — **`.partial().strict()`**, because the parsed result feeds a `$set` and an
  unlisted key (`event`, `recordedBy`, `reservation`) reaching it would be the exact
  mass-assignment hole `parseBody` exists to close. `DoorTable.tsx` keeps its
  quick-entry side form untouched (muscle memory at a busy door beats a
  spreadsheet-first flow) and swaps only the results table for `DataGrid`.
- **§2c `/admin/customers`.** Every check-in across every night in one grid, with the
  event attached. `getAllCheckIns({ eventId, q, limit })` in `lib/data.ts` does it as
  a single `$lookup` aggregation, and the free-text search escapes its input before it
  reaches the regex. Filtering is a **round trip, not a client-side `.filter()`** —
  the row set is capped server-side, so narrowing locally would silently only ever
  search the slice already on screen. Admin-only via the existing `admin/layout.tsx`
  gate; staff still reach check-ins only through their own event's door table.
- **§3 Overview tabs.** `app/(site)/admin/page.tsx` was four tiles that all linked to
  the same unfiltered events list, so "Drafts" and "Upcoming" showed identical
  screens. Now the tiles *are* the tab strip: all four slices are fetched server-side
  in one parallel pass and handed to `components/AdminOverviewTabs.tsx`, so switching
  is instant with no per-tab spinner. New `getAllReservations()` in `lib/data.ts`
  backs the Reservations tab (one `$lookup` for the event, a second for the check-in
  that consumed the reservation, so "did they turn up" comes back in the same pass).
  Active tab lives in `?tab=`, which makes it shareable and — the real point — puts it
  in browser history, so §7's `router.back()` returns to the tab you drilled in from.
- **§4 Events calendar.** `components/MonthCalendar.tsx`, hand-rolled (no calendar
  dependency), reachable via a Table/Calendar toggle on `/admin/events`. Days holding
  a real event are tinted and dotted in that event's own status colour, reusing the
  same `statusTone` mapping as the table. Grid arithmetic is pure UTC — a calendar
  square is a calendar date — while *bucketing* events onto squares goes through the
  new `dayKey()` in `lib/format.ts`, so a 1am show lands on the night it belongs to in
  Cairo. Weeks run Saturday→Friday. **The Wednesday karaoke marker is a hint, not a
  rule**: it is pure `getUTCDay() === 3` date math with no schema, no generated event,
  and nothing blocked — an empty Wednesday books like any other day. That was the
  decision locked in the plan and it is worth not quietly "improving" later.
- **§5 Report charts.** `recharts` added. `components/ReportCharts.tsx` sits *above*
  the existing per-event table, never replacing it — a chart is not screen-reader
  readable. Revenue per night as bars (discrete event-nights, not a continuous
  series), cash-vs-InstaPay as a 2-slice donut, attendees as horizontal bars (long
  event names stay readable on a phone that way). Colours are the workspace tokens
  from `design-system/01-colors.md`, hardcoded as hex in one `COLORS` map at the top
  of the file because recharts needs real values, not CSS classes — **if the theme
  tokens in `globals.css` change, that map has to change with them.** Axes flip for
  RTL via `reversed`/`orientation`. A month with no events shows a message, not an
  empty axis frame. Every chart takes `isAnimationActive={!reduced}`.
- **§6 Centered nav.** `components/layout/Navbar.tsx` re-laid as logo / centred link
  pill / controls, with the links extracted into `components/layout/NavLinks.tsx` so
  the active-link indicator can be a client-side `layoutId` slide. Centring is done
  with a grid, not absolute positioning. This is the *one* nav for the whole site —
  `app/(site)/layout.tsx` wraps public pages and `/admin`/`/staff` alike — so it
  changed everywhere at once.
- **§7 `components/ui/BackButton.tsx`.** `router.back()` with a `fallbackHref`. It
  renders as an anchor pointing at the fallback rather than a `<button>`, which means
  the no-history case needs no code path at all (don't intercept the click, the
  browser follows the href), ctrl/middle-click still opens the parent in a new tab,
  and `whileTap` lands on something already in the tab order. Replaced the two
  hardcoded `ChevronLeft` links and added to the sub-pages that had none.

**Deviations from the plan doc, and why:**

- §4 said the Table/Calendar choice would be "plain client state". It is `?view=` and
  `?month=` in the URL instead: the page is already `force-dynamic` and both views
  render off the same single query, so it costs nothing, and it buys a shareable link
  to a month plus a Back that returns to the month you were looking at.
- §2c's Customers filters are server round trips for the reason given above.

### Events fix — `PLAN/fix_Events.md`

Four changes to the events feature; every decision was already locked in the plan doc
before this was built.

- **Cafe location by default.** `EventForm.tsx`'s create path (`event` prop absent)
  pre-fills `locationAr`/`locationEn`/`mapUrl` from `lib/site.ts` instead of blank —
  still fully editable, this only changes the starting value. Editing an existing
  event shows what's actually saved on it, unaffected.
- **Embedded map for cafe-location events.** The event detail page
  (`app/(site)/events/[id]/page.tsx`) embeds `site.mapsEmbed` (the same iframe already
  proven on the About page) whenever `event.mapUrl` is blank or equals `site.maps`;
  an event with a different (off-site) link keeps the plain "Get directions" link —
  no coordinate-resolving for arbitrary share links.
- **`isPoster` flag for poster-style cover images.** New boolean field
  (`models/Event.ts`, `lib/validation.ts`, `EventDTO`/`toEventDTO` in `lib/data.ts`,
  and the PATCH passthrough list in `app/api/events/[id]/route.ts`, default `false`).
  When true, the event detail hero renders the cover image with no gradient/overlay
  text — the status/spots badges and title move into the normal content flow below
  the hero instead of being drawn over the artwork, so there's still a real `<h1>`
  for a11y/SEO. Toggle lives in `EventForm.tsx` as a checkbox next to Cover Image.
- **One-click Duplicate.** New `components/DuplicateEventButton.tsx`, placed next to
  `EventAdminActions` on `/admin/events/[id]`: clones the loaded event's fields via
  `POST /api/events` with `status: "draft"` and `startsAt` shifted +7 days (same
  time-of-day), then redirects to the new draft. This is the recurrence workaround for
  weekly events (e.g. a karaoke night) — no scheduler was built; the admin still swaps
  in the new poster/date by hand.
- **`doorsOpenAt` hidden, not removed.** Dropped from `EventForm.tsx`'s rendered
  fields (and the payload it sends), the event-detail facts row, and both `ar`/`en`
  dictionaries. The Mongoose/Zod schema field is untouched — existing data isn't
  migrated, and since the form no longer sends the key at all, saving an event never
  clobbers whatever is already stored there.
- **12-hour time everywhere.** `formatTime()` in `lib/format.ts` now always passes
  `hour12: true`, so English no longer falls back to 24-hour via `Intl`'s per-locale
  default — event cards, event detail, My Events, the staff door table, and the admin
  event manager all render "8:00 PM" / "٨:٠٠ م" consistently.

### Poster upload

Admins can now upload a poster image directly in `EventForm.tsx` instead of only
pasting a URL into Cover Image — an "Upload image" button (hidden `<input
type="file">` behind it, matching the pattern of triggering a file picker from a
styled button) posts to the new `POST /api/uploads` (admin-guarded, JPEG/PNG/WEBP/GIF,
5MB cap, both checked client-side for instant feedback and server-side as the real
gate). The route writes to `public/uploads/events/<uuid>.<ext>` and returns that path,
which fills the existing `coverImage` field — the manual URL input is still there
underneath as a visible override/fallback, so nothing about the data model changed.
See the Known Gaps entry above before deploying this anywhere other than a
persistent Node server.

---

## 9. Quick Reference — adding a typical CRUD feature

1. Model: add/extend a schema in `models/`, exporting types + re-exported constants.
2. Validation: add a Zod schema to `lib/validation.ts`.
3. API route(s): `app/api/<resource>/route.ts` (+ `[id]/route.ts` if needed) — always
   `handle()` wrapping `guard()`/`currentUser()` then `parseBody()`.
4. Read helper: if the screen needs more than a single `findById`, add it to
   `lib/data.ts`.
5. Page: `app/(site)/<route>/page.tsx`, built from `PageHeader` + `Card` + shared
   `ui/` primitives; wrap in `.dk-workspace` only if it's a staff/admin screen.
6. i18n: add both `ar` and `en` keys to `lib/i18n/dictionaries.ts` — the type-check
   will fail if you only add one.
7. Update this file's Known Gaps section (or the root README) with anything notable
   you decided along the way.
