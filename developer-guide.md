# Dekka — Developer Guide

Read this before writing any code on this project. It's the technical counterpart to
[`PLAN/idea.md`](PLAN/idea.md) (what we're building) and [`design-system/`](design-system/)
(how it looks) — this file is *how it's built*: architecture, patterns, rules, and the
things that have already bitten us once and shouldn't again.

If you're an AI agent picking up this codebase cold: read `PLAN/idea.md`,
`design-system/README.md`, this file (start with §0), and `PLAN/DEKKA_PWA_APP.md`, in
that order, before touching a single line.

---

## 0. Start here — where the project stands (updated 2026-10-05)

**What's live** (`main` auto-deploys to Vercel): the full events site — auth, events hub,
reservations, Submit-a-Show, staff door table, admin dashboard, monthly report, PDF
event report, legal pages, cookie consent — **plus** the three shipped phases of the
installable-app plan below.

**The active plan is `PLAN/DEKKA_PWA_APP.md`** (written with the owner after a
brainstorm, 2026-10-03). The site *is* the app: an installable PWA, downloaded from the
website on iPhone and Android, with no app stores. It **supersedes
`PLAN/DEKKA_MOBILE_APP.MD`** (native Kotlin), which is parked, not deleted — only its
mobile auth bridge was ever built, and v1 doesn't use it.

| Phase | What | Status | Feature Log entry (§8) |
|---|---|---|---|
| 1 | PWA foundation: manifest, icons, service worker, offline page, installed-mode tab bar, install prompt, `/get-app` | ✅ shipped | "Installable app, phase 1 of 4" |
| 2 | Cafe menu: admin-managed, `/menu`, homepage "Barista's picks", staff sold-out switches, offline menu | ✅ shipped | "phase 2 of 4" |
| — | Phone header **Admin** shortcut, using the owner's icon (`IMGS/admin dash.jpg`) | ✅ shipped | inside "phase 2 of 4" |
| 3 | Event templates: save a night/activity once, make a draft from it in two taps | ✅ shipped | "phase 3 of 4" |
| 4 | Extras (each independent): add-to-calendar, "Tonight at Dekka" banner, WhatsApp share cards, "Open now", seasonal menu sections, owner stats, QR table poster, demo mode | ⏳ not started — **ask the owner which first** | — |

**Open questions / things still owed to the owner:**
- **Nothing has been tested on a real phone** — not the install, not push in the
  installed iOS app (needs iOS 16.4+). All verification so far is headless Chrome,
  including an emulated iPhone. See §7.
- Daytime "activities" were built as ordinary events with `kind: "activity"` on their
  template (sun icon instead of moon). The owner never confirmed; if activities need
  different fields (e.g. no reservations), that's new work.
- **The speed pass's region move (2026-10-06) is confirmed live** (2026-10-08:
  `x-vercel-id: fra1::fra1::…`). Still owed: rerun the phone timings in its Feature Log
  entry to get the real before/after.
- **Rate limiting is INACTIVE in production** (found 2026-10-08 in the runtime logs: a
  fresh process logged the `[ratelimit] … INACTIVE` warning). The code is done; the
  Upstash integration just isn't connected to the Vercel project. Until it is, every
  limited endpoint is unthrottled (§3 rule 8).
- **`PLAN/SITE_ROADMAP.md` (2026-10-08) is the current plan.** It audits the whole site and
  sequences the fixes before the remaining PWA phase-4 features;
  `PLAN/SITE_ROADMAP_IMPLEMENTATION.md` lists the tasks. Its §6 lists what only the owner
  can do.
- The menu starts empty in production until the owner adds sections and items at
  `/admin/menu`. There is no dish photography yet; every card is designed to work
  without a photo.

**How the owner works — follow these:**
- **Plan before code.** Non-trivial work gets a `PLAN/*.md` spec first. Build it in
  phases, and **stop after each phase** for the owner to review.
- **Commit straight to `main`. Never create branches or worktrees** (§6). **Don't push**
  unless asked — the owner pushes, and a push deploys to production.
- **Arabic first.** Every string goes in both `ar` and `en`, Arabic drafted first in the
  café's colloquial voice (`design-system/06-tone-of-voice.md`).
- **The dev server talks to the live database** (`.env.local`'s `MONGODB_URI` is the
  production Atlas cluster). Read-only browsing is fine. **Anything that writes is
  verified against a local throwaway database instead** — the routine is in §11, and
  phases 2 and 3 were verified that way.
- **Say plainly what was and wasn't verified.** Every Feature Log entry ends with a
  "Verification" paragraph and a "Not verified" line. Keep doing that.

---

## 1. Architecture & Folder Layout

Standard Next.js App Router project, MVP-style (not a modular-enterprise split — the
domain is small enough that one flat `models/` and `lib/` works fine).

