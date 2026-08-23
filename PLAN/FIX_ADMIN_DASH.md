# Fix: Admin Dashboard (FIX_ADMIN_DASH.md)

Plan for six requested changes to the admin/staff back-office: motion, an excel-style
data-entry table, a real tabbed overview, an events calendar, analytics charts on the
monthly report, and a centered nav bar. Written against the current code
(`app/(site)/admin/*`, `app/(site)/staff/*`, `components/DoorTable.tsx`,
`components/layout/Navbar.tsx`, `models/*`, `lib/data.ts`) after reading
`developer-guide.md` and every doc in `PLAN/`, per the repo's own instruction to do
that before touching a line. **Status: open questions answered below — this is the
implementation plan, not yet built.** Follows the same "decisions locked in →
per-section spec → implementation checklist" shape as `PLAN/fix_Events.md`.

Per this session's own project rule (Sonnet writes plans, Opus implements): nothing in
this file has been coded. Hand this to an Opus implementation session next.

## Decisions locked in

| # | Question | Answer |
|---|---|---|
| Ref | The two reference dashboards | `dash.motokoui.com` blocks fetching (robots.txt) — grounded instead in the shadcn "Studio Admin Dashboard" reference (KPI cards, data table, sidebar, chart card) and the `ui-ux-pro-max` skill's dashboard/chart guidance. **Not** a shadcn/ui install — developer-guide.md §6 says don't hand-pick colors for a new admin screen, wrap it in `.dk-workspace` and reuse the existing hand-rolled `components/ui/*` primitives. We borrow the *patterns* (KPI tiles, data table, calendar, chart cards, centered nav), not the component library. |
| 1 | Scope of the "excel-like" table | **Both** — the existing per-event Door Check-in table becomes a real inline-editable spreadsheet grid, *and* a new global **Customers** page is added to the admin dashboard rolling up every check-in across every event into one spreadsheet. |
| 2 | What the "Reservations" tab shows | **One combined reservations table** — a new dedicated view listing every member's reservation across all events (event, name, phone, code, status), not just a filtered events list. |
| 3 | How strict the Wednesday-karaoke rule is | **Visual only, event-driven.** The calendar shades whichever Wednesdays already have a real `Event` document (created via the existing Duplicate workflow from `fix_Events.md` §2a). No auto-generated placeholder event, no schema change, no blocking a second event on a Wednesday. A day-of-week hint (pure date math, no new data) reminds the admin which day is "usually karaoke," nothing more. |
| 4 | Which nav bar moves to the center | **The single shared `Navbar.tsx`.** `app/(site)/layout.tsx` wraps *everything* — public pages and `/admin`/`/staff` alike — in one `<Navbar />`, so there is only one nav bar for the whole site to begin with. Centering it applies everywhere automatically; no separate admin-only nav component is being introduced. |

---

## 0. What "fix" means here, concretely

Six asks from the brief, mapped to sections below:

1. Framer Motion + animation "on everything" → **§1**
2. Excel-style table for name/phone/payment → **§2**
3. Overview tiles show the exact slice, not the whole events section → **§3**
4. Calendar UI on Events, booked days shaded/tagged (Wednesday = karaoke) → **§4**
5. Monthly report gets analytics graphs, cool UI/UX (`ui-ux-pro-max`) → **§5**
6. Nav bar centered, more interactive → **§6**
7. A real "back to where I came from" button across the back-office → **§7**

Everything here stays inside the existing architecture from `developer-guide.md`: pages
in `app/(site)/...`, API routes follow the `handle()` + `guard()` + `parseBody()`
pattern, reads that need more than `findById` go in `lib/data.ts`, enums stay in
`lib/constants.ts` (never import `@/models/*` from a client component), every new
label gets both `ar` and `en` keys in `lib/i18n/dictionaries.ts`, RTL stays on logical
Tailwind properties (`ps-`/`pe-`/`ms-`/`me-`, never `pl-`/`pr-`).

---

## 1. Motion system — Framer Motion, applied consistently

