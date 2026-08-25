# Fix: Login, Sign-Up & Account (LOG_SIGN_AUTH_IN.md)

Plan for five requested changes to auth and the member's relationship with their own
account. Written against the current code (`components/AuthForm.tsx`,
`components/auth/AuthScreen.tsx`, `lib/auth.ts`, `models/User.ts`, `lib/rbac.ts`,
`lib/validation.ts`, `app/api/register/route.ts`, `app/api/events/[id]/route.ts`,
`components/layout/Navbar.tsx`) after reading `developer-guide.md` and every doc in
`PLAN/`, per the repo's own instruction to do that before touching a line.
**Status: open questions answered below — this is the implementation plan, not yet
built.** Follows the same "decisions locked in → per-section spec → implementation
checklist" shape as `PLAN/fix_Events.md` and `PLAN/FIX_ADMIN_DASH.md`.

Per this session's own project rule (Sonnet writes plans, Opus implements): nothing in
this file has been coded. Hand this to an Opus implementation session next.

## The five asks, mapped to sections

1. A "Sign in with Google" button, so the user doesn't have to type anything → **§1**
2. A confirm-password field on sign-up → **§2**
3. Cool cafe photos on the left of the auth screen → **§3**
4. Stop people from creating more than one account → **§4**
5. An "edit my account" option from the homepage → **§5**
6. Logged-in members get notified the moment the admin publishes a new event → **§6**

---

## Decisions locked in

| # | Question | Answer |
|---|---|---|
| 1 | Duplicate-account fix | **(A)** Smarter sign-up error when the email already belongs to a Google-only account (points straight at the Google button), *and* a new "set a password" action on the account page so that account can add email/password sign-in too. |
| 2 | Where "edit account" lives | **(A)** A small account menu in the navbar (where the sign-out control is today) opens a real `/account` page — name, phone, profile photo, and password (set or change). Email is not editable there. |
| 3 | Event-publish notifications | Real **browser push** — reaches the member's phone/desktop even if the site tab is closed — offered to *every* member, not just the ones who've shown interest in something similar. |
| 4 | Auth hero photo | **Different photo for login vs. sign-up** — two images, each reinforcing that screen's headline. |

---

## 0. What's already there (don't rebuild this)

Reading the code first turned up two things worth flagging before the plan below,
because they change what "fix" means:

- **Google sign-in is already fully wired**, per `PLAN/authorization-UI.md` and
  `lib/auth.ts`: `AuthForm.tsx` renders a "Continue with Google" button whenever
  `enabledOAuthProviders.google` is true, which is just "are `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` set in `.env.local`". If the button isn't showing up for you
  right now, that's a missing/blank credential pair, not missing code — see §1.
- **Account linking by email already happens on the server.** `lib/auth.ts`'s
  `signIn` callback: if someone signs in with Google using an email that already has
  a password account, it finds that existing `User` document and pushes `"google"`
  into its `providers` array — it does **not** create a second account. The gap is
  only the *reverse* direction (credentials signup on an email that's already
  Google-only) and the UX around both directions — that's what §4 actually fixes.

---

## 1. "Sign in with Google" button

**Today:** the button, the OAuth callback, and the account-linking logic already
exist and work. What's missing is operational, not code:

1. A Google Cloud OAuth **Client ID + Secret** (OAuth consent screen + Web
   application credentials, authorized redirect URI
   `<your-domain>/api/auth/callback/google`, and `http://localhost:3000/api/auth/callback/google`
   for local dev).
