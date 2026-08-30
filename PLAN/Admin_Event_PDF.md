# Admin Event Report — "Show on PDF" (Admin_Event_PDF.md)

Plan for a new admin feature on Dekka: once an event is over, the admin gets one button
on that event's page that pulls together everything about how the night went — who
came, who didn't, and how much money was made — into a report they can open, share, or
hand off. This is the *business* plan (what it does and why); a short technical
addendum for `developer-guide.md` is included further down for whoever builds it.

This complements the existing `/admin/report` page (which rolls up earnings across a
whole *month* of events) rather than replacing it — this new report is about **one
specific event**, in full detail.

**This version is grounded in your actual codebase.** I read through
`developer-guide.md`, `PLAN/idea.md`, the real `Event`/`Reservation`/`CheckIn` models,
the current admin event page, and `package.json` in your connected `DEKKA-EVENTS`
folder before rewriting this — every reference below to an existing file, button, or
pattern is something that's really there today, not a guess. That changes a few
specifics from the first draft (called out inline) and firms up the open questions in
Section 10.

---

## 1. What this feature is, in plain terms

Right now, once an event happens, all the useful information about it — who reserved,
who actually showed up, who paid what — is scattered across the admin's door table and
reservation list. There's no single "here's how last Friday went" document the admin
can pull up, save, or forward to a business partner or accountant.

This feature adds exactly that: a red **"Show on PDF"** button on the event's admin
page. One click gives the admin two things pointing at the same data:

1. A **PDF report** — a clean, printable/shareable snapshot of the event.
2. A **Google Sheet** — the same data, live and open in a new tab, so the admin can
   sort, filter, or copy rows if they need to dig deeper.

---

## 2. Decisions locked in (from our brainstorm)

| # | Question | Decision |
|---|---|---|
| 1 | What does clicking the button produce? | **Both** — a PDF report and a Google Sheet opened in a new tab, same underlying data. |
| 2 | Who counts as "the users of the event" in the data table? | **Everyone, merged** — one row per person, whether they reserved, checked in, both, or neither (walk-in). No one falls through the cracks. |
| 3 | Who owns the Google Sheet in Drive? | **The cafe's own Google account** (a single shared service account set up once). Any admin who clicks the button sees the same sheet — nobody needs to personally connect their Google account. |
| 4 | New sheet every click, or one that updates? | **One persistent report per event.** The first click creates the PDF and the Sheet; every click after that just refreshes them with the latest numbers and reopens the same links. Nothing new piles up in Drive. |
| 5 | Where does the button live? | On that **single event's** admin page, and **only after the event is marked "happened."** It's hidden on draft, published, and closed events — there's nothing to report yet. |
| 6 | Do phone numbers show up in the report? | **Yes**, in full. This is internal business data the cafe uses to reach guests directly — it's not going anywhere public. |

---

## 3. Where the button lives, and when it appears

- Location: the event's own admin management page — `/admin/events/[id]`, the exact
  screen that already shows that event's reservation table, door/check-in table, and
  the row of lifecycle buttons (Publish, Close, Mark Happened, Archive, Delete) plus
  the Duplicate button. "Show on PDF" joins that same row of buttons, right next to
  Duplicate.