**Today:** zero animation library in `package.json`. Every interaction (tab switch,
card hover, table row, filter chip) is a hard cut.

**Add:** `framer-motion` as a dependency. New `lib/motion.ts` exporting a small set of
shared variants so every screen animates with the same rhythm instead of every
component inventing its own timing (`ui-ux-pro-max` §7 `motion-consistency`):

- `fadeUp` — page/section entrance (opacity + 8–12px translateY, 200–250ms, ease-out).
- `staggerContainer` / `staggerItem` — KPI tiles, table rows, calendar cells reveal
  30–50ms apart, not all at once (`stagger-sequence`).
- `pressable` — `whileTap={{ scale: 0.97 }}` for cards/buttons/tiles, restoring on
  release (`scale-feedback`). Transform/opacity only — never animate width/height
  (`transform-performance`).
- `tabIndicator` — a `layoutId`-based sliding pill/underline for active tab/nav state
  (used in §3 and §6).
- All variants read `useReducedMotion()` and collapse to instant/no-op transitions when
  true (`reduced-motion` — non-negotiable per the skill's CRITICAL/HIGH accessibility
  tier).

**Where it lands:**
- `Card` hover/tap in `components/ui/Surface.tsx` gets the `pressable` treatment
  site-wide (KPI tiles, event cards, submission rows).
- Admin/staff page mounts (`PageHeader` + first content block) use `fadeUp`.
- Lists (`AdminEventsPage` table rows, `DoorTable` rows, submissions list) use
  `staggerContainer`/`staggerItem`.
- Loading states: replace bare "loading" text with a skeleton built from
  `PatternAccent` (the tatreez texture already exists for exactly this per
  `authorization-UI.md` §6) animated as a slow shimmer — ties motion back to the brand
  instead of a generic gray pulse.
