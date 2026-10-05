# Dekka — Installable App (PWA) + Menu + Event Templates

Written 2026-10-03 after a brainstorm with the owner, against the live codebase
(`developer-guide.md`, every file in `PLAN/`, `lib/*`, `models/*`, `public/sw.js`) and
Next.js's bundled docs (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`,
`.../metadata/manifest.md`), per `AGENTS.md`.

**This supersedes `PLAN/DEKKA_MOBILE_APP.MD` for v1.** That doc planned a native Kotlin/Compose
Android app in a separate repo. The requirement changed to "customers download it from the
website, on iPhone and Android" — which is only possible as an installable web app (PWA): iOS
cannot install a native app from a website. The native plan is parked, not deleted; its auth
bridge (`POST /api/auth/mobile-login`) stays in the codebase unused by v1.

No branches, no worktrees — everything commits to `main` (`developer-guide.md` §6).

**Status:** Phases 1 (§2, PWA foundation), 2 (§3, cafe menu) and 3 (§4, event
templates) shipped 2026-10-03/04. What was built, where each deviates from this spec and
why, and what's still unverified on real phones are in `developer-guide.md` §8
("Installable app, phase 1/2/3 of 4"). §8's open question about daytime activities was
built as assumed: they're ordinary events, marked `activity` on the template. Phase 4
(extras) is planned in §5 (2026-10-05) as three sub-phases, 4a → 4b → 4c, and awaits the
owner's approval and the answers in §5.5.

---

## 0. Decisions locked in

| # | Question | Decision |
|---|---|---|
| 1 | Delivery | **PWA** — the existing Next.js site is the app. Installed from the website. iPhone + Android from one codebase. No stores in v1; a Capacitor wrapper stays possible later without rework. |
| 2 | Technical approach | **A** — Next's `app/manifest.ts` + extend the existing hand-written `public/sw.js`. No new dependency (rejected: Serwist, precache-everything plugins). |
| 3 | App look | Same Dekka brand, **app-style shell only when installed** (`display-mode: standalone`). Browser visitors see today's site unchanged. |
| 4 | Menu scope | **Browse-only**, with optional size variants. No ordering, no cart, no payment. |
| 5 | Menu permissions | Admin edits everything. **Staff may only toggle Sold out.** |
| 6 | Templates | Saved **event templates**: pick a template, pick a date, done. **No recurrence engine.** |
| 7 | "Impress the owner" | All four bundles selected, phased (§7). |
| 8 | Timeline | No fixed date — build in dependency order. |

---

## 1. Sub-projects and order

Each gets its own plan and build cycle, stopping for review between them.

1. **PWA foundation** (§2) — blocks nothing but is the visible base for everything.
2. **Cafe menu** (§3) — extends `HOME_PAGE.md` §3, which specified the same feature.
3. **Event templates** (§4) — independent of 1 and 2; can be built in parallel.
4. **Extras** (§5).

---

## 2. PWA foundation

**Files:** `app/manifest.ts`, `app/layout.tsx` (viewport + apple meta), `public/sw.js` (extended),
`components/StandaloneDetector.tsx`, `components/AppShell.tsx`, `components/AppTabBar.tsx`,
`components/InstallPrompt.tsx`, `app/offline/page.tsx`, icons via `npm run brand:assets`.

### Manifest
`name` "دكة / Dekka", `short_name` "Dekka", `start_url: "/"`, `display: "standalone"`,
`dir`/`lang` follow default `ar`, `background_color`/`theme_color` from `ink-black`, icons
192 / 512 / **maskable** 512. Icons are generated from the existing logo **on the cream plate**
(design-system rule: the dark-ink logo disappears on `ink-black`). `sharp` is already a dev dep.

### Installed-mode detection
A client component reads `matchMedia("(display-mode: standalone)")` plus `navigator.standalone`
(older iOS) and sets `data-app="standalone"` on `<html>`. Everything installed-only keys off that
attribute, so the browser site is unchanged.

### Shell when installed
- **Bottom tab bar:** Home `/` · Menu `/menu` · My Events `/my-events` · Account `/account`.
  Icon + label, ≥48px targets, active state via the existing `tabIndicator` motion preset,
  logical properties only so Arabic RTL mirrors automatically. Admin/staff reach their screens
  from inside Account (no fifth tab).
- Desktop `Navbar`/`Footer` hidden; a slim top bar keeps logo + `LocaleToggle`.
- `viewport-fit=cover` and `env(safe-area-inset-*)` padding so nothing sits under the notch/home bar.
- Skeleton loaders (tatreez `PatternAccent` shimmer, per `FIX_ADMIN_DASH.md` §1) for in-app
  navigations; `CoffeeLoader` full variant remains the cold-launch splash. All reduced-motion aware
  via the existing required-`reduced`-argument convention in `lib/motion.ts`.

### Install prompt
- **Android/desktop Chromium:** capture `beforeinstallprompt`, show a branded dismissible banner
  with a real Install button. *Progressive enhancement only* — Next's docs note this event is not
  cross-browser.
- **iPhone Safari:** no install API exists; banner shows the two-step "Share → Add to Home Screen"
  instruction, bilingual.
- Never shown when already standalone; dismissal remembered (localStorage, try/catch). A permanent
  "Get the app" link in the footer and on `/account`.

### Service worker (extends `public/sw.js`; push listeners untouched)
- **Never cached:** anything under `/api/*` that is user- or role-specific, and every `/admin`
  and `/staff` page. The site is `force-dynamic` and per-user; caching HTML aggressively would
  serve stale capacity and wrong accounts.
- Pages: network-first → `/offline` fallback. Static assets, fonts, uploaded/menu images:
  cache-first. `GET /api/menu`: stale-while-revalidate.
- Versioned cache name; old caches deleted on `activate`. Registration moves from "on demand in
  `PushOptIn`" to a single idempotent registration that both features share.
