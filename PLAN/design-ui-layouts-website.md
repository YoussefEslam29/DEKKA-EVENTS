# Dekka — UI Layouts Plan (design-ui-layouts.md)

For Claude Code to implement in the actual Next.js app. This documents the mockup work done
in the design tool (`Dekka Baseline.dc.html`), covering a faithful recreation of what's shipped
plus a small set of confirmed changes. Drop this file in `PLAN/` alongside `idea.md` and
`authorization-UI.md`.

Source of truth for tokens/components: `app/globals.css`, `components/ui/*`,
`design-system/*.md`. Nothing here invents new tokens — every color/spacing value below already
exists in the codebase.

---

## 1. Status: what this covers

**Recreated 1:1 from source** (verified against `AuthScreen.tsx`, `AuthForm.tsx`, `DoorTable.tsx`,
`admin/page.tsx`, `admin/report/page.tsx`, `admin/events/page.tsx`, `my-events/page.tsx`,
`about/page.tsx`, `Navbar.tsx`, `dictionaries.ts`):

- Auth — desktop login (60/40 split) and mobile signup (Arabic RTL)
- My Events (member)
- Staff door check-in
- Admin overview (sidebar + tabs)
- Admin monthly report
- About / contact

These are **baseline** — no functional changes, just confirms current visual state renders
correctly. Two small fixes applied on top of baseline during review (§2) should be ported back
into code as real bugs, not treated as new design.

