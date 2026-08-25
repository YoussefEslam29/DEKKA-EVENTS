# LOG_SIGN_AUTH_IN — Task Breakdown

This file exists only to drive Subagent-Driven Development tooling (it needs
`## Task N` headings; the source plan doesn't use that shape). **The Spec is
[`PLAN/LOG_SIGN_AUTH_IN.md`](LOG_SIGN_AUTH_IN.md)** — every task below is a
pointer into it, not a restatement. Read the referenced section(s) in full
before writing code; this file's own prose is a summary, not the requirement.

Also read, once, before Task 1: `PLAN/idea.md` (product), `developer-guide.md`
(architecture/patterns/security rules), and `design-system/*.md` (visual
language) — every implementer subagent should do the same, they're short.

## Global Constraints

Binding on every task, copied here so the controller can paste them verbatim
into every dispatch (per `developer-guide.md` §2/§3/§5):

- **API routes:** `handle(label, fn)` wraps the handler; `guard(min)` (or
  `currentUser()` + null-check) is the first line; `parseBody(request, schema)`
  is the only way a handler reads the body — never `request.json()` fields
  directly. Response shape is always `{ data }` or `{ error, details? }`.
- **Ownership, not just role.** A member acts on *their own* row — check it
  even after `guard("member")` passes.
- **Zod schemas** live in `lib/validation.ts`, next to existing ones.
- **`.lean()`** on every read-only query.
- **i18n:** every new label gets both `ar` and `en` keys in
  `lib/i18n/dictionaries.ts` in the same edit — the English object is
  type-checked against the Arabic one, so a missing key is a compile error.
  Bilingual on-screen labels follow the `English / العربية` pattern via
  `BilingualLabel` — see `design-system/02-typography.md` /
  `04-components.md`.
- **RTL:** Tailwind logical properties only (`ps-`, `pe-`, `ms-`, `me-`,
  `text-start`) — never `pl-`/`pr-`/`ml-`/`mr-`.
- **Client/server boundary:** never import `@/models/*` from a client
  component — shared enums come from `lib/constants.ts`.
- **UI primitives:** reuse `components/ui/*` (`Card`, `TextField`,
  `PasswordField`, `Button`, `PageHeader`, etc.) — check
  `design-system/04-components.md` before inventing new markup. Motion
  reuses `lib/motion.ts` presets (`fadeUp`, `pressable`, `DURATION.press` =
  150ms) — every preset takes `useReducedMotion()` as a required argument.
- **Passwords:** bcrypt, cost factor 12, `passwordHash` is `select: false` on
  `User` — pull it explicitly only where needed (mirrors
  `authorize()` in `lib/auth.ts`).
- **Test/verify before reporting done:** run `npm run typecheck` and
  `npm run lint` at minimum; there is no automated test suite in this repo
  today, so manual verification of the actual behavior (describe what you
  checked and how) stands in for it — say so plainly in the report, don't
  claim "tests pass" when there are none to run.
- **Commit per task**, message describing the change; don't touch files
  outside the task's scope.
- **No subagents:** implementers never dispatch their own subagents
  (helpers or reviewers) — report back to the controller instead.

Interfaces later tasks depend on (front-loaded so the controller can paste
the relevant lines into a dispatch without re-deriving them):
- Task 3 (account page) introduces `/account` and reads `currentUser()` the
  same way `app/(site)/my-events/page.tsx` already does.
- Task 3 also widens `app/api/uploads/route.ts`'s guard from `admin` to
  `member` — Task 5's push opt-in banner lives on the page Task 3 creates,
  so Task 3 must land first.
- Task 5 (push) needs Task 3's `/account` page to exist (the opt-in banner
  renders there).

---

## Task 1: Confirm-password field + Google button polish

**Spec:** `PLAN/LOG_SIGN_AUTH_IN.md` §1 ("What to actually change in code"
bullets only — the OAuth credential setup itself is an operational step for
the human, not code) and §2 in full.

Summary: add a `confirmPassword` field to sign-up (client-side match check
+ animated match indicator, reusing `PasswordField`), plus two small
`AuthForm.tsx` polish items — confirm the social-button row still looks
intentional with a single button, and add `pressable` tap/hover feedback to
the `OutlineButton`-variant social buttons. New i18n keys:
`auth.confirmPassword`, `auth.passwordMismatch`. No server/API changes — the
confirm field never leaves the browser.

---

## Task 2: Duplicate-account UX fix

**Spec:** `PLAN/LOG_SIGN_AUTH_IN.md` §4 in full (§4a and §4b's "what's
covered where" note — §4b's actual fix ships in Task 3, this task is §4a
plus wiring the error UI).

Summary: `POST /api/register` returns `EMAIL_TAKEN_OAUTH` (with
`providers`) instead of generic `EMAIL_TAKEN` when the existing account has
no `passwordHash`. `AuthForm.tsx` renders a specific bilingual message plus
the matching social button inline with that error. New i18n key:
`auth.emailTakenOAuth`.

---

## Task 3: `/account` page, menu, and set/change password

**Spec:** `PLAN/LOG_SIGN_AUTH_IN.md` §5 in full (all of §5a/§5b, the new API
surface table, and the Motion note), plus §4b (one sentence — the
"set a password" action this task builds is what closes that gap).

Summary: `components/AccountMenu.tsx` (replaces the bare `SignOutButton` in
`Navbar.tsx`, desktop + mobile), `app/(site)/account/page.tsx` (gated like
`my-events/page.tsx`), `components/AccountForm.tsx` (photo, name/phone,
providers list read-only, set/change password), `PATCH /api/account`,
`PATCH /api/account/password`, and widening `app/api/uploads/route.ts`'s
guard from `admin` to `member`. New Zod schemas `updateAccountSchema` /
`setPasswordSchema`. New i18n: `nav.account` + an `account.*` block.

---

## Task 4: Auth hero photos (code path only)

**Spec:** `PLAN/LOG_SIGN_AUTH_IN.md` §3 in full.

Summary: `AuthScreen.tsx`'s `heroImage()` takes a `mode: "login" | "signup"`
argument with the login/signup → shared → gradient-fallback resolution order
described in the spec, plus matching env var overrides. Extend
`scripts/prepare-brand-assets.ts` to process two new optional source files
if present in `IMGS/`. No real photos exist yet (`IMGS/` only has logo,
banner, one contest shot) — that's expected; both screens must keep working
exactly as today (gradient fallback) with zero source images present. Note
the two new file slots in `design-system/05-brand-assets.md`.

---

## Task 5: Push notifications on event publish

**Spec:** `PLAN/LOG_SIGN_AUTH_IN.md` §6 in full — this is the largest task,
follow it closely: dependency (`web-push`), env vars, the
`models/PushSubscription.ts` model, `public/sw.js`, the opt-in UI (banner on
`/account` from Task 3 + one-shot post-auth toast, both gated on an explicit
tap, never auto-firing the permission prompt), `POST`/`DELETE
/api/push/subscribe`, and the publish-time fan-out trigger in
`app/api/events/[id]/route.ts`'s `PATCH` handler (fetch prior status first
to detect the draft/closed → published transition; swallow/log `web-push`
errors so a notification failure never turns a successful publish into a
500; clean up subscriptions on 404/410).

Generate real VAPID keys with `npx web-push generate-vapid-keys` and put
them in `.env.local` (not committed) — do not leave placeholder values only.

After this ships: add the "Push notifications" entry to `developer-guide.md`
§8 Feature Log, and update `PLAN/idea.md` §8 to move this line out of "out
of scope" (both called for explicitly in the spec's own checklist).