- Visibility: the button only appears once the event's status has moved to
  **"happened"** (or later, "archived" — archived just means "happened, and now hidden
  from the active list," so the report should stay reachable there too). Before that,
  there's no attendance or payment data worth reporting yet, so showing the button
  early would just be confusing.
- Style: a clear, unmistakable **red button**. Good news — Dekka's UI already has a red
  button style (used today for the "Delete Event" button on this exact page), so this
  doesn't need a new color invented; it reuses that same visual weight to signal "this
  is a distinct, attention-grabbing action" without looking like a destructive one.

---

## 4. What happens when the admin clicks it

1. The admin clicks **"Show on PDF."**
2. Behind the scenes, the system gathers everything tied to that one event — every
   reservation, every door check-in, the event's price and capacity — and works out
   the numbers described in Sections 5 and 6 below.
3. **First time ever clicked for this event:** a brand-new Google Sheet is created
   (owned by the cafe's account) and a PDF is generated. Both are saved and linked to
   this event going forward.
4. **Every time after that:** the existing Sheet and PDF are simply refreshed with
   up-to-date numbers (in case a late check-in was corrected, for example) — no
   duplicates are created.
5. The Google Sheet opens automatically in a new browser tab. The PDF is available to
   view or download from the same button/page.
6. Nothing about this action changes the event itself — it's a read-only snapshot
   action, not an edit.

---

## 5. The "Database" section — who's on the list

One row per person connected to the event in any way, so the list answers "who was
involved with this event" completely — not just the people who paid, and not just the
people who booked ahead.

Each row includes:

- **Name**
- **Phone number**
- **Did they reserve ahead of time?** (yes/no, and their reservation code if so)
- **Did they actually check in at the door?** (yes/no)
- **Their status**, one of:
  - *Attended* — reserved and checked in
  - *No-show* — reserved but never checked in
  - *Walk-in* — checked in with no reservation at all
- **How they paid** (cash / InstaPay) — for anyone who checked in
- **How much they paid**
- **What time they checked in** — for the timing analytics in Section 6

This is the same underlying data whether the admin is looking at the PDF or the Google
Sheet — the Sheet is just the version they can sort/filter/search themselves.

*Good news for feasibility:* the app already computes most of this. The reservation
list on the event page already knows whether each reservation was checked in, and the
door table already has every check-in with payment method and amount — this feature
mainly adds the missing piece (walk-ins with no reservation at all) and puts everyone
on one combined list instead of two separate tables.

---

## 6. The "Analytics" section — what the report highlights

Pulled together from the raw list above into an at-a-glance summary, shown at the top
of both the PDF and the Sheet:

**Money**
- Total revenue collected for the night
- Split between cash and InstaPay (amount and percentage of each)
- Average amount paid per attendee

**Attendance**
- Total reserved vs. total attended vs. total no-shows vs. total walk-ins
- No-show rate (what % of people who booked never showed up)
- Walk-in rate (what % of attendees showed up without booking)

**Capacity**
- How full the event got compared to its capacity limit (if the event has one) —
  e.g. "84 of 100 spots filled (84%)"

**Timing**
- A simple breakdown of when people arrived (e.g. by half-hour window), so the admin
  can see when the night actually got busy — useful for staffing future nights
  correctly.

Since the goal is "anything useful," all four categories are included by default —
nothing here needs to be limited or cut for scope reasons; it's all pulled from data
the system already has.

*Good news for feasibility, again:* the Money and part of the Attendance numbers
(revenue, cash/InstaPay split, how many attendees) are already calculated today, just
one level up — the existing monthly earnings report adds these same figures up across
every event in a month. This feature is largely that same math, narrowed down to a
single event, plus three things that don't exist anywhere in the app yet: no-show
rate, walk-in rate, and arrival timing.

---

## 7. PDF vs. Google Sheet — why both

- **PDF** — a fixed, shareable snapshot. Good for sending to a business partner,
  keeping an offline archive, or printing for a physical file. Doesn't change once
  generated (until the admin refreshes it).
- **Google Sheet** — a live, working copy of the same data. Good for the admin who
  wants to re-sort by payment amount, filter to just no-shows, or copy a phone number
  list out for a follow-up message.

Both are always kept in sync — refreshing one refreshes both.

---

## 8. Privacy & access notes

- Only admins can see this button and its data — same rule as the rest of the
  `/admin` area today.
- The Google Sheet lives under the cafe's own shared account, not any individual
  admin's personal Google account, so access to it is controlled the same way the
  cafe controls access to any of its other shared business documents.
- Because phone numbers appear in full, the Sheet's sharing link should stay
  restricted to people the cafe has explicitly given access to — it's the same
  sensitivity level as the existing door table and reservation list already have.

---

## 9. Keeping things tidy

- Each event gets exactly **one** Sheet and **one** PDF, named consistently, e.g.:
  `Dekka Report — <Event Name> — <Event Date>`
- Because reports are refreshed in place rather than recreated, Drive never fills up
  with duplicate or stale copies of the same event's report.

---

## 10. Open questions — flagged for the technical/implementation plan

These don't need a business decision right now, but whoever builds this should decide
and document them before writing code. Having read the actual project, here's what's
already true and what's genuinely new:

- **Google credentials — partial head start.** `HANDOFF.md` shows a Google Cloud
  Console project was already started (for "Sign in with Google") but never finished.
  The same project can very likely be reused to also turn on the Sheets and Drive APIs
  and generate a service account key, rather than starting from zero — worth checking
  before creating a second Google Cloud project.
- **PDF generation — don't assume the existing tool covers this.** The project already
  has `puppeteer-core` installed, but today it's only used by one local dev script
  (`scripts/shoot.mjs`) that drives Chrome already installed on *your* computer, purely
  to take screenshots for design work. It is not currently set up to run on the live
  website (Vercel doesn't have a full Chrome browser sitting around the way your
  laptop does), so this needs its own decision: either add a serverless-friendly
  headless-Chrome package alongside `puppeteer-core`, or use a lighter PDF library that
  doesn't need a browser at all. Purely a build detail — doesn't change what the admin
  sees or does.
- **Where the Sheet/PDF links get remembered.** For "first click creates, later clicks
  refresh" to work, the event needs to remember its own report's Sheet ID/URL and PDF
  location — a small new field (or two) added to the existing `Event` record, not a
  new database table.
- **Testing has to be careful.** Per the repo's own hand-off notes, the database this
  app currently connects to is the **live, real one** — not a test copy. Whoever builds
  this should test against one real "happened" event's real data rather than generating
  fake data, since the repo's seed script is explicitly off-limits against it.

---

## 11. Implementation checklist (high level)

- [ ] Set up the cafe's shared Google account/credentials for creating and updating
      Sheets.
- [ ] Build the data-gathering step that merges reservations + check-ins into the
      combined per-person list described in Section 5.
- [ ] Build the analytics calculations described in Section 6.
- [ ] Build the "create once, refresh after" Google Sheet logic.
- [ ] Build PDF generation from the same data.
- [ ] Add the red "Show on PDF" button to the event admin page, visible only once
      status is "happened" or later.
- [ ] Wire the button to trigger generation/refresh and open the Sheet in a new tab.
- [ ] Confirm admin-only access on every part of this (matches existing rules).
- [ ] Test with a real finished event: check the numbers in Sections 5 and 6 against
      the door table and reservation list by hand.

---

## Addendum — for `developer-guide.md`

*(Non-technical plan above is the primary deliverable. This section is a short,
self-contained note meant to be merged into the repo's `developer-guide.md` by whoever
implements this — it flags what's new for the codebase and points at the exact
existing files this builds on, so it isn't a "build detail" but not a full spec
either.)*

**New external dependency:** a Google service account (Sheets + Drive API access)
shared across the app, not tied to any admin's personal OAuth login. New env vars
needed (service account email + key, Drive folder ID). A Google Cloud Console project
already exists from the unfinished Google Sign-In setup (`HANDOFF.md` §2) — check
whether it can be reused before starting a second one.

**PDF generation is a genuinely new capability, not a reuse of `puppeteer-core`.**
`package.json` already lists `puppeteer-core` (^25.8.0) as a dev dependency, but it's
wired only into `scripts/shoot.mjs` — a local-only script that launches a Chrome
already installed on a developer's machine for design screenshots. That approach
doesn't work unmodified on Vercel's serverless functions. Decide explicitly between
(a) a serverless-compatible headless Chromium package alongside `puppeteer-core`, or
(b) a browser-free PDF library, before writing the report route.

**New data to persist:** `models/Event.ts` gets one or two new optional fields (report
Sheet ID/URL, PDF location, last-generated timestamp) so a second click refreshes
in place instead of duplicating. Everything else about the schema stays as-is.

**New read path — extends two functions that already exist in `lib/data.ts`:**
`getEventReservations(eventId)` already joins `Reservation` with `CheckIn` to produce
a `checkedIn` flag per reservation, and `getCheckIns(eventId)` already returns every
door-table row including walk-ins (`CheckIn` documents with `reservation: null`). The
combined per-person list in Section 5 is a merge of exactly these two — no new
collections needed, and the join pattern to copy already exists (`getMonthlyReport`
in the same file is a good second reference for computing revenue/cash/InstaPay/
attendee totals via one aggregation instead of a loop — Performance Rules §3 on N+1).

**New button, same pattern as neighbors:** `components/EventAdminActions.tsx` and
`components/DuplicateEventButton.tsx` are the two client components already rendered
side-by-side in the button row on `app/(site)/admin/events/[id]/page.tsx`. A new
`ShowEventReportButton.tsx` (or similar) sitting in that same row, following the same
`"use client"` + `fetch` + `busy` state shape as those two, is the natural fit rather
than a new pattern.

**Access rule:** same `guard("admin")` pattern used by every other admin API route —
this feature adds no new permission model.

**i18n:** button label and any report headings should go through the existing
`t.admin.*` bilingual dictionary (`lib/i18n/`) like every other admin-facing string,
not hardcoded English/Arabic text — the whole app is ar/en bilingual, not
English-only.
