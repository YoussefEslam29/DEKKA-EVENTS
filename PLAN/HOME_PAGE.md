# Home Page Redesign — Dekka

Written 2026-09-01, against the homepage as it stands (`app/(site)/page.tsx`), the
design system (`design-system/`), and the shared animation vocabulary already built
(`lib/motion.ts`, `components/ui/Motion.tsx`). This is the plan-before-code doc for
this feature, in the same shape `developer-guide.md` §5's "Feature loop" already asks
for — read this, then hand the prompt at the bottom to Opus in VS Code.

**Scope note, since another `MOBILE_APP.md` is coming later:** this document is the
*website* homepage only — mobile-first, responsive, running in a browser. It is not a
native app spec. The web build being genuinely mobile-first (real breakpoints, ≥44px
touch targets, no horizontal scroll) is what makes it "easy on a phone" for now; a
native app, if and when that gets built, is its own document and its own decisions —
don't let this one quietly grow into that.

---

## What's actually there today

`app/(site)/page.tsx` (`EventsHubPage`) is a real, working page — not a stub. It has:
a header with `LogoBadge`, a tagline, and a search form; a row of filter pills
(all/live/karaoke/open-mic); a two-column layout pairing `MonthCalendar` with a
compact "soonest first" rail; the full upcoming events grid (`EventCard`); and a past
events section. All server-rendered, `force-dynamic`, reflecting live reservation
counts.

What it doesn't have, confirmed by reading the file and the repo: **any animation at
all** (no `framer-motion` import anywhere in it, despite the library already being a
dependency and already having a shared vocabulary in `lib/motion.ts` from the admin
dashboard work), **no loading screen** (nothing between "click the link" and "the
server-rendered HTML arrives"), and **no cafe menu** (confirmed — no `Menu` model, no
`/menu` route, nothing; the one `menu` string that exists in
`lib/i18n/dictionaries.ts` means the hamburger nav menu, not food — flagged below so
this doesn't collide).

**Decision locked in: keep what works, layer the new stuff on top.** The search,
filters, calendar, and event lists stay exactly where they are and keep working
exactly as they do now. This doc adds a proper hero moment, a real Menu feature, and
motion throughout — it does not restructure the page's core information architecture.

---

## The reference you sent

Both loading-screen references are the same idea in two visual treatments: a coffee
cup **filling up** as the loading indicator, not a generic spinner. One is a hand-
drawn line-art style — a horizontal bar fills with dark coffee, then drips off the
end into a cup below, which slowly fills; "COFFEE LOADING…" hand-lettered above it.
The other is flat and minimal — a cup outline with a wavy gold/orange liquid line
rising inside it, "loding…" (the typo is part of the charm) beneath.

Both work *because* the loading indicator literally is the product — a coffee cup
filling is not a generic UI metaphor borrowed from somewhere else, it's Dekka's own
thing. That's the brief for the section below: not "copy either image," but build an
**original** cup-filling animation in Dekka's actual brand (ink-black background, gold
accent, the line-art icon language the rest of the app already uses, bilingual text)
that does the same job.

---

## 1. Loading screen

**The real design decision here isn't the animation — it's *when* it fires,** and
getting that wrong is exactly how a "keep me from getting bored" idea turns into
"why is this thing here again, I clicked back for one second."

**How Next.js already does this, and why that matters:** the App Router has a
built-in convention for this — a `loading.tsx` file in a route segment automatically
renders while that segment's async Server Component is fetching data, via a Suspense
boundary Next.js manages for you. `app/(site)/page.tsx` is already
`force-dynamic` and does real async data fetching (`getPublicEvents`,
`countReservationsForEvents`), so a `loading.tsx` next to it is the *correct*
primitive — not a hand-rolled client-side timer/overlay hack. This also means it's
free real progress, not a fake spinner running for an arbitrary duration.

**The catch, and the recommended fix:** because the homepage is `force-dynamic`,
Next.js re-triggers that `loading.tsx` on **every** navigation back to `/`, not just
the visitor's first-ever load. Show the full, elaborate cup-filling splash every
single time someone clicks the logo to go home and it stops being delightful and
starts being an obstacle. Two-tier approach:

- **First visit of the browser session → the full splash.** A small client-side check
  (a `sessionStorage` flag, set the first time it runs) gates the full, elaborate
  animation to once per session. This is what should look like the reference images —
  full-bleed, unhurried, a real "welcome" moment.
