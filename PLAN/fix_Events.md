# Fix: Events (fix_Events.md)

Plan for four requested changes to the events feature. Written against the current
code (`models/Event.ts`, `components/EventForm.tsx`, `app/(site)/events/[id]/page.tsx`,
`lib/format.ts`, `lib/site.ts`). **Status: all open questions answered below — this is
now the implementation plan, not yet built.**

## Decisions locked in

| # | Question | Answer |
|---|---|---|
| 1a | Location default | **(A)** Copy the cafe's address/map link into the form once at creation; stays independently editable after. |
| 2a | Recurrence | **(A)** One-click "Duplicate" button on an existing event — clones it into a new draft, admin sets the new date. No scheduler. |
| 2b | Poster image | A fresh dated poster image is supplied by hand each week via the existing `coverImage` field. No auto-generation. |
| 2c | Hero layout | When the cover image is a poster, show it as pure artwork — no gradient, no headline drawn over it. Needs a poster-vs-photo flag. |
| 3a | `doorsOpenAt` | Hide from every screen; leave the field in the schema, unused. |
| 4a | Off-site maps | Cafe-location events get the embedded map; a custom-location event keeps the plain "Get Directions" link. No link-resolving. |

---

## 1. Default every event to the cafe's location

**Today:** `locationAr`, `locationEn`, and `mapUrl` are blank free-text fields on
every new event. Nothing pre-fills them, so the admin retypes "دكة، الإسكندرية" and
pastes the Maps link by hand for every single event, even though almost all of them
happen in the same room.

**Fix:** When the admin opens **New event**, `locationAr` / `locationEn` / `mapUrl`
arrive pre-filled from the cafe's real address and Maps link (already sitting in
`lib/site.ts` as `addressAr` / `addressEn` / `maps`). The admin can still clear or
retype them for a genuinely off-site show — the fields stay editable, this only
changes what they start as.

**Where:** `components/EventForm.tsx` — the `blank` object (currently `locationAr: ""`
etc.) reads from `site.addressAr/addressEn/maps` instead, but only when creating
(no `event` prop); editing an existing event still shows what's actually saved on it.

### Decision — 1a: copy once, not inherit

Confirmed **(A)**: a plain, better starting value — no schema change, no "same as
cafe" toggle. If the cafe's address ever changes, existing events keep their old text
until someone edits them by hand; that's an accepted tradeoff for staying simple.

---

## 2. Recurring "Karaoke Night" — every Wednesday, 100 LE, poster hero

This is the biggest of the four asks, and the one with the most genuinely open
decisions. Breaking it into three separate questions: **recurrence**, **the poster
image**, and **the hero layout**.

### Decision — 2a: one-click Duplicate, no scheduler

Confirmed **(A)**. No new server endpoint needed — the client already has everything
it takes: `GET /api/events/:id` returns the full event, `POST /api/events` creates
one. A **"Duplicate"** button on `/admin/events/[id]` (next to the existing
`EventAdminActions` lifecycle buttons) will:

1. Take the currently-loaded event's fields (title, description, location, mapUrl,
   coverImage, `isPoster`, price, capacity, paymentMethods, instapayNumber, terms).
2. `POST /api/events` with those fields, `status: "draft"`, and `startsAt` set to
   **the same time-of-day, one week later** than the source event (so duplicating a
   Wednesday 7pm karaoke night lands on next Wednesday 7pm by default — the admin
   only has to change the date if it's ever not exactly a week out).
3. Redirect to `/admin/events/[new-id]` so the admin can adjust the date/poster/price
   and publish.

For karaoke night specifically the admin's weekly routine becomes: open last week's
event → Duplicate → swap in this week's poster image → adjust the date if needed →
Publish.

### Decision — 2b: a new poster image every week, supplied by hand

Confirmed — no new feature needed here. `coverImage` already accepts any URL; the
admin pastes this week's poster link into the existing field each time (or, after
2a, the Duplicate flow carries last week's poster forward as a starting point they
overwrite).

### Decision — 2c: poster mode vs photo mode

Confirmed — the poster shows as pure artwork, no overlay. This needs one new field:

- **`models/Event.ts`**: add `isPoster: boolean` (default `false`).
- **`lib/constants.ts` / `lib/validation.ts`**: include `isPoster` in
  `createEventSchema` / `updateEventSchema` (`z.boolean().optional().default(false)`).
- **`components/EventForm.tsx`**: a checkbox next to the Cover Image field — *"This
  image already has its own title/date on it (poster) — don't draw text over it."*
- **`app/(site)/events/[id]/page.tsx`**: the hero section branches on
  `event.isPoster`:
  - `coverImage` set, `isPoster: true` → the image fills the hero with **no**
    gradient and **no** overlay text; the status/spots badges and the event title
    move into the normal content flow *below* the hero (same position they'd occupy
    on a no-image event), so the page still has a real heading for accessibility and
    the browser tab/SEO title, it's just not layered on the artwork.
  - `coverImage` set, `isPoster: false` (a plain photo) → unchanged: gradient +
    badges + bold headline drawn over the image, exactly as today.
  - No `coverImage` → unchanged: the `BrandHeroFallback` treatment.