- Keep every micro-interaction inside the skill's 150–300ms band; nothing above
  400–500ms (`duration-timing`, `excessive-motion` — animate 1–2 key elements per view,
  not everything at once despite the brief's "everything").

---

## 2. Spreadsheet-style data entry (name, phone, how fees were paid)

Two things ship here, per the locked-in "both" decision.

### 2a. New shared primitive: `components/ui/DataGrid.tsx`

A generic, keyboard-navigable inline-edit grid — this is the actual "excel-like" piece,
reused by both 2b and 2c instead of being built twice:

- Renders as a real `<table>` (accessibility: screen readers, `aria-sort` on sortable
  headers — `ui-ux-pro-max` §10 `sortable-table`).
- Click a cell → it becomes an input/select in place. `Tab`/`Shift+Tab` moves across a
  row, `Enter` commits and drops focus one row down (spreadsheet muscle memory), `Esc`
  reverts the cell. Text/tel columns are plain inputs; the payment-method column is a
  small `<select>` cell (cash/instapay — from `lib/constants.ts`, never `@/models/*`).
- Each committed edit fires a per-row `onCommit(rowId, patch)` callback — the grid holds
  no server knowledge itself, callers wire it to whatever API route applies.
- Row actions column (delete, with the existing `Trash2` icon pattern from
  `DoorTable.tsx`).
- Touch targets ≥44×44px even in "spreadsheet" mode so staff can use it one-handed on a
  phone at the door (`touch-target-size` — CRITICAL tier); inputs get
  `touch-action: manipulation` to kill the 300ms tap delay.

### 2b. Door Check-in table becomes editable, not append-only

**Today:** `DoorTable.tsx` is a side form (add) + a read-only results table (view/delete
only) — fixing a mistyped phone number means delete-and-re-add.

**Fix:** keep the quick-entry side form as-is (fast one-hand entry is the actual UX
priority at a busy door — don't replace muscle-memory with a slower spreadsheet-first
flow), but swap the results `<table>` for `DataGrid` in edit mode so staff/admin can
correct a name or phone inline after the fact.

- New route: `PATCH /api/checkins/[id]` (doesn't exist yet — today's route only has
  `DELETE`). Guarded `guard("staff")` — same rank as the existing `POST`/`DELETE` on
  this resource. Validated by a new `updateCheckInSchema` in `lib/validation.ts`
  (name/phone/paymentMethod/amount, all optional/partial).
- `DoorTable.tsx`: the `checkIns` table body renders through `DataGrid`; `onCommit`
  calls the new `PATCH`, then updates local state the same way `addAttendee`/
  `removeCheckIn` already do (optimistic, no full refetch).

### 2c. New global "Customers" page in the admin dashboard

**Today:** the only place to see who came and how they paid is per-event, on the staff
door table. There's no cross-event view for the admin.

**Fix:** a new `/admin/customers` page — every `CheckIn` row across every event, in one
`DataGrid`, with the event's title/date shown per row so it's still traceable to a
night. This is the literal ask: "NAME, PHONE, AND HOW FEES PAYED," admin *and* staff
editable, just not scoped to a single event this time.

- New link in `app/(site)/admin/layout.tsx`'s `links` array — `t.admin.customers` with
  a `Users` icon (lucide, already a dependency).
- New read helper in `lib/data.ts`: `getAllCheckIns({ eventId?, q? })` — a single
  aggregation joining `CheckIn` → `Event` (title/date only, no N+1 per
  developer-guide.md §4.3), sorted newest first, capped like `getSubmissions` (limit
  200–500, add pagination later if it's ever needed — cafe scale, same spirit as the
  existing "accepted tradeoff" notes in Known Gaps).
- Filter bar above the grid: event picker + free-text search (name/phone), same pattern
  as `DoorTable`'s existing `Search` input.
- Edits go through the same new `PATCH /api/checkins/[id]` from §2b — one API surface,
  two UIs.
- Guard: `guard("admin")` on the page (layout-level, like every other `/admin/*` route)
  — staff still only touches check-ins through their own event's door table, not the
  cross-event view, matching the existing role split in `idea.md` §3.

---

## 3. Overview tiles → real tabs, each showing the exact slice

**Today:** `AdminOverviewPage` (`app/(site)/admin/page.tsx`) renders four KPI tiles
(Upcoming / Drafts / Reservations / Submissions) that are just `<Link>`s to
`/admin/events` or `/admin/submissions` — clicking "Drafts" or "Upcoming" both land on
the same unfiltered `AdminEventsPage`, which is exactly the bug in the brief ("please
show the exact option, not just showing the whole event section").

**Fix:** turn the Overview page itself into a tabbed view — clicking a tile switches an
in-page tab instead of navigating to a different, unfiltered screen. Each tab renders
only that slice.

- New client component `components/AdminOverviewTabs.tsx`: four tabs — **Upcoming**,
  **Drafts**, **Reservations**, **Submissions** — with an animated sliding indicator
  (`layoutId="overviewTab"` from `lib/motion.ts`, §1) under the active tab.
- `AdminOverviewPage` (server component) fetches all four slices up front in parallel
  (`Promise.all`, no client-side waterfall) and passes them as props — switching tabs is
  a pure client-side visibility toggle, not a refetch:
  - **Upcoming** → `getPublicEvents({ when: "upcoming" })` filtered further to
    `status === "published"` — what's already shown today, kept as the default tab.
  - **Drafts** → `getAllEvents()` filtered to `status === "draft"` (new, currently
    nothing shows drafts-only).
  - **Reservations** → the new combined table, see below.
  - **Submissions** → `getSubmissions("pending")` — reuses `SubmissionRow` (existing
    component), scoped to pending like the KPI tile's own count already implies.
- Tab state syncs to `?tab=` in the URL (`useSearchParams`/`router.replace`, shallow) so
  the tab is shareable/back-button-safe (`ui-ux-pro-max` §9 `deep-linking`,
  `state-preservation`) — landing on `/admin?tab=drafts` opens straight to Drafts.
- New read helper in `lib/data.ts`: `getAllReservations({ limit })` — aggregates
  `Reservation` joined to `Event` (title/date) for the **Reservations** tab, columns:
  event, name, phone, code, status, reserved-on, checked-in (cross-referenced against
  `CheckIn.reservation`, same join `getEventReservations` already does per-event —
  reused, not reinvented).
- KPI tiles stay at the top (still useful as at-a-glance counts + the visual entry
  point into each tab) but clicking one now activates the matching tab in place instead
  of navigating away.

---

## 4. Events calendar view

**Today:** `/admin/events` is a flat table, sorted newest-first, no date-at-a-glance
view. There's no way to see "is Wednesday open" without scanning rows.

**Fix:** add a month calendar as a second view on the same page, not a new route —
`/admin/events` gets a **Table / Calendar** toggle (persists the choice per session via
plain client state, no new backend).

- New component `components/MonthCalendar.tsx` — a hand-rolled month grid (matches the
  codebase's existing pattern of small hand-rolled pieces like `MonthPicker.tsx`, no new
  calendar dependency). Uses the same month-range logic already proven in
  `lib/data.ts`'s `monthRange()` for the monthly report.
- Each day cell:
  - Shaded/tinted (`gold-wash` token, already used elsewhere for hover states) and
    dot-tagged when a real `Event` exists that day, dot color from the existing
    `statusTone` map in `AdminEventsPage` (draft = neutral, published = good, etc.) so
    the calendar reads consistently with the table view.
  - Clicking a day with an event → `/admin/events/[id]`. Clicking an empty day →
    `/admin/events/new` with that date pre-filled (`startsAt` query param, consumed by
    `EventForm.tsx`'s existing create-path defaults from `fix_Events.md` §1).
  - **Wednesday hint:** every Wednesday cell (`date.getDay() === 3`, pure client-side
    date math — no schema, no server call) gets a small low-emphasis note/icon ("usually
    karaoke night") *in addition to* the real shading above. This is a reminder for the
    admin, not a rule: an empty Wednesday still just looks like an empty day you can
    book anything into; a Wednesday with a real event shades exactly like any other
    booked day. This is what keeps §3's locked-in decision ("visual only, event-driven")
    intact while still surfacing the recurring pattern you flagged.
- Entrance stagger on the grid cells (`§1`), respects `prefers-reduced-motion`.
- Mobile: the grid degrades to a scrollable/compact month view rather than introducing
  horizontal scroll (`ui-ux-pro-max` §5 `horizontal-scroll` is a hard "avoid").

---

## 5. Monthly report — analytics graphs

Ran the monthly-report page's requirements through `ui-ux-pro-max`'s chart and
dashboard guidance (its CLI scripts weren't available in this session — the tool result
came back with only `SKILL.md` synced, no `scripts/` — so this section is built from the
skill's inline Quick Reference tables, §10 Charts & Data specifically, rather than a
generated design-system doc).

**Today:** `MonthlyReportPage` is three KPI tiles + a cash/instapay row + a plain table.
All real numbers, zero visualization.

**Fix:** add chart cards above/beside the existing table (the table stays — charts
alone aren't screen-reader friendly, `data-table` rule — so this is additive, not a
replacement):

- Add `recharts` as a dependency (the standard, lightweight choice for this stack; no
  chart library exists in `package.json` today).
- **Revenue trend** — one bar per event in the selected month, x-axis = event date,
  y-axis = revenue. Bar chosen over line since these are discrete event-nights, not a
  continuous series (`chart-type`: comparison → bar).
- **Cash vs InstaPay split** — a small donut, exactly 2 categories so it stays within
  the skill's `no-pie-overuse` guidance (avoid pie/donut past ~5 categories; 2 is fine).
- **Attendees per event** — horizontal bar (reads better than vertical on mobile widths,
  `responsive-chart`).
- Color: `gold-accent`/`gold-deep` for the primary series, `coffee-brown`/`ink` for the
  secondary, `cream`/`gold-wash` for chart backgrounds and gridlines — pulled straight
  from the existing tokens in `design-system/01-colors.md`, not new hex values
  (`color-guidance`, `token-driven theming`).
- Every chart: visible legend, hover/tap tooltips with exact values
  (`tooltip-on-interact`), axis labels with units, gridlines kept low-contrast so they
  don't compete with the data (`gridline-subtle`).
- Empty state: a month with zero events shows a real "No events this month yet" message
  in place of the chart, not a blank axis frame (`empty-data-state`).
- Chart entrance respects `prefers-reduced-motion`; data must be legible immediately,
  not gated behind an animation finishing (`animation-optional`).
- `MonthPicker.tsx` (already exists) stays as the month switcher — no changes needed
  there.

---

## 6. Centered, more interactive nav bar

**Today:** `Navbar.tsx` is logo-left, links left-aligned filling the remaining space,
controls right. It's the one shared nav for the entire site — public pages *and*
`/admin`/`/staff`, since `app/(site)/layout.tsx` wraps everything in it (there's no
separate admin nav component to touch).

**Fix:** re-lay the desktop nav as logo (start) — **centered link group** — controls
(end), instead of logo–links–controls filling left-to-right:

- Wrap the `<nav>` link list in a rounded "pill" container (reuses existing
  `border-border-dark`/`bg-surface-dark` tokens), positioned with `absolute
  inset-inline-start-1/2 -translate-x-1/2` (RTL-safe via logical `inset-inline-start`,
  not `left`) inside the header's flex row, so it sits mathematically centered
  regardless of how wide the logo or the right-side controls are.
- Active link gets a `layoutId="navIndicator"` sliding pill background (from
  `lib/motion.ts`, §1) instead of the current static `hover:bg-surface-dark` — the
  indicator glides between links on navigation/hover rather than snapping
  (`state-transition`).
- Link hover/tap gets the shared `pressable` variant (subtle scale, §1).
- Mobile: unchanged structurally — the existing `<details>` disclosure menu is already
  a reasonable no-JS-required pattern; it just gains the same `pressable` tap feedback
  on its rows.
- Because this is the one shared `Navbar`, this change is automatically "the whole
  nav-bar for the whole website" (your answer to Q4) — no separate pass needed for
  `/admin` or `/staff`.

---

## 7. A real "back" button, everywhere in the back-office

Added mid-plan, per your follow-up: admin/staff sub-pages should have a back button
that returns to whichever page the user actually came from — not a hardcoded parent
link.

**Today:** back navigation in the back-office is ad hoc. `staff/events/[id]/page.tsx`
hardcodes a `ChevronLeft` link to `/staff`; `admin/events/[id]/page.tsx` imports
`ChevronLeft` too but the destination is similarly a fixed route, not "wherever you
were." Several sub-pages (`admin/events/new`, `admin/report`, `admin/submissions`, the
new `admin/customers` from §2c) have no back affordance at all. If an admin drills in
from a filtered Overview tab (§3) or from a specific calendar day (§4), a hardcoded
parent link would drop them back at the unfiltered top of the section instead of where
they actually were.

**Fix:** one shared `components/ui/BackButton.tsx`:

- Primary behavior: `router.back()` (Next.js `useRouter` from `next/navigation`) — true
  browser-history "previous page," so returning from an event detail opened via
  `?tab=drafts` lands back on that same tab, not a reset overview
  (`ui-ux-pro-max` §9 `back-behavior`, `state-preservation`).
- Fallback `href` prop for the case there's no in-app history to go back to (a
  bookmarked/shared link opened directly) — each call site passes the sensible parent
  route as the fallback (e.g. `admin/events/[id]` → `/admin/events`,
  `staff/events/[id]` → `/staff`), and the component only uses it when
  `window.history.length` shows nothing to go back to, otherwise `router.back()` wins.
- Same `ChevronLeft` (RTL-flipped, already the pattern in `staff/events/[id]/page.tsx`
  — `rtl:rotate-180`) + bilingual `t.common.back` label, `pressable` tap feedback (§1),
  44px+ touch target.
- Replaces the two existing hardcoded `ChevronLeft` links (`staff/events/[id]`,
  `admin/events/[id]`) and gets added to every sub-page that doesn't have one yet:
  `admin/events/new`, `admin/customers` (§2c), and any deep link inside `admin/report`
  reached from elsewhere (e.g. clicking a row in the new Reservations tab, §3).
- Not added to the four top-level tabs under `admin/layout.tsx`'s sidebar-turned-nav
  (Overview, Events, Submissions, Report) or to `/staff` itself — those are entry
  points, not drill-ins, and already reachable from the centered nav bar (§6); a back
  button there would just duplicate it.

---

## Implementation checklist

Everything below is scoped; no remaining open questions.

- [ ] **Deps:** add `framer-motion` and `recharts` to `package.json`.
- [ ] **§1** `lib/motion.ts`: `fadeUp`, `staggerContainer`/`staggerItem`, `pressable`,
      `tabIndicator` variants, all reduced-motion-aware.
- [ ] **§1** Apply `pressable`/`fadeUp`/stagger to `components/ui/Surface.tsx`'s `Card`,
      admin/staff page mounts, and existing list renders (events table, submissions,
      door table rows).
- [ ] **§6** `components/layout/Navbar.tsx`: center the link pill, add the
      `layoutId` active indicator, `pressable` on links — ships before §2–§5 since it's
      the smallest, most isolated change (touches one shared file, no new routes/data).
- [ ] **§2a** New `components/ui/DataGrid.tsx` — generic inline-edit table primitive.
- [ ] **§2b** `lib/validation.ts`: `updateCheckInSchema`. New
      `app/api/checkins/[id]/route.ts` `PATCH` handler (the file already exists for
      `DELETE` — add the method). `DoorTable.tsx`: swap the results table for
      `DataGrid` in edit mode.
- [ ] **§2c** `lib/data.ts`: `getAllCheckIns({ eventId?, q? })`. New
      `app/(site)/admin/customers/page.tsx` + nav link in `admin/layout.tsx`. Reuses the
      `PATCH` from 2b.
- [ ] **§3** `lib/data.ts`: `getAllReservations({ limit })`. New
      `components/AdminOverviewTabs.tsx`. Rewrite `app/(site)/admin/page.tsx` to fetch
      all four slices server-side and render the tab component; sync active tab to
      `?tab=`.
- [ ] **§4** New `components/MonthCalendar.tsx`. `app/(site)/admin/events/page.tsx`:
      add the Table/Calendar toggle; wire empty-day click → prefilled
      `/admin/events/new?startsAt=...`.
- [ ] **§5** `app/(site)/admin/report/page.tsx`: add the three chart cards (revenue bar,
      cash/instapay donut, attendees bar) above the existing table, using `recharts`
      and the existing design tokens; empty-month state.
- [ ] **§7** New `components/ui/BackButton.tsx` (`router.back()` + fallback `href`).
      Swap the two existing hardcoded `ChevronLeft` back-links
      (`staff/events/[id]/page.tsx`, `admin/events/[id]/page.tsx`) for it; add it to
      `admin/events/new`, `admin/customers` (§2c), and any other admin sub-page reached
      as a drill-in.
- [ ] **i18n:** add both `ar`/`en` keys for every new label — nav tab names, "Customers"
      page, calendar hint text, chart titles/legends, `PATCH` error strings — to
      `lib/i18n/dictionaries.ts` (compile-time-checked, per developer-guide.md §2).
- [ ] **Docs:** once shipped, add a "Fix: Admin Dashboard" entry to
      `developer-guide.md` §8 (Feature Log), same style as the existing "Events fix"
      entry, and fold any new decisions into §7 (Known Gaps) if something was
      deliberately deferred.

**Order:** §6 (nav) first — smallest, isolated, gives every other screen its final
chrome immediately. Then §1's shared motion primitives (everything after depends on
them existing). Then §2a→§2b→§2c (the grid primitive, then its first two consumers).
Then §3 (overview tabs, needs the new `getAllReservations` helper but nothing from §2 or
§4). Then §4 (calendar, fully independent of §2/§3/§5). §5 last — it's the only section
with a new runtime dependency (`recharts`) and doesn't block or get blocked by anything
else. §7 (back button) slots in right after §1's motion primitives exist, since it's a
small isolated component every other section's sub-pages then just import — no need to
wait for §2–§6 to finish first.