2. Those two values set as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in `.env.local`
   (and in Vercel's project environment variables for the deployed site).

**What to actually change in code:** nothing structural. Two small polish items
while we're in this file:

- `AuthForm.tsx`'s social button row currently reads "stacked on desktop,
  side-by-side on mobile" per `authorization-UI.md` §4/§5 — confirm that still holds
  once Google is the only OAuth provider actually configured (Facebook/Apple stay
  wired but usually blank per `enabledOAuthProviders`, so on a typical deploy the row
  will show one button, not three — the layout should still look intentional with a
  single button, not like two are missing. `socials.length > 1` already branches the
  grid, so a length-1 row already gets `grid gap-3` with no forced columns — verify
  visually, no code change expected).
- Apply `pressable` (`lib/motion.ts`) to the social buttons via `Button`'s existing
  variant styling — see §3's motion note; today they're plain `OutlineButton`s with a
  CSS-only hover, no press feedback.

**Checklist:**
- [ ] Create Google OAuth credentials, set `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
      locally and on Vercel.
- [ ] Confirm the button renders and a Google sign-in lands the user on `next` with a
      session (`role: member` on first sign-in unless the email is in
      `ADMIN_EMAILS`/`STAFF_EMAILS`).
- [ ] Add `pressable` tap/hover feedback to `OutlineButton`-variant social buttons.

---

## 2. Confirm-password field on sign-up

**Today:** `AuthForm.tsx`'s `form` state is `{ name, email, phone, password }` — one
password input, client-side length check only (`password.length < 8`).

**Fix:**

- Add `confirmPassword` to the form state, rendered only when `isSignup` (right after
  the existing `PasswordField` for `password`, reusing the same component — it
  already has the eye-icon toggle, so the confirm field gets it for free).
- New i18n key `auth.confirmPassword` (`ar`/`en`) in `lib/i18n/dictionaries.ts`,
  alongside the existing `auth.password` key — both dictionary objects, or the
  type-check fails at compile time (this is the whole point of that pattern).
- Client-side check before the fetch to `/api/register`, next to the existing
  `password.length < 8` guard:
  ```ts
  if (form.password !== form.confirmPassword) {
    setError(t.auth.passwordMismatch); // new key
    return;
  }
  ```
- **Cool-UI touch, not just a plain field:** a small inline indicator under the
  confirm field — a `Check` (green, `text-good` if that token exists, else
  `gold-accent`) that fades/scales in via `framer-motion`'s `AnimatePresence` the
  moment `confirmPassword` is non-empty **and** matches `password`, and disappears
  the instant they diverge. This is exactly the kind of "1–2 key elements" micro-
  interaction `FIX_ADMIN_DASH.md` §1 already established the vocabulary for — reuse
  `DURATION.press` (150ms) for the fade, not a new timing constant.
- `registerSchema` in `lib/validation.ts` stays **server-side password-only** — do
  **not** add `confirmPassword` to the Zod schema or send it to `/api/register`. It's
  a client-side UX guard against typos, not a security boundary; the server only
  ever needs the one password it will hash.

**Checklist:**
- [ ] `lib/i18n/dictionaries.ts`: `auth.confirmPassword`, `auth.passwordMismatch`
      (both `ar`/`en`).
- [ ] `AuthForm.tsx`: new field + state + mismatch check + the animated match
      indicator.
- [ ] No `lib/validation.ts` or `app/api/register/route.ts` change — confirm-password
      never leaves the browser.

---

## 3. Cafe photos on the auth screen's left panel

**Today:** `AuthScreen.tsx`'s `heroImage()` looks for exactly one file,
`public/brand/auth-hero.jpg` (or `NEXT_PUBLIC_AUTH_HERO_IMAGE`), used for both login
and sign-up, and falls back to `BrandHeroFallback` (the gradient + tatreez texture)
when it's absent — which is the case today; `IMGS/` only holds the logo, banner, and
one contest photo, no interior/event shots yet.

**Fix — one photo per mode, decision (A) from `authorization-UI.md` §9.5 finally
answered:**

- `heroImage()` takes a `mode: "login" | "signup"` argument and looks for
  `auth-hero-login.jpg` / `auth-hero-signup.jpg` in `public/brand/` first; if that
  specific file is missing, fall back to the shared `auth-hero.jpg` (so dropping in
  just one photo still improves both screens); if *that's* also missing, fall back to
  `BrandHeroFallback` exactly as today. Same override pattern via env vars:
  `NEXT_PUBLIC_AUTH_HERO_LOGIN_IMAGE` / `NEXT_PUBLIC_AUTH_HERO_SIGNUP_IMAGE`.
- Suggested pairing (yours to swap once you drop real photos in `IMGS/` and run
  `npm run brand:assets` — see below): a **warm, calm counter/pour-over shot** for
  login ("Where heritage meets the brew." already fits a quieter moment), and a
  **packed live-event/band-night shot** for sign-up (new-visitor energy — "come be
  part of this").
- **Getting the files in:** same pipeline as the logo/banner — drop originals in
  `IMGS/` (e.g. `IMGS/auth-hero-login.jpg`, `IMGS/auth-hero-signup.jpg`), extend
  `scripts/prepare-brand-assets.ts` to copy/process those two alongside the existing
  three outputs into `public/brand/`, so `npm run brand:assets` stays the one command
  that regenerates everything. Until you hand those photos over, both screens keep
  working exactly as they do today (branded gradient fallback) — nothing breaks.
- No change to the gradient overlay, the headline copy, or the mobile layout (mobile
  stays photo-less per the confirmed `authorization-UI.md` §9.1 decision — dark
  column only, matching the reference mocks).

**Checklist:**
- [ ] `AuthScreen.tsx`: `heroImage(mode)` with the login/signup → shared → fallback
      resolution order described above.
- [ ] `scripts/prepare-brand-assets.ts`: process the two new optional source files if
      present in `IMGS/`.
- [ ] `design-system/05-brand-assets.md`: document the two new file slots next to the
      existing "Photography" section once real photos land.
- [ ] Update the two `heroLoginSub`/`heroSignupSub`-style dictionary entries only if
      the new photos change what headline makes sense — copy itself is out of scope
      here unless you want to revisit it.

---

## 4. Stop duplicate accounts, fix the confusing error

Two sub-problems, both real, per §0's read of the current code.

### 4a. Sign-up on an email that already has a Google-only account

**Today:** `POST /api/register` returns `409 EMAIL_TAKEN` whenever *any* user with
that email exists — correct as a block, but `AuthForm.tsx` shows the generic
`t.auth.emailTaken` string ("this email is already registered") with no next step.
Someone who only ever used "Continue with Google" has no idea that's why they're
stuck, and no path forward except guessing to try the Google button.

**Fix:**

- `POST /api/register` (`app/api/register/route.ts`): when the found `existing` user
  has no `passwordHash` (i.e. it's OAuth-only today), return a more specific error
  code — `EMAIL_TAKEN_OAUTH` — instead of the generic `EMAIL_TAKEN`, alongside which
  provider(s) are on file (`existing.providers`), e.g.
  `jsonError("EMAIL_TAKEN_OAUTH", 409, { providers: existing.providers })`.
  When the existing user *does* have a `passwordHash`, keep today's plain
  `EMAIL_TAKEN`.
- `AuthForm.tsx`'s error handling branches on that code: `EMAIL_TAKEN_OAUTH` renders
  a specific message — *"You already have an account signed in with Google — use the
  button below instead"* (bilingual, new `auth.emailTakenOAuth` key) — and,
  critically, the error block itself becomes actionable: render the relevant social
  button (from `providers.google` etc., matched against the returned `providers`
  array) directly under the message, not just prose pointing at a button somewhere
  else on the same screen.

### 4b. Adding a password to a Google-only account (so it's not a dead end)

**Today:** there's no way for a Google-only member to ever get a password — they're
correctly *not* creating a second account, but they also have no email/password
fallback if they ever want one (e.g. Google is unavailable, or they want to hand a
family member the login without sharing their Google account).

**Fix:** covered fully in §5's account page — a "Set a password" action that appears
only when `providers` doesn't already imply a usable password, i.e. when
`passwordHash` is absent. This is additive (sets a hash), never destructive, and
needs no "current password" step since there isn't one yet. If the account *already*
has a password, the same account-page section instead offers **change** password,
which does require the current one (see §5).

### What's deliberately not being built here

Per the earlier discussion: stronger anti-duplication (phone-number uniqueness,
device/browser fingerprinting, requiring phone verification) was considered and
deliberately deferred — email uniqueness plus the linking behavior already in
`lib/auth.ts` covers the realistic case ("I forgot I already had an account") well;
the fingerprinting-style defenses are aimed at a different problem (someone
deliberately evading a ban or a one-per-person promotion) that isn't in scope for
Dekka's cafe-scale use. Flag if that's actually a concern worth a follow-up plan.

**Checklist:**
- [ ] `app/api/register/route.ts`: branch the `EMAIL_TAKEN` response on whether
      `existing.passwordHash` exists; add `EMAIL_TAKEN_OAUTH` + `providers` payload.
- [ ] `lib/i18n/dictionaries.ts`: `auth.emailTakenOAuth` (`ar`/`en`).
- [ ] `AuthForm.tsx`: render the matching social button inline with the
      `EMAIL_TAKEN_OAUTH` error instead of (or in addition to) plain text.
- [ ] See §5 for the "set/change password" action itself.

---

## 5. "Edit my account" from the homepage

**Today:** there is no account page at all. The only account-related control anywhere
in the UI is the sign-out button in `Navbar.tsx` — a plain link/button, no menu, no
"my account" destination. `User` has `name`, `email`, `phone`, `image`, `providers`,
`role` — all of it exists in the data model already except a place to see or edit it.

**Fix — decision (A): navbar account menu → real `/account` page.**

### 5a. Navbar: turn the sign-out control into a small account menu

- `Navbar.tsx`'s signed-in branch currently renders a bare `<SignOutButton>`. Replace
  it with a new client component `components/AccountMenu.tsx`: the user's name (or
  "Account" if name is somehow blank) as a small trigger — reuse the same
  `<details>`/`<summary>` disclosure pattern already used for the mobile hamburger
  menu two lines below it in the same file (no-JS-required, consistent with the
  codebase's existing preference for that pattern over a hydrated dropdown
  library) — opening a short menu: **My Account** (→ `/account`) and **Sign Out**
  (the existing `SignOutButton`, moved inside this menu instead of standing alone).
- Desktop and the existing mobile `<details>` menu both get this treatment — today's
  mobile menu already lists `SignOutButton` as a raw row; add "My Account" as a
  sibling row there too, same placement logic (`hasRole`/`user` guards already exist
  in that file).
- New i18n keys: `nav.account` (ar/en) — "My Account / حسابي" following the existing
  bilingual pattern used for every other nav label.

### 5b. `/account` page (new route, `app/(site)/account/page.tsx`)

Server component, gated the same way `my-events/page.tsx` already gates itself
(`currentUser()` + `redirect("/login?next=/account")` if null — no new middleware,
consistent with `developer-guide.md` §1's "no middleware gate, layouts/pages check
directly" rule). Renders a client form component, `components/AccountForm.tsx`,
built from the same primitives as every other form in the app (`Card`, `TextField`,
`PasswordField`, `Button`) — nothing new invented at the component level.

Sections, top to bottom:

1. **Profile photo.** Current `image` (or an initials placeholder if none) +
   "Upload" trigger reusing the existing hidden-`<input type="file">`-behind-a-
   styled-button pattern already built for event posters
   (`components/EventForm.tsx`'s "Upload image" button). Posts to the **existing**
   `POST /api/uploads` route — it's already admin-role-agnostic in terms of file
   handling logic; it just needs its `guard()` call widened from `guard("admin")` to
   `guard("member")` (or a parallel check) since any signed-in member should be able
   to upload their own avatar, not just admins uploading posters. Same JPEG/PNG/WEBP/
   GIF + 5MB constraints. **Same known gap applies** (`developer-guide.md` §7):
   `public/uploads/...` is local-disk and won't survive a serverless deploy — this
   plan doesn't fix that gap, just inherits it; if you deploy to Vercel before
   swapping in real object storage, note that avatar uploads (like poster uploads)
   need that fix too.
2. **Name / Phone.** Plain `TextField`s, pre-filled from `currentUser()`, submitted
   via a new `PATCH /api/account` route.
3. **Sign-in methods (read-only info, not editable).** A short line listing
   `providers` in plain language — *"Signed in with: Email & password, Google"* —
   so a member can see for themselves why the Google button linked instead of
   erroring (ties directly back to §4).
4. **Password.**
   - If `passwordHash` is absent (Google-only account): a single **"Set a
     password"** action — two fields (new password, confirm — same
     `PasswordField` + match-indicator pattern from §2), no current-password step.
   - If `passwordHash` exists: **"Change password"** — current password, new
     password, confirm. Current password is verified server-side with the same
     `bcrypt.compare` pattern `lib/auth.ts`'s `authorize()` already uses.
   - Both cases post to `PATCH /api/account/password` (`bcrypt.hash(new, 12)`, same
     cost factor as `app/api/register/route.ts`).
5. Email is **shown, not editable** — changing it would break OAuth account matching
   (`lib/auth.ts`'s `signIn` callback matches purely on email) and re-verification is
   its own project; out of scope here, consistent with `idea.md`'s "flag if this is
   actually a must-have" spirit for anything not explicitly asked for.

### New API surface

| Method | Path | Guard | Body | Notes |
|---|---|---|---|---|
| `PATCH` | `/api/account` | `guard("member")` | `{ name?, phone?, image? }` | Ownership is implicit — always the current session's user, never an `:id` param, so there's no ownership check to forget. |
| `PATCH` | `/api/account/password` | `guard("member")` | `{ currentPassword?, newPassword, confirmPassword }` | Server re-validates match even though the client already did (§2's rule: confirm is a UX guard, but the server never trusts the client alone for anything it writes). Requires `currentPassword` match via `bcrypt.compare` only when `passwordHash` already exists on the account. |

Both follow the existing `handle()` + `guard()` + `parseBody()` shape from
`lib/api.ts` — no new pattern introduced. New Zod schemas `updateAccountSchema` /
`setPasswordSchema` in `lib/validation.ts`, next to `registerSchema`.

### Motion

`Card` sections on `/account` mount with `fadeUp` (already the site-wide page-entry
convention per `FIX_ADMIN_DASH.md` §1); the password-match indicator reuses §2's
exact animation so the whole app has one "this matches" visual language, not two.

**Checklist:**
- [ ] `components/AccountMenu.tsx` (new) — replaces bare `SignOutButton` in
      `Navbar.tsx`, desktop + mobile menu.
- [ ] `lib/i18n/dictionaries.ts`: `nav.account`, and an `account.*` block for the new
      page's labels (ar/en both, compile-checked).
- [ ] `app/(site)/account/page.tsx` (new) — `currentUser()` gate, same pattern as
      `my-events/page.tsx`.
- [ ] `components/AccountForm.tsx` (new) — profile photo, name/phone, providers
      list, password set/change.
- [ ] `lib/validation.ts`: `updateAccountSchema`, `setPasswordSchema`.
- [ ] `app/api/account/route.ts` (new) — `PATCH`.
- [ ] `app/api/account/password/route.ts` (new) — `PATCH`.
- [ ] `app/api/uploads/route.ts`: widen the guard from admin-only to any signed-in
      member (event-poster callers are still admin-gated one layer up, in
      `EventForm.tsx`'s own admin-only page, so this doesn't open posters to
      non-admins).

---

## 6. Push notifications when the admin publishes an event

This is the biggest addition, and it's genuinely new ground: `PLAN/idea.md` §8
explicitly scoped **"Push notifications / reminders before an event"** *out* of v1.
Worth being precise about what changed: idea.md's exclusion was about *reminders
before an event you've already reserved* (e.g. "your event is tomorrow"). What's
being built here is different — a **"a new event just went live"** announcement, sent
once, at publish time, to every member, regardless of whether they've reserved
anything. Still a real scope addition, not just a rewording — flagging it clearly so
whoever next touches `idea.md` can move it from §8 (out of scope) into the main
feature list, rather than the two documents silently disagreeing.

### How browser push actually works (constrains the design)

A push notification that can reach a device even with the site's tab **closed**
fundamentally requires that specific browser, on that specific device, to have
**explicitly granted notification permission** at some point — there is no way for a
server to push to "all members" who never granted that permission; browsers block it
by design (this is not a Dekka limitation, it's how the Push API and every browser's
permission model work everywhere). So "to all members" in practice means: **ask every
member to opt in, as frictionlessly as possible, and honor whatever fraction says
yes.** The plan below is built around getting that opt-in rate as high as realistically
possible without being obnoxious about it — a permission prompt is a one-shot ask in
most browsers (deny it once and the browser silences future prompts from that origin
until the user changes it manually), so it should not fire immediately and
unprompted on first page load.

**Where the opt-in ask appears:**
- A dismissible banner on `/account` (§5's new page) — "Get notified the moment we
  announce a new night — [Enable notifications]" — persistent but not modal, so it
  never blocks anything.
- Once, right after a successful sign-up or login redirect (`next` target), a small
  non-blocking toast with the same one-tap action — this is the highest-intent
  moment (someone just chose to create an account with this cafe), but still
  dismissible, still asked at most once per browser session, never re-shown the same
  session if dismissed.
- **Never** trigger the actual OS permission dialog automatically — only in direct
  response to the user tapping "Enable notifications" (browsers require a user
  gesture for this anyway; some silently ignore programmatic calls without one).

### New pieces

**Dependency:** `web-push` (npm) — the standard Node library for sending Web Push
messages against the VAPID protocol; no other dependency needed (no third-party
push service/SaaS required — this is the app's own server talking directly to each
browser's push endpoint).

**Env vars** (add to `.env.example`):
```
# --- Push notifications ----------------------------------------------------
# Generate once with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# Contact address browsers may show if a push endpoint provider needs to reach you
VAPID_SUBJECT=mailto:you@dekka.example
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```
(The public key is needed both server-side, for `web-push` to sign requests, and
client-side, to register the subscription — hence both a plain and a
`NEXT_PUBLIC_`-prefixed copy of the same value, matching this codebase's existing
convention of `NEXT_PUBLIC_`-prefixing anything the browser needs, e.g. `lib/site.ts`.)

**Model:** `models/PushSubscription.ts` — one row per browser/device, not per user
(someone can have the site open on a phone and a laptop, both should get notified):
```ts
export interface IPushSubscription {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;   // ref User
  endpoint: string;                // unique — this *is* the device
  keys: { p256dh: string; auth: string };
  createdAt: Date;
}
```
`endpoint` unique-indexed — re-subscribing the same browser upserts rather than
duplicating.

**Client:** `public/sw.js` — a minimal service worker whose only job is a `push`
event listener that calls `self.registration.showNotification(...)` with the
event's title/short blurb and a click handler that opens `/events/[id]`. Registered
from a small client component (e.g. inside `AccountForm.tsx`'s new banner, and the
post-auth toast) via `navigator.serviceWorker.register("/sw.js")` →
`registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey:
NEXT_PUBLIC_VAPID_PUBLIC_KEY })` → `POST /api/push/subscribe` with the resulting
subscription object.

**API routes:**

| Method | Path | Guard | Notes |
|---|---|---|---|
| `POST` | `/api/push/subscribe` | `guard("member")` | Upserts a `PushSubscription` by `endpoint`, `user` set from the session. |
| `DELETE` | `/api/push/subscribe` | `guard("member")` | Body `{ endpoint }` — removes one device's subscription (e.g. an explicit "turn off notifications" control, future nice-to-have; not required for this round but cheap to add alongside the POST route). |

**The send trigger:** `app/api/events/[id]/route.ts`'s `PATCH` handler already knows
the event's *previous* status is available (it's fetched before the update — actually
today it isn't fetched first, `findByIdAndUpdate` goes straight to the write; this
needs a small restructure: fetch the current `status` first, or use
`findByIdAndUpdate`'s `new: false` … actually simplest is to read `doc.status` via a
pre-update `Event.findById(id).select("status").lean()` before the `findByIdAndUpdate`
call, so the transition can be detected). When `update.status === "published"` **and**
the event's status was **not already** `"published"` before this call (so re-saving
an already-published event, e.g. editing its description, never re-notifies), fire a
fan-out:

```ts
// after the successful findByIdAndUpdate, only on draft/closed → published:
const subs = await PushSubscription.find().lean();
await Promise.allSettled(
  subs.map((s) =>
    webpush
      .sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({
          title: locale-aware "New night at Dekka" / "ليلة جديدة في دكة",
          body: doc.titleEn / doc.titleAr pairing, or just titleEn — see i18n note below,
          url: `/events/${doc._id}`,
        })
      )
      .catch(async (err) => {
        // 404/410 = the browser unsubscribed or the endpoint expired; clean up.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: s._id });
        }
      })
  )
);
```

This runs **inside** the existing `handle()`-wrapped `PATCH` handler but should not
block or fail the actual publish if push sending has a problem — wrap the whole
fan-out block so a `web-push` error never turns a successful publish into a 500 (the
event is published either way; notification delivery is best-effort). Log failures,
don't throw them.

**i18n note:** push notification payloads are plain-text, sent once, and shown by
the OS — they can't live-switch with the viewer's locale toggle the way in-page text
does, because they're rendered outside the page entirely. Simplest honest choice:
send the notification bilingually in one string (`"New night at Dekka / ليلة جديدة في
دكة: {titleEn}"`), matching the "English / Arabic on one line" pattern already used
everywhere else in the UI (`BilingualLabel`), rather than picking one locale per user
(which would need tracking a locale preference per subscription — not worth it for
one short string).