---

## 3. Remove "doors open", switch to 12-hour time

**Remove "doors open":** drop the `doorsOpenAt` field from:
- `components/EventForm.tsx` (the admin input)
- `app/(site)/events/[id]/page.tsx` (the "DOORS" fact row)
- `lib/i18n/dictionaries.ts` (`event.doors`, `admin.fields.doorsOpenAt` — both `ar`
  and `en`)

**12-hour time:** `lib/format.ts`'s `formatTime()` currently uses
`Intl.DateTimeFormat` with `hour: "numeric", minute: "2-digit"` and no `hour12` flag,
so it silently follows each locale's convention — English renders 24-hour ("20:00"),
Arabic renders 12-hour with an Arabic AM/PM marker ("٨:٠٠ م"). Forcing `hour12: true`
makes both consistent: English shows "8:00 PM", Arabic shows "٨:٠٠ م", everywhere a
time is shown (event cards, event detail, My Events, the staff door table, the admin
event manager) — `formatTime` is the one shared function all of those already call,
so this is a single change that applies everywhere at once.

### Decision — 3a: hide it, leave the schema alone

Confirmed. `doorsOpenAt` stays in `models/Event.ts` and `lib/validation.ts` untouched
— it's simply never rendered or submitted from any screen going forward. No
migration, easy to resurrect later if ever wanted back.

---

## 4. Replace "Get Directions" with an embedded map

**Today:** the event detail page shows a **"Get directions"** link that opens
`event.mapUrl` (or the cafe's default Maps link) in a new tab. The About page already
has a *working* embedded map (`site.mapsEmbed`, an iframe pointed at the cafe's
resolved coordinates) — built while wiring up the real social links, including a bug
fix where the wrong URL format made the embed zoom out to the entire globe instead of
centering on Alexandria.

**Fix, for the common case:** since (per §1) almost every event defaults to the cafe's
own location, the event detail page can just embed `site.mapsEmbed` directly — the
same iframe already proven to work on About, reused here. That's the easy 90% of it.

### Decision — 4a: plain link fallback for off-site events

Confirmed **(A)**. No coordinate-resolving, no new field.

**How the page decides which to show:** compare `event.mapUrl` against the cafe's own
`site.maps` link (string equality). Since §1 pre-fills every new event's `mapUrl` with
`site.maps` and it's only ever *replaced*, not edited-in-place, an unmodified event
still matches exactly:

- `event.mapUrl === site.maps` (the untouched default, i.e. almost every event) →
  render the embedded iframe using `site.mapsEmbed` (the same known-good coordinates
  already proven on the About page).
- `event.mapUrl` differs (an admin pasted a different link for an off-site show) →
  keep today's plain **"Get Directions"** link pointed at that URL, since there's no
  way to embed an arbitrary share link without resolving it to coordinates.

---

## Implementation checklist

Everything below is scoped and unblocked — no remaining open questions.

- [ ] **Schema:** add `isPoster: boolean` (default `false`) to `models/Event.ts`,
      `lib/validation.ts` (`createEventSchema`/`updateEventSchema`), and the
      `EventDTO` type + `toEventDTO` in `lib/data.ts`.
- [ ] **§1** `components/EventForm.tsx`: pre-fill `locationAr`/`locationEn`/`mapUrl`
      from `site.ts` in the `blank` object, only for the create path.
- [ ] **§2a** New "Duplicate" button on `app/(site)/admin/events/[id]/page.tsx` (or a
      small `DuplicateEventButton` client component alongside
      `EventAdminActions`): reads the loaded event, `POST /api/events` with its
      fields copied, `status: "draft"`, `startsAt` shifted +7 days, then redirects to
      the new event's edit page.
- [ ] **§2c** `components/EventForm.tsx`: `isPoster` checkbox next to Cover Image.
      `app/(site)/events/[id]/page.tsx`: branch the hero on `event.isPoster` as
      specced above.
- [ ] **§3** Remove `doorsOpenAt` from `EventForm.tsx`'s rendered fields and the
      event-detail `facts` array; delete `event.doors` / `admin.fields.doorsOpenAt`
      from both halves of `lib/i18n/dictionaries.ts`. Leave the Mongoose/Zod schema
      fields in place, unused.
- [ ] **§3** `lib/format.ts`: add `hour12: true` to `formatTime()`.
- [ ] **§4** `app/(site)/events/[id]/page.tsx`: replace the "Get Directions" link with
      the `site.mapsEmbed` iframe when `event.mapUrl === site.maps`; keep the
      existing link otherwise.

Order: §3 first (smallest, no dependencies), then §1 and §4 (both touch the same
"what is the default location" logic), then §2 last (needs the new `isPoster` field
before the Duplicate button or the hero branch make sense).