- **Every other load of `loading.tsx` (repeat navigation back to `/`, or any other
  route's own data fetch) → a small, fast variant.** Same visual language (the cup
  icon, the gold liquid), much smaller footprint — a compact centered mark, not a
  full-screen takeover — so a returning navigation feels quick, not repetitive.
- **Never an artificial minimum duration.** The animation runs exactly as long as the
  real data fetch takes. If that's genuinely instant on a fast connection, add a short
  delay (~150–200ms) before the splash is even allowed to appear, so it doesn't
  flash-blink on screen for one frame — but never pad it out longer than the real
  wait just to "let the animation finish." A fake delay is the anti-pattern this
  section is designed to avoid, not the fix.
- **`prefers-reduced-motion` → the static final frame** (a full cup, no liquid
  animation, no bounce), consistent with how every existing preset in `lib/motion.ts`
  degrades — `reduced` is a required argument there for exactly this reason, and this
  new component should follow the same rule rather than inventing its own.

**Visual spec (original, not a copy of either reference):**
- Full-screen overlay, `ink-black` background, centered content — the same "first
  thing you see" weight the current header's `PatternAccent` + `LogoBadge` combo
  already has, so it doesn't feel like a different app for two seconds.
- A single-stroke, line-art coffee cup icon (matches the "SVG icons, one consistent
  stroke style, never emoji" rule already in this codebase's design system) in
  `gold-accent`, with the liquid inside rising via an animated clip-path/mask —
  transform/opacity-safe, no layout-thrashing properties.
- A short bilingual line beneath it, cross-fading between "جاري التحضير…" and
  "Brewing…" — reuses the existing bilingual pattern (`BilingualLabel` /
  `English / العربية` conventions in `design-system/02-typography.md`) rather than
  inventing new copy conventions for one component.
- Optional, cheap continuity touch: the same small steam-wisp motif can reappear as a
  tiny animated accent in the redesigned hero (§2) — one visual idea, used twice,
  reads as intentional brand craft rather than "we built a loading screen and a hero
  separately."
- Duration target: the full first-visit splash should feel like a beat, not an ad —
  aim for the animation's own visual cycle to complete in roughly 1–1.5s, capped, even
  if the real data fetch is slightly faster or slower (fetch finishing first ends it
  early; fetch running long lets the liquid gently loop rather than freezing
  mid-fill).

**New files:** `app/(site)/loading.tsx` (the route-level Suspense fallback Next.js
already knows how to use), a `components/CoffeeLoader.tsx` (the actual animated
component, takes a `variant: "full" | "compact"` prop so both tiers share one
implementation), and the small `sessionStorage`-gated client wrapper deciding which
variant to render.

---

## 2. Hero section — motion pass, not a rebuild

**What's there:** `PatternAccent` + `LogoBadge` + tagline + search form, static.
**What changes:** the exact same content, staggered in with the existing
`fadeUp`/`staggerContainer` presets from `lib/motion.ts` — logo badge first, tagline a
beat later, search bar last — so the page feels like it's *arriving*, not just
appearing. This is a direct reuse of the vocabulary already built for the admin
dashboard (`developer-guide.md` §8's "§1 Motion system" entry), not a new animation
system. Add the small steam-wisp accent from §1 near the tagline as the one new visual
element — subtle, looping, respects `prefers-reduced-motion`.

No new copy, no new layout structure, no new components beyond what's needed to wire
the existing presets in — this section is intentionally the smallest change in this
whole document.

---

## 3. Cafe Menu — new feature, real feature

**Decision locked in:** items live in the database, admins manage them from a real
admin screen — the same weight and pattern as Events, not a hardcoded content block.

**Naming collision to avoid:** `lib/i18n/dictionaries.ts` already has a `menu` key
meaning the hamburger nav menu (`t.nav.menu` = "Menu" / "القائمة"). The new feature's
strings need their own namespace — `t.cafeMenu.*` (or similar) — not a second `menu`
key colliding with the existing one. Small thing, but exactly the kind of thing that's
invisible until the type-check catches a duplicate key or, worse, doesn't catch it and
two unrelated strings quietly share one.

**Data shape:**
- `MenuCategory` — `nameAr`, `nameEn`, `order` (display order, admin-controlled, not
  alphabetical — a cafe wants "Hot Drinks" before "Snacks," not Z-before-A).
- `MenuItem` — `category` (ref), `nameAr`, `nameEn`, `descriptionAr?`, `descriptionEn?`,
  `price`, `image?`, `isFeatured` (boolean — powers the homepage preview, see below),
  `available` (boolean — 86'd items stay in the system, just hidden from the public
  menu, same spirit as an event's `status` rather than deleting rows), `order`.
- **Index:** `MenuItem` gets `{ category: 1, order: 1 }` — matches the real query
  shape ("items in this category, in display order"), following the exact discipline
  `developer-guide.md` §4.1 already documents for `Event`/`Reservation` — don't add
  anything speculative beyond that one compound index.

**Two surfaces, one dataset:**
- **`/menu`** — the full page, every category, every available item. This is where
  someone goes to actually browse the whole menu.
- **Homepage section** — a compact preview, not the whole thing: a handful of
  `isFeatured` items (admin picks which, the same way `isPoster` is a manual admin
  toggle on `Event` today, not a computed value) in a horizontal card row, with a
  clear "View Full Menu" link to `/menu`. This is what answers "must show on the
  homepage" without turning the single-page scroll into the entire printed menu.

**Admin surface:** `/admin/menu`, following the exact shape `developer-guide.md` §9's
"adding a typical CRUD feature" checklist already lays out — model, Zod schema in
`lib/validation.ts` (`.strict()` on anything feeding a `$set`), API routes under
`app/api/menu/**` (`guard("admin")` for writes, no guard needed for the public
GET since menu content isn't sensitive the way reservation data is), a read helper in
`lib/data.ts` if the homepage/`/menu` query needs more than a plain `find()` (grouping
items by category in one query, not N+1 — `developer-guide.md` §4.3), a page built
from the existing `PageHeader` + `Card` + `ui/` primitives, `.dk-workspace` for the
cream admin theme. This is not a new pattern — it's the same recipe as every other
admin CRUD screen in this app.

**Content dependency to flag, not block on:** no dish/drink photos exist anywhere in
the repo today (checked `IMGS/` and `public/brand/` — logo and one banner only). Build
`image` as optional on `MenuItem` and design the card to look intentional without a
photo (a clean text-forward card, not a broken-image icon) — swap in real photos once
they exist rather than waiting on them to ship the feature.

---

## 4. Calendar of events

Already built (`MonthCalendar`), already correct, already reflects real event dates in
Cairo time. The only change here is motion: the day cells stagger in with
`staggerContainer`/`staggerItem` on month load, and switching months crossfades rather
than hard-cutting. No functional change, no new data, no new component beyond wiring
the existing presets — same spirit as §2's hero pass.

---

## 5. The extra sections

Your answer on this came back selecting all three additions **and** "none of these" at
once — read as: include the three, since they were each picked individually. Say the
word if "none" was actually what you meant and this section should be dropped
entirely.

- **About / location & hours** — the data already exists in full in `lib/site.ts`
  (address, hours, maps embed) and is already live on `/about`. This is the cheapest
  addition in the whole doc: a homepage teaser card (address + hours + a "Get
  Directions" link, maybe the same embedded map already proven on `/about`) linking
  through — no new data, no new model, just a new section pulling from what's already
  there.
- **Photo gallery** — **blocked on real content.** There are no cafe or event photos
  in this repo today (same finding as the menu-photo gap above — only the logo and one
  banner exist). Build the section's shell now (a responsive image grid/strip
  component) with a real, honest empty state rather than placeholder stock photography
  — Dekka's own design-system rule against filler content applies here directly. Swap
  in real photos the moment you have them; don't ship fake ones to fill space in the
  meantime.
- **Instagram / social** — the real handle is already in `lib/site.ts`
  (`instagram: "https://www.instagram.com/dekkacafe/"`). Recommend a simple, well-
  designed "Follow @dekkacafe" card linking out, **not** a live embedded feed —
  Instagram's embed/API options either need app review and access tokens (real
  infrastructure for a small addition) or a paid third-party embed service. A
  good-looking link-out card gets the "we're active on social" signal across for
  near-zero engineering cost; say so explicitly if a real live feed is actually wanted
  instead, since that's a materially bigger scope than everything else in this
  section combined.

**Placement:** below the core spine (hero → menu preview → calendar/upcoming →
full upcoming grid), above past events — supporting content, not competing with the
page's actual job of getting someone to an event or the menu.

---

## Section order (top to bottom)

1. Hero (§2) — logo, tagline, search, animated entrance
2. Cafe Menu preview (§3) — featured items, link to `/menu`
3. Calendar + "soonest first" rail (§4, existing layout, animated)
4. Full upcoming events grid (existing, unchanged)
5. About/location teaser, gallery, Instagram (§5, in that order — practical info
   before atmosphere before social)
6. Past events (existing, unchanged, stays last — it already is)

This keeps events as the page's primary spine (this is an events-hub page today, by
its own function name and by `PLAN/idea.md`'s framing of Dekka as an events-first
business) while giving the two "must show" additions — Menu and the loading screen —
real, deliberate weight rather than bolting them on wherever there was space.

---

## Design principles for this pass

- **Every animation is `reduced`-aware, using the existing `lib/motion.ts` presets
  first.** Only build a new preset (the cup-fill, the steam wisp) where nothing in the
  existing vocabulary fits — don't rebuild `fadeUp`/`staggerContainer` a second time
  for this feature.
- **Transform/opacity only**, matching the rule already documented in `lib/motion.ts`
  — nothing here animates width/height/top/left.
- **No fake delays, ever.** The loading screen's whole premise (§1) is real perceived-
  performance, not decoration bought with an artificial wait.
- **No emoji, no stock icon fonts** — SVG line-art matching the existing icon
  language, per `design-system/`'s own rule and the general "no emoji as structural
  icons" standard.
- **Bilingual by default, not retrofitted** — every new string (menu items, loading
  text, new section headings) goes into `lib/i18n/dictionaries.ts` for both `ar` and
  `en` from the first commit, the same discipline every existing feature in this app
  already follows.
- **Mobile-first, real touch targets** — ≥44px on every new interactive element (menu
  item cards, the "View Full Menu" link, gallery items), verified at a real phone
  width before calling any of this done, not just eyeballed on a desktop browser.

---

## Build order

1. **Loading screen (§1)** — self-contained, no dependency on anything else, and
   immediately visible/testable on its own.
2. **Hero motion pass (§2)** and **calendar motion pass (§4)** — small, mechanical,
   can happen together since both are "wire existing presets into existing markup."
3. **Cafe Menu (§3)** — the one real new feature with a model, admin screen, and two
   public surfaces. Biggest single piece of work here; build and verify it on its own
   before touching the homepage's section order.
4. **Extra sections (§5)** — About/location teaser first (cheapest, no content
   dependency), gallery shell and Instagram card after.
5. **Final assembly** — the homepage section order from above, all sections in place,
   one full pass checked at phone width with `prefers-reduced-motion` on and off.

---

## Prompt for Claude Code (Opus) in VS Code

```
You're working in the Dekka repo. Before touching anything, read developer-guide.md,
PLAN/idea.md, design-system/ (all six files), and PLAN/HOME_PAGE.md in full —
HOME_PAGE.md is the spec for everything below; don't re-derive it from scratch,
follow it.

Hard rules from developer-guide.md, restated because they're easy to violate by default:
- No branches, no worktrees. Commit directly to main.
- MONGODB_URI is the live production database. Never run scripts/seed.ts against it.
  Test the new Menu feature by creating and cleaning up real (harmless) documents
  through the admin UI you build, the same way every entry in the Feature Log
  describes doing.
- Every write goes through parseBody() + a Zod schema in lib/validation.ts. Every
  protected route goes through guard()/currentUser(). Every schema that feeds a $set
  is .strict(). Reuse PageHeader/Card/ui/ primitives and the .dk-workspace pattern for
  the admin menu screen — don't invent new UI patterns where existing ones fit.
- lib/motion.ts already has the shared animation vocabulary (fadeUp, staggerContainer/
  staggerItem, pressable, tabIndicator), all reduced-motion-aware via a required
  `reduced` argument. Reuse these first; only add a new preset (the coffee-cup fill,
  the steam wisp) for what genuinely doesn't exist yet, and follow the same
  reduced-motion-as-required-argument convention when you do.
- Bilingual by default: every new string (menu items, section headings, loading text)
  goes into lib/i18n/dictionaries.ts for both ar and en. Use a new t.cafeMenu.*
  namespace for the menu feature — do NOT reuse the existing `menu` key, which already
  means the hamburger nav menu, not food.
- There is no test suite. Verification is: npm run typecheck, npm run lint, npm run
  build, all clean — plus manual exercise of the actual new code path (create a menu
  category/items through the real admin UI, view /menu and the homepage section, check
  the loading screen on a hard refresh), and a short note of what you verified and
  how, in the style of developer-guide.md §8's Feature Log entries.
- Before building anything non-trivial, write a short plan.md in PLAN/ first
  (developer-guide.md §5's "Feature loop"), the same shape as PLAN/authorization-UI.md.

Build in this order. Stop after each phase and wait for me before starting the next —
I want to review and test each one before you build on top of it.

PHASE 1 — Loading screen (HOME_PAGE.md §1)
Build components/CoffeeLoader.tsx (variant: "full" | "compact") and
app/(site)/loading.tsx wired to it. Full variant: full-screen ink-black overlay,
single-stroke line-art coffee cup in gold-accent with an animated liquid fill
(clip-path/mask, transform/opacity only), bilingual "جاري التحضير… / Brewing…" text
cross-fade. Gate the full variant to once per browser session via sessionStorage; every
other trigger of loading.tsx (repeat navigation, other routes) gets the compact
variant instead. No artificial minimum duration — it runs exactly as long as the real
data fetch takes, with a short (~150-200ms) appearance delay so it doesn't flash on
instant loads. Full prefers-reduced-motion fallback: static final-frame cup, no
animation, matching how every existing preset in lib/motion.ts degrades.

PHASE 2 — Hero and calendar motion pass (HOME_PAGE.md §2, §4)
Wire the existing lib/motion.ts presets (fadeUp, staggerContainer/staggerItem) into
the current hero (LogoBadge → tagline → search bar, staggered) and the MonthCalendar
day cells (staggered reveal, crossfade on month change). No layout or copy changes —
this phase only adds motion to what's already there. Add the small looping steam-wisp
accent near the hero tagline, reusing the same visual idea as the loading screen's cup
icon for brand continuity.

PHASE 3 — Cafe Menu feature (HOME_PAGE.md §3)
Build the full feature: models/MenuCategory.ts and models/MenuItem.ts (fields exactly
as specified in HOME_PAGE.md §3, including the { category: 1, order: 1 } index on
MenuItem and the isFeatured/available booleans), Zod schemas in lib/validation.ts,
API routes under app/api/menu/** (guard("admin") on writes, public GET unguarded), a
read helper in lib/data.ts that groups items by category in one query (no N+1), an
admin screen at /admin/menu following the existing admin CRUD pattern exactly
(developer-guide.md §9), a public /menu page showing every available item grouped by
category, and a homepage preview section showing isFeatured items with a "View Full
Menu" link. Handle missing item photos gracefully — image is optional, cards look
intentional without one, no broken-image icons.

PHASE 4 — Extra homepage sections (HOME_PAGE.md §5)
About/location teaser card pulling from lib/site.ts (address, hours, map, matching
what's already proven on /about). A photo gallery section shell with a real empty
state (not stock placeholder photos) since no real photos exist yet. A simple
"Follow @dekkacafe" Instagram link-out card using the real handle already in
lib/site.ts — not a live embedded feed.

PHASE 5 — Final assembly
Assemble the full homepage in the section order from HOME_PAGE.md's "Section order"
list. Check the whole page at a real phone width (375px) and with
prefers-reduced-motion enabled and disabled. Confirm every new interactive element
meets the 44px touch-target minimum. Update developer-guide.md §8 (Feature Log) with
what shipped, new files/deps/env vars, and a Verification line stating plainly what
was and wasn't exercised — matching the style of every existing entry there.
```

---

## What's still your call

- **Whether §5's extras are actually wanted** — the answer that selected them also
  selected "none of these" in the same response; I've built the plan assuming you want
  all three, say so if that's wrong before Phase 4 runs.
- **Real photos** — for the menu items and the gallery, whenever you have them. Both
  are built to look intentional without them and to accept them later without a
  redesign.
- **Instagram: link-out card vs. a real live embed** — the plan assumes the simple
  card. A genuine live feed is real extra scope (API access, tokens, or a paid embed
  service) — flag it now if that's actually what you want instead.
