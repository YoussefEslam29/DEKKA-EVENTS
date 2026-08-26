# Handoff — session ending 2026-08-26

Summary of everything done in this working session, for whoever (or whichever
Claude session) picks this up next. Read `developer-guide.md` for how the app
works day-to-day; this file is just "what happened and what's left."

## Standing rules for this repo

- **No branches, no worktrees. Everything goes directly to `main`.** The
  owner was explicit and repeated about this — see `developer-guide.md` §6.
  Don't "fix" this by re-introducing a branch workflow even if it seems
  cleaner.
- `.env.local`'s `MONGODB_URI` points at the **live production Atlas
  cluster** with real user data. Never run `scripts/seed.ts` against it.
  Treat any DB write as irreversible until proven otherwise.
- On Windows, `mongodb+srv://` lookups can fail with `ECONNREFUSED` because
  Node picks up an unreachable IPv6 link-local DNS server. Fixed everywhere
  with `dns.setServers(["8.8.8.8","1.1.1.1"])` guarded to non-production —
  see `lib/db.ts` and the top of every standalone script in `scripts/`. Reuse
  this pattern in any new script that connects directly with Mongoose.

## 1. MongoDB Atlas + admin/staff roles

- Diagnosed and fixed the Windows DNS issue above.
- Found and fixed a real bug: `ADMIN_EMAILS`/`STAFF_EMAILS` env vars were
  only ever applied on the Google OAuth path — email/password signups always
  got `role: "member"`, silently ignoring the env var. This is why the
  owner's own admin login looked "wrong" even with the right email.
  - Fix: extracted `bootstrapRole(email)` into `lib/roles.ts`, used by both
    `lib/auth.ts` (OAuth) and `app/api/register/route.ts` (credentials).
- Added `scripts/set-role.ts` to promote/demote an *existing* account (env
  vars only bootstrap a role at account creation time):
  ```
  npx tsx --env-file=.env.local scripts/set-role.ts <email> <member|staff|admin>
  ```
  Also available as `npm run set-role -- <email> <role>`. The person must
  sign out/in afterward — roles are baked into the JWT session.
- The owner's own account was promoted to admin this way.
- Atlas project is set up for multiple people (owner + staff), not just the
  owner — `set-role.ts` is the repeatable way to onboard each new admin/staff
  account after they sign up normally.

## 2. Google Cloud Console (Google sign-in)

- Owner has a Google Cloud Console project started but **not finished** as
  of last check. A step-by-step runbook was produced covering OAuth consent
  screen + credentials setup — ask the owner if they still have that link,
  or re-generate one if needed.
- Along the way, found and fixed a real gap: Google sign-in doesn't collect
  a phone number, but reservations require one. `ReserveButton.tsx` now
  handles a `PHONE_REQUIRED` error with an actionable link to `/account`
  instead of a dead-end error.
- Known gap, not yet fixed: `next.config.ts`'s `remotePatterns` for images
  is still a wildcard (pre-existing, left alone deliberately this pass).

## 3. Git credential mismatch (push denied)

