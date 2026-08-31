# Dekka — Password Reset (password-reset.md)

Plan for **Phase 4** of `PLAN/Before_Deployment.md` §5.

Before this, the app had no way to recover an account. `/account` lets a *signed-in*
member change their password — a different feature, which stays as-is. Someone locked
out had no route back in at all.

---

## 1. The one defect in the spec, rejected

`Before_Deployment.md` §5 and §7 both call for **a MongoDB TTL index on
`resetTokenExpiresAt`** so expired tokens are "purged automatically rather than
lingering as dead rows forever."

**That instruction, applied to the `User` collection, deletes user accounts.** A TTL
index removes *the whole document*, never one field. Every member who ever requested a
password reset would have their account silently deleted 30 minutes later, taking their
reservation history's meaning with it. It would have looked fine in testing — the damage
lands half an hour after anyone stops watching.

So there is no TTL index. The doc's underlying worry does not apply anyway: there are no
"dead rows" here, only two optional `select: false` fields on a document that has every
reason to keep existing. They are overwritten by the next request, cleared on a
successful reset, and inert once expired because the route checks expiry in code.

If auto-purging is ever genuinely wanted, the right shape is a separate
`PasswordResetToken` collection whose documents are *entirely* ephemeral. That was judged
not worth a collection for two fields. The rejection is recorded in `models/User.ts` too,
where someone would actually be standing when tempted to "fix" it.

**Verified**, not assumed: the DB check confirmed the user document survives.

---

## 2. Token rules

| Property | Choice | Why |
|---|---|---|
| Generation | `randomBytes(32)` hex, 64 chars | 256 bits of CSPRNG. Not a UUID — v1/v7 are partly time-derived, and for a credential granting account takeover that is fatal |
| Storage | SHA-256 of the token | A database dump must not yield working reset links. Same instinct as `passwordHash` |
| Hash choice | SHA-256, **not bcrypt** | bcrypt is slow because *passwords* are low-entropy. A 256-bit random token has nothing to brute force, so the slow hash would buy nothing and add ~100ms to a path that is also a timing surface |
| Comparison | `timingSafeEqual` | Costs nothing, removes the question |
| Lifetime | 30 minutes, checked in code | Never left to a background reaper — this check is what stands between an expired link and a takeover |
| Single use | Cleared in the same write that sets the password | A second submission fails even inside the window |
| Supersession | A new request overwrites the stored hash | An intercepted older link stops working the moment the real user asks again |

The reset write is matched on `{ _id, resetTokenHash }`, so two requests racing with the
same link cannot both succeed — the second matches nothing.

---

## 3. No user enumeration

`POST /api/auth/forgot-password` returns **the same 202 and the same body** for every
well-formed request: address with an account, address without one, OAuth-only account
with no password, and mail-send failure alike. A 404, a different message, or even a
different `details` key would turn the endpoint into a "does this person have a Dekka
account" oracle for anyone holding a list of emails.

The UI mirrors this: `ForgotPasswordForm` shows its "check your inbox" state on every
successful submission. A screen saying "no account with that email" would hand back the
oracle the API just refused.

An OAuth-only account is silently skipped rather than told to use Google — that fact is
exactly what must not leak. Such a user still has a route: sign in with the provider,
then set a password from `/account`.

Both buckets are charged **before** the database lookup, so a throttled response does not
depend on whether the account exists either.

---

## 4. Rate limiting

Two new buckets, the tightest in the table (`lib/ratelimit.ts`):

| Bucket | Limit |
|---|---|
| `forgot-password-ip` | 5 / hour |
| `forgot-password-email` | 3 / hour |

Keyed both ways deliberately: per-IP stops one machine hammering many addresses, per-email
stops many machines hammering one person's inbox. This is the only anonymous endpoint in
the app that sends email, making it simultaneously an inbox-spam vector against a real
person and a cost vector against the mail quota.

`/api/auth/reset-password` shares the IP bucket — it is the token-guessing surface.

---

## 5. Email

