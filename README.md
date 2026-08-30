# دكة — Dekka

A bilingual (Arabic-first, RTL) web app for **Dekka**, a coffee shop that runs live
events. It replaces the Instagram-DM-plus-Google-Form-plus-notebook workflow described
in [PLAN/idea.md](PLAN/idea.md) with one system:

- **Guests** browse upcoming nights without an account.
- **Members** reserve a spot in one tap and get a door code.
- **Bands** pitch a show through an in-app form instead of a Google Form.
- **Staff** run the door from a real table — name, phone, payment method, amount.
- **Admin** manages events, sees who is coming, reviews pitches, and closes out the month.

No online payments: a reservation only holds a spot. Guests pay **cash or InstaPay at
the cafe** on the day.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript, strict |
| Database | MongoDB via Mongoose 9 |
| Auth | Auth.js / NextAuth v5 — email+password, Google, Facebook, Apple |
| Styling | Tailwind CSS v4, brand tokens + themed primitives in `app/globals.css` |
| Validation | Zod 4 on every write path |
| Icons | lucide-react (Google/Facebook/Apple/social marks in `components/BrandIcons.tsx`) |
| Images | `sharp`, used once at build time to matte the logo (`npm run brand:assets`) |

---

## Design system

Implements [PLAN/authorization-UI.md](PLAN/authorization-UI.md).

### Two surfaces, one palette

The public app (auth, events hub, event detail, my events, submit a show, about) is
the dark **"coffeehouse at night"** theme. The back-office (**staff door check-in**,
**admin dashboard**) stays on the light cream workspace — §8's own flagged exception,
because those are counter-side, data-entry-heavy tools where contrast matters more
than mood. Brand chrome (navbar, footer) is dark on both.

Rather than threading a `tone` prop through every shared component, the primitives
(`.dk-card`, `.dk-field`, `.dk-label`, `.dk-muted`, `.dk-thead`, `.dk-hairline`) each
have one class whose colours flip inside a `.dk-workspace` ancestor. One `Card`
renders dark on the public app and cream in the back-office.

> **Gotcha worth keeping:** these classes live inside `@layer components`. Without
> that, the `padding` shorthand in `.dk-field` outranks Tailwind's `ps-11` utility and
> leading icons overlap the input text.

### Brand assets

`IMGS/` holds the supplied originals. `npm run brand:assets` turns them into
web-ready files in `public/brand/`:

| Output | What it is |
|---|---|
| `dekka-logo.png` | The دكة lockup with the white JPEG background matted out to alpha, trimmed tight |
| `dekka-logo-square.png` | 512×512 square rendition, used as the favicon |
| `dekka-banner.jpg` | The banner, copied through |

§1 asked for a transparent PNG before implementation; the script produces one so the
pipeline is reproducible rather than depending on a manual export. Re-run it if the
source artwork changes.

The mark is **dark brown ink** — verified to all but disappear on `ink-black`. So
every appearance on a dark surface goes through `LogoBadge`, which sets it on a cream
plate exactly as the mockups do. The fabricated "COFFEE & COMMUNITY" circle from the
mockups is gone; the optional tagline is **"COFFEE SHOP"**, the real copy from the
banner.

### Component library (§6)

| Component | Where |
|---|---|
| `LogoBadge` / `LogoLockup` | `components/ui/LogoBadge.tsx` |
| `Button` (`gold` = PrimaryButton, `outline` = OutlineButton, `light*` = workspace) | `components/ui/Button.tsx` |
| `TextField` / `PasswordField` / `TextAreaField` | `components/ui/TextField.tsx` |
| `SectionDivider` | `components/ui/SectionDivider.tsx` |
| `BilingualLabel` | `components/ui/BilingualLabel.tsx` |
| `PatternAccent` | `components/ui/PatternAccent.tsx` |
| `Card` / `Badge` / `PageHeader` / `EmptyState` | `components/ui/Surface.tsx` |

`PatternAccent` is the tatreez motif from the wordmark's texture, drawn as a CSS
**mask** tinted by `color` — so one definition serves a divider on dark panels, a
watermark on cream, and a skeleton texture.

### Bilingual labels (§3)

`BilingualLabel` enforces `English / العربية` on one line, with each half wrapped in
its own `lang` so Cairo renders the Arabic and Plus Jakarta Sans the Latin. It forces
`dir="ltr"` on the pair — without that the run reverses inside the Arabic (RTL)
layout and renders Arabic-first.