```
app/
  layout.tsx         root: fonts, viewport/manifest meta, EARLY_APP_SCRIPT, ServiceWorkerRegistrar
  manifest.ts        the PWA web app manifest (served at /manifest.webmanifest)
  offline/           the offline fallback page the service worker serves (outside (site) on purpose)
  (auth)/            route group — /login, /signup — no navbar/footer, full-bleed split screen
  (site)/            route group — everything else, wrapped in Navbar + Footer (+ AppTabBar when installed)
    admin/           admin dashboard (role: admin) — incl. menu/, templates/, customers/, events/, report/
    staff/           door check-in tool (role: staff or admin) — incl. menu/ (sold-out switches)
    events/[id]/     public event detail
    menu/            the public cafe menu (the installed app's Menu tab)
    get-app/         "install Dekka on your phone" — where every Get-the-app link points
    my-events/       member's reservations
    submit-show/     public band/artist application
    about/           cafe info, socials, map
  api/               REST-ish route handlers, one folder per resource
                     (menu/**, event-templates/**, events/from-template are the newest)
components/
  ui/                shared primitives: Button, TextField, Card, DataGrid, PageSkeleton, LogoBadge, etc.
  layout/            Navbar (+ AdminShortcut via NavLinks), Footer, AppTabBar (installed app only)
  auth/              AuthScreen (the split-layout shell)
  menu/              public menu cards/board/strip, offline menu, staff toggles
  menu/admin/        /admin/menu: MenuManager, MenuItemForm, MenuSections
  templates/         event templates: TemplateLauncher, SaveAsTemplateButton, TemplateForm, TemplateManager
  BrandIcons.tsx     hand-drawn SVG icons (socials, AdminDashIcon) — lucide has no brand marks
lib/
  auth.ts            NextAuth config + providers
  rbac.ts             currentUser() / hasRole() / guard() — the authorization layer
  db.ts              cached Mongoose connection
  api.ts             parseBody() / handle() / jsonError() — the API route helpers
  validation.ts      every Zod schema, one place (incl. stripDefaults — see §2)
  constants.ts       shared enums (role, status, payment method, MENU_TAGS, template kinds) — NO mongoose import
  data.ts            read-side query helpers + every DTO (e.g. getMenu, getEventTemplates)
  format.ts          dates/times/money in cafe time (Africa/Cairo), both locales
  pwa.ts             installed-app plumbing: EARLY_APP_SCRIPT, install-prompt store, SW registration
  menu.ts            menu pricing rule + localName helpers (pure, client-safe)
  templates.ts       template ↔ event field list, builder, Cairo date math (pure, client-safe)
  upload-image.ts    browser-side photo upload to /api/uploads
  i18n/              dictionaries.ts (ar + en), locale resolution (server-only — see §6)
  site.ts            cafe-level config (socials, address, hours) — env-overridable
models/              one Mongoose model per collection: User, Event, Reservation, CheckIn,
                     BandSubmission, PushSubscription, MenuCategory, MenuItem, EventTemplate
scripts/             check-*.ts (DB-free invariant checks, `npm run check:*`), set-role, seed (NEVER on prod)
PLAN/                idea.md (product) + one spec doc per major feature; DEKKA_PWA_APP.md is the active one
design-system/       colors, typography, spacing, components, brand assets, tone of voice
IMGS/                raw brand source files (before processing)
public/brand/        processed, web-ready brand assets (regenerate via `npm run brand:assets`)
public/icons/        PWA icons (192/512/maskable/apple-touch) — also from `npm run brand:assets`
public/sw.js         the service worker — hand-written, served as-is (see §2)
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

**Every protected page calls `requireRole(min, next)` as its first `await`**, before it
reads anything. The layouts (`app/(site)/admin/layout.tsx`, `.../staff/layout.tsx`) keep
their own check for the sidebar and the redirect, but **a layout check alone leaks**: a
layout and its page render in parallel and stream in one response, so a page that
fetched before the layout's `redirect()` landed sends its data in the RSC payload of the
same response. A browser follows the redirect; `curl` reads every name and phone number.
That was live until 2026-10-08 (Feature Log, "Security fix"). `npm run check:integrity`
fails if any `page.tsx` under `/admin` or `/staff` doesn't start with
`await requireRole(...)`. There is no middleware doing this; a new protected route group
needs both the layout check and the page call.

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
Cairo, regardless of where the admin physically is. Egypt observes daylight saving
(UTC+3 from late April to late October, UTC+2 otherwise), so never hard-code an offset —
go through `fromLocalInputValue` / `startsAtFor` (`lib/templates.ts`). `formatTimeOfDay`
shows a bare "HH:mm" (a template's usual time).

### The installed app — one site, a `standalone:` variant

There is no separate app codebase. When someone launches Dekka from their home screen,
`EARLY_APP_SCRIPT` (`lib/pwa.ts`, an inline `<head>` script in `app/layout.tsx`) sets
`data-app="standalone"` on `<html>` **before first paint**. `app/globals.css` defines a
Tailwind variant on that attribute:

```html
<nav class="hidden standalone:block">…</nav>   <!-- AppTabBar: only in the installed app -->
<div class="standalone:hidden">…</div>          <!-- footer columns: only in the browser -->
```

- **Rule: the browser site must look exactly as it did.** Anything app-only goes behind
  `standalone:`, never behind client-side detection (that would flash on every launch).
- The installed app keeps the normal `Navbar` as its top bar. On phones it's already
  just logo, language and menu, and its menu is how Submit-a-Show, About, the door and
  the admin stay reachable. The bottom `AppTabBar` has four tabs (Home, Menu, My
  Events, Account) — no fifth tab.
- **Anything fixed to the bottom of the screen must lift above the tab bar in the app:**
  `standalone:bottom-[calc(5rem+env(safe-area-inset-bottom))]` (see `CookieConsent`,
  `PushOptIn`). The `(site)` layout already pads page content.
- iPhone notch / home bar: `viewport-fit=cover` + `env(safe-area-inset-*)`. Body side
  padding is in `globals.css`; the tab bar pads its own bottom.

### Service worker — `public/sw.js`

Hand-written plain JS, served as-is, registered for every visitor by
`ServiceWorkerRegistrar` (and idempotently by `PushOptIn`). It does push (unchanged) and
caching, under **one rule: nothing user- or role-specific is ever cached.**

| Request | Strategy |
|---|---|
| Page navigations | Always the network; if that fails, the precached `/offline` page. **Page HTML is never cached** — every page is per-user (who's signed in, spots left). |
| `/_next/static/*` | Cache-first (content-hashed, safe) |
| Images (`/_next/image`, `/brand/`, `/icons/`, `/uploads/`) | Cache-first, capped at 120 entries |
| `GET /api/menu` | Stale-while-revalidate — feeds the offline page's "menu as you last saw it" |
| Every other `/api/*`, everything under `/admin` and `/staff` | Never touched |

- **Bump `VERSION` in `sw.js`** when the caching rules change **or the offline page's
  content changes** (it's precached only when the worker installs, so otherwise
  already-installed phones keep the old one). Currently `v2`.
- `next dev` registers `/sw.js?cache=off`, which turns caching off — Turbopack's dev
  chunks aren't content-hashed, so a caching worker would serve stale code.
- `next.config.ts` serves `/sw.js` with `no-cache` (and `npm run check:config` asserts
  that survives the Sentry wrapper).

### Updates are strict and default-free — `stripDefaults()`

Every `$set`-feeding update schema is built as
`z.object(stripDefaults(core)).partial().strict()` (`lib/validation.ts`). In Zod v4,
`.partial()` does **not** stop `.default()` from firing on an absent key. Without
`stripDefaults`, a one-field PATCH silently writes every defaulted field back to its
create-time value. That once blanked events on Publish. The menu and template check
scripts' mutation runs showed it would also re-show sold-out items on a price change and
wipe a template's description on a rename. **Any new update schema must use it.**

### The event lifecycle is one table

`EVENT_TRANSITIONS` in `lib/constants.ts` says where a night may go from each status. The
API refuses everything else, and the admin buttons and the form's status dropdown are
built from the same table, so they can't offer a move the API refuses. A night only
reaches `draft` with no reservations and no door rows. It is only announced by push on
its first publish (`firstPublishedAt`).

### Door rows are voided, never deleted

A `CheckIn` is the record of cash taken. "Remove" sets `voidedAt`; every reader filters
`voidedAt: null`; and `CheckInAudit` logs each check-in, edit and removal with who did it.
Any new query on `CheckIn` must filter voided rows too; `check:integrity` scans
`lib/data.ts` for it.

### Reordering takes the whole sequence

Menu sections, menu items (per section) and templates are reordered with
`PATCH …/order` and body `{ ids }`: the **complete** new sequence, written as `order = index`
in one `bulkWrite`. A list that doesn't match what's stored (someone added or deleted a
row meanwhile) is refused with `409 STALE_ORDER`, and the screen re-fetches. `order` is
never settable through a single-row PATCH, so two rows can't claim one slot.

### Narrow routes for narrow roles

When a lower role needs one power over a resource, it gets its **own route with its own
one-field schema** — not a role check inside the general route. The example is
`PATCH /api/menu/items/:id/availability` (`guard("staff")`, body `{ available }` only):
staff can mark an item sold out, and there's no way to shape that request so it reaches
a price or a name. Everything else on menu items is `guard("admin")`.

### Shared field lists, not copied ones

When two directions must agree, write the list once. `TEMPLATE_EVENT_FIELDS`
(`lib/templates.ts`) is both what "Save as template" copies out of an event and what
`buildEventFromTemplate` copies back in. The template schema reuses `eventCore`'s own
Zod pieces, so a template can always make a valid event. The menu's pricing rule
(sizes set the price) lives once in `lib/menu.ts`, and the API, cards, admin grid and
offline menu all call it.

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
   `scripts/set-role.ts <email> <role>`. The new role reaches the person's open session
   within about five minutes, with no re-login: the session re-checks the account every
   few minutes (`lib/session-check.ts`, §3 rule 11). Don't re-introduce env-based role
   checks anywhere else in the app.
7. **No CORS headers are set anywhere, deliberately.** The app is same-origin only —
   one Next.js app, the browser talking to `/api/*` on the origin it was served from.
   Next doesn't send `Access-Control-Allow-Origin` unless you add it, so the browser's
   same-origin policy already stops any other site reading this API with a signed-in
   visitor's cookies. **Don't "fix" a cross-origin fetch error by adding a wildcard
   `*`** — that would let any website make authenticated requests on a member's behalf,
   since these routes read the session cookie. If a mobile app or a separately-hosted
   admin tool is ever built, add an explicit origin allowlist, never a wildcard.
8. **Rate limiting fails open** (`lib/ratelimit.ts`) — an unconfigured or unreachable
   Upstash allows the request rather than blocking it, so a third-party blip can't lock
   everyone out of signing in. The consequence worth remembering: **a deploy missing
   `UPSTASH_REDIS_REST_*` is unprotected while looking perfectly healthy.** It warns on
   every boot and reports to Sentry in production — don't ignore that warning. The
   `KV_REST_API_*` names that Vercel's Upstash integration injects count too:
   `upstashConfigured()` accepts exactly what `Redis.fromEnv()` does, and
   `check:ratelimit` pins that.
9. **Two routes are intentionally unauthenticated, and both leak nothing.**
   `/api/health`: an uptime monitor can't hold a session. It returns no data, no counts
   and no build id, and a fixed `"unhealthy"` string on failure rather than the error
   text (a Mongoose failure can carry `MONGODB_URI` with its credentials).
   `GET /api/menu`: the menu is public by nature and returns only what any guest sees.
   It **must never vary by caller**, because the service worker caches it on the device.
   That's why the admin screen reads hidden sections server-side
   (`getMenu({ includeHidden: true })`), never through this route. Any other new route
   without a check is a bug.
10. **Make-from-template only ever makes drafts.** `POST /api/events/from-template`
    takes `{ templateId, date, time? }`, nothing more. The server builds every event
    field from the stored template and sets `status: "draft"`. Publishing (the `PATCH`
    draft → published transition) stays the **single** path that announces a night and
    fans out push notifications. Don't add a "create and publish" shortcut anywhere.
11. **Sessions are revocable through `User.sessionVersion`** (`lib/session-check.ts`).
    Every session (and mobile token) carries the version it was issued under; the
    `jwt` callback re-checks it, with the role and name, every 5 minutes and on every
    `update()`. Bump the version to end every session an account has: the reset and
    password-change routes do. `update()` re-checks *before* it refreshes, so a stolen
    session can't use it to adopt the new version. Changing your own password signs
    this device back in with the new password (`AccountForm`).

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
5. **No `index: true` on a field that already leads a compound index.** Mongoose builds
   both, and the single-field one only costs writes. §7 lists four on the live cluster
   created exactly this way. `MenuItem` declares only `{ category: 1, order: 1 }`; follow
   that.
6. **Server functions run in Frankfurt, next to the database** (`vercel.json`:
   `"regions": ["fra1"]`). The Atlas cluster is in Frankfurt (measured: same latency as
   AWS eu-central-1, half that of us-east-1), and Vercel's default region is Washington
   (`iad1`). Until 2026-10-06 every page and API call ran there, so each request crossed
   the Atlantic once for the request, again for every database round trip, and many
   times during a cold start's Mongo handshake. If the database ever moves, move
   `regions` with it. Any service the server calls on a hot path (Upstash, once it
   exists) belongs in Frankfurt too. To check which region a request ran in:
   `curl -sI https://dekka-events.vercel.app/ | grep -i x-vercel-id`. The second segment
   is the function's region and should read `fra1`.
7. **No app-wide `SessionProvider`.** Mounted in the root layout, it fetched
   `/api/auth/session` on every page load and every time the installed app came back to
   the foreground. Server components read the user with `currentUser()`, and `signIn` /
   `signOut` from `next-auth/react` work without a provider. A client screen that really
   needs `useSession()` mounts its own, seeded with the server's session
   (`session={await auth()}`) so it doesn't fetch on mount. `/account` is the one example.
8. **Every tab tap is one server round trip, on purpose.** Every page is dynamic (the
   root layout reads the locale cookie), and Next keeps dynamic pages in its client cache
   for 0 seconds by default (`staleTimes.dynamic`), so spot counts and sold-out switches
   are never stale. That is why rule 6 matters so much. Raising
   `experimental.staleTimes.dynamic` would make going back to a recently seen tab instant,
   at the cost of showing data up to that many seconds old (spot counts, the menu, the door
   list). That's the owner's call, not a default to flip quietly.

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
- Don't import runtime code from `@/lib/i18n` in a component that can render on the
  client. `lib/i18n/index.ts` reads cookies (`next/headers`), so `fill()` is
  server-only. Client components import only types from it (`import type { Locale }`)
  and do placeholder substitution inline. See `menuHeadline` in
  `components/menu/MenuItemCard.tsx`.
- Don't reuse `t.nav.menu` for food — it means the hamburger menu. Cafe-menu strings
  live under `t.cafeMenu.*`.
- Don't detect "installed app" in JavaScript to change layout; use the `standalone:`
  variant (§2). Don't change how the browser site looks while doing app work.
- Don't put an absolutely positioned element (including Tailwind's `sr-only`) inside a
  horizontal scroller unless the scroller is `relative`. Otherwise its containing block
  is the page, and it widens the whole document. That is exactly the bug that made
  every `DataGrid` with rows scroll sideways on phones until phase 2 (the wrapper is now
  `relative`).
- Don't show the raw `IMGS/` JPEGs as icons. They're black on white. Redraw as an SVG
  on the 24px stroke grid in `components/BrandIcons.tsx`, so they tint with
  `currentColor` (see `AdminDashIcon`).

**Service worker / PWA**
- Don't cache page HTML, a user- or role-specific API response, or anything under
  `/admin` or `/staff` in `public/sw.js`. Offline pages get `/offline`, nothing else
  (§2).
- Don't change `/offline` (or what it imports) without bumping `VERSION` in `sw.js`, or
  installed phones keep the old copy.
- Don't make `GET /api/menu` depend on who's asking (§3 rule 9).
- Don't use `next/image` on `/offline`. Its `/_next/image?…` URL varies by width and
  won't be in the cache; that page uses a plain `<img>` on purpose.

**Backend**
- Don't import `@/models/*` from a client component — it pulls Mongoose into the
  browser bundle. Import shared enums from `lib/constants.ts` instead.
- Don't rely on a layout to protect a page. Start every protected `page.tsx` with
  `await requireRole(...)` before reading anything (§2); the layout's check runs in
  parallel with the page and cannot stop the page's data from streaming out.
- Don't skip `guard()`/`currentUser()` on a new API route "because it's simple" — every
  route gets a check, even read-only ones that only need to hide drafts from the
  public. (The two deliberate exceptions are listed in §3 rule 9.)
- Don't build an update schema without `stripDefaults()` + `.partial()` + `.strict()`
  (§2), and don't let a single-row PATCH set `order` (§2, "Reordering").
- Don't give a lower role a power by adding a role check inside a general route. Give it
  its own narrow route (§2, "Narrow routes").
- Don't let a cafe-menu photo be a pasted URL. Menu `image` must match
  `UPLOAD_IMAGE_PATTERN` (uploads only), so `/_next/image` only fetches from hosts this
  site already trusts.
- Don't delete a `CheckIn` or add a `CheckIn` query without `voidedAt: null`, and don't
  add a status change that bypasses `canTransition()` (§2).
- Don't delete a menu section that still has items (`409 CATEGORY_NOT_EMPTY`). Hiding
  (`isActive: false`) is the reversible way off the menu.
- Don't read `request.json()` fields directly — always through `parseBody()` + a
  Zod schema.
- Don't add a new role check inline — extend `RANK`/`hasRole()` in `lib/rbac.ts` if the
  role model itself needs to change.
- Don't add a host to `next.config.ts`'s `remotePatterns`, and never a wildcard. Every
  image the app shows is an upload (`UPLOAD_IMAGE_PATTERN` on cover images, menu photos
  and account pictures), served from Vercel Blob. A pasted URL needed the old `**`
  pattern, which made `/_next/image` an open proxy; `check:config` fails if one comes
  back.
- Don't store an uploaded file without `processImage()` (`lib/image-processing.ts`). It
  decides the type from the bytes and strips metadata, including a phone photo's GPS.
- Don't send push to a stored endpoint without `isAllowedPushEndpoint()`, and don't
  await a fan-out inside a request; use `sendToSubscriptions()` inside `after()`
  (`lib/push.ts`).

**Testing**
- **Don't write-test against the dev server.** `npm run dev` uses `.env.local`, whose
  `MONGODB_URI` is the live production cluster. Use the local throwaway database in
  §11, and prove the server is on it before the first write.
- Don't run `scripts/seed.ts` against anything but a local database.
- Don't upload test files through a local server and leave them behind.
  `public/uploads/events/` also holds the owner's real files from August. Delete only
  the ones your run created.
- Don't trust a full-page puppeteer screenshot alone for "the page scrolls sideways".
  Measure `document.documentElement.scrollWidth` (phase 3 found a capture artifact that
  looked like a bug).

---

## 7. Known Gaps (carried over from README — keep this list current)

- Capacity is checked read-then-write, not atomically (§4.4 — accepted tradeoff).
- ~~Open image proxy~~ — **fixed 2026-10-08** (roadmap S7): cover images are upload-only
  and the `**` remote pattern is gone (Feature Log, "Roadmap P2").
- ~~Uploads written to local disk~~ — **fixed**, see `lib/storage.ts`. Uploads go to
  Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set and to `public/uploads/events/`
  otherwise, so `next dev` still needs no Blob store. Orphaned blobs are now cleaned up
  (`releaseUploads()`, roadmap S9): a replaced or deleted poster, menu photo, template
  cover or account picture is deleted from Blob once no event, template, menu item or
  account still points at it. That check only runs when Blob is configured, so it has
  never run against a real Blob store. Also note the two backends are **not** a migration path for each other:
  rows already holding `/uploads/events/...` keep working (the regex accepts both
  shapes) but those files do not exist on a Vercel deploy, so any poster uploaded
  before the switch renders broken and has to be re-uploaded once.
- ~~Password reset does not invalidate already-issued sessions; mobile tokens outlive
  a reset, a demotion and the account~~ — **fixed 2026-10-08** (roadmap S8, Feature Log
  "Roadmap P2"). Sessions and mobile tokens carry the account's `sessionVersion`, re-checked
  every 5 minutes. A reset or a password change bumps it, and a deleted account fails the
  check. What remains: a revoked session lives on for up to **5 minutes** (the re-check
  interval) plus the per-instance cache's 60 seconds. `MOBILE_TOKEN_SALT` is still the
  lever to invalidate every mobile token at once.
- **No refresh token in the mobile bridge.** At 30 days the app asks for the password
  again; there is no silent renewal. Deliberate for v1 — a refresh token is a second
  credential with its own storage and rotation rules, and it buys convenience rather than
  capability. `expiresAt` comes back on the login response precisely so the app can
  re-prompt on its own schedule instead of discovering expiry as a 401 mid-action.
- **Sign-in timing still differs between a known and an unknown email.** `bcrypt.compare`
  only runs when a `passwordHash` exists, so an unknown address answers measurably faster
  than a wrong password on a real account. This predates the mobile work — it is how
  `lib/auth.ts`'s credentials `authorize()` has always behaved — and
  `POST /api/auth/mobile-login` was deliberately written to match it rather than diverge.
  The *response* is byte-identical either way (verified), so this is a timing side channel
  only. Fixing it means a dummy compare against a throwaway hash on both paths together.
- **OAuth-only accounts cannot sign in to the mobile app.** No `passwordHash` means
  `INVALID_CREDENTIALS`, with no hint about why — the non-enumeration rule costs the
  ability to say "this account uses Google, set a password first." They have to set one at
  `/account` on the website. This affects nobody today (no OAuth provider is configured,
  so no OAuth-only account can exist yet), but it becomes real the moment
  `AUTH_GOOGLE_*` is set, and it is the main thing that would push the app toward the
  OAuth-in-webview option in `PLAN/DEKKA_MOBILE_APP.MD` §13.1.
- **Rate limiting fails open.** Unconfigured or unreachable Upstash allows the request.
  See §3 rule 8 — a deploy missing `UPSTASH_REDIS_REST_*` is unprotected while looking
  healthy. Deliberate: a limiter that turns a third-party outage into a total auth
  outage does more damage than the abuse it prevents.
- **No 429 has ever actually been observed.** The limiter's table, IP resolution and
  fail-open path are covered by `npm run check:ratelimit`, but no Upstash account exists
  yet, so real throttling — and the sliding window's behaviour across concurrent Vercel
  instances — is untested. Verify on the first real deploy.
- **No email has ever actually been delivered.** The reset flow is complete and its
  token rules are verified (`npm run check:reset`, plus a live-cluster run against a
  throwaway user), but `RESEND_API_KEY`/`EMAIL_FROM` are unset because no sending domain
  exists. `emailEnabled` is therefore false, which hides the "Forgot?" link and
  redirects both pages — the flow is dormant, not broken. Resend needs a **verified
  domain**; without one it delivers only to your own account address, which would look
  like it works and silently fail for every member.
- **Do not put a TTL index on `User.resetTokenExpiresAt`**, however sensible it sounds
  (`PLAN/Before_Deployment.md` §5/§7 asks for one). A MongoDB TTL index deletes the
  **whole document**, so it would delete every member who ever requested a reset, 30
  minutes later. The reasoning is recorded in `models/User.ts` at the point of
  temptation. The live cluster was audited and carries no TTL index anywhere.
- **Redundant single-field indexes exist on the live cluster**, found by the §7 audit
  and left alone: `events.status_1`, `reservations.status_1`, `checkins.event_1` and
  `bandsubmissions.status_1` are each a prefix of an existing compound index
  (`status_1_startsAt_1`, `event_1_status_1`, `event_1_createdAt_-1`,
  `status_1_createdAt_-1`) and so serve no query the compound one can't. Mongoose
  created them from `index: true` on the field alongside the explicitly declared
  compound. They cost write throughput, not correctness. Dropping them is a live-DB
  write and was out of scope for a read-only audit — worth doing deliberately.
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
- **~~Event analysis report — `@sparticuz/chromium` on Vercel is unverified.~~
  Verified, and it broke — fixed 2026-09-05 (Feature Log below).** The first real
  hit of `GET /api/events/:id/report` in production threw `Error: The input
  directory ".../bin" does not exist` (Sentry SENTRY-BYZANTINE-YACHT-3). Cause:
  `serverExternalPackages` stops the bundler from touching `@sparticuz/chromium`'s
  JS, but Vercel's separate file-tracing step (`@vercel/nft`) still didn't pick up
  its ~67MB of compressed binaries in `bin/*.br`, since they're only reached via
  `chromium.executablePath()`'s internal `fs` logic rather than a static
  `require`. Fixed with `outputFileTracingIncludes` in `next.config.ts`, scoped to
  just this route. Still note: `@sparticuz/chromium` (^149) and `puppeteer-core`
  (^25, targets Chrome ~152) are a few versions apart — only stable CDP surface is
  used (`setContent` + `page.pdf`), which is version-tolerant, but if a deploy
  throws a CDP/protocol error, align the two package versions.
- **`lib/report/fonts/Cairo.ttf` is a vendored binary (~600 KB).** It's the OFL
  variable font, embedded into the report HTML as a data URI at render time. If
  the app's Arabic face ever changes, change this too (it's independent of
  `next/font`'s Cairo in `app/layout.tsx`).
- **The installable app has never been installed on a real phone.** Everything in the
  PWA phase-1 Feature Log entry was verified in headless Chrome, including an emulated
  iPhone user agent and an emulated `navigator.standalone`. That is not Safari. Before
  telling the owner it works, add it to the home screen on a real iPhone (Safari) and a
  real Android (Chrome), launch it, switch tabs, and turn on airplane mode to see
  `/offline`. iOS push additionally needs iOS 16.4+ and the app installed, on top of the
  existing "push never verified on a device" gap below.
- **`public/sw.js` has a hand-bumped `VERSION`.** Bump it when the *caching rules*
  change *or the offline page's content does* (it's precached only at install — phase 2
  bumped it to `v2` so already-installed devices get the remembered-menu offline page), so the old `dekka-*` caches are dropped on activate. A normal deploy needs no
  bump, because cached assets are content-hashed. Forgetting it after a rules change
  leaves entries written under the old rules in place until their ceiling evicts them.
- **The offline page is precached once, at worker install.** It shows the locale the
  visitor had when the worker installed, and it's refreshed only when `sw.js` itself
  changes. That's deliberate: it carries no user data, and refetching it on every visit
  would cost every visitor bandwidth for a page almost nobody sees.
- **Only Chromium gets a one-tap Install button.** `beforeinstallprompt` doesn't exist in
  Safari, Firefox or (reliably) Samsung Internet. Those visitors get the written steps on
  `/get-app`, and the strip under the header shows only for iPhone and Chromium.
- **No iOS launch images** (`apple-touch-startup-image`). iOS shows a plain screen in
  the manifest's `background_color` (`ink-black`) while the app boots. It needs one
  image per device size, so it was left out; add them if the blank moment ever bothers
  anyone.
- **The CSP only reports.** `lib/csp.ts` ships `Content-Security-Policy-Report-Only`
  (reports go to Sentry when the DSN is set). Enforcing it with no `'unsafe-inline'`
  scripts needs per-request nonces from a `proxy.ts`, per Next's CSP guide. The other
  headers (`nosniff`, `X-Frame-Options: DENY`, Referrer- and Permissions-Policy) are
  enforced now.
- **Menu photos share the event-poster storage** (orphans now cleaned up, see above). `/api/uploads`
  keys everything as `events/<uuid>`, menu photos included (`UPLOAD_IMAGE_PATTERN`
  depends on that shape, so a separate `menu/` prefix would have meant widening the
  pattern for no functional gain). Replacing or deleting a menu item's photo leaves the
  old blob behind, the same accepted gap as posters above.
- **`next start` only serves `public/` files that existed when it started.** An upload
  written to local disk during a `next start` run 404s until a restart. Local-disk
  uploads therefore only really work under `next dev`. Production uses Vercel Blob, so
  this is a local-testing trap, not a production one — it produced a broken image in the
  menu phase's first verification run, and a restart fixed it.
- **The event page's action row is still 32px buttons.** Publish, Duplicate, the report
  and now "Save as template" are all `size="sm"`, under the 44px touch-target rule the
  newer screens follow. Fine with a mouse; worth enlarging together if the owner runs
  events from a phone.
- **Admin-shortcut asymmetry:** only admins get a one-tap header button on phones. Staff
  still reach the door through the hamburger. Adding a "Door" button the same way is a
  one-liner in `Navbar.tsx` if the bar team wants it.
- **`next start` on Windows can't reach Atlas.** The DNS workaround in `lib/db.ts` is
  guarded to non-production, so any database-backed page errors under a local
  production build (`querySrv ECONNREFUSED`). Verify production-only behaviour, such as
  the service worker, on pages that don't query the database (`/about`, `/menu`,
  `/get-app`), or on a real deploy.
- **A phone still downloads ~230 KB of JavaScript (brotli) on its first visit.** After
  the 2026-10-06 speed pass, most of it is React and the Next.js runtime, which is a
  fixed cost. The biggest optional pieces are the Sentry SDK and framer-motion (~41 KB).
  framer-motion's shared `layoutId` tab indicators need its full layout features, so
  `LazyMotion` would save little. Both complete dictionaries also ride in every hard
  load's HTML (about half of the home page's 171 KB uncompressed), because `bi()`
  labels need both languages on the client. Splitting that is real work: the client
  would need only the keys it renders.
- **The favicon is the 85 KB `public/brand/dekka-logo-square.png`** (`metadata.icons`
  in `app/layout.tsx`). Browsers fetch it after the page loads, so it's not on the
  critical path, but a 32–48 px export from `npm run brand:assets` would do the same job
  in a few KB.
- **`npm audit` (dev dependencies) keeps 5 high findings, all one chain:**
  `braces` ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ←
  `eslint-config-next`. There is no fix on the 16.x line (npm's only suggestion is
  downgrading to `eslint-config-next@14`, which is wrong), and it only ever runs on our own
  lint globs, never in production. CI audits production dependencies only
  (`npm audit --omit=dev`), which are clean. Re-check when `eslint-config-next` moves.
- **`stripDefaults()` in `lib/validation.ts` touches Zod internals**
  (`instanceof z.ZodDefault`, `.removeDefault()`). It's the structural guard that
  stops `updateEventSchema` re-introducing the default-leak bug described in §8,
  and it's deliberately mechanical so a newly added `eventCore` field can't
  reintroduce it. Worth re-checking on a Zod major/minor upgrade.

---

## 8. Feature Log

Short "what shipped" notes for anything implemented from a `PLAN/fix_*.md` spec, so
the next session doesn't have to diff `git log` to understand intent. Newest first.

### Roadmap P2 — hardening: push, headers, images, revocable sessions, uploads (2026-10-08)

- **Push (S5), `lib/push.ts`.** A subscription's endpoint must be a real push service
  (`isAllowedPushEndpoint`: FCM, Mozilla, Windows, Apple; HTTPS, no port or userinfo).
  Before, any HTTPS URL a member named was POSTed to on every publish.
  `POST /api/push/subscribe` is rate-limited per user (`push-subscribe`) and keeps 10
  devices per account. The publish fan-out runs in `after()`, so Publish answers at once
  however many devices there are. It sends in batches of 50 and drops dead or
  pre-allowlist rows. `sendToSubscriptions()` is now the one sender.
- **Headers (S6), `lib/csp.ts`.** On every route: `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` (Wake Lock allowed for the door code), and a
  **report-only** CSP whose reports go to Sentry's security endpoint (derived from the
  DSN). `X-Robots-Tag: noindex` on `/admin`, `/staff`, `/account` and `/my-events`.
  `poweredByHeader: false`. `check:config` asserts all of it survives the Sentry wrapper.
- **Image proxy closed (S7).** `coverImage` (events and templates) must match
  `UPLOAD_IMAGE_PATTERN`; the paste box is gone from both forms; the `**` remote pattern
  is deleted. A read-only query of production found all 4 events, the 1 template and
  both account photos already using uploads, so nothing broke.
- **Revocable sessions (S8), `lib/session-check.ts`.** New optional
  `User.sessionVersion`. It is stamped into each session at sign-in and re-checked (with
  role, name and phone) every 5 minutes and on every `update()`. A per-instance 60-second
  cache keeps that to about one read per account per minute; server components can't
  rewrite the cookie, so an old cookie re-checks on every request. Bumped by a password
  reset and a password change. `AccountForm` signs the changing device straight back
  in, and `update()` re-checks before refreshing so a stolen session can't follow
  along. Mobile bearer tokens carry and check the same version. Role changes now reach
  an open session without a re-login.
- **Uploads (S9).** `lib/image-processing.ts` decides the type from the file's bytes
  (the declared MIME type is ignored) and re-encodes with `sharp`. That applies the
  EXIF rotation, then drops all metadata (GPS included) and fits the image inside
  2000px. `sharp` moved to `dependencies`. `releaseUploads()` deletes a replaced or
  deleted image from Blob once no event, template, menu item or account points at it.
  It runs in `after()` from the five routes that replace images.
- **Small ones (S10, R2).** Door codes come from `crypto.randomInt` and are unique
  among the night's confirmed reservations (`uniqueReservationCode`). Band links are
  web addresses only, with `https://` added to a bare domain (`bandLink`). New
  `password-change` bucket. Mongo `maxPoolSize: 10`, `serverSelectionTimeoutMS: 10000`.
- **`npm run check:hardening`:** 82 assertions, including a real `sharp` round trip
  (EXIF in, none out). Mutations caught: any HTTPS push host allowed, `update()`
  skipping the check, EXIF kept, and both link-safety layers removed. Removing only the
  `javascript:` rule is *not* caught, because the URL check still refuses it; the two
  layers overlap on purpose.

**Verification.**
- **Checks:** typecheck, lint, build and `check:all` (10 scripts) are clean.
- **End to end:** 29/29 on a production build against `dekka_verify`. Covered:
  - real response headers, including no `X-Powered-By`;
  - `/_next/image` refusing an outside host (400) while still serving our own images;
  - a pasted cover URL refused;
  - a non-push endpoint refused, and the 10-device cap;
  - Publish answering in 43 ms with 313 subscriptions in the database (300 junk FCM
    rows, 3 pre-allowlist rows, which the fan-out then deleted);
  - a 2600×1400 JPEG carrying EXIF stored at 2000px with no EXIF;
  - HTML posted as `image/png` refused, and a PNG posted as `image/jpeg` stored as `.png`;
  - band links refused or normalised;
  - a second device's session gone after the first device changed the password, even
    when it called `update()`, with the first device signed back in and
    `sessionVersion` at 1.
- **Cleanup:** this run's upload files were deleted.
- **Timed revocation:** see the line below.

**Not verified:** `releaseUploads()` against a real Blob store (it no-ops without
`BLOB_READ_WRITE_TOKEN`); a real push delivery; the CSP reports arriving in Sentry.

### Roadmap P1 — integrity: lifecycle rules, voided door rows, the door log (2026-10-08)

- **Lifecycle (I1).** `EVENT_TRANSITIONS` + `canTransition()` in `lib/constants.ts` is the
  one table. `PATCH /api/events/:id` refuses anything else (`409 INVALID_TRANSITION`), and
  `EventAdminActions` and `EventForm`'s status dropdown offer only those moves. Moving to
  `draft` also needs zero reservations and zero door rows (`409 EVENT_HAS_RECORDS`). Ruled
  out: re-publishing a `happened`/`archived` night (it pushed every member about a past
  night) and sending one back to `draft` (its takings left the monthly report).
- **First publish only (roadmap Q7).** New optional `Event.firstPublishedAt`. The push
  fan-out fires only on `draft → published` while it's unset. Re-opening a closed night
  or re-publishing an unpublished one notifies nobody.
- **Delete protection (I2).** `DELETE /api/events/:id` refuses a `happened`/`archived`
  night or any night with a door row (voided ones included), and no longer touches
  `CheckIn` at all. The UI hides Delete there and names the reservation count in the
  confirm.
- **Door rows are voided, never deleted (I3).** `CheckIn.voidedAt/voidedBy/voidedReservation`
  (optional). "Remove" sets them and moves `reservation` into `voidedReservation`, so the
  existing unique partial index lets the guest be checked in again. Every reader filters
  `voidedAt: null`: `getCheckIns`, `getEventReservations`, `getAllCheckIns`,
  `getAllReservations`, `getMonthlyReport`, `getEventReportData`. A voided row can't be
  edited (`409 CHECKIN_VOIDED`).
- **The door log.** New `CheckInAudit` collection (`lib/checkin-audit.ts`): one row per
  check-in, edit (field by field, old → new) and removal, with who and when. It is shown on
  the admin event page (`components/DoorLog.tsx`). A failed log write reports to Sentry
  but never fails the door. The door table now confirms before removing and says
  "every edit or removal here is recorded".
- **Cairo time (I4).** `shiftCafeDays()` (`lib/templates.ts`) keeps Duplicate at the same
  Cairo wall-clock time across Egypt's DST change; the old `setDate` in the browser's
  timezone was an hour off either side of it (`check:integrity` proves both
  directions). The staff picker's "today" uses `dayKey()`, not the server's UTC date.
- **Close-out prompt (I5).** `getNightsToCloseOut()`: published or closed nights that
  started more than 6 hours ago. `components/CloseOutCard.tsx` sits on `/admin` with a
  one-tap "Mark as happened".
- **Fixed while there:** on a phone, the door page scrolled sideways by 268px once the
  attendee table had rows. Its one-column grid sized itself to the table's minimum width.
  It now uses `minmax(0, …)` tracks (`DoorTable.tsx`), so the table scrolls inside
  `DataGrid` instead.

**Verification.**
- **Checks:** typecheck, lint, build and `check:all` (9 scripts) are clean.
  `check:integrity` has 80 assertions. Five mutations each made it fail:
  `happened → draft` allowed, the void filter dropped from `getCheckIns`, door rows
  hard-deleted, Duplicate back to `+7 × 24h`, and the old notify rule.
- **End to end:** 41/41 against a production build on the local `dekka_verify` database
  (marker proof first), with real sign-ins for an admin, a staff member and a member.
  Covered: every allowed and refused transition, `firstPublishedAt` surviving a re-open,
  the delete rules, a door row created → edited → voided → re-checked-in, the door log
  holding exactly `create, update, void, create` with `amount 100 → 80` and the staff
  name, the monthly report counting only the live row, the page gates holding for a
  signed-in member and staff, and the close-out prompt appearing and clearing.
- **Screens:** `/admin`, the admin event page, the door page and `/admin/customers` in
  Arabic and English at 390px and 1280px. Screenshots were looked at, and scroll width
  was measured after hydration: 0 overflow everywhere.

**Not verified:** a real phone; the push fan-out itself (no subscriptions in the test
database; the rule is covered by source assertions and the `firstPublishedAt` checks).

### Security fix: admin and staff pages leaked their data to signed-out requests (2026-10-08)

Roadmap finding S2, which the roadmap rated "documented by Next, not exploited". It was
exploitable with a plain `curl`. Admin and staff pages relied on their layout's role check
alone. In a streamed render the page runs alongside the layout, so its data was already in
the response when the layout's `redirect()` took effect. Proven against a local production
build on the throwaway database, with probe rows planted. Signed-out `GET` requests
returned:

- `/admin` (and its `?tab=` views): every confirmed reservation (name, phone, door code)
  and every pending pitch (contact name, email, phone);
- `/admin/customers`: every door record (name, phone, method, amount);
- `/admin/events/<id>` and `/staff/events/<id>`: that night's reservations and door list.
  Event ids are public, in every event URL;
- `/admin/submissions`: every pitch with its email and phone.

No special headers were needed. The pages without probe-able personal data (events list,
report, menu, templates) were exposed the same way.

**Fix:** `requireRole(min, next)` in `lib/rbac.ts`, called as the first `await` of all 12
pages under `/admin` and `/staff`, so the redirect is thrown before any read starts. The
layouts are unchanged. **Verification:** the same 14 URLs, signed out, return only the
redirect, with zero probe strings. New `npm run check:integrity` asserts that every
`page.tsx` under those trees begins with `await requireRole("<role>", …)`. Two
mutations (gate removed; staff page downgraded to `member`) each made it fail.

**Not verified:** production was not probed, because that would mean reading real
customers' data. The code there was identical, so it should be treated as exposed until
this deploy. Whether anyone actually fetched these pages can only be judged from
Vercel's request logs, which keep about an hour on Hobby.

### Roadmap P0 — safe base (`PLAN/SITE_ROADMAP.md`, 2026-10-08)

- **`next` 16.3.1 → 16.3.8** (and `eslint-config-next` with it, both still exact pins).
  16.3.1 carried 9 published advisories, including an unauthenticated RCE in the image
  optimizer, an RCE in `next/og` and an image-optimizer SSRF; 16.3.8 is the first release
  outside every advisory range. `npm audit fix` cleared `undici`, `brace-expansion`,
  `fast-uri` and `source-map-js`; `sharp` → `^0.35.5`. Production dependencies now audit
  clean. The remaining dev-only chain is in §7.
- **Runtime:** `"engines": { "node": ">=24 <25" }` (local and Vercel both run Node 24),
  `@types/node` → `^24`, and in-range updates (`zod` 4.6.5, `mongoose` 9.11.1,
  `@sentry/nextjs` 10.76.1, `@upstash/*`, `framer-motion` 13.5.1, `lucide-react` 1.53).
- **`npm run check:all`** (`scripts/check-all.mjs`) runs every `check:*` script, discovered
  from `package.json`.
- **CI:** `.github/workflows/ci.yml` — on every push/PR to `main`: `npm ci`, typecheck, lint,
  `check:all`, build (placeholder env; nothing connects anywhere). Weekly and on demand:
  `npm audit --omit=dev --audit-level=high`.

**Verification.** typecheck, lint, all 8 checks and `next build` are clean on the new
versions; `stripDefaults` survived the Zod minor bump (`check:menu` / `check:templates`
exercise it). `npm audit --omit=dev`: 0 vulnerabilities.

**Not verified:** the CI workflow itself has never run (it runs on the first push), and
production rate limiting is still off until Upstash is connected (§0).

### Mobile speed pass (2026-10-06)

The owner's report: "the mobile application is too slow." I measured the live site
before changing anything. The setup was headless Chrome emulating a Pixel 7 in
installed-app mode, on Lighthouse's mobile profile (slow 4G: 150 ms latency, 1.6 Mbps;
4× CPU slowdown), from the owner's machine.

**What the measurements showed (live, before):**
- **Server functions were running in Washington.** Every response carried
  `x-vercel-id: fra1::iad1`: it entered Vercel in Frankfurt but ran in `iad1`, while the
  Atlas cluster is in Frankfurt. A static file answered in ~70 ms, but any dynamic page
  took ~250 ms even with no database work. Pages with queries added ~100–170 ms more,
  because each query also crossed the Atlantic. Cold starts were 2.5–4.5 s.
- **Tab taps:** Menu and About ~650 ms each; My Events (as a guest) ~330–400 ms.
- **First load:** ~300 KB of brotli JavaScript, first paint ~1.3–1.6 s, load ~3 s,
  190–310 ms of main-thread blocking.
- **Background chatter:** `/api/auth/session` on every launch and every time the app
  returned to the foreground (root `SessionProvider`), plus two Sentry "session"
  requests on every tab tap.

**Changes:**
- **`vercel.json` → `"regions": ["fra1"]`** (§4 rule 6). This is the big one. It
  removes the transatlantic hop from every request and from every database round trip.
- **`SessionProvider` moved from the root to `/account`** (§4 rule 7), seeded with the
  server's session so it doesn't fetch on mount.
- **Fixed while there: renaming yourself on `/account` never reached the navbar.**
  `useSession().update()` with no argument is a plain GET, so the `jwt` callback never
  saw `trigger: "update"` and the cookie kept the old name until the next sign-in. This
  predates the speed pass. `AccountForm` now calls `update({})`, which is the POST that
  re-reads the user (same for the photo).
- **Sentry, client:** `browserSessionIntegration({ lifecycle: "page" })`, which gives one
  release-health session per app launch instead of one per screen. That's two fewer
  requests per tab tap.
- **Sentry, bundle:** `compiler.define` sets `__SENTRY_DEBUG__` and
  `__SENTRY_TRACING__` to `false`. The existing `webpack.treeshake` options were meant to
  do this, but they don't run under Turbopack. It applies to server bundles too, which
  is the intent: we run `tracesSampleRate: 0` everywhere. `check:config` now asserts both
  flags survive the Sentry wrapper.

**Verification.**
- **Checks:** typecheck, lint and build are clean; `check:config` passes with the new
  assertion.
- **Bundle:** per-page JavaScript went from 245 KB to 230 KB brotli (local production
  builds, same pages: `/get-app`, `/about`, `/login`).
- **Sentry still reports, with tracing stripped.** I built and ran with a fake DSN
  pointing at a local catcher, against an unreachable database. A page render error
  (`onRequestError`), an API error (`handle()`) and a thrown browser error each arrived
  as an `event` envelope. There were no Sentry requests on client navigations.
- **Signed-in flow, end to end:** against a production build on the **local** throwaway
  `dekka_verify` database (marker proof first; the live cluster was never written to).
  - Sign-in through `/login` works without the root provider.
  - Browsing three screens and a simulated return to the foreground made **0**
    `/api/auth/session` calls.
  - `/account` mounts without fetching the session.
  - Before the rename fix, saving a new name sent a `GET` and the navbar kept the old
    name, even after a full reload. After it, a `POST`, and the navbar showed the new
    name immediately and after a reload.
  - Sign-out works.
- **Installed-app smoke run:** cold load, warm reload and four tab taps work on the local
  build. Locally, where the server sits next to its database, a tab tap took ~380 ms
  under the same emulation, against ~650 ms live. That's a preview of what the region
  move should give, not a measurement of it.
- **Cleanup:** the throwaway database was dropped (remaining: `admin, config, dekka,
  local`); the container and Docker Desktop were stopped. The run created no upload
  files.

**Not verified:** the region change itself, which only takes effect on deploy (§0 says
how to check it). The photo-upload path of the session fix wasn't exercised; it uses the
same `updateSession()` call as the name. Nothing was run on a real phone.

### Installable app, phase 3 of 4: event templates (`PLAN/DEKKA_PWA_APP.md` §4, 2026-10-04)

The owner's ask: "if the admin wants to change the nights or put some activities in the
day, save it so he doesn't need to fill the options again." Now any night or activity
can be saved once and run again in two taps — pick it, pick a date — producing a draft
with every field filled in.

- **`EventTemplate` model** — the reusable half of an `Event` (titles, descriptions,
  location, map, poster, price, capacity, payment, InstaPay, terms) plus its own
  `nameAr`/`nameEn` (the button label), `kind` (`night` | `activity`, display only — a
  moon or a sun), `defaultTime` (`"HH:mm"`, cafe time) and `order`. Never a date, a
  status or `doorsOpenAt`: those belong to one occurrence. New collection only.
- **`lib/templates.ts` is the one place the merge lives:** `TEMPLATE_EVENT_FIELDS`
  (the exact list that crosses between an event and a template, both directions),
  `buildEventFromTemplate` (always `status: "draft"`), `templateFieldsFromEvent`, and
  `startsAtFor(date, time)`, which goes through `fromLocalInputValue` like `EventForm`
  does, so 20:00 is 8pm in Cairo on either side of Egypt's DST change.
- **`POST /api/events/from-template` takes `{ templateId, date, time? }` and nothing
  else** (`.strict()`): the server reads the stored template and builds every event
  field itself, so no title, price or `status` can be injected, and even a template
  doctored straight in the database yields a draft. **Always a draft** — publishing
  stays the single path that announces a night and sends the push. The optional `time`
  is the one deviation from the spec's `{ templateId, date }`: the spec's own flow
  pre-fills a time the admin can change, so the request has to carry it.
- **Template schemas** reuse `eventCore`'s own Zod pieces for every event field, so a
  template can always make a valid event and a limit changed on events changes here
  too. Updates go through `stripDefaults()` — without it, renaming a template wiped its
  description, location, map, poster and terms (`check:templates`' mutation run showed
  exactly that). Template CRUD and the full-sequence reorder route are `guard("admin")`.
- **Screens:**
  - **"From a saved template"** (`components/templates/TemplateLauncher.tsx`) sits
    under the header of `/admin/events` and `/admin/events/new`. Tap a template: the
    date defaults to today (or the calendar day you came from) and the time to the
    template's usual one. Create takes you to the new draft.
  - **"Save as template"** goes at the end of an event page's action row, so its small
    form opens below the buttons. It captures the event *as saved*, using the event's
    start time as the usual time.
  - **`/admin/templates`** (new sidebar link) lists, edits, reorders and deletes
    templates, or starts one from scratch with the full form. Deleting a template
    never touches events made from it — they were copies.
- **A planned behaviour finally wired:** the admin calendar has linked empty days to
  `/admin/events/new?date=YYYY-MM-DD` since `FIX_ADMIN_DASH.md` §4, but nothing read the
  date. Now both the launcher and `EventForm` (new `defaultDate` prop, 8pm) start on it;
  an unreal date is ignored.
- **One upload helper:** `lib/upload-image.ts` replaces the copy-pasted upload code in
  the new template form and the menu item form. `EventForm` still has its own copy,
  left alone because it works and isn't this phase's to change.
- `formatTimeOfDay()` in `lib/format.ts` shows a template's "HH:mm" as "8:00 PM" /
  "٨:٠٠ م", matching `formatTime`.

**New files:** `models/EventTemplate.ts`, `lib/templates.ts`, `lib/upload-image.ts`,
`app/api/event-templates/route.ts`, `…/[id]/route.ts`, `…/order/route.ts`,
`app/api/events/from-template/route.ts`, `app/(site)/admin/templates/page.tsx`,
`components/templates/*` (`TemplateLauncher`, `SaveAsTemplateButton`, `TemplateForm`,
`TemplateManager`), `scripts/check-templates.ts`. `EVENT_TEMPLATE_KINDS` in
`lib/constants.ts`; strings under `t.templates.*`. **No new dependencies, no new env
vars, no change to existing collections.**

**Verification.**
- **Checks:** typecheck, lint and build are clean; all eight `check:*` scripts pass.
- **`check:templates`:** 55 DB-free assertions. Four deliberate mutations each made it
  fail: a builder copying a template's status, dropping `stripDefaults`, a non-strict
  request schema, and the route opened to staff.
- **End to end, 41/41:** against a production build on a **local** throwaway MongoDB.
  As in phase 2, I proved the server was on it with a marker first. The live cluster
  was never touched.
- **Access:** guest 401; staff 403 on from-template and on creating a template.
- **Save as template (UI):** the template held the event's fields and a 20:00 usual time
  taken from a 17:00Z start, with no status or date.
- **Launcher (UI):** the time was pre-filled; the result was a draft at 2026-10-21 17:00Z
  with every field from the template, and the source event was untouched.
- **`?date=`:** pre-fills both the launcher and the full form; a custom 19:30 on 2 Dec
  gave 17:30Z (winter time); an unreal date was ignored.
- **API refusals:** an unknown template gives 404, an unreal date 400, and a request
  carrying event fields 400.
- **Doctored template:** one stored with `status: "published"` still made a draft.
- **Reorder:** a partial order is refused as stale; a full order is accepted.
- **Template edits:** a price-only edit left the rest intact (a real write).
- **Manager (UI):** create, edit, order and delete all work, and events made from a
  deleted template remain.
- **Phones:** no sideways scroll on any of the four admin screens touched.
- **Console:** no errors.
- **Visual checks:** screenshots were checked by eye. They found the Save-as-template
  form splitting the action row (fixed by moving it last). One full-page capture showed
  the page shifted sideways; measured, the page was 1280 wide with nothing scrolled, and
  a plain capture of the same state was correct, so that was a capture artifact rather
  than a page bug.
- **Cleanup:** the throwaway database was dropped and the container and Docker Desktop
  were stopped.

**Not verified:** the template screens on a real phone. The "Save as template" button
matches its row's existing 32px (`size="sm"`) buttons rather than the 44px rule; that
whole row predates the rule.

### Installable app, phase 2 of 4: cafe menu (`PLAN/DEKKA_PWA_APP.md` §3, 2026-10-03)

The menu the admin manages and every guest can browse: sections, items with optional
sizes, photos, labels, "Barista's pick", and a sold-out switch staff can flip from
behind the bar. It shows on `/menu` (the installed app's Menu tab), as a "Barista's
picks" strip on the homepage, and — from the service worker's copy — on the offline
page.

- **Models:** `MenuCategory` (names, `order`, `isActive`) and `MenuItem` (names,
  descriptions, `price`, `variants[]`, `image`, `tags[]`, `isFeatured`, `available`,
  `order`). New collections only. The one index is `{ category: 1, order: 1 }`;
  `category` deliberately has no `index: true` of its own (the redundancy §7 found four
  times on the live cluster).
- **One pricing rule, in `lib/menu.ts`:** an item with sizes is priced *by* them, and
  `price` is kept equal to the cheapest size. The routes enforce it on every write: a
  bare price PATCH on a sized item is `409 PRICE_SET_BY_VARIANTS`. Cards show "from X"
  only when there are two or more sizes.
- **Validation** (`lib/validation.ts`): every menu schema is `.strict()`; both update
  schemas go through `stripDefaults()`. Without that, a `{ price }` PATCH parses to
  `available: true, isFeatured: false` as well — `check:menu`'s mutation run showed
  exactly that. `order` is in no single-item schema; position only changes through the
  two `…/order` routes, which take the **complete** sequence and refuse a stale or
  mixed one (`409 STALE_ORDER`, `400 MIXED_CATEGORIES`) rather than half-apply it.
  Photos must match `UPLOAD_IMAGE_PATTERN`, so a menu image is always an upload, never
  a pasted URL proxied through `/_next/image`.
- **Routes:** `GET /api/menu` is deliberately unauthenticated, like `/api/health`. It
  returns only what any guest sees, and it must never vary by caller, because the
  service worker caches it. The admin screen reads hidden sections server-side through
  `getMenu({ includeHidden: true })`, never through this route. Section/item
  `POST`/`PATCH`/`DELETE` and both reorder routes are `guard("admin")`. A section with
  items can't be deleted (`409 CATEGORY_NOT_EMPTY`): hiding it is the reversible way off
  the menu. **`PATCH /api/menu/items/:id/availability` is the one staff write** — its
  own route and its own `{ available: boolean }` schema, so no request shape reaches a
  price or a name from there.
- **Screens:**
  - `/admin/menu` (`components/menu/admin/*`): a sections panel, then each section's
    items in the shared `DataGrid`. Names, price and pick edit in place; sold-out is one
    tap; order is up/down; everything else goes through the inline item form (sizes,
    labels, photo upload via `/api/uploads`).
  - `/staff/menu`: big switches only, linked from `/staff`.
  - `/menu`: search across both languages, ignoring case and Arabic diacritics. A
    sticky row of section chips follows your scroll position. Sold-out items stay
    listed, marked in words.
  - **Homepage:** the picks strip goes right under the hero, per `HOME_PAGE.md`'s
    section order. Sold-out picks are left out of it.
  - **No photo:** the card is complete as text, and the homepage strip shows the
    tatreez texture with a cup instead.
- **Offline menu.** `MenuCacheWarmer` fetches `/api/menu` once per `/menu` visit, only
  when a worker controls the page, so the worker holds a copy; `OfflineMenu` on
  `/offline` lists it ("the menu, as you last saw it").
- **Admin shortcut in the header (your request mid-phase).** On phones the header's
  centre track is empty — the link pill is hidden — so admins get a gold "Admin" button
  there (`AdminShortcut` in `NavLinks.tsx`), lit anywhere under `/admin`, hidden from
  `lg` up where the pill already has the link. Below 360px it's icon-only so the bar
  never wraps. The icon is the owner's own admin-dashboard mark (`IMGS/admin dash.jpg`,
  a person beside a bar chart), redrawn as `AdminDashIcon` in `components/BrandIcons.tsx`
  on lucide's 24px stroke grid so it tints gold. The JPEG itself is black on white and
  would have shown as a white box on the button. Checked in the real header in both
  languages, and icon-only at 340px.
- **Two shared-component changes:**
  - `DataGrid` gained an optional per-row `readOnly` (a sized item's price), and Tab
    skips such cells.
  - **A latent `DataGrid` bug, fixed.** The delete column's `sr-only` header is
    absolutely positioned, and the scroll wrapper wasn't positioned, so the label
    escaped the wrapper's clipping and widened the whole page by the table's overflow.
    `/admin/menu` scrolled 321px sideways at 390px. The door table and Customers grid
    have the same column; they only looked fine locally because the test database had
    no check-ins. The wrapper is now `relative`.

**New files:** `models/MenuCategory.ts`, `models/MenuItem.ts`, `lib/menu.ts`,
`app/api/menu/**` (7 route files), `app/(site)/admin/menu/page.tsx`,
`app/(site)/staff/menu/page.tsx`, `components/menu/*` (`MenuItemCard`, `MenuBoard`,
`FeaturedMenuStrip`, `MenuCacheWarmer`, `OfflineMenu`, `StaffMenuToggles`,
`admin/MenuManager`, `admin/MenuItemForm`, `admin/MenuSections`),
`scripts/check-menu.ts`. `/menu` replaced its phase-1 placeholder. `MENU_TAGS` in
`lib/constants.ts`; strings under `t.cafeMenu.*` (not `t.nav.menu`, which is the
hamburger). **No new dependencies, no new env vars, no change to existing collections.**

**Deviations from the spec:**
- `getFeaturedMenuItems` leaves sold-out picks off the homepage, which the spec didn't
  say. A headline recommendation you can't order tonight disappoints rather than
  informs; `/menu` still lists them, marked.
- Seasonal *scheduling* (date-ranged sections) stays deferred to phase 4, as the
  brainstorm planned; hiding a section covers the manual case now.

**Verification.**
- **Checks:** typecheck, lint and build are clean; all seven `check:*` scripts pass.
- **`check:menu`:** 62 DB-free assertions — schemas, the staff route's one-field
  boundary, guard rank on every route read from source, upload-only photos, the
  pricing rule and the reorder contract. Three deliberate mutations each made it fail:
  dropping `stripDefaults`, opening availability to members, and downgrading an admin
  DELETE to staff.
- **End to end, 55/55:** a production build, driven by headless Chrome, against a
  **local** MongoDB (the repo's `docker-compose` container) in a throwaway `dekka_verify`
  database. Before any write went through the app, I proved the server was on it by
  planting a marker there and reading it back through `GET /api/menu`.
- **Admin rules (real writes):** sizes price an item; a bare price on a sized item is
  refused; a price-only edit left sold-out and pick untouched; a stale order, a mixed
  order, deleting a non-empty section and an external image URL were all refused; a
  photo upload attached to an item.
- **Public view:** hidden sections stay hidden, sold-out items stay listed, and the
  admin's order holds.
- **Staff:** can flip availability, but availability-plus-price is 400, the full item
  PATCH is 403 and deleting a section is 403. The price was unchanged afterwards (read
  back from the database), and the staff page's switches flip and save.
- **Member:** 403 on availability.
- **Admin UI:** inline price edit saves, a sized item's price cell is read-only, and the
  add-item form saves.
- **Header:** the admin shortcut sits centred and 44px tall on a phone, and is hidden on
  desktop.
- **`/menu` in Arabic and English:** chips, item count, search (Arabic and English) and
  no sideways scroll.
- **Homepage strip:** shows visible picks only.
- **Offline:** `/api/menu` is cached after visiting `/menu`, and the offline page lists
  it.
- **Console:** no page errors.
- **Cleanup:** `dekka_verify` was dropped, the test photo deleted and the container
  stopped. The live cluster was never touched. Screenshots in both languages were
  checked by eye, which is how the overflow bug and the cramped sections panel at phone
  width were found and fixed.

**Not verified:** a real phone, and the photo path through Vercel Blob. Locally,
uploads go to disk; Blob is the same `storeUpload()` the event posters already use in
production.

### Installable app, phase 1 of 4: PWA foundation (`PLAN/DEKKA_PWA_APP.md` §2, 2026-10-03)

The site is now installable from the browser on iPhone and Android, and when launched
from the home screen it behaves like an app: bottom tab bar, no website footer, an
offline page instead of the browser's error. `PLAN/DEKKA_PWA_APP.md` supersedes
`PLAN/DEKKA_MOBILE_APP.MD` (native Kotlin) for v1 — "download it from the website, on
iPhone too" is only possible as a PWA. A browser visitor sees the site exactly as
before, plus two "Get the app" entry points.

- **How "installed" is detected, and why it's not a component.** `EARLY_APP_SCRIPT`
  (`lib/pwa.ts`) is an inline `<head>` script in `app/layout.tsx` that sets
  `data-app="standalone"` on `<html>` from `display-mode: standalone` or iOS's
  `navigator.standalone`, *before the body paints*. `globals.css` defines a Tailwind
  `standalone:` variant on that attribute, and every installed-only style uses it. A
  React detector (what the spec's file list named) would run after hydration, so the
  website navbar/footer would flash on every launch. `<html>` carries
  `suppressHydrationWarning` for that one attribute.
- **The same script parks `beforeinstallprompt`** on `window`, because Chromium can fire
  it before hydration and an unheard event is gone. `components/InstallPrompt.tsx` reads
  it (and the platform, and a remembered dismissal) through `useSyncExternalStore` with a
  "show nothing" server snapshot, so the server never renders a banner the client then
  removes.
- **Installed shell.** `components/layout/AppTabBar.tsx` (Home / Menu / My Events /
  Account) is always in the markup and shown only by `standalone:`. It reuses
  `isActive()` from `NavLinks.tsx`, so the two navs cannot disagree. It's a grid, so
  Arabic reverses the order by itself (verified: Home is rightmost in Arabic, leftmost in
  English). The `(site)` layout pads its bottom by the bar's height plus
  `safe-area-inset-bottom`; the cookie banner and the push toast lift above the bar.
- **Service worker** (`public/sw.js`, push listeners untouched). Now registered for every
  visitor by `components/ServiceWorkerRegistrar.tsx` after `load`; `PushOptIn` goes
  through the same `registerServiceWorker()`. The rule it's built around: **nothing user-
  or role-specific is ever cached.** Pages are never cached — a failed navigation gets
  the precached `/offline` page and nothing else. `/_next/static` and images are
  cache-first with entry ceilings; `GET /api/menu` (phase 2) is stale-while-revalidate;
  every other `/api` and everything under `/admin` and `/staff` is never intercepted.
  `/offline` is precached *together with* the `/_next/static` files its HTML references,
  in one cache, so it can't be left without its stylesheet. Navigation preload is on, so
  having a worker never slows a navigation. `next dev` registers `/sw.js?cache=off`
  instead: Turbopack's dev chunks aren't content-hashed, and dev and `next start` share
  `localhost:3000`, so a production worker left over from a local build has to be
  actively replaced.
- **`next.config.ts`** serves `/sw.js` `no-cache` with the CSP from Next's PWA guide.
  `check:config` now also asserts that header survives the Sentry wrapper; a mutation
  (header changed to `max-age=3600`) made both configs fail, as intended.
- **Icons.** `npm run brand:assets` now also writes `public/icons/` (192, 512, maskable
  512, 180 apple-touch), all full-bleed cream plates — iOS paints a transparent touch icon
  black, and the logo is dark ink. Re-running regenerated every existing brand file
  byte-identically.
- **Skeletons.** In the installed app, navigations after the cold launch show
  `components/ui/PageSkeleton.tsx` (tatreez-textured bones with a sheen, `.dk-shimmer`)
  instead of the compact coffee cup; the browser keeps the cup. Picked in CSS by
  `standalone:` inside `CoffeeLoader`'s compact branch, so there's no detection to flash on.

**New files:** `app/manifest.ts`, `app/offline/page.tsx`, `app/(site)/get-app/page.tsx`,
`app/(site)/menu/page.tsx` (placeholder until phase 2), `lib/pwa.ts`,
`components/ServiceWorkerRegistrar.tsx`, `components/InstallPrompt.tsx`,
`components/InstallPanel.tsx`, `components/ReloadButton.tsx`,
`components/layout/AppTabBar.tsx`, `components/ui/PageSkeleton.tsx`, `public/icons/*`.
New i18n namespaces `t.app.*` and `t.cafeMenu.*`. **No new dependencies, no new env vars,
no schema changes.**

**Deviations from the spec, and why:**

- **The navbar stays as the installed app's top bar** instead of being replaced by a new
  slim bar. At phone width it already *is* logo + language + menu, and its menu is what
  keeps Submit-a-Show, About, the door and the admin reachable without a fifth tab.
- **The footer's column block is hidden, but its legal bar stays.** "Manage cookies" has
  to be reachable from every page, app included.
- **No `AppShell` component.** The shell is the `standalone:` variant applied to the
  existing layout.
- **Pages are network-only with the offline page as the fallback**, not
  network-first-with-cache. Caching page HTML would break the rule above.
- **New `/get-app` page.** The spec asked for "Get the app" links without naming where
  they go. It's also the natural target for the QR poster in phase 4.
- **Install strip sits under the header, not as a floating card.** The cookie banner and
  push toast already own the bottom corner, and three stacked cards cover a small phone.
- **`appleWebApp.statusBarStyle: "black"`**, not `black-translucent`. The bar then sits
  above the page rather than over it, so no screen (the auth split screen included) has
  to pad for it.
- **One pre-existing bug fixed on the way:** below the nav breakpoint, `Navbar`'s
  controls slid into the middle grid track because the hidden link pill dropped out of
  the grid. Now pinned with `col-start-3`. This changes the *browser* header on phones
  too — that is the fix, not a side effect.

**Verification.** typecheck, lint, build clean; all six `check:*` scripts pass. A
headless-Chrome script against `next start` ran 54 checks, all passing:
- **Manifest, icons, head tags and headers:** the manifest fields, every icon served as
  PNG, the `/sw.js` headers, and the manifest link, apple-touch icon, `viewport-fit`,
  theme colour and early script in the page head.
- **Service worker:** the worker controls the page after a reload.
- **Offline fallback:** a navigation to `/about` with the network off shows the offline
  page at the original URL, fully styled from cache.
- **Cache contents:** after browsing, every cache holds only static files, images and
  `/offline` — no page HTML, no private API, nothing from the back-office.
- **Browser mode on iPhone:** no `data-app`, no tab bar, footer intact. The install strip
  shows the Share hint, stays dismissed after a reload, and `/get-app` lists iPhone steps
  first.
- **Installed mode, in Arabic and English:** the attribute is set before hydration, the
  tab bar shows, the footer columns hide while the legal bar stays, and there's no
  install strip. Tab order mirrors per language, the current tab is correct, tabs are
  64px tall, and the last line of the page clears the bar.
- **Desktop:** neither the strip nor the tab bar appears.
- **Reduced motion:** the shimmer stops.
- **Console:** no hydration or console errors. The only ones were next-auth's session
  fetch while the network was off.

Screenshots in both languages were checked by eye.

**Not verified, stated plainly:**
- Installing on a **real iPhone** (Safari) or a **real Android** phone (Chrome).
- Push arriving in the installed iOS app. It needs iOS 16.4+ and was never verified on
  any device (§7).
- The Home tab's active state on `/` itself. The home page queries MongoDB, and under
  `next start` on Windows `lib/db.ts`'s DNS workaround is off by design, so DB-backed
  pages error locally in production mode. The logic is `NavLinks`' `isActive()`, which
  the desktop nav already relies on.

### Fix: PDF report's Chromium binaries missing from the Vercel deploy (2026-09-05)

Diagnosed from a Sentry email (SENTRY-BYZANTINE-YACHT-3): the first real production
hit of `GET /api/events/:id/report` — the Admin_Event_PDF.md feature — threw
`Error: The input directory "/var/task/.../@sparticuz/chromium/bin" does not exist`
the moment an admin actually clicked **Show Analysis Report** on a live deploy. This
is exactly the gap §7 had flagged as "unverified" before a real click ever happened.

**Root cause, and why `serverExternalPackages` alone didn't cover it:**
`serverExternalPackages` in `next.config.ts` is a *bundling* instruction — it tells
webpack/Turbopack not to inline `@sparticuz/chromium`'s JS into the compiled output.
It says nothing to Vercel's separate *file-tracing* step (`@vercel/nft`), which
decides which `node_modules` files actually get zipped into the deployed function.
`chromium.executablePath()` reaches its bundled binaries (`bin/*.br`, ~67MB — the
compressed Chromium build, fonts, and swiftshader) through its own internal `fs`
logic rather than a static `require`/`import`, so nft's static analysis never saw
them as a dependency and silently left all four files out of the deploy.

**Fix:** added `outputFileTracingIncludes` to `next.config.ts`, keyed to just
`/api/events/[id]/report` (escaped for picomatch as the docs specify), pointing at
`./node_modules/@sparticuz/chromium/bin/**/*`. This is the option Next.js's own docs
name for exactly this failure mode ("Next.js might fail to include required
files"). Scoped to the one route rather than every API route, since the ~67MB
shouldn't ride along on functions that never touch Chromium.

**Verified before shipping, not just reasoned through:** cloned the repo into a
throwaway sandbox with real npm-registry access, built it once with the fix and
once without, and diffed the emitted
`.next/server/app/api/events/[id]/report/route.js.nft.json` trace file directly:
0 `@sparticuz/chromium/bin/*.br` files traced without the fix (reproducing the
exact production failure), 4 traced with it. Full `npm run build` (Turbopack)
passes; `tsc --noEmit` is clean. Not verified: an actual PDF render against a real
Vercel deploy — that's the one thing this fix couldn't test from outside Vercel's
own infrastructure, so it's still worth a manual **Show Analysis Report** click
after this deploys (§9's post-deploy checklist already asks for this on every
dependency-touching deploy; keep doing it, since a version bump of
`@sparticuz/chromium` or `puppeteer-core` could reintroduce a *different* mismatch
even with this fix in place).

### Mobile auth bridge — `PLAN/DEKKA_MOBILE_APP.MD` §3, phase 1 of 10 (2026-09-02)

The backend half of the companion Android app: a native client cannot hold NextAuth's
httpOnly session cookie, so it needs a bearer token instead. This is the only genuinely
new backend piece the whole mobile plan calls for — §3 of that doc confirmed every other
endpoint the app needs already exists.

**The change is smaller than the plan expected, because of where it was made.** §3
anticipated teaching `guard()` *and* `currentUser()` about the header. In fact `guard()`
resolves its caller through `currentUser()`, and `currentUser()` can read the request's
`Authorization` header via `next/headers` without taking a parameter — so **one function
changed and no call site did.** Every already-guarded route accepts the app today,
including ones written long before the app existed. That is the payoff of §2/§5's rule
that every protected surface funnels through the same three functions.

- **New `lib/mobile-token.ts`** — `issueMobileToken()` / `verifyMobileToken()` /
  `readBearerToken()`, built on the same `@auth/core/jwt` `encode`/`decode` and the same
  `AUTH_SECRET` NextAuth uses for its session cookie. Tokens are JWE (A256CBC-HS512), so
  the claims are *encrypted*, not merely signed — verified: the member's email, id and
  phone are not recoverable from the token string.
- **The two channels use different HKDF salts, deliberately.** `encode`/`decode` derive
  their key from (`secret`, `salt`) and NextAuth passes its cookie *name* as the salt;
  this passes `"dekka.mobile-token"`. The result is that a mobile token pasted into a
  browser's cookie jar does not decrypt, and a session cookie lifted from a browser is not
  a usable bearer token — for the price of one string. Both directions are asserted in
  `check:mobile-auth`, and both were confirmed to actually fail by mutating the salt to
  match and watching the two assertions fire.
- **New `POST /api/auth/mobile-login`** — `handle()` + `parseBody()` + the standard
  `{ data }` / `{ error }` shape, like every other route here. It **shares the sign-in
  rate-limit buckets with `lib/auth.ts`'s credentials provider** rather than getting its
  own, keyed identically (`signin-ip` charged always, `signin-email` peeked then charged
  only on failure). A separate bucket would have let an attacker double their allowance
  against one account just by alternating between the app's endpoint and the website's —
  a new sign-in channel has to share the existing limits, not add a parallel set.
- **No new env var, no new collection, no new user table.** Same `User`, same
  `passwordHash`, same `role`; the app is a new *client* of the existing identity system.
- **No CORS headers, deliberately** — §3 rule 7 predicted a mobile app would tempt someone
  into adding them. It doesn't: a native Android client is not a browser and is not bound
  by the same-origin policy, so it needs none. The reasoning is written at the top of the
  route so the next person meets it before the temptation. If a *browser-based* client is
  ever built, that rule still stands: an explicit origin allowlist, never a wildcard.
- **`mobileLoginSchema`** is `.strict()` like every other schema here, and deliberately
  does *not* reuse `registerSchema`'s `password.min(8)`: this validates against an existing
  hash rather than setting a new one, so a length floor would turn a wrong-password 401
  into a confusing 400 for an older account.

**New check:** `npm run check:mobile-auth`, joining the existing five. DB-free and
network-free, covering token round-trip, payload encryption, exact 30-day TTL and enforced
expiry, salt non-interchangeability in both directions, the required `channel`/`sub`
claims, tampered / spliced / foreign-secret / junk rejection, 13 `Authorization`-header
parse cases, and the login schema. Two deliberate mutations (unifying the salts; deleting
the claim checks) were run to confirm the negative assertions actually fail rather than
passing vacuously.

**Verification.** typecheck, lint and build clean; the build manifest confirms
`/api/auth/mobile-login` resolves alongside the `[...nextauth]` catch-all rather than
colliding with it, the same way `forgot-password` and `reset-password` already do.
Exercised end-to-end against the **live cluster** with **one throwaway member, deleted
afterwards** (deletion confirmed by re-query, per `HANDOFF.md`'s standing rules — the
seed script was not touched): correct credentials return a token whose `expiresAt` is 30
days out; the response carries neither the password nor a hash; the token is accepted by
`guard("member")` on a real route and the write lands on that token's own user; junk,
empty, truncated and tampered tokens all 401; a member token on a `guard("staff")` route
gets **403, not 200**; a guest still gets 401 on both, so the cookie path is untouched;
wrong-password and unknown-email responses are **byte-identical**
(`401 {"error":"INVALID_CREDENTIALS"}`); an unlisted `role: "admin"` key is a 400 rather
than an escalation. Rate limiting was inactive during the run (no Upstash configured — it
fails open, §3 rule 8), so the buckets themselves are still unverified against a real 429,
exactly as noted in §7 for every other limited route.

**Decisions locked in for the mobile project** (`PLAN/DEKKA_MOBILE_APP.MD` §13, which
asked for these before Phase 2): **§13.1** email+password only for v1 — social sign-in is
not configured on the website either, so OAuth-in-webview would have been built on a flow
that does not yet work in a browser; **§13.2/§13.5** the app lives in its own repo beside
this one (`Websites/DEKKA-APP`), so Gradle never enters the Vercel build and this repo's
history stays website-only; **§13.4** minimum Android 8.0 / API 26, which is where
notification channels become native and so removes a compat branch from the FCM work in
phase 8. §13.3 (push delivery shape) and §13.6 (Menu sequencing) are not needed until
phases 8 and 9 and are still open.

### Pre-launch hardening - PLAN/Before_Deployment.md phases 1-5 (2026-08-31)

Five phases from the pre-launch checklist, each planned in its own `PLAN/` doc first and
reviewed before the next started. Two of them deviated from the spec; those deviations
are the most important thing in this entry, because in one case following the spec
literally would have destroyed user accounts.

**Phase 1 - Error tracking (`PLAN/observability.md`).** `@sentry/nextjs`, errors only:
`tracesSampleRate: 0` in all three runtimes, no `replayIntegration`, no
`feedbackIntegration`, `enableLogs: false`, and the webpack treeshake flags strip the
tracing half of the SDK rather than shipping it dead. New `instrumentation.ts`,
`instrumentation-client.ts`, `sentry.{server,edge}.config.ts`. `handle()` in `lib/api.ts`
gained one `captureException` tagged by route label - one call site covers every API
route, the same reason `guard()` and `parseBody()` are shared helpers. New
`app/global-error.tsx` catches a throw in the *root layout*, which `app/error.tsx`
structurally cannot (it renders inside the layout that died); it owns `<html>`/`<body>`,
uses inline styles and a system font stack, and shows both languages at once because the
locale cookie is turned into `<html lang dir>` by the very layout that failed.
`app/error.tsx`'s component was named `GlobalError` - the name of a *different* Next.js
boundary - and is now `RouteError`.

The app-specific work was scrubbing. `lib/sentry-scrub.ts` exists because this app's real
leak vector is not a field called `password`: it is `MONGODB_URI`, which is
`mongodb+srv://user:pass@host` and lands verbatim in any Mongoose connection error. No
default scrubber catches that, because it is a URI rather than a named field. The
`beforeSend` rewrites the credential half of *any* `scheme://user:pass@` - covering
Upstash Redis too - while keeping the hostname, since "which cluster failed" is the
debugging value worth preserving.

**Phase 2 - Alerts.** Mostly dashboard configuration, but with a code prerequisite that
turned out to matter. Two errors in the publish path are caught deliberately and never
rethrow (an individual `web-push` send failing, and the whole fan-out failing, wrapped so
a push problem cannot turn a successful publish into a 500). Both behaviours are correct
and unchanged - but *swallowed had become the same as unseen*: the publish succeeds, the
admin sees success, and nobody learns that nobody was notified. An alert cannot fire on
an error that never arrives, so this was a prerequisite for alerting rather than a
footnote. Both now `captureException` with a `stage` tag.

New `GET /api/health` for an external uptime monitor - the one intentionally
unauthenticated route (§3 rule 9). Capped at 5s because `connectDB()` against an
unreachable host was measured taking **30008ms** (Mongoose's default
`serverSelectionTimeoutMS`), which would leave a monitor hanging on every poll during an
outage. It deliberately does *not* report to Sentry: the monitor polling it is itself the
alerting channel, and capturing here would file ~288 duplicate issues a day during an
outage.

**Phase 3 - Rate limiting (`PLAN/rate-limiting.md`).** Upstash Redis, not an in-memory
counter: every Vercel invocation is a separate process, so an in-memory limit of 5 is
really 5 *per instance*. `lib/ratelimit.ts` is shaped like `guard()` and holds all eight
limits in one table, so no route hardcodes a number.

*Deviation:* `Before_Deployment.md` §4 names `POST /api/auth/[...nextauth]` as the top
target. That file is `export const { GET, POST } = handlers` - one catch-all also serving
session, CSRF, sign-out and every OAuth callback - so limiting it would throttle far more
than sign-in. The limit lives in the Credentials provider's `authorize()` instead, which
runs exactly once per attempt and has the submitted email in hand, so it can key per
account. Two sign-in buckets: per-email (targeted brute force) and per-IP (spraying many
accounts). The email bucket is *peeked* before the password check and *charged* only on
failure, so signing in legitimately on several devices does not burn your own allowance -
but it is charged for unknown addresses too, so it cannot become an oracle for which
emails have accounts. A throttled attempt throws `CredentialsSignin` with code
`RATE_LIMITED` rather than returning `null`, because telling someone "invalid
credentials" while actually throttling them makes them retype a correct password harder.

**Phase 4 - Password reset (`PLAN/password-reset.md`).** `randomBytes(32)` hex tokens
stored as SHA-256 (never raw), compared with `timingSafeEqual`, 30-minute expiry checked
in code, single-use, and superseded by any newer request. SHA-256 rather than bcrypt
deliberately: bcrypt is slow because *passwords* are low-entropy, and a 256-bit random
token has nothing to brute force, so the slow hash would buy nothing while adding latency
to a path that is also an enumeration-timing surface. The reset write matches on
`{ _id, resetTokenHash }`, so two requests racing the same link cannot both succeed. No
enumeration anywhere: an identical 202 for an address with an account, without one, with
an OAuth-only account, and on send failure - with both rate-limit buckets charged
*before* the lookup so timing does not diverge either. `lib/email.ts` is a thin `fetch`
wrapper over Resend rather than the SDK, plain text only, bilingual.

*Deviation, and the important one:* §5 and §7 both call for **a MongoDB TTL index on
`resetTokenExpiresAt`**. Applied to the `User` collection that instruction **deletes user
accounts** - a TTL index removes the whole document, never one field, so every member who
ever requested a reset would be silently deleted 30 minutes later. It would have passed
testing; the damage lands half an hour after anyone stops watching. Rejected, with the
reasoning recorded in `models/User.ts` at the point of temptation, and the live-cluster
check explicitly asserts the user document survives.

**Phase 5 - Three audits.** §1 (ownership): every route touching user-owned data was
checked and all are correct. `DELETE /api/reservations/:id` compares `reservation.user`
to `currentUser().id` with an admin escape; both `/api/account` routes act on
`auth.user.id` and never take an id from the body; `DELETE /api/push/subscribe` scopes to
`user`, so a guessed endpoint cannot unsubscribe someone else's device. Staff/admin
routes that legitimately act on other people's rows (check-ins, events) are role-only by
design and were left that way - §7 of the checklist is explicit that adding ownership
checks there would be wrong. §2 (validation): no route reads `request.json()` outside
`parseBody`, and every dynamic route validates its ObjectId first. **One real gap:**
`submissionUpdateSchema` feeds a `findByIdAndUpdate` but was not `.strict()` - the only
`$set`-feeding schema that was not. Not exploitable today (the route copies its two
fields across by hand rather than spreading) but the convention exists precisely so
safety does not depend on the call site staying written that way; fixed, along with
`submissionSchema`. §7 (indexes): every index listed in the checklist exists on the live
cluster, and **no TTL index exists anywhere**. Found four redundant single-field indexes
- see §7 Known Gaps - and left them alone, since dropping them is a live-DB write and the
audit was read-only.

**New dependencies:** `@sentry/nextjs`, `@upstash/ratelimit`, `@upstash/redis`.

**New env vars:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
`SENTRY_AUTH_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`RESEND_API_KEY`, `EMAIL_FROM`. Every one is optional: absent, the feature it powers
switches itself off rather than half-working - the same rule `enabledOAuthProviders`
already followed. The one place that rule bites is rate limiting, where "off" means
unprotected; hence the boot warning and the Sentry report (§3 rule 8).

**New checks:** `npm run check:sentry`, `check:config`, `check:ratelimit`, `check:reset`,
joining the existing `check:uploads`.

**Verification.** typecheck, lint and build clean throughout, and the build was run both
with *and without* the Sentry env vars, since the wrapped config is what production
actually uses. `check:config` exists because that comparison found Sentry **appends 22
packages of its own** to `serverExternalPackages` - ours survive, but a future upgrade
changing that would break the event-report PDF route in production with a build that
still passes. Sentry was proven end-to-end against a real DSN: a test event arrived in
the project, and the scrubber was confirmed on the wire (a deliberately embedded password
left the process as `mongodb+srv://[redacted]@dekka.abc12.mongodb.net/dekka`). The reset
flow's database guarantees were exercised against the live cluster with **one throwaway
user, deleted afterwards** (cleanup confirmed): `select: false` holds, a new request
supersedes the old token, single-use is enforced (a second spend modifies 0 documents),
the fields clear on success, and the user document is not deleted. The index audit was
read-only.

**Not verified, stated plainly:** no real 429 has been observed (no Upstash account
exists), no email has been delivered (no verified sending domain), and
`@sparticuz/chromium` on a real Vercel deploy remains untested from before. All are in
§7.

### Event analysis report — "Show Analysis Report" — `PLAN/Admin_Event_PDF.md` (2026-08-30)

A green **"Show Analysis Report"** button
(`components/ShowEventReportButton.tsx`, `Button variant="success"`) in the
action row on `/admin/events/[id]`, next to Duplicate, rendered by the page
only when `event.status` is `happened` or `archived`. One click opens
`/api/events/:id/report` in a new tab, which streams a freshly-built PDF
(`Content-Type: application/pdf`, `Content-Disposition: inline`). Admin-only via
`guard("admin")` on the one new route.

**Scope note — the plan was deliberately trimmed after the first build.** The
locked plan called for a Google Sheet *and* a PDF, both persisted in a shared
Drive folder via a cafe service account, refreshed in place on every click. The
owner then cut all of that: no Google account, no Sheet, no service account, no
stored files — just "build the PDF and open it in a new tab." So the report is
generated on demand every click and streamed straight back; there is nothing to
store and therefore no duplication to avoid. `Cache-Control: no-store`.

- **New route:** `GET /api/events/:id/report` (`runtime = "nodejs"`,
  `dynamic = "force-dynamic"`, `maxDuration = 60`). `guard("admin")` → status
  must be `happened`/`archived` (else `409 REPORT_NOT_AVAILABLE`) → gather data
  → analytics → view → HTML → PDF → return the bytes as `NextResponse`.
- **New read path:** `getEventReportData(eventId)` in `lib/data.ts` — one
  `$lookup` aggregation (Event ⨝ CheckIn ⨝ confirmed Reservation) then a plain
  in-memory merge into the one-row-per-person list of §5: every confirmed
  reservation becomes `attended` or `no-show`, every check-in not consumed by a
  reservation becomes `walk-in` (covers `reservation: null` and check-ins whose
  reservation was later cancelled). No new collection; same join shape as
  `getEventReservations`, widened.
- **`lib/report/`** (new folder): `analytics.ts` (pure §6 math — money split,
  no-show/walk-in rates, half-hour arrival buckets in cafe time; same input
  always gives the same output, so it's checkable against the door table by
  hand), `view.ts` (one locale-shaped view model — `buildReportView()` — that
  also bakes the chart series + legends so `html.ts` stays presentation-only),
  `html.ts` (report HTML: a headline 4-stat band, an inline-SVG arrivals bar
  chart, two CSS 100%-stacked bars for the payment / attendance split, a
  3-column details grid and the roster table — all hand-built, no chart
  library; Cairo embedded as a data URI; palette is one gold accent + green /
  terracotta for data, RTL-mirrored for Arabic), `pdf.ts` (HTML to PDF).
- **No new `Event` field.** The plan's §10 "remember the Sheet/PDF location"
  question is moot once nothing is stored — every click regenerates from live
  reservation/check-in data.
- **New `CheckIn.gender`** (`"male" | "female" | null`, optional, `enum` in
  `lib/constants.ts` as `GENDERS`). Staff-entered at the door — a dropdown in
  `DoorTable`'s quick-entry form and an editable column in its `DataGrid`;
  threaded through `checkInSchema` / `updateCheckInSchema`, both check-in
  routes, and `CheckInDTO`. The report adds a **Gender** column to the roster
  and a third stacked bar (Female / Male / Not recorded) beside Payments and
  Attendance, plus `analytics.gender` counts over everyone through the door.
  Reason: the owner runs female-only nights and wants to confirm the room at a
  glance. No-shows and un-recorded entries show "—".
- **New dependencies:** `@sparticuz/chromium` (^149) added to `dependencies`;
  `puppeteer-core` (^25) **moved** devDeps → deps (the report route imports it
  at runtime now, not just `scripts/shoot.mjs`). `next.config.ts` gains
  `serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"]` (both are
  already on Next's auto-external list — pinned explicitly so a native binary is
  never traced into the bundle). No Google SDK — `google-auth-library` was added
  in the first build and removed in the trim.
- **New env var:** `LOCAL_CHROME_PATH` (`.env.example`) — optional, local dev
  only, points `pdf.ts` at an installed Chrome when it isn't at the per-OS
  default. Nothing else; no credentials of any kind.
- **New `Button` variant:** `success` (green, `bg-good text-white`), mirroring
  `danger`. `components/ui/Button.tsx`.
- **i18n:** new `t.admin.eventReport.*` block (ar + en) — the button label plus
  every heading / column / status label inside the report document. Nothing
  hardcoded.
- **New vendored asset:** `lib/report/fonts/Cairo.ttf` (the OFL variable font,
  already the app's Arabic face) — see the PDF decision below.

**§10 decision 1 — Google Cloud project.** Resolved then dropped. The finding
still holds and is worth keeping on record: the project started for "Sign in
with Google" (HANDOFF.md §2) *can* be reused for other Google APIs — enabling an
API and adding a service account are project-scoped, additive actions that don't
touch the existing OAuth client or consent screen. It just isn't needed here any
more, because the owner removed the Sheet/Drive half of the feature.

**§10 decision 2 — PDF generation: real headless Chromium, not a browser-free
library.** `puppeteer-core` (already present for `scripts/shoot.mjs`) + a Linux
Chromium from `@sparticuz/chromium` on Vercel/Lambda; locally it falls back to
the installed Chrome (`LOCAL_CHROME_PATH` or the per-OS default — the same binary
`shoot.mjs` drives; picked via `process.env.VERCEL` / `AWS_LAMBDA_*`). Reason:
the §5 people list is full of real guest names, which at Dekka are overwhelmingly
Arabic. `pdfkit`/`pdf-lib`/`@react-pdf/renderer` do **no** Arabic glyph shaping
or bidi and would render those names as broken, reversed letters — useless for a
list whose purpose is phoning guests. Chromium shapes Arabic and mixed RTL/LTR
natively. The route is admin-only and rarely hit, so Chromium's cold-start /
bundle cost never touches a guest path. Cairo is embedded in the report HTML as
a base64 data URI (not a `<link>`) so Arabic still renders on a serverless
Chromium whose system font set has little Arabic coverage, with no network
dependency at render time.

**Verification:** typecheck + lint + `next build` clean. The data → analytics →
view → PDF pipeline was exercised against real `happened` events' real
production data (read-only, no DB writes, seed script untouched) — the merge,
the §6 numbers, and both the English and Arabic PDFs (Arabic shaping correct)
verified by eye. Not exercised here: `@sparticuz/chromium` on an actual Vercel
deploy (local runs use installed Chrome) — see Known Gaps.

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
  `scripts/set-role.ts <email> <role>` — and (since 2026-10-08) the change reaches their
  open session within about five minutes, through the session re-check.
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

## 9. Deployment & rollback

`main` auto-deploys to production through Vercel's GitHub integration — §6's
"commit directly to `main`" rule means every commit is a candidate release. There
is no staging environment and no test suite, so the checklists below are the gate.

### Before every push to `main`

- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds locally
- [ ] `npm run check:all` passes (it runs every `check:*` script in `package.json`, so
      a new check is included as soon as its script entry exists). CI
      (`.github/workflows/ci.yml`) runs the same list plus a build on every push to
      `main`; a red run there means "roll back", since the deploy has already started.
- [ ] Manually exercise the code path you changed against a real `happened` event
      or a throwaway document — `MONGODB_URI` is the live cluster, so treat every
      write as real (`HANDOFF.md` "Standing rules")
- [ ] Any new or changed `Event`/`User`/etc. field is **additive and optional** —
      never a rename or a required-field addition in the same deploy. This is what
      keeps a rollback data-safe: an older deployment ignores a newer optional
      field it doesn't know about, and never crashes on data a newer version wrote.
- [ ] Any new env var is set in **Vercel's** environment variables, not just
      `.env.local`. A missing env var fails at runtime, not at build, so the
      checklist above won't catch it — and several features degrade silently to
      "off" when their var is absent (rate limiting → unprotected, §3 rule 8;
      password-reset email → dormant, §7; Sentry → no error tracking). "The deploy
      is green" is not proof they work.

### Immediately after a deploy that touched auth, reservations, uploads, or the report

- [ ] Sign in with credentials
- [ ] Sign in with Google (if `AUTH_GOOGLE_*` is configured)
- [ ] `POST /api/auth/mobile-login` returns a token, and that token is accepted as
      `Authorization: Bearer` on a guarded route — `AUTH_SECRET` differing between
      environments is the failure mode here, and it fails as a plain 401 with nothing
      in the logs to say why
- [ ] Create a reservation and confirm it appears on the staff door table
- [ ] Open an event's **Show Analysis Report** and confirm the PDF renders —
      this broke once in production already (§7, fixed 2026-09-05) because file
      tracing is what actually needs to catch `@sparticuz/chromium`'s binaries, not
      just bundler externalization, so re-check after *any* deploy that changed
      dependencies, not just report code
- [ ] If email is live: request a password reset, confirm the mail arrives, the
      link works, and it's rejected after 30 minutes or on a second use
- [ ] If `public/sw.js`, `app/manifest.ts` or the `standalone:` styles changed: on a
      phone, open the site and confirm the installed app still launches, the tab bar
      shows, and airplane mode lands on `/offline` (`PLAN/DEKKA_PWA_APP.md` §2)

### Rolling back

Vercel deployments are immutable and pushing to `main` never deletes the previous
one, so a rollback is a platform action, not a rebuild:

1. Vercel dashboard → the project → **Deployments**.
2. Find the last deployment known healthy (the one before whatever broke).
3. Its "…" menu → **Promote to Production**. Works on every Vercel plan — the
   "Instant Rollback" button is a Pro-plan shortcut for the same action, not a
   different capability.
4. From a terminal instead: `vercel rollback` (prompts for the deployment) —
   useful if the dashboard is slow to load during an incident.
5. **This reverts code, not data.** If the bad deploy already wrote bad data,
   promoting an older deployment does not undo those writes — that's a separate
   manual fix against the live cluster.
6. Re-run the post-deploy smoke test against the **restored** deployment before
   treating the incident as closed.

**Not yet drilled:** do one practice rollback against a harmless deploy while
there's no pressure, so the first real one isn't learned live.

---

## 10. Quick Reference — adding a typical CRUD feature

The menu (`app/api/menu/**`, `components/menu/`) and templates (`app/api/event-templates/**`,
`components/templates/`) are the most recent complete examples of this recipe — copy
their shape.

1. **Model:** add a schema in `models/` (new collections over changing existing ones —
   §9's rollback rule), exporting types + re-exported constants. Enums go in
   `lib/constants.ts`. Only index real query shapes (§4).
2. **Validation:** in `lib/validation.ts`, a `core` object of field schemas;
   `create = z.object(core).strict()`;
   `update = z.object(stripDefaults(core)).partial().strict()` (§2). Never put `order`,
   `status` or ownership fields in a schema a client can send unless they're meant to
   be set.
3. **API route(s):** `app/api/<resource>/route.ts` (+ `[id]/route.ts`, + `order/route.ts`
   if it's reorderable). Always `handle()` wrapping `guard()`/`currentUser()`, then
   `parseBody()`; `{ data }` / `{ error }`; machine-readable error codes
   (`STALE_ORDER`, `CATEGORY_NOT_EMPTY`) where the UI must react differently.
4. **Read helper + DTO** in `lib/data.ts` if the screen needs more than one
   `findById`. One aggregation, no N+1.
5. **Pages:** `app/(site)/<route>/page.tsx` (server) handing data to one client
   "manager" component; built from `PageHeader` + `Card` + `ui/` primitives (`DataGrid`
   for spreadsheet-style editing); `.dk-workspace` for staff/admin; admin pages get a
   sidebar link in `app/(site)/admin/layout.tsx`.
6. **i18n:** both `ar` and `en` keys in `lib/i18n/dictionaries.ts`, in a namespace of
   the feature's own. The type-check fails if you only add one.
7. **A DB-free check script**, `scripts/check-<feature>.ts` + `npm run check:<feature>`:
   schema edges, the strict/default-free updates, and guard rank read from the route
   sources. Then **deliberately break** what it guards (drop `stripDefaults`, downgrade
   a guard) and confirm it fails — then restore.
8. **Verify for real** against a local throwaway database (§11): typecheck, lint, build,
   the checks, an end-to-end run, and screenshots in both languages at phone and desktop
   width, **looked at**.
9. **Write it down:** a Feature Log entry (§8) with files, deviations from the spec and
   why, and a plain "Verification" / "Not verified" paragraph; Known Gaps (§7) for
   anything deferred; and §0's status table.

---

## 11. Verifying changes locally (without touching live data)

`npm run dev` and `.env.local` point at the **production** Atlas cluster, so any test
that writes needs a different database. This is the routine phases 2 and 3 used. Every
step was safe to repeat.

**1. A local MongoDB.** The repo's `docker-compose.yml` defines `dekka-mongo` (`mongo:7`,
port 27017). The container already exists on the owner's machine with their own local
`dekka` database in it — **leave that alone**; use a separate throwaway database,
`dekka_verify`. Docker Desktop is usually *not* running: start it, wait for
`docker version --format '{{.Server.Version}}'` to print a version, then
`docker start dekka-mongo`. (Docker Desktop may also auto-start another project's
container, `incarnatrun-postgres` — not ours, don't touch it.)

**2. A production build pointed at it.** Environment variables set on the command line
override `.env.local`:

```bash
npm run build
MONGODB_URI='mongodb://127.0.0.1:27017/dekka_verify' AUTH_URL='http://localhost:3100' \
  node node_modules/next/dist/bin/next start -p 3100
```

`AUTH_URL` must match the port, or sign-in redirects to the wrong one. `.env.local`
configures no Blob, Upstash, Sentry or email keys, so uploads go to local disk and
nothing reaches a live service.

**3. Prove the server is on the throwaway database before the first write.** Insert a
marker with `mongosh` (e.g. a `menucategories` + `menuitems` pair named `VERIFY-MARKER`)
directly into `dekka_verify`, then `curl http://localhost:3100/api/menu`. It may only
proceed if the marker comes back. Remove the marker afterwards.

**4. Accounts.** Register throwaway users through `POST /api/register`
(`…@dekka-verify.test`), then set roles directly in `dekka_verify` with `mongosh`
(`db.users.updateOne({email}, {$set: {role: "admin"}})`). Sign in through the real
`/login` page in the browser.

**5. Drive it with headless Chrome.** `puppeteer-core` is a dependency, and Chrome is at
`C:/Program Files/Google/Chrome/Application/chrome.exe` (forward slashes — backslashes
get mangled in shell heredocs). Write the scripts in the session scratchpad, not the
repo, loading puppeteer with
`createRequire("D:/4) projects/Websites/DEKKA-EVENTS/package.json")`. Chrome only
launches from a non-sandboxed shell. Make API calls with `page.evaluate(fetch…)` so the
session cookie rides along. Set React-controlled inputs with the native value setter
plus an `input` event. Accept the cookie banner before screenshots. Read Mongo results
with `EJSON.stringify(…, {relaxed: true})` and unwrap `$oid`/`$date`.

**6. Things that look like bugs but aren't:**
- A photo uploaded during a `next start` run 404s until the server restarts. `next
  start` only serves `public/` files that existed at boot; production uses Vercel Blob.
- A full-page screenshot can show the RTL page shifted sideways after a smooth
  `scrollIntoView`. Measure `scrollWidth` and take a plain capture before believing it.

**7. Production mode without step 1:** `next start` *with* `.env.local` can't reach Atlas
on this Windows machine (the DNS workaround in `lib/db.ts` is dev-only), so
database-backed pages error. For browser-only checks (service worker, layout) use
`/about`, `/menu` or `/get-app`.

**8. Clean up, every time:**
- Stop the server. Stopping a background `next start` can orphan the `node` process
  holding the port, so check `Get-NetTCPConnection -LocalPort 3100` and confirm the
  command line before `Stop-Process`.
- `db.dropDatabase()` on `dekka_verify`, then confirm the remaining databases are still
  `admin, config, dekka, local`.
- Delete only the upload files your run created.
- `docker stop dekka-mongo`, and `docker desktop stop` if you started Docker Desktop.

If a commit then fails with "Another git process seems to be running", there's a stale
`.git/index.lock` (it has happened twice). Confirm no `git.exe` is running and that
the lock is old and empty before deleting it.