**Not yet built in the mockup** (this file's Phase 2, below): the 4 distinct role UIs
(Guest / Member / Staff / Admin) as differentiated experiences, the calendar-first events hub,
and the motion spec. Implement Phase 1 fixes first; Phase 2 is a separate, larger pass — treat
each of its sections as a standalone ticket.

---

## 2. Phase 1 — bug fixes found during recreation (port into real code)

These are layout bugs the recreation surfaced, confirmed against the actual component contracts
in `AuthForm.tsx` / `Button.tsx`. Even though they were "found" in a static mockup, they describe
real overflow risk in the live app:

1. **Auth hero headline is too heavy.** `text-4xl xl:text-5xl font-extrabold` on the desktop
   hero headline (`AuthScreen.tsx`) and `text-3xl font-extrabold` on the mobile "Welcome
   Back"/"Create Account" heading (`AuthForm.tsx`) read as too loud against the dark photo panel.
   Confirmed direction: drop to **`font-semibold`** (was `font-extrabold`) and one step down in
   size — desktop hero `text-[34px]` (was `text-4xl`/`text-5xl`), mobile heading `text-2xl`
   (was `text-3xl`). Apply `text-cream/90` instead of solid `text-cream` on the hero headline,
   and `text-on-dark/90` on the mobile heading, so it sits back slightly rather than shouting.
   The Arabic sub-line under the hero headline should drop with it: `text-base` (was `text-lg`),
   `text-cream/60` (was `text-cream/75`).

2. **Desktop social buttons wrap and look cramped.** `buttonStyles` already sets
   `whitespace-nowrap` at the button level, but the bilingual span inside (`<BilingualLabel>` in
   `SocialButton`) does not inherit it in every browser at 420px width, so "Continue with Google /
   المتابعة بجوجل" can wrap to two lines inside the 48px-tall button. Add `whitespace-nowrap`
   explicitly to the label span in `AuthForm.tsx`'s `SocialButton`, and drop the label one step to
   `text-sm` (was inheriting `text-base` from `size="lg"`) so it fits comfortably.

None of these are copy changes — verbatim strings from `dictionaries.ts` stay as-is.

---

## 3. Phase 2 — four role UIs (new work, not yet built)

**Principle confirmed with stakeholder:** keep the existing dark-public / cream-back-office split
(§8 of `authorization-UI.md`) as the base, but Staff gets its own variant on top of the cream
workspace rather than being visually identical to Admin — see §3.3.

### 3.1 Guest (not logged in)

- Events hub becomes **calendar-first**: the primary browse surface on `/` is a month calendar
  (reuse `MonthCalendar.tsx`, already built for `/admin/events?view=calendar` — lift it into the
  public hub rather than building a second calendar component). Below the calendar, keep the
  existing soonest-first list as a secondary "Upcoming" rail, collapsed to 3–4 cards with a
  "See all" link, so a guest who doesn't want to think in month-grid terms still has the old
  linear feed one scroll away.
- Guest sees the "Reserve my spot" button same as a member (per README decision #2, always
  visible); tapping sends to `/login?next=…`.
- No account-only chrome (`My Events`, account menu) — `Navbar.tsx` already conditions on `user`,
  no change needed there.

### 3.2 Member (logged in, role `member`)

- Adds `My Events` nav + the reservation code UI already built (§ Phase 1 recreation, unchanged).
- New: on the event detail page, once reserved, show the confirmation as a **card morph**, not a
  full navigation — the "Reserve my spot" button should transform in place into the confirmed
  state (code + "You're on the list") rather than reloading the page. Framer Motion `layout`
  animation on the button→card, matching the existing `motion` usage pattern in
  `AuthForm.tsx`/`NavLinks.tsx` (project already depends on `framer-motion`, see `lib/motion.ts`).

### 3.3 Staff (role `staff`)

- Keep the cream `.dk-workspace` base (per README, this stays a data-entry-friendly light theme)
  but apply a **staff-specific density/contrast layer**, since this is used one-handed on a phone
  at a dim counter at night, not at a desk:
  - Minimum tap targets **48px** (up from the workspace default ~40px) on the add-attendee form
    and the reservation-list rows.
  - Bump base font size in the door tool from `text-sm`/`text-base` to one step larger site-wide
    within `/staff/*` only (a `.dk-workspace.dk-staff` modifier class, scoped so `/admin` is
    untouched).
  - Keep the same `paper`/`gold`/`line` tokens — no new colors — just larger touch surface and
    type.
  - This only affects `/staff/*` routes; `/admin/*` keeps the current density.

### 3.4 Admin (role `admin`)

- Layout unchanged (sidebar + content, already implemented in `admin/layout.tsx`) — this is what
  stakeholder picked as the preferred shape, no rebuild needed.
- Confirmed direction: no new visual identity beyond current cream workspace — Admin and Staff
  stay in the same color family, differentiated only by §3.3's density layer and by Admin's wider
  nav (5 sections vs. Staff's single door tool).

---

## 4. Motion spec (confirmed subset — implement these four, nothing else yet)

Stakeholder picked 4 of 9 candidate motion treatments. Everything else (chart draw-in, number
tickers, hover-only micro-interactions as a category) is explicitly **out of scope** for this
pass — don't add incidental motion beyond what's listed.

1. **Page/route transitions.** A simple fade+8px-slide on route change, consistent across all
   four roles. `lib/motion.ts` already exports `useMotionPresets()` / `DURATION` — add a shared
   `routeTransition` preset there rather than inventing per-page variants.
2. **Reserve button → confirmation morph** (detailed in §3.2 above).
3. **Tatreez pattern draw-on for dividers/loading.** `PatternAccent` (`components/ui/
   PatternAccent.tsx`) currently renders as a static masked band. Add an entrance animation: the
   mask reveals left-to-right (`clip-path` animated from `0%` to `100%` width) over ~600ms when
   the divider scrolls into view, using `IntersectionObserver` or Framer's `whileInView`. Applies
   everywhere `PatternAccent` is already used (auth hero, about page, footer) — one change in the
   shared component covers every instance.
4. **Skeleton loading states.** For the events hub (both calendar and list view) and the admin
   tables, add a skeleton pass using the same `PatternAccent variant="field"` texture at low
   opacity as the loading placeholder (per `authorization-UI.md` §6's original spec for
   `PatternAccent` — "a loading-skeleton texture" — this was planned but not yet wired up
   anywhere in the codebase; this is the first real usage).

---

## 5. Explicitly not changing

- Copy/strings — every string above is verbatim from `lib/i18n/dictionaries.ts`; do not
  rewrite tone of voice.
- Color tokens — no new hex values anywhere in this plan; everything maps to existing
  `--color-*` tokens in `app/globals.css`.
- Component APIs — `Button`, `TextField`, `Card`, etc. keep their current props; §2 and §3.3
  are styling-only changes (new Tailwind classes / one new modifier class), not new component
  variants, except where explicitly noted (routeTransition preset in `lib/motion.ts`).

## 6. Reference

Mockup file: `Dekka Baseline.dc.html` (design tool project) — static HTML recreation, not
importable code, but every color/spacing value in it was copied from the files listed in §1 and
can be diffed against directly.
