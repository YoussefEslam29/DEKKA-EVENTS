# دكة — Dekka

A bilingual (Arabic-first, RTL) web app for **Dekka**, a coffee shop that runs live
events. It replaces the Instagram-DM-plus-Google-Form-plus-notebook workflow described
in [idea.md](idea.md) with one system:

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
| Auth | Auth.js / NextAuth v5 — email+password, Google, Facebook |
| Styling | Tailwind CSS v4 with brand tokens in `app/globals.css` |
| Validation | Zod 4 on every write path |
| Icons | lucide-react (social marks are hand-drawn in `components/BrandIcons.tsx`) |

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

Social sign-in is optional — leave `AUTH_GOOGLE_ID` / `AUTH_FACEBOOK_ID` blank and those
buttons simply do not render.

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
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
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

These were the open questions in [idea.md](idea.md) §9:

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
- `next.config.ts` allows images from any HTTPS host because cover images are admin-typed
  URLs. Narrow `remotePatterns` once you settle on an image host.
- Out of scope for v1, per idea.md §8: online payments, loyalty, non-event table bookings,
  push reminders, waitlists, QR check-in.
