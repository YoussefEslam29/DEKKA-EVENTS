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
(extras) not started.

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

## 5. Extras (phase 4, each independently shippable)

- **Event night:** "Add to calendar" (`.ics`), "Tonight at Dekka" home banner (pure query on
  today's published event), WhatsApp share with a rich card (OG image per event), large door code
  already planned for My Events.
- **Cafe life:** "Barista's pick" badge (uses `isFeatured`), "Open now / closes at" from
  `lib/site.ts` hours, one-tap directions, scheduled seasonal sections (adds a start/end date and
  visibility rule to `MenuCategory` — deliberately deferred out of §3).
- **Owner wow:** admin "popular" stats — **count only privacy-safe events** (menu item views,
  install-prompt shown/accepted) with no per-user tracking, and say so in the privacy page; a
  printable QR poster that opens/installs the app; a demo mode with sample data for the pitch.
- **Push:** the existing web-push pipeline works in an installed iOS app (16.4+). It has never
  been verified on a real device (`developer-guide.md` §7) — verify on a real iPhone and Android
  before promising it to the owner.

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