- `next.config.ts` gets a headers rule for `/sw.js` (`Cache-Control: no-cache`, per Next's docs).
  **Run `npm run check:config`** — Sentry's wrapper rewrites this file's output and that script
  exists to catch it.

---

## 3. Cafe menu

Follows `PLAN/HOME_PAGE.md` §3; adds variants, tags and the staff toggle.

### Models (new collections only — nothing existing changes)
**`MenuCategory`:** `nameAr`, `nameEn` (required), `order`, `isActive`.
**`MenuItem`:** `category` (ref), `nameAr`, `nameEn`, `descriptionAr?`, `descriptionEn?`,
`price`, `variants[]?` `{ labelAr, labelEn, price }`, `image?`, `tags[]?` (enum in
`lib/constants.ts`: vegan, hot, cold, …), `isFeatured`, `available`, `order`.
Index `{ category: 1, order: 1 }` only. Enums live in `lib/constants.ts`; clients never import
`@/models/*`.

### API (`handle()` + `guard()` + `parseBody()`, `{ data }` / `{ error }`)
- `GET /api/menu` — public, one `lib/data.ts` helper returning categories + items in one query.
- Category/item `POST` / `PATCH` / `DELETE` — `guard("admin")`, `.strict()` Zod schemas. Update
  schemas go through `stripDefaults()` (the Event "Publish wipes content" bug, `developer-guide.md`
  §8, applies to any defaulted field such as `available`/`isFeatured`).
- `PATCH /api/menu/items/[id]/availability` — `guard("staff")`, body `{ available: boolean }`
  only. Separate narrow route so staff cannot reach price or text.

### Screens
- `/admin/menu` — `.dk-workspace`; category list with reorder; items grouped by category in the
  existing `DataGrid` (inline price edit); availability toggle per row; add/edit form with
  AR+EN names, variants, tags, featured, photo upload via the existing `/api/uploads`
  (admin-guarded today — sufficient).
- `/staff/menu` — only the sold-out toggles.
- `/menu` — sticky category chips, cards, search. Sold-out items stay visible, greyed, labelled.
  No-photo cards are text-forward — never a broken image.
- Homepage — "Featured" strip + "View full menu".
- i18n under a new `t.cafeMenu.*` namespace (the existing `t.nav.menu` means the hamburger menu).

---

## 4. Event templates

**Problem:** today the admin Duplicates an event (+7 days) then re-edits by hand; there is no
library of "the nights and activities I run".

### Model — `EventTemplate`
The reusable half of `Event`: `nameAr`/`nameEn` (the button label), `kind`
(`night` | `activity`, display only), `titleAr/En`, `descriptionAr/En`, `locationAr/En`, `mapUrl`,
`coverImage`, `isPoster`, `price`, `capacity`, `paymentMethods`, `instapayNumber`, `termsAr/En`,
`defaultTime` (`"HH:mm"`, cafe timezone), `order`. **Not stored:** `startsAt` date, `status`,
`doorsOpenAt` (hidden in the form since `fix_Events.md`).

### Flow
- `/admin/events` and `/admin/events/new` show a row of **template buttons** at the top.
- Click one → small sheet with a date picker (time pre-filled from `defaultTime`) and Create →
  event is created as a **draft** with every field pre-filled, admin lands on its page.
  **Draft, not published,** so the existing Publish transition (and its one-time push fan-out)
  stays the single path that notifies members — no duplicated notify logic.
- **"Save as template"** button on any existing event page: captures that event's fields
  (minus date/status) — the fastest way to build the library from past nights.
- **Template manager** (`/admin/templates`, small): list, edit, reorder, delete.
- API: `POST /api/events/from-template` takes `{ templateId, date }` only — the server does the
  merge, so the client cannot inject extra event fields. Template CRUD is `guard("admin")`,
  `.strict()`, `stripDefaults()` on update. Reuses `lib/format.ts` helpers so "20:00" means 20:00
  Cairo regardless of where the admin sits.
- Same screens serve "the website" and the installed app — the admin dashboard is the website.

---

## 5. Extras (phase 4) — planned 2026-10-05, awaiting the owner's approval

**The original brief** (kept for traceability): *Event night* — add to calendar (`.ics`), a
"Tonight at Dekka" home banner, WhatsApp share with a rich card (an OG image per event), a large
door code on My Events. *Cafe life* — "Barista's pick" badge, "Open now / closes at", one-tap
directions, scheduled seasonal sections. *Owner wow* — privacy-safe counters (menu item views,
install prompt shown/accepted), a printable QR poster, a demo mode for the pitch. *Push* — never
verified on a real device; verify before promising it.

Three sub-phases, built in this order. **Each one stops for review** before the next starts. Each
ends with typecheck, lint, build, `check:config`, `check:menu`, `check:templates` and its own new
check script (mutation-tested), an end-to-end run on the local throwaway database
(`developer-guide.md` §11) in both languages at 390px and 1280px with the screenshots looked at, a
commit to `main`, a Feature Log entry, and updates to §0 and §7 of the guide.

### 5.0 What already exists (checked against the code, 2026-10-05)

| Brief item | Today | So the plan… |
|---|---|---|
| Door code on My Events | Shown at 24px (`text-2xl`, mono) in the corner of each card; 30px on the event page after reserving. Readable by the guest, too small to hold up to staff in a dim cafe. | Adds a full-screen "show at the door" view (4a). |
| "Barista's pick" badge | **Already on every menu card**: `MenuItemCard` shows a gold `t.cafeMenu.baristaPick` badge when `isFeatured`. The offline menu is text-only by design. | **Nothing to build.** Dropped from 4b. |
| Opening hours | Free text only (`site.hoursAr/En`, "Daily, 10am – 1am"), env-overridable. | Adds structured hours next to it (4b). |
| Directions | "Get directions" on /about and the event page opens `site.maps`, a Google Maps *place* link: the place page, then a second tap for directions. | Adds a true one-tap directions link (4b). |
| OG / share metadata | None. No `metadataBase`, no `generateMetadata` anywhere, no `opengraph-image`. | 4a. |
| Font for images | `lib/report/fonts/Cairo.ttf` exists (OFL, for the PDF report) but it's a **variable** font, and `next/og`'s bundled Satori (0.25.0, via `@vercel/og` 0.11.1) **crashes parsing it** (`parseFvarAxis`). Tested. | 4a ships a static instance (below). |
| Rate limiting | `lib/ratelimit.ts`, one `BUCKETS` table, fails open, IP via `clientIp()`. | New buckets for every new public route. |
| Privacy wording | `/privacy` says "this site runs no analytics or advertising tools of any kind"; `/cookies` has a "No analytics, no advertising" section. | 4c **must** reword both (drafts below) or the counters contradict them. |
| Seasonal sections | `MenuCategory` has `isActive` only. | 4b adds optional dates. |

### 5.1 Cross-cutting decisions (apply to all three sub-phases)

- **New public routes join §3 rule 9's list** (`/api/health`, `GET /api/menu`), on the same
  terms: they return only what any guest can already see, **never vary by who is asking** (so
  nothing role-specific can be cached anywhere), and are rate-limited per IP with their own
  bucket in `lib/ratelimit.ts`. The rule-9 text and `check-*` source assertions are updated so
  "every other route is guarded" stays checkable.
- **`site.url`** — one absolute origin in `lib/site.ts`: `NEXT_PUBLIC_SITE_URL` or
  `https://dekka-events.vercel.app` (README's live URL). Used for `metadataBase`, share links, the
  calendar entry's URL and the QR poster. Local verification builds set it to
  `http://localhost:3100`.
- **One event length.** Events store no end time. `EVENT_DEFAULT_DURATION_MIN = 180` in
  `lib/constants.ts` is the one place the calendar entry's end and the "Tonight" banner's "on now"
  window both come from. *(Owner question Q3.)*
- **Service worker:** the new routes live under `/api/*`, which `sw.js` never touches, so 4a and
  4c don't change caching. 4b changes what `/offline` imports, so it bumps `VERSION` to `v3`.
- **No new dependencies**, with one open question: the QR encoder (Q1).
- All new strings in `ar` + `en`, Arabic drafted first. Guest-facing copy is warm and colloquial,
  admin copy plain (`design-system/06-tone-of-voice.md`). Every tappable thing is at least 44px.

---

### 5.2 Sub-phase 4a — Event night

#### 4a.1 Add to calendar

- **Where:** the event page's reserve card (upcoming, public events only) and each upcoming card
  on My Events.
- **What:** a native `<details>` disclosure ("Add to your calendar", no JavaScript needed) with
  two choices:
  - **".ics" → `GET /api/events/:id/calendar?lang=ar|en`.** This opens the Calendar sheet on
    iPhone and imports into Outlook, Apple Calendar and Samsung Calendar.
  - **"Google Calendar"**, a plain `calendar.google.com/calendar/render?action=TEMPLATE…` link.
    It's there because the Google Calendar app on Android **can't open `.ics` files**, so an
    .ics-only button dead-ends for most Android users. *(Owner question Q3.)*
- **The .ics** is built by the pure `buildIcs()` in `lib/calendar.ts`:
  - **Times:** `DTSTART`/`DTEND` in UTC (`…Z`), so there's no `VTIMEZONE` block. The end is
    start + `EVENT_DEFAULT_DURATION_MIN`.
  - **Identity:** `UID: <eventId>@<host>`, so re-adding updates the entry instead of
    duplicating it. `DTSTAMP` is now.
  - **Text:** `SUMMARY` is the title in `lang`. `DESCRIPTION` is the first 300 characters of
    the description plus the event URL. `LOCATION` is the event's location text, or
    "دكة — الإسكندرية، مصر" / "Dekka — Alexandria, Egypt". `URL` is the event page.
  - **Reminder:** a `VALARM` two hours before.
  - **Format:** CRLF line endings, lines folded at 75 octets (counted in UTF-8 bytes, so Arabic
    is never split mid-character), and `\ , ; newline` escaped.
- **Route:** `app/api/events/[id]/calendar/route.ts`.
  - **Access:** public-statuses only (`published`, `closed`, `happened`, `archived`). Drafts
    and unknown ids get 404 *for everyone*, admins included, so the response never varies by
    caller.
  - **Input:** `lang` is validated with a Zod enum, defaulting to `ar`.
  - **Rate limit:** `calendar-ip`, 30 per 10 minutes.
  - **Headers:** `Content-Type: text/calendar; charset=utf-8` and
    `Content-Disposition: attachment; filename="dekka-<yyyy-mm-dd>.ics"`.

#### 4a.2 "Tonight at Dekka" banner

- **Query:** `getTonightEvents()` in `lib/data.ts` returns events with `status ∈ {published,
  closed}` (`closed` means reservations are closed, but the night still happens) whose `startsAt`
  falls on **today's Cairo calendar day**, and that haven't ended (`now < startsAt +
  EVENT_DEFAULT_DURATION_MIN`). It uses the existing `{status, startsAt}` index.
- **Day bounds:** `cafeDayBounds(now)` in `lib/format.ts` is built from the existing
  `dayKey()` + `fromLocalInputValue()`, so Egypt's DST change (the night of 29→30 Oct 2026) can't
  shift it.
- **Where:** `components/TonightBanner.tsx` (server component) sits at the very top of `/`,
  above the hero. On a phone the hero fills the first screen, so under it would be below the fold.
  The home page is `force-dynamic`, so the banner is always current.
- **Look:** a slim full-width gold-edged band, one row per event (usually one, at most three):
  - **Icon:** lucide `Moon`, or `Sun` for a start before 17:00 Cairo.
  - **Eyebrow:** "Tonight at Dekka", "Today at Dekka" for a daytime start, or "On now" once
    started.
  - **Text:** the title and the time.
  - **Action:** a ≥44px link to the event: "Hold your spot" if it can still be reserved, or
    "Full" / "See the night" otherwise. Spots-left reuses the page's existing
    `countReservationsForEvents` call; no extra query.
- Nothing is rendered when there's no event today. Visible in the browser too (a deliberate
  addition).

#### 4a.3 WhatsApp share with a rich card

- **Share button** on the event page (upcoming public events): a plain link to
  `https://wa.me/?text=<message>`. That opens WhatsApp's chat picker on phones and WhatsApp Web on
  desktop, with no JavaScript. The message is built server-side by `whatsAppShareUrl()` in
  `lib/calendar.ts`, in the reader's language, with the absolute event URL on its own line.
- **Metadata:**
  - **Root layout:** `metadataBase: new URL(site.url)`, plus a site-wide default `openGraph`
    (site name "دكة · Dekka", locale `ar_EG`, image `/brand/dekka-banner.jpg`, 68 KB). Sharing the
    home page or `/get-app` then gets a card too.
  - **Event page:** `generateMetadata` gives `title`, `description` (date · time · price, then
    the first line of the description) and `openGraph.images =
    [{ url: /api/events/:id/og, width: 1200, height: 630, alt }]`. It's built only for public
    statuses, so a draft's metadata is the site default.
  - **One read:** `getEvent` gets wrapped in React `cache()` so the metadata and the page share
    one database read (per Next's metadata guide).
  - **WhatsApp sees it:** Next 16 streams metadata for normal browsers, but WhatsApp is in its
    default `htmlLimitedBots` list (checked in `html-bots.js`), so the crawler gets the tags in
    `<head>`. This is verified with `curl -A "WhatsApp/2.23"`.
- **The card image:** `GET /api/events/:id/og`, `app/api/events/[id]/og/route.tsx`, renders a
  1200×630 PNG with `ImageResponse` from `next/og`.
  - **Access and caching:** public statuses only, 404 otherwise, for everyone. Rate-limited per
    IP with the `og-ip` bucket (120/min). Because it never varies by caller, it's cached at
    Vercel's edge: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
  - **The design is bilingual** because the crawler has no language cookie:
    - **Brand:** the Dekka logo on its cream plate (the logo is dark ink; brand rule), on
      ink-black with a gold rule.
    - **Titles:** the Arabic title large (two lines at most, then an ellipsis), with the English
      title under it.
    - **Details:** the date and time in both languages, and a price chip ("مجاناً · Free" or
      "١٥٠ ج.م · EGP 150").
    - **Footer:** the site's host name in small type.
    - **No poster photo inside the card:** a photo would push the PNG far past the ~300 KB
      WhatsApp is known to accept.
  - **Size budget:** at most 300 KB, asserted by the check script on rendered samples.
- **The font:** `lib/og/fonts/Cairo-Bold.ttf` (+ its `OFL.txt`) is a **static** wght=700
  instance of the vendored variable Cairo. It's cut once with fontTools (`varLib.instancer`, then
  `pyftsubset` to Arabic, Arabic presentation forms, Basic Latin + Latin-1, Arabic-Indic digits
  and the punctuation used), at roughly 100 KB. It's loaded the same way the PDF report loads its
  font (`readFileSync(new URL("./fonts/…", import.meta.url))`), so Vercel's file tracing picks it
  up. Cairo's OFL declares no Reserved Font Name, so a modified instance may keep the name. The
  exact commands are recorded in the Feature Log so it can be regenerated. **Not a dependency** —
  just a font file next to the existing one.
- **Arabic word order:** Satori 0.25 has no bidi.
  - **What a test render showed (2026-10-05):** letters *join* correctly with the static font,
    but words are placed **left-to-right**, and Arabic word gaps come out oversized.
  - **Fix:** `lib/og/bidi.ts` splits a line into direction runs (Arabic words; Latin runs kept
    together, so "مع Dekka Band" stays "Dekka Band"; digits attached to their neighbours). It
    lays them out as separate flex items in a `row-reverse`, wrapping container with an explicit
    word gap.
  - **Date line:** built from parts, not one formatted string, so digits can't reorder.
  - **Testing:** `check:event-night` tests the run-splitting, and the rendered samples
    (Arabic-only, mixed Arabic/English, long titles, free and paid) are looked at by eye.

#### 4a.4 Big door code

- **`components/DoorCodeButton.tsx`** (client): a ≥44px "Show at the door" button on every
  upcoming My Events card **and** in `ReserveButton`'s reserved state. It opens a full-screen
  dialog (`role="dialog"`, `aria-modal`, focus moved in and restored, Esc and a 44px Close):
  - **The code:** on a cream plate, ~72px mono black, letter-spaced. Screen readers get it
    letter by letter via `aria-label`.
  - **Context:** the event title and date.
  - **Two hints:** "show this to the door team", and "weak signal at the door? take a
    screenshot now". My Events is never cached offline, by design (§2's service-worker rule).
  - **Screen stays on:** a **Wake Lock** while open where the browser supports it. A
    progressive extra that fails silently.
- **Tonight badge:** a reservation for an event on today's Cairo date gets a gold "Tonight"
  badge on its My Events card.

#### 4a files

- **New:** `lib/calendar.ts` (pure: `buildIcs`, `googleCalendarUrl`, `whatsAppShareUrl`),
  `lib/og/card.tsx`, `lib/og/bidi.ts`, `lib/og/fonts/Cairo-Bold.ttf` + `OFL.txt`,
  `app/api/events/[id]/calendar/route.ts`, `app/api/events/[id]/og/route.tsx`,
  `components/TonightBanner.tsx`, `components/EventShareActions.tsx` (calendar + WhatsApp),
  `components/DoorCodeButton.tsx`, `scripts/check-event-night.ts` (+ `npm run check:event-night`).
- **Changed:**
  - `lib/site.ts` (`url`), `lib/constants.ts` (duration), `lib/format.ts` (`cafeDayBounds`).
  - `lib/data.ts` (`getTonightEvents`, `cache()` on `getEvent`), `lib/ratelimit.ts` (two
    buckets).
  - `app/layout.tsx` (`metadataBase`, default OG), `app/(site)/page.tsx`,
    `app/(site)/events/[id]/page.tsx`, `app/(site)/my-events/page.tsx`,
    `components/ReserveButton.tsx`.
  - `lib/i18n/dictionaries.ts`.
- **Data changes:** none.

#### 4a copy (Arabic first)

| Key | العربية | English |
|---|---|---|
| `tonight.tonight` | الليلة في دكة | Tonight at Dekka |
| `tonight.today` | النهارده في دكة | Today at Dekka |
| `tonight.onNow` | شغّالة دلوقتي | On now |
| `tonight.reserve` | احجز مكانك | Hold your spot |
| `tonight.details` | شوف التفاصيل | See the night |
| `calendar.add` | ضيفها لتقويمك | Add to your calendar |
| `calendar.google` | تقويم جوجل | Google Calendar |
| `calendar.ics` | آيفون وأوتلوك وغيرهم (ics.) | Apple, Outlook & others (.ics) |
| `calendar.reminder` (inside the .ics) | الحفلة كمان ساعتين — مستنيينك في دكة | Two hours to go — see you at Dekka |
| `share.whatsapp` | ابعتها لصحابك على واتساب | Send it to friends on WhatsApp |
| `share.message` | تعالى معايا {title} في دكة — {date}، {time} | Come with me to {title} at Dekka — {date}, {time} |
| `doorCode.show` | وري الكود على الباب | Show at the door |
| `doorCode.title` | كود الحجز | Your door code |
| `doorCode.hint` | ورّي الشاشة دي لفريق الباب | Show this screen to the door team |
| `doorCode.offlineHint` | الشبكة ضعيفة عند الباب؟ خُد سكرين شوت دلوقتي. | Weak signal at the door? Take a screenshot now. |
| `doorCode.close` | قفل | Close |
| `myEvents.tonightBadge` | الليلة | Tonight |
| OG card price chip | مجاناً · Free / ١٥٠ ج.م · EGP 150 | (bilingual on the image) |

#### 4a verification

- **`check:event-night`** (DB-free):
  - **The .ics:** UTC `Z` times; CRLF; every line ≤ 75 octets including Arabic; escaping;
    a stable `UID`; end = start + duration; a `VALARM`.
  - **The Google Calendar URL:** its `dates=` value.
  - **`cafeDayBounds`:** across both DST changes, and at 23:59 and 00:01 Cairo.
  - **The "has it ended" window.**
  - **`bidi` runs:** Arabic, Latin runs kept whole, digits, punctuation.
  - **A real card render** from a sample DTO: a PNG signature, 1200×630, under 300 KB.
  - **From the route sources:** both new routes call `rateLimit`, filter on public statuses,
    and never read the session or cookies (that last one is what keeps them caller-invariant).
  - **Mutation runs:** local times instead of UTC, drafts allowed, the `rateLimit` call
    removed, and RTL ordering broken. Each must fail.
- **End to end** (`dekka_verify`, production build with `NEXT_PUBLIC_SITE_URL=http://localhost:3100`):
  - **Seeded events:** one tonight, one tonight already ended, one tomorrow, a draft today, and
    one at 00:30 the next day.
  - **The banner:** shows exactly the right one in both languages, at 390px and 1280px.
  - **The .ics:** downloaded and parsed. The draft gets 404 on both new routes, as a guest and
    as an admin.
  - **Card images:** the OG PNGs are saved and looked at, and their sizes recorded.
  - **Head tags:** `curl -A "WhatsApp/2.23"` shows `og:image` as an absolute URL in `<head>`.
  - **Share link:** the WhatsApp `href` decodes to the expected message.
  - **Door code:** opens, closes with Esc, and returns focus; screenshots in both languages.
  - **No sideways scroll** on any touched page (measured, not eyeballed).
- **Not verifiable here (goes on the phone checklist):** the real WhatsApp preview (needs the
  public HTTPS deploy), adding the .ics on a real iPhone and Android, and the Wake Lock.

---

### 5.3 Sub-phase 4b — Cafe life

#### 4b.1 "Open now / closes at"

- **Structured hours** in `lib/site.ts`: `openingHours`, seven entries (Sunday first), each
  `{ opens: "10:00", closes: "01:00" }` or `null` for a closed day.
  - **After midnight:** `closes` earlier than `opens` means after midnight.
  - **Env override:** `NEXT_PUBLIC_OPENING_HOURS` accepts one range for every day
    (`"10:00-01:00"`, the default) or seven comma-separated ranges / `closed`. Ramadan hours can
    then change without a deploy, the same way the text lines already can.
  - **One source of truth:** the existing `hoursAr/En` text lines stay as they are, as display
    copy. A comment in `site.ts` says the two must agree. *(Owner question Q5: are the hours
    really the same every day?)*
- **`lib/hours.ts`** (pure, client-safe): `openStatus(now, hours)` returns
  `{ state: "open" | "closingSoon" | "closed", until?, opensAt?, opensTomorrow? }`.
  - **Cairo wall clock:** read through `Intl` (the same technique as `lib/format.ts`), so
    nothing hard-codes an offset.
  - **The after-midnight tail:** at 00:30 on Saturday the relevant window is *Friday's*
    10:00→01:00, so it checks today's window **and** yesterday's spill-over.
  - **Closing soon:** within 60 minutes of close.
- **`components/OpenStatus.tsx`** (client): a pill with a coloured dot and words. Colour is
  never the only signal.
  - **First render:** the server computes it and passes it as a prop, so there's no flash.
  - **Staying current:** the client recomputes every minute, so a page left open across closing
    time updates.
- **Where:** in a small "visit" row (with directions, below) on `/` (under the hero line),
  `/menu` (under the header) and `/about` (beside the hours line). Not on `/offline`: it's
  precached once, so a status there would be frozen.

#### 4b.2 One-tap directions

- **Two URLs** in `lib/site.ts`, built from `NEXT_PUBLIC_CAFE_COORDS` (default `31.2067034,29.9258693`,
  the coordinates already in `mapsEmbed`):
  - **Google:** `https://www.google.com/maps/dir/?api=1&destination=<lat,lng>`, which opens
    turn-by-turn in the Google Maps app on Android and iPhone, or the web.
  - **Apple:** `https://maps.apple.com/?daddr=<lat,lng>`.
- **`components/DirectionsLink.tsx`** (client): renders the Google URL on the server, and swaps
  to Apple Maps on iPhone after hydration, reusing `readPlatform()` from `lib/pwa.ts` via
  `useSyncExternalStore`. Only the `href` changes, so there's no layout shift.
- **Where:**
  - **The visit row:** next to "Open now".
  - **/about:** the "Get directions" link becomes the one-tap link.
  - **Event page:** the map's directions link, when the event is at the cafe. An event with its
    own `mapUrl` keeps that link.
  - **Footer:** the "Google Maps" social link stays the place page.

#### 4b.3 "Barista's pick" badge

Already built (§5.0). Nothing to do. The Feature Log will say so.

#### 4b.4 Scheduled seasonal sections

- **Model (additive, optional):** `MenuCategory.startsOn?` and `endsOn?` as `"YYYY-MM-DD"`
  strings. They're **Cairo calendar days, both inclusive**, with no default, so existing sections
  and a rollback are untouched.
  - **Why strings and not Dates:** strings say exactly what the admin picked, with no timezone
    conversion to get wrong. Zero-padded ISO compares correctly both in Mongo and in JS.
- **Visibility rule (one function):** `isInSeason(category, today)` in `lib/menu.ts`. A section
  is shown to guests when `isActive && (!startsOn || today ≥ startsOn) && (!endsOn || today ≤
  endsOn)`, where `today = dayKey(now)`.
  - **Server:** the public `getMenu()` (and so `GET /api/menu`) and `getFeaturedMenuItems()`
    filter on it in the aggregation.
  - **Admin:** `getMenu({ includeHidden: true })` returns everything.
  - **Response shape:** `MenuCategoryDTO` gains `startsOn`/`endsOn` (public facts, harmless in
    the cached response).
- **The service-worker cache can't keep an expired section:** `/api/menu` is stale-while-revalidate.
  The online `/menu` page is server-rendered and always fresh. The cached copy is only *read* by
  the offline page's `OfflineMenu`, so that component also applies `isInSeason` against the
  device's current Cairo day (`dayKey(new Date())`). A section that has ended since the copy was
  saved disappears offline too.
  - **Known limit:** a section whose season *started* since the copy was saved shows offline
    only after the next online visit to `/menu`.
  - **`sw.js` `VERSION` → `v3`**, because `/offline`'s imports change.
- **Validation** (`lib/validation.ts`):
  - **Format:** a `seasonDay` schema checks the shape and that it's a real date.
  - **Create:** both fields optional, plus a refine that the end isn't before the start.
  - **Update:** through `stripDefaults` + `.partial().strict()`. `null` clears a date (the route
    turns it into `$unset`).
  - **Partial edits:** a PATCH that sends only one end is checked against the stored other end
    → `400 SEASON_RANGE`.
- **Admin UI** (`MenuSections` / `MenuManager`):
  - **Editing:** the section's edit form gains "Show from" / "Until" date inputs and a "Clear
    dates" control.
  - **Status badge:** each row shows "Seasonal: 1 Dec – 28 Feb", "Shows from …" or "Season
    ended …", so it's obvious why a section isn't on `/menu`.
- **Public UI:** a section with an end date shows "Limited time · until {date}" under its
  heading on `/menu`.

#### 4b files

- **New:** `lib/hours.ts`, `components/OpenStatus.tsx`, `components/DirectionsLink.tsx`,
  `components/VisitRow.tsx`, `scripts/check-cafe-life.ts` (+ `npm run check:cafe-life`).
- **Changed:**
  - **Config and helpers:** `lib/site.ts`, `lib/menu.ts`, `lib/data.ts`, `lib/validation.ts`.
  - **Model and routes:** `models/MenuCategory.ts`, `app/api/menu/categories/route.ts` and
    `[id]/route.ts`.
  - **Menu components:** `components/menu/MenuBoard.tsx`, `OfflineMenu.tsx`,
    `admin/MenuSections.tsx`, `admin/MenuManager.tsx`.
  - **Pages:** `app/(site)/page.tsx`, `menu/page.tsx`, `about/page.tsx`, `events/[id]/page.tsx`.
  - **Also:** `public/sw.js` (`v3`), `lib/i18n/dictionaries.ts`.
- **Data changes:** two optional fields on `MenuCategory`.

#### 4b copy (Arabic first)

| Key | العربية | English |
|---|---|---|
| `visit.openUntil` | مفتوح دلوقتي · لحد {time} | Open now · until {time} |
| `visit.closingSoon` | بنقفل قريب · {time} | Closing soon · {time} |
| `visit.closedOpensAt` | مقفول دلوقتي · بنفتح {time} | Closed now · opens at {time} |
| `visit.closedOpensTomorrow` | مقفول دلوقتي · بنفتح بكرة {time} | Closed now · opens tomorrow at {time} |
| `visit.directions` | وديني دكة | Take me there |
| `visit.directionsLabel` (aria) | الطريق لدكة على تطبيق الخرايط | Directions to Dekka in your maps app |
| `cafeMenu.limitedUntil` | لفترة محدودة · لحد {date} | Limited time · until {date} |
| `cafeMenu.admin.seasonFrom` | يظهر من | Show from |
| `cafeMenu.admin.seasonUntil` | لحد | Until |
| `cafeMenu.admin.seasonHint` | سيبهم فاضيين لو القسم موجود طول السنة. | Leave both empty for an all-year section. |
| `cafeMenu.admin.seasonClear` | شيل المواعيد | Clear dates |
| `cafeMenu.admin.seasonBadge` | موسمي: {from} – {until} | Seasonal: {from} – {until} |
| `cafeMenu.admin.seasonUpcoming` | هيظهر من {date} | Shows from {date} |
| `cafeMenu.admin.seasonEnded` | خلص موسمه {date} | Season ended {date} |
| `cafeMenu.admin.seasonRangeError` | تاريخ النهاية لازم ييجي بعد البداية أو في نفس اليوم. | The end date has to be on or after the start date. |

#### 4b verification

- **`check:cafe-life`** (DB-free):
  - **`openStatus`** at 09:59, 10:00, 00:30 (yesterday's spill-over), 00:59, 01:00, closing-soon
    at 00:15, a `null` day, a seven-range env string, and both 2026 DST transition nights.
  - **`isInSeason`:** inclusive bounds; 23:30 UTC (already tomorrow in Cairo); open-ended either
    side.
  - **Category schemas:** strict; no default leak on a rename; `null` clears; a bad range is
    refused.
  - **From the sources:** `GET /api/menu` still reads no session or cookies (caller-invariant),
    and `OfflineMenu` applies `isInSeason`.
  - **Mutation runs:** an exclusive end day, dropping yesterday's spill-over, dropping the
    offline filter, and dropping `stripDefaults` on the category update. Each must fail.
- **End to end** (`dekka_verify`):
  - **Seeded sections:** one past, one current and one future season.
  - **Public reads:** `/menu`, `/api/menu` and the homepage picks strip show only the current
    one.
  - **Admin (through the UI):** sets and clears dates; the badge reads right; a bad range shows
    the error.
  - **Offline:** a cached `/api/menu` containing an already-ended section is planted with
    `caches.open(...).put(...)`, then `/offline` is loaded with the network off. The section
    isn't shown.
  - **`OpenStatus` on the client:** `Date` is overridden before load to times either side of
    01:00 Cairo. The server path is covered by the check script.
  - **`DirectionsLink`:** Apple Maps under an iPhone UA, Google otherwise.
  - **Both languages, 390px and 1280px,** screenshots looked at, scroll width measured.

---

### 5.4 Sub-phase 4c — Owner wow

#### 4c.1 Privacy-safe counters

- **Collection `UsageCounter`** (new): `{ metric, day: "YYYY-MM-DD" (Cairo), item?: ObjectId,
  count }`. **Nothing else.** No user, no IP, no cookie, no user agent, no timestamp finer than
  the day. One unique index `{ metric: 1, day: 1, item: 1 }`. Each write is an upsert `$inc` (one
  retry on a duplicate-key race).
- **Metrics** (`USAGE_METRICS` in `lib/constants.ts`):
  - `menu_item_view`, per item: a menu card was **≥50% on screen for ≥1 second**, counted once
    per item per page load. Only on `/menu`, not the homepage strip.
  - `install_prompt_shown`: the install strip or the `/get-app` panel was *actually visible*
    (the strip is in the markup on desktop but CSS-hidden, so it's checked with
    `getClientRects()`). Once per page load.
  - `install_prompt_accepted`: Chromium's `userChoice.outcome === "accepted"`. **iPhone gives
    websites no such signal**, so this is an Android/desktop number.
  - *Proposed extras, owner question Q4:* `app_open` (a cold launch of the installed app,
    counted once per document load in standalone mode; the only install-related number iPhones
    can produce) and `qr_scan` (an arrival at `/get-app?from=qr` from the poster; the parameter
    is then removed with `history.replaceState`, so a reload or a re-share doesn't recount).
- **`POST /api/stats`** (`app/api/stats/route.ts`, a new rule-9 public route):
  - **Body:** strict, through `parseBody` + `z.discriminatedUnion("metric", …)`: either
    `{ metric: "menu_item_view", items: objectId[] }` (1–100, de-duplicated) or `{ metric: <one
    of the others> }`.
  - **Never reads the session or any cookie.**
  - **Only real items count:** item ids are filtered to existing `MenuItem`s in one query, so
    junk ids can't create junk rows.
  - **Rate limit:** the `stats-ip` bucket (60 per 10 minutes) is keyed by **a SHA-256 of the
    IP**, so even Upstash's short-lived counter never holds the raw address.
  - **Response:** `204`.
- **Client:** `lib/stats-client.ts` batches the item views and flushes them with one
  `fetch(…, { keepalive: true })` on `pagehide`/`visibilitychange`, or at 50 items.
  - **One observer:** a single `IntersectionObserver` in `MenuBoard`.
  - **Signed-in staff and admins aren't counted**, decided in the browser. The server still
    never learns who anyone is.
  - **Failures are ignored**, including a `409` in demo mode.
- **Admin stats card** (`components/admin/UsageStatsCard.tsx`) on `/admin`, above the tabs, read
  by `getUsageStats(30)` in `lib/data.ts` (one aggregation). It shows:
  - the five most-viewed items, by name, with counts;
  - prompt shown, prompt accepted and the rate;
  - Q4's extras, if approved.
  - **A caveat line:** "a view = on screen for a second; items near the top get seen more".
    That's the honest limit of a list-based view count.
- **Privacy and cookie pages** must be reworded. Drafts below; the owner should sign off on the
  legal text. Both "last updated" dates get bumped in `lib/legal.ts`.

#### 4c.2 Printable QR poster (blocked on Q1)

- **Page:** `/admin/qr` (`app/(site)/admin/qr/page.tsx`, gated by the admin layout like every
  admin page). It gets a sidebar link "QR poster" with lucide's `QrCode` icon.
- **Content:** an A4 portrait poster, bilingual so one poster serves every table:
  - the logo;
  - "نزّل دكة على موبايلك / Get Dekka on your phone";
  - the QR, about 10 cm, ECC level Q, with a 4-module quiet zone, encoding
    `${site.url}/get-app?from=qr`;
  - three numbered steps;
  - the URL in plain text, for anyone whose camera won't scan.
- **Print:** dark on white for any printer. `@page { size: A4; margin: 12mm }`. A "Print the
  poster" button calls `window.print()`. The site chrome (navbar, footer, tab bar, admin sidebar,
  install strip, cookie banner, push toast) gets Tailwind's `print:hidden`, which **changes
  nothing on screen**.
- **The QR is rendered on the server** as inline SVG, so no encoder code ships to the browser,
  whichever option is chosen.
- **Verification:**
  - **Decoding:** the screenshot is decoded with OpenCV's `QRCodeDetector` (available on this
    machine, in Python), asserting it equals the expected URL.
  - **Print:** a print-media screenshot and a `page.pdf()` render are looked at.

#### 4c.3 Demo mode (proposal — owner question Q2)

**Goal:** pitch the app on a real phone, with a full menu, a "tonight" event, door codes and
stats, while the production database stays empty of fake data and receives **no writes at all**.

- **How it's switched on:**
  - **Start:** an admin presses "Start the demo" on a "Demo mode" card on `/admin`. That calls
    `POST /api/demo` (`guard("admin")`), which sets one cookie on **that device**:
    `dekka_demo=1`, `Max-Age` 2 hours, `Path=/`, `SameSite=Lax`.
  - **Not `httpOnly`:** it holds no secret, and the ribbon's "Leave demo" can clear it in the
    browser with no route at all.
  - **It expires by itself** after 2 hours, so it can't linger on someone's phone.
- **Who sees it:** whoever is using that device, signed in or not. A pitch needs the guest view
  too. A permanent ribbon at the top of every page says "Demo mode — sample data, nothing is
  saved", with "Leave demo".
  - **Setting the cookie by hand grants nothing:** it swaps in sample data for that person and
    blocks their own writes.
  - **Admin-only pages stay admin-only:** the real role check is unchanged.
- **What shows sample data** (`lib/demo.ts`: `isDemo()` reads the cookie, and the fixtures are
  built relative to "now", so there's always an event *tonight* in Cairo):
  - **`/`:** sample nights, including tonight (so the banner shows), and sample Barista's picks.
  - **`/events/demo-*`:** sample event pages, already in the "reserved" state with a door code.
    No reserve request is ever sent.
  - **`/menu`:** a full sample menu with sizes, sold-out items, picks and a seasonal section.
  - **`/my-events`:** sample reservations with door codes, even signed out.
  - **The `/admin` stats card:** sample numbers.
  - Everything else (other admin screens, the door table) shows **real** data under the ribbon.
- **What never shows sample data:** every `/api/*` route. In particular `GET /api/menu`, which
  the service worker caches, never consults the cookie (asserted by the check script). So
  nothing sample ever lands in a device cache, a CDN, an OG image or a calendar file. Pages are
  never cached (§2), so the switch is clean.
- **"Never writes to the database" is enforced in one place, not trusted to each route:**
  - **`proxy.ts`** (Next 16's renamed middleware) at the root, with a matcher on `/api/:path*`
    **that only fires when the `dekka_demo` cookie is present** (`has: [{ type: "cookie", key:
    "dekka_demo" }]`), so normal visitors pay nothing.
  - **What it refuses:** any method other than `GET`/`HEAD`/`OPTIONS` gets
    `409 { code: "DEMO_MODE" }`. The exception is `/api/auth/*`, so signing out still works.
  - **Server actions** are the other POSTs in the app (language and cookie-consent). They only
    set cookies, never the database.
  - **Testable decision:** the rule itself is the pure `demoBlocks(method, pathname)` in
    `lib/demo-guard.ts`, imported by `proxy.ts` and unit-tested.
- **Alternatives considered:**
  - **A separate demo deployment** with an env flag: zero risk to production pages, but it
    needs a second Vercel project and someone to run it.
  - **A `/demo` "showroom" route tree:** the safest, but it doesn't let you tap through the real
    app.

#### 4c files

- **New:**
  - **Counters:** `models/UsageCounter.ts`, `app/api/stats/route.ts`, `lib/stats-client.ts`,
    `components/admin/UsageStatsCard.tsx`.
  - **QR poster:** `app/(site)/admin/qr/page.tsx`, `components/admin/QrPoster.tsx`.
  - **Demo mode:** `lib/demo.ts`, `lib/demo-fixtures.ts`, `lib/demo-guard.ts`, `proxy.ts`,
    `app/api/demo/route.ts`, `components/DemoRibbon.tsx`, `components/admin/DemoModeCard.tsx`.
  - **Check script:** `scripts/check-owner-tools.ts` (+ `npm run check:owner-tools`).
- **Changed:**
  - **Shared code:** `lib/constants.ts`, `lib/validation.ts`, `lib/data.ts`, `lib/ratelimit.ts`.
  - **Counted components:** `components/menu/MenuBoard.tsx`, `components/InstallPrompt.tsx`,
    `components/InstallPanel.tsx`, `app/(site)/get-app/page.tsx`.
  - **Admin:** `app/(site)/admin/page.tsx`, `app/(site)/admin/layout.tsx` (sidebar link,
    `print:hidden`).
  - **Demo branches:** `app/(site)/page.tsx`, `events/[id]/page.tsx`, `menu/page.tsx`,
    `my-events/page.tsx`.
  - **Site chrome** (`print:hidden`; the ribbon in the `(site)` layout): `Navbar`, `Footer`,
    `AppTabBar`, `CookieConsent`, `PushOptIn`.
  - **Legal and copy:** `lib/i18n/legal-content.ts`, `lib/legal.ts`,
    `lib/i18n/dictionaries.ts`.
  - **Possibly** `package.json` (Q1).
- **Data changes:** one new collection, nothing existing touched.

#### 4c copy (Arabic first)

| Key | العربية | English |
|---|---|---|
| `stats.title` | آخر ٣٠ يوم | Last 30 days |
| `stats.topItems` | أكتر أصناف اتشافت في المنيو | Most-viewed menu items |
| `stats.views` | {n} مشاهدة | {n} views |
| `stats.promptShown` | دعوة التثبيت ظهرت | Install prompt shown |
| `stats.promptAccepted` | ثبّتوا من الدعوة (أندرويد) | Installed from the prompt (Android) |
| `stats.appOpens` *(Q4)* | مرات فتح التطبيق | App opens |
| `stats.qrScans` *(Q4)* | دخلوا من بوستر الـQR | Arrived from the QR poster |
| `stats.note` | أعداد إجمالية بس — من غير أي معلومة عن مين. | Totals only — nothing about who. |
| `stats.viewsCaveat` | المشاهدة = الصنف فضل على الشاشة ثانية؛ الأصناف اللي فوق بتتشاف أكتر. | A view = the item stayed on screen for a second; items near the top get seen more. |
| `stats.empty` | لسه مفيش أرقام. | No numbers yet. |
| `poster.navLabel` | بوستر الـQR | QR poster |
| `poster.headline` | نزّل دكة على موبايلك | Get Dekka on your phone |
| `poster.sub` | صوّر الكود بكاميرا الموبايل — من غير متجر تطبيقات. | Point your phone camera at the code — no app store needed. |
| `poster.step1` / `2` / `3` | صوّر الكود · افتح الرابط · «أضف إلى الشاشة الرئيسية» | Scan the code · Open the link · "Add to Home Screen" |
| `poster.print` | اطبع البوستر | Print the poster |
| `demo.ribbon` | وضع العرض — بيانات تجريبية، ومفيش حاجة بتتسجل. | Demo mode — sample data, nothing is saved. |
| `demo.leave` | اخرج من العرض | Leave demo |
| `demo.cardTitle` | وضع العرض | Demo mode |
| `demo.cardBody` | اعرض التطبيق بحفلات ومنيو وأرقام تجريبية، على الجهاز ده بس. مفيش أي حاجة بتتكتب في قاعدة البيانات، وبيقفل لوحده بعد ساعتين. | Show the app with sample nights, menu and numbers — on this device only. Nothing is written to the database, and it switches itself off after two hours. |
| `demo.start` | شغّل وضع العرض | Start the demo |
| `DEMO_MODE` error (shown by existing error UI) | ده وضع عرض — مفيش حاجة بتتسجل. | Demo mode — nothing is saved. |

**Legal text drafts** (formal register, matching the existing policy pages):

- **Privacy → "Data we collect", a new bullet:**
  - ar: "– إحصاءات مجمّعة مجهولة الهوية: نعدّ عدد مرات ظهور كل صنف في قائمة المقهى على
    الشاشة، وعدد مرات ظهور دعوة تثبيت التطبيق وقبولها[، وعدد مرات فتح التطبيق المثبّت ومرات
    الدخول من ملصق رمز QR]. لا نحتفظ إلا بالعدد الإجمالي لكل يوم، دون اسمك أو حسابك أو عنوان
    IP أو أي كوكي أو معرّف لجهازك، فلا يمكن ربط أي رقم منها بشخص بعينه."
  - en: "– Anonymous totals: we count how often each cafe-menu item is shown on screen and how
    often the install-the-app prompt is shown and accepted[, how often the installed app is
    opened, and how many visits arrive from our QR poster]. We store only a running total per
    day — never your name, account, IP address, a cookie, or any identifier for your device — so
    no number can be traced back to anyone."
- **Privacy → "Who we share your data with", first sentence:**
  - ar: "…ولا نستخدم أي أدوات تحليلات أو إعلانات من أطراف خارجية على هذا الموقع (الإحصاءات
    المجمّعة الموصوفة أعلاه نحسبها بأنفسنا ولا تغادر قاعدة بياناتنا)."
  - en: "…and this site runs no third-party analytics or advertising tools of any kind (the
    anonymous totals described above are counted by us and never leave our database)."
- **Cookies → the "No analytics, no advertising" section** is renamed "لا تتبّع ولا إعلانات / No
  tracking, no advertising", and this sentence is appended:
  - ar: "نحتفظ فقط بأعداد إجمالية مجهولة (راجع سياسة الخصوصية)، ولا نضع أي كوكي لهذا الغرض."
  - en: "We keep only anonymous daily totals (see our Privacy Policy), and set no cookie to do it."
- **Cookies → the list** gains, if demo mode is approved:
  - ar: "– dekka_demo: لا يُضاف إلا على جهاز شغّل عليه أحد مسؤولي دكة وضع العرض، ويُحذف تلقائياً
    بعد ساعتين."
  - en: "– dekka_demo: only ever set on a device where a Dekka admin turned on demo mode; it
    deletes itself after two hours."

#### 4c verification

- **`check:owner-tools`** (DB-free):
  - **The stats schema:** strict, discriminated, 100-id cap, de-duplicated.
  - **No identity anywhere:** the `UsageCounter` model declares no user, IP, cookie or agent
    field (read from the source). `POST /api/stats` never reads the session or cookies, and
    rate-limits on a *hashed* IP.
  - **`demoBlocks`:** POST, PATCH, PUT and DELETE are blocked; GET and HEAD pass; `/api/auth/*`
    passes.
  - **Proxy matcher:** it carries the cookie condition.
  - **No demo leakage:** `GET /api/menu`, the OG route and the calendar route never call
    `isDemo()`.
  - **Fixtures:** they always include an event tonight in Cairo time.
  - **Mutation runs:** a `user` field added to the counter, the method check dropped, `/api/menu`
    made demo-aware, and the `rateLimit` call removed. Each must fail.
- **End to end** (`dekka_verify`):
  - **Counters:** browse `/menu` as a guest, then read the counter rows straight from Mongo:
    exact counts, no other fields.
  - **Install prompt:** a fake `beforeinstallprompt` (parked the way `EARLY_APP_SCRIPT` does)
    shows the strip and counts it; pressing Install with `accepted` counts that too.
  - **No admin noise:** an admin browsing adds nothing.
  - **The stats card:** renders those numbers.
  - **Demo mode:** turn it on, then check the ribbon on every page type, and that the sample
    tonight banner, menu and door codes show. Then attempt a reservation, a menu edit and a
    stats beacon: each gets `409`. **A document count of every collection before and after is
    identical.** Leave demo, and the real data is back.
  - **QR:** decoded by OpenCV to the exact URL; the print render is looked at.
  - **Legal pages:** both languages read correctly.

---

### 5.5 Questions for the owner (each blocks only the sub-phase shown)

| # | Blocks | Question | My recommendation |
|---|---|---|---|
| Q1 | 4c | **QR encoder.** (a) Add `uqr`: MIT, zero transitive dependencies, ~80 KB, used server-side only, and the poster always follows `site.url`. (b) No dependency: generate the SVG once outside the repo and commit it to `public/brand/`; it must be regenerated by hand if the domain changes. (c) Hand-write an encoder (~300 lines with Reed-Solomon). | **(a)**. (b) is acceptable. Not (c): a wrong module on a printed poster is an expensive bug. |
| Q2 | 4c | **Demo mode** as proposed in 4c.3: a per-device cookie started by an admin, a 2-hour expiry, a ribbon, sample data on five guest-facing screens, all writes blocked by `proxy.ts`? | Yes, as proposed. |
| Q3 | 4a | **Calendar:** how long should an event's calendar entry be (no end time is stored)? And may I add the Google Calendar link next to the .ics? | 3 hours; yes to the Google link. |
| Q4 | 4c | **Extra counters:** besides the item views and the prompt shown/accepted you named, also count `app_open` (the only install signal iPhones give) and `qr_scan` (proves the poster works)? | Both. |
| Q5 | 4b | **Opening hours:** is it really 10:00–01:00 every day, Fridays and Ramadan included? Are `NEXT_PUBLIC_HOURS_AR/EN` set on Vercel? | Daily default plus the per-day env override. |

### 5.6 Out of scope, or needs a human

- **Push:** the web-push pipeline is unchanged by phase 4. It still needs verifying on a real
  iPhone (16.4+, installed) and a real Android before anyone promises it.
- **Real-device steps:** the install, the WhatsApp preview (needs the public HTTPS deploy),
  adding the .ics, directions opening the maps app, Wake Lock on the door code, and printing the
  poster then scanning it. All of this goes on a phone checklist written at the end of 4c.
- **Not planned:** per-event QR codes, a poster photo inside the share card, charts on the stats
  card, and any counter beyond those listed. Each is easy to add later and none was asked for.

---

## 6. Hard rules (restated from `developer-guide.md`)

- Every API route guarded; every write Zod-validated and `.strict()` when it feeds a `$set`.
- All new schema additions **additive and optional** so a rollback is data-safe (§9).
- Logical Tailwind properties only; bilingual `ar`+`en` for every string; Arabic-first copy per
  `design-system/06-tone-of-voice.md`.
- `MONGODB_URI` is the live production database — never run `seed.ts`; test with throwaway
  documents you delete afterwards (dev server hits Atlas).
- Service worker must never cache auth/role-specific data.

## 7. Verification (no test suite exists)

`typecheck`, `lint`, `build`, plus new DB-free check scripts in the repo's existing style
(`check:menu` for schemas/availability-route field whitelist, `check:templates` for the
from-template merge, `check:config` after the `next.config.ts` change). Manual: Lighthouse
installability; install on a **real iPhone (Safari) and a real Android (Chrome)**; airplane-mode
launch shows `/offline` and a previously viewed menu; Arabic RTL tab-bar order; staff cannot reach
price via the availability route (expect 403/400); log what was and wasn't exercised in
`developer-guide.md` §8 in the usual style.

## 8. Still open

- **Real photos** for menu items and gallery do not exist yet; everything is designed to look
  intentional without them.
- **A real iPhone** is needed for the install and push checks — who has one for testing?
- **Menu seed content:** will the owner supply the list and prices, or do you enter them?
- **Template for "activities in the day"** assumes they are ordinary `Event` documents with a
  daytime `startsAt`; if activities need different fields (e.g. no reservations), say so before
  sub-project 3 starts.