Applied to **field labels, buttons and headings**. Body copy and event content still
follow the locale toggle: making every paragraph bilingual would double the reading
length of the whole site, which is not what the mockups show.

### Auth screens (§4, §5, §7)

`/login` and `/signup` live in an `(auth)` route group with no navbar or footer, so
the split screen is genuinely full-bleed. Everything else sits in `(site)`.

- **≥1024px:** 60/40 split — ambient left panel, form right.
- **<1024px:** single dark column, heading in white rather than gold, social buttons
  side-by-side instead of stacked.
- Inputs carry leading icons at both breakpoints (§5's recommendation: one shared
  input component).
- **"Continue as Guest"** sits below the sign-up switch link — one tap away without
  competing with the primary action.

In RTL the split mirrors (form left, panel right). That is correct RTL behaviour, not
a bug — the mockups are LTR.

**No real Dekka photography exists yet (§9.5).** The left panel falls back to a
brand-derived treatment: warm pendant-light gradients over deep coffee with the
tatreez texture. Drop a photo at `public/brand/auth-hero.jpg` — or point
`NEXT_PUBLIC_AUTH_HERO_IMAGE` at one — and it is picked up automatically, no code
change.

### Screenshots

`node scripts/shoot.mjs <outDir> "name|path|WxH|locale"` renders pages through the
Chrome already installed on the machine via `puppeteer-core` (no bundled browser
download). Set `SHOOT_LOGIN="admin@dekka.test:dekka1234"` to capture signed-in routes.

---

## Getting started

### 1. Start a database

```bash
docker compose up -d
```

That runs MongoDB on `127.0.0.1:27017`. Alternatively point `MONGODB_URI` at a MongoDB
Atlas cluster.

### 2. Configure environment

```bash
cp .env.example .env.local
```

At minimum set `MONGODB_URI` and `AUTH_SECRET`. Generate a secret with:

```bash
npx auth secret
```

Social sign-in is optional — leave a provider's variables blank and that button simply
does not render, rather than dead-ending at a broken callback.

**Apple needs paid setup.** `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` require an Apple
Developer Program membership (~$99/yr) plus a Services ID and a signed client-secret
JWT. The provider and button are wired and will appear the moment those exist.

Put your own email in `ADMIN_EMAILS` to be promoted to admin on first sign-in.

### 3. Seed some data

```bash
npm run seed
```

Creates three events across the lifecycle, reservations, a completed door table, and two
band pitches. Accounts (all password `dekka1234`):

| Email | Role |
|---|---|
| `admin@dekka.test` | admin |
| `staff@dekka.test` | staff |
| `sara@example.test` | member |

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000.

---

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run seed       # wipe and re-seed the database
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run brand:assets # regenerate public/brand/* from IMGS/
```

---

## Routes

### Public
| Path | Screen |
|---|---|
| `/` | Events hub — upcoming feed, past nights |
| `/events/[id]` | Event detail: date, time, location, price, payment terms, T&Cs, reserve |
| `/submit-show` | Band/artist application form (no account needed) |
| `/about` | Cafe story, socials, address, map |
| `/login`, `/signup` | Auth — email/password, Google, Facebook, continue as guest |

### Member
| Path | Screen |
|---|---|
| `/my-events` | Reservations, upcoming and past, each with its door code |

### Staff (role `staff` or `admin`)
| Path | Screen |
|---|---|
| `/staff` | Pick tonight's event |
| `/staff/events/[id]` | Door check-in: attendee entry, reservation search, running totals |

### Admin (role `admin`)
| Path | Screen |
|---|---|
| `/admin` | Overview tiles + next events with reservation counts |
| `/admin/events` | All events with status and reservation counts |
| `/admin/events/new` | Create an event |
| `/admin/events/[id]` | Manage one event: lifecycle buttons, reservation list, door table, edit form |
| `/admin/submissions` | Band pitches inbox, filterable, approve/decline/annotate |
| `/admin/report` | Monthly earnings rolled up across every event |

---

## API

All writes are Zod-validated and role-guarded. Responses are `{ data }` or `{ error }`.

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/register` | public |
| `GET/POST` | `/api/auth/*` | Auth.js |
| `GET` | `/api/events` | public (admin also sees drafts) |
| `POST` | `/api/events` | admin |
| `GET` | `/api/events/:id` | public (drafts admin-only) |
| `PATCH` `DELETE` | `/api/events/:id` | admin |
| `GET` | `/api/events/:id/reservations` | staff |
| `POST` | `/api/events/:id/reservations` | member |
| `DELETE` | `/api/reservations/:id` | owner or admin |
| `GET` `POST` | `/api/events/:id/checkins` | staff |
| `DELETE` | `/api/checkins/:id` | staff |
| `POST` | `/api/submissions` | public |
| `GET` | `/api/submissions` | admin |
| `PATCH` | `/api/submissions/:id` | admin |
| `GET` | `/api/reports/monthly?month=YYYY-MM` | admin |