**Performance / safety notes, matching this codebase's existing standards:**
- `PushSubscription.find()` with no cap: at cafe scale (few hundred members, each
  with 1–2 devices) this is fine; if it ever needs a cap or batching, that's the same
  "simple until the scale assumption changes" tradeoff already accepted elsewhere in
  `developer-guide.md` §4/§7 for `getAllCheckIns`/`getAllReservations`.
- The route stays `guard("admin")`-gated exactly as it is today — this section adds
  a side effect to an existing admin action, not a new privileged surface.
- HTTPS is required for the Push API outside `localhost` — true automatically on
  Vercel, worth a one-line note in `README.md`'s deploy section.

**Checklist:**
- [ ] **Deps:** add `web-push` to `package.json`.
- [ ] **Env:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.example` + generate real values with
      `npx web-push generate-vapid-keys`.
- [ ] **Model:** `models/PushSubscription.ts`, unique index on `endpoint`.
- [ ] **Service worker:** `public/sw.js` — `push` + `notificationclick` listeners.
- [ ] **Client opt-in:** subscribe flow wired into `/account` (banner) and the
      post-auth redirect (one-shot toast), both gated on an explicit tap, never
      auto-firing the permission prompt.
- [ ] **API:** `app/api/push/subscribe/route.ts` — `POST` (upsert) + `DELETE`
      (unsubscribe).
- [ ] **Trigger:** `app/api/events/[id]/route.ts`'s `PATCH` — detect draft/closed →
      published transition (fetch prior status first), fan out via `web-push`,
      swallow/log failures, clean up dead subscriptions on 404/410.
- [ ] **i18n:** bilingual single-string payload as described above — no new
      dictionary keys strictly needed since the string is composed at send time from
      the event's own `titleEn`, but add a small `push.*` block for the opt-in
      banner/toast copy (ar/en).
- [ ] **Docs:** once shipped, note the scope delta in `PLAN/idea.md` §8 (move this
      line out of "out of scope") and add the "Push notifications" entry to
      `developer-guide.md` §8 Feature Log, same style as the existing entries.

---

## Implementation checklist (top-level, all sections)

Everything below is scoped; no remaining open questions.

- [ ] **§1** Configure `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`; add `pressable` to
      social buttons.
- [ ] **§2** Confirm-password field + animated match indicator on sign-up.
- [ ] **§3** `heroImage(mode)` split login/signup photo resolution +
      `prepare-brand-assets.ts` updated for the two new optional source files.
- [ ] **§4** `EMAIL_TAKEN_OAUTH` error branch + actionable inline social button on
      the sign-up error.
- [ ] **§5** `AccountMenu.tsx`, `/account` page, `AccountForm.tsx`,
      `PATCH /api/account`, `PATCH /api/account/password`, widen `/api/uploads`
      guard to any member.
- [ ] **§6** Full push-notification pipeline — dependency, model, service worker,
      opt-in UI, subscribe/unsubscribe API, publish-time fan-out trigger.
- [ ] **i18n:** every new label above gets both `ar` and `en` keys in
      `lib/i18n/dictionaries.ts` — compile-time-checked, per `developer-guide.md` §2.
- [ ] **Docs:** once shipped, add a "Login/Sign-up/Account fix" entry to
      `developer-guide.md` §8 (Feature Log), and update `PLAN/idea.md` §8 per §6's
      note above.

**Suggested order:** §2 first (smallest, fully isolated, no new routes). Then §4
(small, shares the sign-up form §2 already has open, and directly improves the
existing duplicate-account confusion with no new UI surface). Then §5 (needed before
§4b's "set a password" action has anywhere to live, and before §6's opt-in banner has
a page to sit on). §3 can happen any time after real photos exist — it's fully
decoupled from the others. §6 last — it's the only section with new infrastructure
(service worker, VAPID keys, a new model) and both benefits from §5's `/account` page
existing first and is safe to ship independently of everything else above it.