Owner's Windows git had a **different** GitHub account cached
(`XIXYA29`) than the one authorized on the repo (`YoussefEslam29`), causing
push rejections. Root-caused via `cmdkey /list` (PowerShell), which showed
the exact stored target `LegacyGeneric:target=git:https://XIXYA29@github.com`.
Fixed by deleting that entry with
`cmdkey /delete:"LegacyGeneric:target=git:https://XIXYA29@github.com"`, then
having the owner push once themselves to re-trigger the OAuth/credential
flow (this can't be done from an automated shell). Confirmed synced via
`git fetch` + empty `git log origin/main..main`.

## 4. LOG_SIGN_AUTH_IN.md — full implementation (all 6 sections)

Rebuilt from scratch on `main` (owner explicitly chose full rebuild over
keeping partial branch work) using a subagent-driven-development process:
fresh implementer per task, independent reviewer per task, fix-loop rounds,
then one final whole-branch review. That final review is what caught the two
bugs below — neither was visible from any single task's diff.

1. **Google button polish** — pressable states on social buttons.
2. **Confirm-password field** — `AuthForm.tsx`, with live match indicator.
3. **Duplicate-account handling** — signing up with an email that already has
   a Google-only account now gets a clear `EMAIL_TAKEN_OAUTH` error with an
   inline social button, instead of a generic failure.
4. **Auth hero photos** — `AuthScreen.tsx` resolves a mode-specific image
   (login vs signup) → shared fallback → gradient, via
   `scripts/prepare-brand-assets.ts` (the file open in the IDE right now —
   it processes the two new optional hero source images).
5. **`/account` page** — new self-service page: update profile fields, set a
   password (for Google-only accounts) or change one (for password
   accounts). New files: `components/AccountMenu.tsx`,
   `app/(site)/account/page.tsx`, `components/AccountForm.tsx`,
   `app/api/account/route.ts`, `app/api/account/password/route.ts`.
6. **Push notifications on publish** — `models/PushSubscription.ts`,
   `public/sw.js`, `components/PushOptIn.tsx`,
   `app/api/push/subscribe/route.ts`. When an event transitions into
   `published` from draft/closed, a push fan-out fires, wrapped in
   try/catch so a push failure never breaks the publish response itself.
   **Not yet verified on a real device** — needs an actual HTTPS deploy to
   test end-to-end; VAPID keys are already in `.env.local` (real keys, never
   committed).

### Two bugs the final review caught (outside the plan's scope)

- **Critical data-corruption bug**: Zod v4 changed `.partial()` so it no
  longer suppresses `.default(...)` on absent keys (opposite of v3
  behavior). `updateEventSchema` was silently blanking whichever of the ten
  `eventCore` fields weren't sent on every Publish/Close/Reopen click — an
  earlier self-initiated fix only patched the `status` field and missed the
  other nine. Fixed properly with a new `stripDefaults()` structural helper
  in `lib/validation.ts` that strips defaults from the *whole* shape
  mechanically, so a future field can't reintroduce the same bug. Verified
  the owner's live `events` collection was empty at the time — no real data
  was actually lost.
- **Security hole**: widening `/api/uploads` to `guard("member")` (needed
  for account avatars) combined with an unrestricted `image` field and the
  pre-existing `remotePatterns` wildcard meant any member could point their
  avatar at an arbitrary external HTTPS URL. Fixed with an
  `UPLOAD_IMAGE_PATTERN` regex in `lib/validation.ts` restricting `image` to
  same-origin `/uploads/...` paths. Verified against 26 adversarial cases
  (protocol-relative URLs, path traversal, encoded traversal, etc.).

All of this is written up in more detail in `developer-guide.md` §8 (Feature
Log) and §7 (Known Gaps).

## 5. Admin dashboard — Karaoke Night calendar + poster

- `components/MonthCalendar.tsx`: the small 12px `Mic2` corner icon on empty
  Wednesday cells (a purely visual "usually karaoke" hint — nothing is
  generated or enforced) was replaced with a larger, low-opacity mic-in-ring
  SVG watermark anchored to the cell's bottom corner. Committed as `c11d650`.
- Designed a full Karaoke Night poster (1080×1350, Dekka brand system:
  ink-black ground, gold accent, tatreez diamond texture, bilingual
  footer) as a Claude Design canvas. Two real defects caught by a review
  pass and fixed: footer info items were using the wrong bilingual layout
  (stacked instead of the inline "English / العربية" slash pattern), and the
  English venue text was missing "Alexandria" (Arabic had it). Canvas:
  https://claude.ai/code/artifact/913b0f42-c6ff-44c8-9f41-986fda9170ac
- Real event facts used: **Wednesdays, 7:00 PM, 100 EGP entry (drink not
  included)**.
- Owner has already exported the poster themselves and committed both files
  to `IMGS/` (the repo's existing raw-brand-source convention):
  `IMGS/Karaoke Night Poster.pdf` (commit `126d766`) and
  `IMGS/Main@1x.png` (commit `1bcc28d`, 1080×1350 PNG — this is the one to
  actually use, the event form doesn't accept PDF).

## 6. Pending — Karaoke Night on the homepage "Upcoming"

**This is the one open loop.** The homepage's Upcoming section
(`app/(site)/page.tsx`) is purely event-driven — it queries real `Event`
documents (`getPublicEvents()` in `lib/data.ts`) with
`status: published|closed` and `startsAt >= now`. **No code change is
needed** to get Karaoke Night onto the homepage; a real event just needs to
exist. This can't be done from this session — it requires the owner's
authenticated admin session, and DB writes against the live cluster are
off-limits for automated tooling here.

Owner needs to, via `/admin/events/new`:
- Title: ليلة الكاريوكي / Karaoke Night
- Date/time: the next Wednesday at 19:00
- Location: Dekka Cafe, Alexandria / دكة كافيه، الإسكندرية
- Price: 100
- Cover image: upload `IMGS/Main@1x.png` through the form's image upload
  (must go through `/api/uploads` to get a same-origin path — pasting an
  external URL won't pass `UPLOAD_IMAGE_PATTERN`, see §4 above)
- Check **"Poster mode"** (`isPoster`) — this makes the event page render
  the uploaded image as the full hero instead of a title bar, which is what
  the poster was designed for
- Status: **Published** (draft/archived won't show up)

For future weeks: `PLAN/fix_Events.md` §2 already designed the recurrence
workaround — open last week's event, hit the **Duplicate** button
(`components/DuplicateEventButton.tsx`), it clones everything one week later
as a new draft; swap in that week's poster and publish. No scheduler exists
or is planned — this is the accepted tradeoff.

## Untouched / still open

- Google Cloud Console setup itself — owner said "not done yet" as of this
  session.
- Push notifications — infrastructure shipped, real-device delivery unverified.
- `next.config.ts` `remotePatterns` wildcard — known, deliberately left alone.