`lib/email.ts` — a thin `fetch` wrapper over Resend rather than the SDK, because the
entire surface used is one POST and this keeps a dependency tree out of the app for a
feature that sends a handful of messages a month. Swapping provider is a one-file change.

Plain text, **no HTML** — no tracking pixels, no remote images. Bilingual, Arabic first,
carrying the link in both halves. Deliberately *not* routed through
`lib/i18n/dictionaries.ts`: an email is read outside the app, hours later, possibly on a
device set to another language, so there is no locale to honour. Same reasoning as the
push payload.

`sendEmail()` never throws — callers sit on request paths where a mail failure must not
become a 500, and for this flow must not change the response at all.

---

## 6. Degrades to absent, not broken

`emailEnabled` is false without `RESEND_API_KEY` and `EMAIL_FROM`. Then:

- the **"Forgot?" link is not rendered** — exactly as `enabledOAuthProviders` hides a
  social button with no client ID
- `/forgot-password` and `/reset-password` **redirect to `/login`**, so a hand-typed URL
  cannot reach a form that could never deliver
- the API still answers with its generic 202, so nothing about the deploy's configuration
  leaks through a differing response

A link into a flow that silently cannot deliver is worse than no link: the user believes
an email is coming and waits for it.

---

## 7. The limitation this does NOT fix

**A password reset does not sign out devices that are already signed in.**

Sessions here are JWTs (`session: { strategy: "jwt" }`). A JWT is valid until it expires
because it is self-contained — nothing checks the database on each request. So if someone
else has an active session on this account, resetting the password **does not evict
them**. It stops them getting a *new* session; it does not revoke the one they hold.

This is the same limitation `developer-guide.md` §3.6 already records for role changes
("the person must sign out and back in"). Real revocation means either database sessions
or a session-version stamp checked on every request — genuine work, deliberately out of
scope here.

It is stated rather than quietly worked around, because the difference matters in the one
scenario a reset is most urgently used: *"I think someone got into my account."* For that
case the honest answer today is that the reset locks them out of getting back in, but an
already-open session survives until its JWT expires.

---

## 8. Files

| File | Status |
|---|---|
| `lib/password-reset.ts` | new — token generation, hashing, comparison, expiry, email body |
| `lib/email.ts` | new — Resend wrapper + `emailEnabled` |
| `app/api/auth/forgot-password/route.ts` | new |
| `app/api/auth/reset-password/route.ts` | new |
| `app/(auth)/forgot-password/page.tsx` | new |
| `app/(auth)/reset-password/page.tsx` | new |
| `components/ForgotPasswordForm.tsx` | new |
| `components/ResetPasswordForm.tsx` | new |
| `scripts/check-password-reset.ts` | new |
| `models/User.ts` | +2 `select: false` fields, and the recorded no-TTL decision |
| `lib/validation.ts` | `requestPasswordResetSchema`, `resetPasswordSchema` |
| `lib/ratelimit.ts` | two new buckets |
| `components/auth/AuthScreen.tsx` | accepts `children`, so both screens reuse the split layout |
| `components/AuthForm.tsx` | "Forgot?" now points at `/forgot-password`, gated on `emailEnabled` |
| `lib/i18n/dictionaries.ts` | 13 new keys × 2 languages |

---

## 9. Verification

`typecheck`, `lint`, `build` clean. `npm run check:reset` covers 500 tokens for
uniqueness and unpredictability, hashing, constant-time comparison against junk/short/
empty input, exact 30-minute TTL, and the bilingual plain-text email.

Exercised against the live cluster with **one throwaway user, deleted afterwards**
(cleanup confirmed): `select: false` holds, a new request supersedes the old token,
single-use is enforced (second spend modifies 0 documents), the token fields are cleared
on success, an expired token reads as expired, **and the user document is not deleted** —
the check that would have caught the TTL disaster.

**Not verified:** that a real email is delivered. There is no verified sending domain, so
`emailEnabled` is false and no message has been sent. The flow is dormant until that
exists — see §6.
