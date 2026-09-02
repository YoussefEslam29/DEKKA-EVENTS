# Dekka — Mobile App Blueprint (DEKKA_MOBILE_APP.md)

Written 2026-09-02, against the live codebase (`developer-guide.md`, `PLAN/idea.md`,
`design-system/` in full, `PLAN/HOME_PAGE.md`, `PLAN/design-ui-layouts-website.md`,
`PLAN/Before_Deployment.md`) and against the `mobile-app-ui-design` + `ui-ux-pro-max`
design-intelligence skills, read in full before writing this. This is the doc
`PLAN/HOME_PAGE.md` flagged as coming later:

> *"another `MOBILE_APP.md` is coming later... a native app, if and when that gets
> built, is its own document and its own decisions — don't let this one quietly grow
> into that."*

This is that document. It follows this repo's own plan-before-code convention
(`developer-guide.md` §5's "Feature loop") — read this, lock in the open decisions in
§13, then hand the prompt at the bottom to Opus.

**Scope note, mirrored back:** `PLAN/HOME_PAGE.md` and `PLAN/design-ui-layouts-website.md`
are the *website's* mobile-responsive pass — real breakpoints, no horizontal scroll, a
mobile-first browser experience. That work stays exactly as planned and does not change
here. This document is a **separate, installable app** with its own codebase — a phone app
in the literal sense, not a responsive web page. The two share a brand, a backend, and a
business, and nothing else gets duplicated between them.

---

## 1. Why a native app, not just a better mobile site

The website (once `HOME_PAGE.md` ships) will already be genuinely mobile-first. A native
app is worth the extra codebase only where the browser can't do the job:

- **A home-screen icon.** Dekka's regulars are the audience — people who come back every
  Thursday. An icon on the home screen is a standing invitation the browser can't offer;
  a bookmark is not the same habit as an app icon next to Instagram.
- **Real push notifications.** The web build already ships browser push for "a new event
  just went live" (`PLAN/LOG_SIGN_AUTH_IN.md` §6, via `PushSubscription` + VAPID). That
  only reaches someone while their browser is running and they said yes to a permission
  prompt mid-session. A native app's push (FCM) reaches the phone directly and is the
  channel guests actually expect from an app they installed on purpose.
- **The door tool, offline.** Cafe wifi on a packed event night is exactly the condition
  under which a browser tab silently fails a fetch. A native door-check-in screen can
  queue check-ins locally and sync when the connection returns — a responsive web page
  cannot do this reliably (see §10).
- **One-handed ergonomics the OS actually enforces.** A bottom tab bar in a native app
  gets safe-area insets, gesture-nav coexistence, and haptics from the platform for free.
  A web `<nav>` pinned to the bottom has to fight the browser chrome (address bar,
  pull-to-refresh) for the same result.

**What does *not* change:** admin stays web-only (see §5) — a data-dense back-office
dashboard is a desktop/tablet job, and building it twice would be maintenance debt with
no user upside. The event calendar, the cafe's own story, and anything a first-time
visitor finds via a shared link stay reachable from the browser exactly as `HOME_PAGE.md`
already plans — the app is for people who already know Dekka, not the discovery surface.

---

## 2. Tech stack & architecture strategy

**Platform:** Android first, built so iOS is an extension of the same codebase rather
than a second app written from scratch later.

| Layer | Choice | Why |
|---|---|---|
| UI | Jetpack Compose (Kotlin) | Declarative, matches the component-driven approach already used in `components/ui/*` on the web — same mental model, different renderer |
| Cross-platform boundary | Kotlin Multiplatform (KMP) for the non-UI layers: networking, models, validation, state | Compose UI stays Android-only for v1, but business logic, API client, and data models are written once in `shared/` from day one — the single most expensive mistake to make now is writing everything Android-only and re-doing it for iOS later |
| Networking | Ktor client (KMP-compatible) | Talks to the existing Dekka REST API (§3) — no GraphQL layer, no BFF; the mobile app is just another client of the same routes the website already calls |
| Local persistence | Room (Android) via a KMP-friendly repository interface, DataStore for small key-value state (locale choice, "seen full splash this session" equivalent, auth token) | Matches the `datastore` / `android-data-layer` skill conventions already installed in this environment |
| Async | Kotlin Coroutines + Flow | Standard for Compose + Room + Ktor; no RxJava |
| DI | Koin | Lightweight, matches the `koin` skill already installed; avoids Hilt's codegen overhead for a project this size |
| Images | Coil (Compose-native image loading, matches `coil-compose` skill) | Event posters, menu photos, brand assets |
| Push | Firebase Cloud Messaging (FCM) | Separate infrastructure from the web's VAPID/web-push — see §11, this is a new decision, not a reuse of the existing `PushSubscription` model as-is |
| Auth | Ktor client against a new mobile-auth bridge on the Next.js backend (§4) | NextAuth's default session is a browser cookie; a native app needs a bearer token instead — this is real backend work, flagged explicitly so it isn't discovered mid-build |

**Module shape (MVP, not enterprise-modular — this is a five-screen consumer app plus
one staff tool, not a 50-screen product):**

```
dekka-app/
  shared/                  # KMP module — no Android/iOS UI dependencies
    api/                   # Ktor client, DTOs matching the Next.js API's { data } / { error } shape
    models/                # Kotlin data classes mirroring Event, Reservation, MenuItem, User
    repository/            # Interfaces + implementations wrapping Ktor + Room
  androidApp/
    ui/
      theme/               # Color.kt, Type.kt, Shape.kt — generated from design-system/*.md (§7)
      components/          # DkButton, DkCard, DkBadge, BilingualLabel, PatternAccent — mirrors components/ui/*
      nav/                 # Bottom nav scaffold (§8), NavHost
      screens/
        home/              # Events hub — calendar + list (§9.1)
        eventdetail/       # Event detail + reserve flow (§9.2)
        menu/              # Cafe menu (§9.3)
        myevents/           # Reservations, upcoming + past (§9.4)
        submitshow/         # Band/artist pitch form (§9.5)
        account/           # Profile, locale toggle, push opt-in, sign out (§9.6)
        staffdoor/         # Staff-only door check-in (§9.7)
    di/                    # Koin modules
```

This is intentionally the Android half of a KMP project, not a full KMP-with-iOS-target
build yet — §13 flags exactly when iOS work should start.

---

## 3. Backend: what already exists, what the app needs added

The good news, confirmed by listing `app/api/**`: **the REST surface is mostly already
there**, because the website itself calls a real JSON API for several flows, not only
Server Actions.

| Endpoint | Already exists | Mobile app use |
|---|---|---|
| `GET /api/events` | ✅ | Events hub list/calendar |
| `GET/PATCH /api/events/[id]` | ✅ | Event detail, admin edit (web-only, not called from the app) |
| `POST /api/events/[id]/reservations` | ✅ | "Reserve my spot" |
| `GET/DELETE /api/reservations/[id]` | ✅ | My Events — view/cancel a reservation |
| `POST /api/events/[id]/checkins`, `PATCH /api/checkins/[id]` | ✅ | Staff door tool (§9.7) |
| `POST /api/submissions`, `PATCH /api/submissions/[id]` | ✅ | Submit a Show |
| `POST /api/register` | ✅ | Sign up (needs the mobile auth bridge below to be useful) |
| `GET/PATCH /api/account`, `/api/account/password` | ✅ | Account screen |
| `POST /api/uploads` | ✅ | Not needed by v1 of the app (no user-generated image uploads in any app screen) |
| `POST /api/push/subscribe` | ✅, but **web-push shaped** | Needs an FCM-token variant — see §11 |
| **Cafe Menu** (`GET /api/menu`, category grouping) | ❌ — not built yet, `HOME_PAGE.md` §3 plans it for the website | The Menu tab (§9.3) is blocked on this shipping first; build order in §14 accounts for it |
| **Mobile auth / token issuance** | ❌ | New work — see below, this is the one real backend gap |

### The auth bridge (the one genuinely new backend piece)

`lib/auth.ts` runs NextAuth v5 with credentials + Google + Facebook + Apple, issuing a
browser session (JWT in an httpOnly cookie). A native app can't read or send that cookie
the way a browser tab does. Two realistic options, decision needed before Phase 2 (§14)
starts:

1. **A dedicated mobile sign-in route** (`POST /api/auth/mobile-login`) that accepts the
   same credentials NextAuth already validates, and returns a signed bearer token (a JWT,
   same signing secret/shape NextAuth already uses) instead of setting a cookie. Every
   other API route already runs through `guard()`/`currentUser()` in `lib/rbac.ts` — that
   helper needs to also accept `Authorization: Bearer <token>` alongside the existing
   cookie check, not replace it. This is the smaller change and the recommended path.
2. **Full OAuth-in-webview** for Google/Facebook/Apple sign-in from the app, landing back
   on the same mobile-login route to exchange the result for a bearer token. Needed either
   way if social sign-in should exist in the app at all — flagged as a v1 scope question
   in §13, not assumed here.

Either way: **no new user table, no parallel auth system** — same `User` model, same
`passwordHash`, same `role`. The app is a new *client* of the existing identity system,
not a second one.

---

## 4. Roles in the app

| Role | Gets the consumer app (§8–9) | Gets the door tool (§9.7) | Gets anything else |
|---|---|---|---|
| Guest (not signed in) | ✅ — browse events, browse menu, read about the cafe | ❌ | Reserve/Submit Show prompt sign-in, same as the website's decision |
| Member | ✅ full | ❌ | — |
| Staff | ✅ (staff are customers too) | ✅ — switches into door mode from Account | — |
| Admin | ✅ (as a person, not as "admin mode") | — | **No admin surface in the app at all — decision below** |

**Decision locked in: Admin does not get a mobile surface.** The admin dashboard
(`app/(site)/admin/*`) is a sidebar-plus-data-table product — monthly reports, the
band-submissions inbox, event CRUD — genuinely a desktop/tablet job, and
`PLAN/design-ui-layouts-website.md` §3.4 already confirmed the sidebar shape as final for
web. Building a second, worse version of that on a phone screen serves no one; the admin
opens the website like anyone doing spreadsheet-adjacent work would. This mirrors the
website's own existing role split (`Navbar.tsx` already gates `/admin` behind `hasRole`)
rather than inventing a new one.

---

## 5. Bilingual & RTL mandate (native, not a port of the CSS rules)

Arabic is the default language, RTL, exactly as on the website — but Compose's RTL
support is a different mechanism than Tailwind's logical properties, so this section
restates the rule in native terms rather than assuming it carries over automatically.

- **`LocalLayoutDirection`** is set from the user's locale choice (stored in DataStore,
  mirrors the web's `lib/actions/locale.ts` cookie-based toggle) and wraps the entire app
  `NavHost` — every Compose layout that uses `Modifier.padding(start = ..., end = ...)`
  (never `left`/`right`) mirrors automatically. This is the direct native equivalent of
  the website's Tailwind `ms-`/`pe-` mandate — same rule, different API.
- **Icons that imply direction** (back chevrons, the bottom-nav order itself) must be
  explicitly mirrored — Compose does not auto-flip icon *glyphs*, only layout direction.
  `Icons.AutoMirrored.Filled.ArrowBack` (and equivalents) over the non-mirrored versions,
  everywhere.
- **Bottom nav tab order reverses in RTL** — see §8's worked example. This is the single
  highest-risk RTL detail in this whole document because it's easy to get backwards
  without noticing in testing (a developer testing in English/LTR will never see the bug).
- **Bilingual label pattern carries over as-is:** `English Label / العربية`, per
  `design-system/02-typography.md` — same convention, implemented as a small
  `BilingualLabel` Compose composable mirroring the web component 1:1 (English first,
  forced LTR run, each half separately tagged for the system font it needs — see §7).
- **Fonts:** Cairo (Arabic) and Plus Jakarta Sans (Latin) — both are on Google Fonts, so
  they're bundled as local font resources (`res/font/`) rather than loaded at runtime, the
  native equivalent of `next/font/google`'s self-hosting. A `FontFamily` per language,
  selected the same way the web selects by `lang` tag: Arabic-tagged text always gets
  Cairo, Latin-tagged text always gets Plus Jakarta Sans, regardless of the screen's
  overall layout direction — same rule as `design-system/02-typography.md`, restated for
  Compose's `Text(fontFamily = ...)` instead of a CSS variable.

---

## 6. Tone of voice — unchanged, restated for where it applies in the app

`design-system/06-tone-of-voice.md` applies verbatim — this app is not a new brand voice,
it's the same one on a different screen. Concretely, for the screens in §9:

- **Warm/invitational:** the Home tab's empty/loading states, the reservation confirmation
  moment (§10's "peak"), the Account screen's welcome line, push notification copy.
- **Plain and clear:** the door tool (§9.7) — "Name", "Phone", "Payment Method", nothing
  clever, staff need speed over charm at a dim counter on a Thursday night.
- Every new string ships in both `ar` and `en` from the first commit, sourced from the
  same content decisions already made in `lib/i18n/dictionaries.ts` where a string
  already exists on the website (don't re-translate "Reserve my spot" — reuse the exact
  approved Arabic line). New app-only strings (push notification body text, offline-queue
  status messages) get drafted Arabic-first, per the tone doc's own rule, then given an
  English line that matches the feeling rather than a literal translation.

---

## 7. Visual design system — the same tokens, Compose-native

Nothing here invents a new palette. Every value below is copied from
`design-system/01-colors.md` and `app/globals.css` — the point of this section is the
*mapping* to Compose, not new decisions.

### Color tokens (`ui/theme/Color.kt`)

**Dark (the whole consumer app — Home, Event Detail, Menu, My Events, Submit a Show,
Account):**

| Compose token | Hex | Web source |
|---|---|---|
| `InkBlack` | `#18120D` | `ink-black` — screen background |
| `Coffee` | `#3B2A1F` | `coffee` — pressed/secondary surfaces |
| `SurfaceDark` | `#241B14` | `surface-dark` — cards, inputs |
| `BorderDark` | `#4A3B2C` | `border-dark` — card/input outlines |
| `OnDark` | `#F5F0EA` | `on-dark` — primary text on dark |
| `TextMuted` | `#9C9086` | `text-muted` — secondary/placeholder text |

**Accents (both surfaces):**

| Compose token | Hex | Web source |
|---|---|---|
| `GoldAccent` | `#D9A566` | `gold-accent` — primary buttons, active tab, links |
| `GoldAccentDeep` | `#C08A52` | `gold-accent-deep` — button gradient end-stop |
| `TanMuted` | `#B08968` | `tan-muted` — dividers, secondary labels |
| `Cream` | `#F3E6D8` | `cream` — logo badge plate |

**Light (Staff Door tool only — §9.7 is the one screen that flips):**

| Compose token | Hex | Web source |
|---|---|---|
| `Ink` | `#241611` | `ink` |
| `Paper` | `#FFFBF3` | `paper` |
| `Gold` | `#C08B4A` | `gold` |
| `Line` | `#E2D6C2` | `line` |

**Status (both surfaces):** `Good #5C9C74`, `Warn #D9A566`, `Bad #C2604A` — same three
tokens, same meanings (confirmed, pending, declined/cancelled) as `01-colors.md`.

**Rule of thumb, restated for the app:** every screen in §9 except Staff Door is dark
with gold accents. Staff Door is the one place that flips to the light "counter" theme —
`design-system/01-colors.md`'s `.dk-workspace` rule, expressed here as a second Compose
`MaterialTheme` applied only inside the door screen's `NavHost` branch, not a global
theme switch.

### Typography

- Headings: Cairo Bold / Plus Jakarta Sans ExtraBold — matches `02-typography.md`'s
  weight rule.
- Body: Cairo Regular / Plus Jakarta Sans Regular.
- Scale: reuse the same four-tier system the mobile-app-ui-design skill recommends
  (max 4 sizes, 2 weights) mapped onto the web's existing scale — page title ~24sp
  extrabold, section label ~11sp uppercase semibold (`letterSpacing` wide, matching the
  web's `tracking-[0.18em]`), body ~15sp regular, field label ~14sp bold. Don't add a
  fifth size for the app "because native allows it" — the discipline is the point.

### Spacing

8-point grid, exactly as both `design-system/03-spacing-radius.md` and the
`ui-ux-pro-max` skill's own rule agree: every spacing value divisible by 8 or 4. Card
internal padding 24dp baseline (matches the web's `p-6`), section vertical spacing 32dp,
related-element spacing 8–12dp.

### Components to build (native equivalents of `components/ui/*`)

| Compose component | Mirrors | Notes |
|---|---|---|
| `DkButton` | `Button.tsx` | Same variant set: gold (primary), outline, ghost, dark, danger — plus light variants for Staff Door |
| `DkCard` | `Surface.tsx`'s `Card` | Dark by default, flips to `Paper` only inside Staff Door's theme branch |
| `DkBadge` | `Surface.tsx`'s `Badge` | Tones: neutral/gold/good/warn/bad — status pill for reservation state, submission status |
| `BilingualLabel` | `BilingualLabel.tsx` | `en / ar` on one line, correct font per half, collapses to one render when identical |
| `LogoBadge` | `LogoBadge.tsx` | The دكة mark on the cream plate — required whenever the logo sits on `InkBlack` |
| `PatternAccent` | `PatternAccent.tsx` | The tatreez diamond motif — on native, drawn once as a tileable vector (`Canvas` + `Path`, or a bundled SVG via a vector-drawable), reused as a low-opacity divider band and a loading-skeleton texture, matching the web's two `variant`s |
| `DkTextField` | `TextField.tsx` | Bilingual label above field, optional leading icon; `dir`-forced LTR for email/phone/password content the same way the web does |

**Component checklist for anything new, restated for native:** before styling a new
screen from scratch, check whether it's really just `DkCard` + `DkTextField` +
`DkButton` + `DkBadge`. Same discipline as `04-components.md`'s web checklist.

---

## 8. The bottom navigation bar — the headline feature of this doc

**This is the answer to "the mobile UI isn't done yet, and I want a bottom nav for
one-handed reach."** Everything above sets up the brand and backend; this section is the
actual navigation architecture.

### Why bottom, and why this shape

`ui-ux-pro-max`'s Navigation Patterns rules (`bottom-nav-limit`, `tab-bar-ios`,
`nav-label-icon`, `bottom-nav-top-level`) and the mobile-app-ui-design skill's "primary
actions in the thumb zone" rule agree on the same shape a coffee-shop-plus-events app
needs: a **persistent, 5-item-max bottom tab bar**, icon + label on every item (never
icon-only — discoverability over minimalism), current tab visually distinct by fill +
`GoldAccent` color, and reachable with one thumb without the user shifting their grip —
exactly the "one-handed" requirement in the ask.

### The five tabs (Member/Guest — the default experience)

| # | Tab (EN / AR) | Icon | Destination | Badge |
|---|---|---|---|---|
| 1 | Home / الرئيسية | Outline house | Events hub (§9.1) | — |
| 2 | Menu / المنيو | Outline cup | Cafe menu (§9.3) | — |
| 3 | My Events / حجوزاتي | Outline ticket | Reservations (§9.4) | Dot badge when a new confirmation just landed |
| 4 | Submit Show / قدّم عرضك | Outline mic | Band/artist pitch form (§9.5) | — |
| 5 | Account / حسابي | Outline user circle | Profile, locale, push opt-in, sign out (§9.6) | — |

Five items, at the rule's own limit — deliberately not six. Event Detail is a **push
destination from Home**, not its own tab (`bottom-nav-top-level`: tabs are top-level
screens only, nothing nests a sub-navigation inside them). About/Contact content
(location, hours, socials — already live on the website's `/about`, per `lib/site.ts`)
lives inside Account as a section, not a sixth tab, since it's reference info a guest
checks occasionally, not a destination they return to daily.

**Guest (not signed in) sees the same five tabs.** Home and Menu work fully without an
account. Tapping "Reserve my spot" from Event Detail, or opening My Events / Submit Show,
prompts sign-in — exactly the website's own confirmed decision
(`PLAN/idea.md` §9's guest-reservation question, resolved the same way both places: the
button is always visible, the account requirement surfaces at the point of commitment,
not before).

### Staff — the bar itself changes, not just its content

Staff are customers first (they still see the five-tab bar above) but need a fast way
into door mode on an event night. **Decision:** door mode is not tab #6. Staff open it
from a "Door Check-In" entry inside Account (visible only when `role === "staff"`,
mirroring `Navbar.tsx`'s existing `hasRole(user, "staff")` gate) — opening it swaps the
whole screen into the light Staff Door theme (§7) and **replaces the bottom bar** with a
single full-width "Exit Door Mode" bar, because door check-in is a focused, one-task tool
that shouldn't compete with tab-switching mid-shift. This matches
`PLAN/design-ui-layouts-website.md` §3.3's website decision that Staff gets a
density/contrast layer, not a new nav paradigm — here that becomes "a modal-like
full-screen tool," the native equivalent of the same idea.

### RTL mirroring — worked example, not left implicit

In the Arabic (RTL, default) layout, the tab bar's reading order reverses so it still
reads start-to-end correctly:

```
LTR (English):   [ Home ]  [ Menu ]  [ My Events ]  [ Submit Show ]  [ Account ]
RTL (Arabic):    [ Account ]  [ Submit Show ]  [ My Events ]  [ Menu ]  [ Home ]
```

Home stays the reading-start item in both directions (leftmost in LTR, rightmost in RTL)
— it's still the first thing a thumb naturally lands on, because the *visual* start
position is what matters for one-handed reach, not the literal screen-left pixel. This is
the native equivalent of Compose's automatic RTL row-reversal (`Row` reverses its
children under `LocalLayoutDirection.Rtl` automatically) — the risk flagged in §5 is
**not** building the bar as a manually-ordered `Row` with hardcoded left-to-right
`Modifier.offset` positions, which would silently break this. Use Compose's native `Row`
(or `NavigationBar` from Material 3, which already handles this correctly) rather than a
custom-positioned layout.

### Interaction & sizing (from `ui-ux-pro-max`'s Touch & Interaction rules)

- Tab height: 56–64dp, safe-area-aware bottom inset added on top (never let the gesture
  bar/home indicator overlap tap targets — `safe-area-awareness` rule).
- Each tab's tap target: full available width ÷ 5, minimum 48×48dp met by construction.
- Active-tab transition: icon fill + label color animate to `GoldAccent` over 150–200ms,
  no layout shift (transform/opacity only, matching `lib/motion.ts`'s own rule that the
  website already follows — one motion philosophy across both surfaces).
- Press feedback: Material ripple, standard, no custom override — `system-controls` rule
  ("prefer native/system controls over fully custom ones").

---

## 9. Screens

### 9.1 Home — Events Hub

Calendar-first, exactly the direction `PLAN/design-ui-layouts-website.md` §3.1 already
locked in for the website's guest experience — reused here rather than inventing a
second IA for the same content. A month calendar (dots on days with a published event) as
the primary browse surface, with a "Soonest" rail beneath it (3–4 upcoming cards,
horizontally scrollable) for anyone who'd rather scan a list than think in month-grid
terms. Tapping a day or a card opens Event Detail. Pull-to-refresh for a manual sync;
background refresh on tab focus otherwise.

**Empty/first-open state:** never a blank calendar — if no events are published yet
(shouldn't happen in production, but matters for a fresh install before first sync),
show the "About Dekka" content (from `lib/site.ts`) as a warm placeholder rather than
a bare grid, per the mobile-app-ui-design skill's "turn empty states into opportunities"
rule.

### 9.2 Event Detail

Day/date/time, location (with a "Get Directions" action opening `lib/site.ts`'s
`mapsEmbed` URL in the system maps app — no in-app map view needed for v1), price,
payment terms (cash / InstaPay, with the InstaPay number shown if set), T&Cs, and the
**Reserve my spot** button, mirroring `models/Event.ts`'s exact field set 1:1.

**The reserve flow — this is the app's peak moment (§10):** tapping Reserve does not
navigate away. The button morphs in place into a confirmation card — door code in large
tabular-figure type (the code is what gets shown at the entrance, it needs to be legible
at a glance, not a small inline string), a short warm confirmation line, and a subtle
one-shot animation echoing the brand's coffee-cup/steam motif from the web's loading
screen (`PLAN/coffee-loader.md`) — reusing an existing brand idea rather than inventing
a new "success" animation from scratch. This is a Compose `AnimatedContent` /
shared-element transition, the native equivalent of the website's Framer Motion `layout`
morph already planned in `design-ui-layouts-website.md` §3.2.

### 9.3 Cafe Menu — blocked on the website feature shipping first

Per `HOME_PAGE.md` §3, the Menu feature (categories, items, `isFeatured`, `available`)
does not exist yet anywhere in the codebase. This tab's build is sequenced *after* that
ships on the website (§14) — the app should not build its own parallel menu data model.
Once the API exists (`GET /api/menu`, grouped by category): categories as horizontal
chips/sections, items as cards (name, price, description, optional photo — same
"looks intentional without a photo" rule `HOME_PAGE.md` already specified, since no
dish photography exists yet either).

### 9.4 My Events

Two sections, Upcoming and Past, each reservation as a ticket-style card: event name,
date, and — for upcoming — the same large door code from §9.2's confirmation, so a guest
can pull this screen up at the entrance without hunting for a confirmation email that
doesn't exist (there is no email confirmation in this system — the app screen *is* the
proof). Cancel action available on upcoming reservations only, with a confirmation
dialog (`confirmation-dialogs` rule — never a bare destructive tap).

### 9.5 Submit a Show

Band/artist name, genre, links (SoundCloud/Instagram/YouTube), preferred dates, short
pitch — mirrors the website form and `models/BandSubmission.ts` field-for-field. Uses
progressive disclosure (links section collapsed behind an "Add links" affordance rather
than three empty fields up front, per the mobile-app-ui-design skill's structure rule) and
ends in a clear confirmation state ("We got it — you'll hear from us"), not just a toast
that vanishes, since this is a meaningful moment for the person submitting.

### 9.6 Account

Profile (name, email, phone — editable, mirrors `/account`), locale toggle (Arabic/
English — the single most-used control for a bilingual-first app, placed at the top of
this screen, not buried), push-notification opt-in toggle (§11), sign out, and — role-
gated — the "Door Check-In" entry point into §9.7 for staff. About/location/hours/social
links live here as a scrollable section beneath the account controls, sourced from
`lib/site.ts` exactly as the website's footer/about page already are.

### 9.7 Staff Door Check-In

The one screen that flips to the light "counter" theme (§7) — high contrast for a
counter at night, large touch targets (48dp minimum, up from the app's normal 44dp, per
`design-ui-layouts-website.md` §3.3's own website decision for the same tool). Add-
attendee form (name, phone, payment method, amount — mirrors `models/CheckIn.ts`), a
live-updating list of who's already checked in for the selected event, and **offline
queueing** (§10): a check-in entered with no connection is stamped locally and shown as
"pending sync," never silently lost or blocking the next entry.

---

## 10. Interaction, motion, and the emotional beats

Applying the `ui-ux-pro-max` and mobile-app-ui-design skills' shared framework — peak,
end, and the anti-patterns to avoid — mapped onto this specific app rather than generic
advice:

- **The peak:** the Reserve confirmation (§9.2). This is the one moment worth a designed
  "holy dang" beat — everything else in the app should be calm and fast, not competing
  for the same attention.
- **The ending, per session:** My Events (§9.4) doubles as the app's "you're set" closing
  screen — a guest who reserved and then checks My Events on their way out the door sees
  the ticket-style card and the venue/time again, a small reaffirming close rather than
  the app just going quiet.
- **Negative peaks to soften, specifically:**
  - Offline door check-in (§9.7) — "pending sync" reads as reassurance, not an error.
  - An event that fills up mid-browse — a clear, non-alarming "Full" state on the card
    and detail page (`Bad`/`Warn` token, plus text — never color-only, per
    `color-not-only`), not a dead-end error.
  - Submit-a-Show's wait — the confirmation screen (§9.5) explicitly sets the expectation
    ("you'll hear from us") rather than leaving the pitch feeling like it vanished into a
    form.
- **Global motion rules, one set for the whole app (mirrors `lib/motion.ts`'s own
  discipline on the website — one vocabulary, not per-screen invention):** 150–300ms for
  micro-interactions, transform/opacity only, ease-out on enter/ease-in on exit, respects
  system reduced-motion. Stagger list entrances (events list, menu items) 30–50ms per
  item — not all-at-once, not a slow crawl.

---

## 11. Push notifications

**Decision needed, flagged plainly:** the web already ships browser push via VAPID/
`PushSubscription` (`models/PushSubscription.ts`) for "a new event just went live,"
opt-in only, per `PLAN/idea.md` §8's recorded scope change. **Native push is a separate
delivery mechanism (FCM), not a reuse of that model as-is** — an Android push token is
not a web-push subscription object. Two ways to handle it, pick one before Phase 3 (§14):

1. **Add an `fcmToken` array field to the same `User` document** (or a small new
   `DeviceToken` collection keyed by user) and a separate send path in the event-publish
   flow that fans out to both web-push subscribers and FCM tokens for the same "new event
   published" trigger — one business event, two delivery channels.
2. **Keep them fully separate** (different collection, different send code) if the two
   channels are expected to diverge later (e.g., reservation reminders only on mobile).
   Costs a little duplication now for more flexibility later.

Either way: **same opt-in philosophy as the web** — nothing sends to a device that hasn't
explicitly granted the OS permission and toggled it on in Account (§9.6), no dark
patterns, no pre-checked box. `PLAN/idea.md` §8 explicitly keeps "reminders before an
event you've reserved" out of scope for now — the app's push stays limited to the same
"a new event just went live" announcement the web already ships, not a broader
notification strategy invented here.

---

## 12. Offline & performance

- **Door check-in (§9.7) is the one screen that must survive a dropped connection** — a
  local Room queue of pending check-ins, retried on connectivity return (`WorkManager`),
  each shown as "pending sync" until confirmed. Nothing else in the app needs this level
  of resilience; don't over-build offline support for the browse/reserve screens, which
  can fail gracefully with a retry state instead (`error-recovery` rule — a clear cause +
  a retry action, not a silent failure).
- **Skeleton loading, not spinners,** for the Home calendar/list and Menu — reuses the
  `PatternAccent` texture idea from `PLAN/design-ui-layouts-website.md` §4's skeleton spec
  for the website, so the loading moment feels like Dekka even before content arrives,
  rather than a generic gray box.
- **Image caching via Coil** for event posters and (once built) menu photos — cache
  aggressively, these change rarely per event/item.
- **No artificial delays anywhere** — same rule the website's coffee-loader doc
  (`PLAN/coffee-loader.md`) is explicit about: perceived performance comes from honest,
  fast loading states, never a padded-out animation "so it doesn't look too fast."

---

## 13. Open decisions — lock these in before Phase 2 starts

1. **Mobile auth bridge shape** (§3) — the new bearer-token sign-in route vs. also
   building OAuth-in-webview for Google/Facebook/Apple in the app. Recommend: ship
   email+password bearer-token auth first, add social sign-in to the app in a later pass
   once the pattern is proven — say so if social sign-in is actually a v1 requirement.
2. **iOS timeline.** This doc scopes Android first with KMP boundaries kept clean so iOS
   is an extension, not a rewrite — but doesn't schedule iOS work. Say when (or if) it's
   wanted; that decides how strictly `shared/` needs to stay Android-agnostic from day one
   versus allowing minor shortcuts now that get cleaned up later.
3. **Push delivery shape** (§11) — combined `User.fcmToken` vs. a separate device-token
   collection.
4. **Minimum Android version / device support floor** — affects which Compose/Material 3
   APIs are safe to use without fallbacks.
5. **App store account & signing** — Google Play Console account, package name
   (`com.dekka.app` or similar), and who owns the signing key — logistics, not design, but
   blocking for any real distribution and worth settling early rather than at ship time.
6. **Menu tab launch timing** (§9.3, §14) — ships only after the website's Menu feature
   (`HOME_PAGE.md` §3) is live; confirm that sequencing is acceptable rather than wanting
   the app's menu built against a temporary/hardcoded dataset.

---

## 14. Build order

Ordered by dependency, matching how this repo's other PLAN docs sequence phased work —
stop after each phase for review before the next, same discipline as
`developer-guide.md` §5's "Feature loop."

1. **Backend: mobile auth bridge** (§3) — blocks everything else; nothing in the app can
   be a signed-in flow without it. Can happen in parallel with Phase 2 below since it's
   backend-only work on the existing Next.js repo, not the new mobile codebase.
2. **App scaffold** — KMP module boundaries (`shared/`), Koin DI setup, theme tokens from
   §7, the bottom nav shell from §8 with all five tabs present but showing placeholder
   content. This is the single most valuable early milestone: the actual navigation
   feature this doc was written to spec, working end-to-end, before any screen is fully
   built out.
3. **Home + Event Detail + Reserve flow** (§9.1–9.2) — the core "why someone opens this
   app" loop. Wire to the real `/api/events` and reservation endpoints once Phase 1 lands.
4. **My Events** (§9.4) — small once reservations exist; mostly a read + cancel screen
   against `/api/reservations/[id]`.
5. **Submit a Show** (§9.5) — self-contained, no dependency on anything above except auth.
6. **Account** (§9.6) — profile, locale, push opt-in toggle (UI only until Phase 8),
   about/location content from `lib/site.ts`.
7. **Staff Door Check-In** (§9.7) — including the offline queue (§12), the most
   operationally important screen for an actual event night; verify against a real
   (harmless) event before considering it done.
8. **Push notifications** (§11) — FCM wiring, once §13's decision on delivery shape is
   made.
9. **Cafe Menu tab** (§9.3) — sequenced last deliberately; do not start before the
   website's Menu feature (`HOME_PAGE.md` §3) has shipped `GET /api/menu`.
10. **Polish pass** — motion (§10), empty/error/loading states across every screen, RTL
    verification pass (§5, §8's worked example — test the tab bar in Arabic specifically,
    not just the rest of the UI), accessibility pass against the `ui-ux-pro-max`
    Pre-Delivery Checklist (contrast, touch targets, reduced motion, dynamic type).

---

## 15. Prompt for Claude Code (Opus)

Copy everything in the fenced block below as-is, matching this repo's own convention
(`CLAUDE.md`: Sonnet for planning docs, Opus for implementation) — hand it to Opus once
§13's open decisions are answered.

```
You're starting a new mobile app codebase for Dekka, a companion Android app (KMP-ready
for iOS later) to the existing Dekka Next.js website in this workspace. Before writing
any code, read DEKKA_MOBILE_APP.md (this document) in full, plus — in the website repo —
developer-guide.md, PLAN/idea.md, design-system/ (all six files), and
PLAN/design-ui-layouts-website.md. DEKKA_MOBILE_APP.md is the spec for everything below;
don't re-derive it from scratch, follow it.

Hard rules, restated because they're easy to violate by default:
- Kotlin Multiplatform module boundaries from day one: shared/ (api, models, repository)
  has zero Android-only dependencies, even though only androidApp/ ships in v1. This is
  what makes iOS later an extension, not a rewrite — see §2 and §13.2.
- The bottom nav (§8) is the headline feature of this whole project — five tabs max
  (Home, Menu, My Events, Submit Show, Account), icon + label on every item, RTL-correct
  tab order (§8's worked example — verify this specifically in Arabic, it's the easiest
  thing to get backwards without noticing), safe-area-aware, Material ripple feedback.
- Every color/spacing/type value comes from §7's token tables, which are copied directly
  from design-system/*.md in the website repo — do not invent new hex values or
  spacing numbers anywhere.
- Bilingual by default: every string ships in both ar and en from the first commit,
  reusing exact approved copy from the website's lib/i18n/dictionaries.ts wherever the
  same string already exists there (don't re-translate "Reserve my spot" or any other
  shipped line). New app-only copy (push notification text, offline-sync status
  messages) follows design-system/06-tone-of-voice.md's Arabic-first drafting rule.
- The Menu tab (§9.3) is blocked on the website's Menu feature shipping GET /api/menu —
  do not build it against placeholder/hardcoded data; build the other six screens first
  per the build order in §14, and confirm the website API is live before starting it.
- The mobile auth bridge (§3, §13.1) is new backend work in the Next.js repo, not just
  the mobile app — lib/rbac.ts's guard()/currentUser() needs to accept a Bearer token
  alongside the existing cookie check. Build and verify this against the real API before
  any app screen that requires sign-in.
- Staff Door Check-in (§9.7) needs the offline queue (§12) to be considered done — a
  check-in entered with no connection must never be silently lost.
- No test suite exists yet for this new codebase — write it as you go for the shared/
  module at minimum (pure Kotlin, no Android dependency, cheap to test); manual device
  verification for Compose UI, documented the same way developer-guide.md §8's Feature
  Log entries describe verification for the website.

Build in the order from §14 — stop after each phase and wait for review before starting
the next:

PHASE 1 (parallel with Phase 2) — Mobile auth bridge (§3, backend, in the website repo)
Add a POST /api/auth/mobile-login route issuing a bearer token from validated
credentials, using the same signing approach NextAuth already uses. Extend
lib/rbac.ts's guard()/currentUser() to accept Authorization: Bearer <token> alongside
the existing cookie check — don't replace the existing web session path. Verify against
a real (harmless) account, not the seed script (MONGODB_URI is the live database, same
rule as every other feature in this repo).

PHASE 2 — App scaffold
KMP shared/ module (api client shell, model classes for Event/Reservation/User/
BandSubmission/CheckIn mirroring the website's Mongoose schemas field-for-field), Koin
DI setup, theme tokens (§7) in ui/theme/, and the five-tab bottom nav shell (§8) with
placeholder screens. This phase's done-state is: the app launches, shows all five tabs,
switches between them, and renders correctly in both English/LTR and Arabic/RTL — before
any screen has real content.

PHASE 3 — Home, Event Detail, Reserve flow (§9.1, §9.2)
Wire to /api/events and the reservation endpoints via Phase 1's bearer auth. Build the
reserve-button-to-confirmation-card morph (§9.2, §10's "peak" moment) as a real
AnimatedContent transition, not a page navigation.

PHASE 4 — My Events (§9.4)
Upcoming/past reservations, large door-code display, cancel with confirmation dialog.

PHASE 5 — Submit a Show (§9.5)
Form with progressive disclosure on the links section, real confirmation state on
success.

PHASE 6 — Account (§9.6)
Profile, locale toggle (top of screen), push opt-in toggle (UI now, wired in Phase 8),
about/location/social content from the website's lib/site.ts values, and the staff-only
Door Check-In entry point.

PHASE 7 — Staff Door Check-In (§9.7)
Light-theme screen (§7's Staff Door tokens), 48dp minimum touch targets, add-attendee
form matching models/CheckIn.ts, and the offline queue (§12) — Room-backed pending list,
WorkManager sync retry, clear "pending sync" state per entry.

PHASE 8 — Push notifications (§11)
FCM integration per whichever delivery-shape decision was made in §13.3. Opt-in only,
wired to the Account toggle from Phase 6.

PHASE 9 — Cafe Menu (§9.3)
Only after confirming GET /api/menu is live on the website. Category sections, item
cards, graceful no-photo state matching HOME_PAGE.md §3's website spec for the same data.

PHASE 10 — Polish pass
Motion audit against §10's rules, empty/error/loading states on every screen, a full RTL
verification pass with specific attention to the bottom nav's tab order, and a run
through the ui-ux-pro-max Pre-Delivery Checklist (contrast, touch targets ≥48dp,
reduced-motion support, dynamic type / font-scale support).
```

---

## What's still your call

- **Which of §13's six open decisions to answer before Phase 2 starts** — auth-bridge
  scope, iOS timeline, push delivery shape, minimum OS version, app-store logistics, and
  Menu-tab sequencing. None of them block the app scaffold (Phase 2) itself, but several
  block later phases and are cheaper to answer now than mid-build.
- **Whether social sign-in (Google/Facebook/Apple) is a v1 requirement for the app** —
  this doc recommends shipping email+password first and adding social sign-in once the
  bearer-token pattern is proven; say so if that's the wrong call.
- **Real photography, again** — the app's Event Detail and (later) Menu cards inherit the
  same content gap `HOME_PAGE.md` already flagged for the website: no dish/event photos
  in the repo today beyond the logo and one banner. Every card in this doc is designed to
  look intentional without one.