---

## Data model

- **User** — one row per person regardless of sign-in method. `role` is `member` \| `staff` \| `admin`.
- **Event** — bilingual fields (`titleAr`/`titleEn`, …), `startsAt`, `price`, optional
  `capacity`, accepted `paymentMethods`, and a `status` following the lifecycle
  `draft → published → closed → happened → archived`.
- **Reservation** — a held spot with a 6-character door `code`. Unique per `(event, user)`;
  cancelling sets `status: "cancelled"` rather than deleting, so the spot frees up but the
  history survives.
- **CheckIn** — one row of the door table. **This, not Reservation, is the record of money
  taken**, which is what the monthly report sums.
- **BandSubmission** — a pitch, `pending` \| `approved` \| `declined`.

---

## Decisions locked in

These were the open questions in [PLAN/idea.md](PLAN/idea.md) §9:

1. **Capacity** — optional per event. Set it and the event flips to *Full* when reservations
   reach it; leave it blank for an open door.
2. **Guest reserve button** — always visible. Tapping it as a guest sends you to
   `/login?next=…` and returns you to the event afterwards.
3. **Band submissions** — open to anyone, no account. A signed-in musician gets the pitch
   linked to their account automatically.
4. **Staff accounts** — staff have their own logins with a `staff` role that reaches the door
   tool and nothing else.
5. **Confirmation proof** — reservations carry a short code shown on the event page and in
   *My Events*. Staff can search the door list by name, phone, or code — the code is a
   convenience, not a requirement.

And from [PLAN/authorization-UI.md](PLAN/authorization-UI.md) §9:

1. **Dark theme scope** — the whole public app, with cream/logo as the accent.
2. **Admin/Staff theme** — light cream workspace (§8's flagged exception).
3. **Social providers** — Google, Facebook **and Apple** on both platforms. The
   mockups' desktop/mobile split (Facebook vs Apple) was treated as mockup drift.
4. **Tagline** — "COFFEE SHOP", the real copy from the banner.
5. **Photography** — none yet; the auth hero uses a brand-derived fallback and reads a
   real photo the moment one is added.

---

## Notes on how this is built

- **Arabic is the default**, with English as a toggle. The locale lives in a cookie
  (`dekka_locale`), the root layout sets `lang`/`dir`, and layout uses logical properties
  (`ps-`, `me-`, `text-start`) so RTL is not a retrofit. Both dictionaries live in
  `lib/i18n/dictionaries.ts`; the English object is type-checked against the Arabic one, so
  a missing key is a compile error.
- **Times are cafe-local.** Everything renders in `NEXT_PUBLIC_CAFE_TIMEZONE`
  (default `Africa/Cairo`), and the admin's `datetime-local` inputs are converted both ways,
  so typing `20:00` means 20:00 in Cairo no matter where the admin is.
- **Authorization is enforced on the server** in `app/staff/layout.tsx`,
  `app/admin/layout.tsx`, and in every API route via `lib/rbac.ts`. There is no middleware
  gate to bypass.
- **`lib/constants.ts` holds the shared enums with no runtime dependencies.** Client
  components import from there; importing from `@/models/*` would pull the MongoDB driver
  into the browser bundle.
- **UI primitives are hand-rolled** (`components/ui/`) rather than generated by the shadcn
  CLI. The brand is specific enough — cream paper, coffee ink, 4px corners, no shadows, RTL
  throughout — that the generated neutral components would have been overridden anyway.

## Known gaps

- Capacity is checked read-then-write rather than enforced atomically. At cafe scale a
  simultaneous double-booking is unlikely; an admin can close reservations by hand.
- `next.config.ts` allows images from any HTTPS host because cover images can be
  admin-typed URLs, which leaves `/_next/image` an open image proxy. Drop the
  `hostname: "**"` entry once posters are always uploaded rather than pasted.
- Uploaded images go to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, and to
  `public/uploads/events/` otherwise (`lib/storage.ts`). Orphaned files are never
  cleaned up when a poster is replaced or an event is deleted.
- Out of scope for v1, per PLAN/idea.md §8: online payments, loyalty, non-event table bookings,
  push reminders, waitlists, QR check-in.
