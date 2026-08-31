# Dekka — Rate Limiting (rate-limiting.md)

Plan for **Phase 3** of `PLAN/Before_Deployment.md` §4.

Today every endpoint accepts unlimited requests from a single IP or account. Nothing in
`package.json` limits anything, there is no middleware, and no route throttles.

---

## 1. Deviation from the spec, and why

`Before_Deployment.md` §4 lists the highest-priority target as
`POST /api/auth/[...nextauth]` — "the credentials sign-in path". **That is the wrong
insertion point and this plan does not use it.**

`app/api/auth/[...nextauth]/route.ts` is `export const { GET, POST } = handlers` — one
catch-all serving sign-in, sign-out, every OAuth callback, CSRF *and* session. Wrapping
its `POST` would throttle sign-out and OAuth callbacks alongside sign-in attempts, and
put an app-wide auth chokepoint behind a Redis round trip.

The precise place is the Credentials provider's `authorize()` in `lib/auth.ts`. It fires
exactly once per credentials sign-in attempt, nothing else routes through it, and — the
real win — **it has the submitted email in hand**, so the limiter can key per account
rather than per IP alone. `authorize(credentials, request)` also receives the original
request (verified against `@auth/core`'s types), so the IP is available too.

---

## 2. Decision — Upstash Redis

Locked in `Before_Deployment.md` §4. The reason it is not an in-memory counter: each
Vercel invocation is a separate process, so an in-memory limit of 5 becomes 5 *per
instance*, which under the concurrency an attacker actually generates is close to no
limit at all. Upstash is HTTP-based, so it works from serverless with no connection pool.
Free tier is 10,000 commands/day; a sliding-window check is 1–2 commands, and
`ephemeralCache` means a client already known to be blocked is rejected in-process
without touching Redis at all.

`analytics` stays **off** — it costs extra commands per check and buys a dashboard we
would not read.

---

## 3. Failure behaviour — the one genuinely hard call

Three distinct situations, and they must not be conflated:

| Situation | Behaviour | Why |
|---|---|---|
| Upstash env vars absent | **allow**, warn at startup, report once to Sentry in production | Local dev and anyone who has not signed up must still be able to run the app |
| Upstash errors or times out | **allow**, report to Sentry | An Upstash blip must never mean nobody at Dekka can log in. A limiter that takes the site down has done more damage than the abuse it prevents |
| Limit genuinely exceeded | **reject**, `429` + `Retry-After` | The actual job |

This is **fail-open**, and that is a deliberate, stated tradeoff rather than an oversight.
Fail-closed would convert a third-party outage into a total auth outage. The cost is that
a misconfigured deploy is unprotected while *looking* fine — which is exactly why the
unconfigured case is loud in production rather than silent, and why it belongs on the
deploy checklist in `developer-guide.md`.

---

## 4. `lib/ratelimit.ts`

Shaped like `guard()` so it drops into a route in one line and reads like everything else:

```ts
const rl = await rateLimit("register", ip);
if ("response" in rl) return rl.response;
```

Returns `{ ok: true } | { response: NextResponse }`. The `429` body follows the repo's
`{ error, details? }` shape and carries a `Retry-After` header.

Limits are defined once, in one table in that file, keyed by a named bucket — so changing
a limit is a one-line edit and no route hardcodes a number.

| Bucket | Limit | Key | Rationale |
|---|---|---|---|
| `signin-email` | 10 / 10 min | email | targeted brute force against one account |
| `signin-ip` | 30 / 10 min | IP | spraying many accounts from one machine |
| `register` | 5 / hour | IP | signup spam |
| `reserve` | 10 / hour | user id | booking spam on a real event night |
| `upload` | 20 / hour | user id | storage and bandwidth abuse |
| `health` | 60 / min | IP | public, unauthenticated, touches the DB |

Sign-in checks **both** buckets: per-email stops the targeted attack, per-IP stops the
spray. Neither alone covers the other.

`reserve` and `upload` key on user id rather than IP because both are authenticated — a
shared cafe wifi would otherwise make one guest's uploads throttle everyone else's.

---

## 5. Client IP

`x-forwarded-for` (first entry), falling back to `x-real-ip`. On Vercel these are set by
the platform. **Both are trivially spoofable when the app is not behind a trusted
proxy**, so this is worth stating plainly: IP-keyed limits are a speed bump against
casual abuse, not a defence against a determined attacker who rotates the header. The
account-keyed limits (`signin-email`, `reserve`, `upload`) are the ones that hold,
because their key comes from the session or the submitted credentials, not a header.

A request with no resolvable IP is keyed `unknown` and shares one bucket — deliberately,
so an attacker cannot earn an unlimited allowance by stripping headers.

---

## 6. Files

| File | Status | What |
|---|---|---|
| `lib/ratelimit.ts` | new | the helper, the bucket table, the IP resolver |
| `lib/auth.ts` | edit | `authorize()` checks `signin-email` + `signin-ip` |
| `app/api/register/route.ts` | edit | `register` |
| `app/api/events/[id]/reservations/route.ts` | edit | `reserve` |
| `app/api/uploads/route.ts` | edit | `upload` |
| `app/api/health/route.ts` | edit | `health` (flagged in its own header in Phase 2) |
| `lib/i18n/dictionaries.ts` | edit | `t.errors.rateLimited`, ar + en |
| `.env.example` | edit | the two Upstash vars |

**Phase 4 note:** the forgot-password request endpoint does not exist yet. When it is
built it needs a `forgot-password` bucket keyed by IP *and* email, at the tightest limit
in the table — it is the only endpoint in the app that sends email on an anonymous
request, so it is both an inbox-spam vector and a cost vector.

---

## 7. Sign-in specifics

Two details that are easy to get wrong:

1. **Only failed attempts count against the email bucket.** Counting successes means a
   member legitimately signing in on phone and laptop repeatedly burns their own
   allowance. The IP bucket counts every attempt; the email bucket counts failures.
2. **`authorize()` returning `null` is how NextAuth signals bad credentials.** A rate
   limit rejection must be distinguishable from a wrong password, or the user is told
   "invalid credentials" while actually being throttled, and retries harder. Throwing a
   `CredentialsSignin` with a distinct code lets `AuthForm.tsx` render the right message.

---

## 8. Verification

`typecheck`, `lint`, `build` clean, plus:

- `scripts/check-ratelimit.ts` (`npm run check:ratelimit`) — exercises the bucket table
  and the IP resolver without Redis: unconfigured fails open, header parsing behaves,
  and every bucket has a limit.
- Manual: with real Upstash credentials, hit `POST /api/register` past its limit and
  confirm a `429` with `Retry-After`, then confirm it resets.

**Will not be verified here:** behaviour under genuine concurrent load, and whether the
sliding window stays exact under a burst spread across multiple Vercel instances.
Upstash's own correctness is taken on trust; what is verified is that this app calls it
correctly.

---

## 9. What you must set up

1. Upstash account (free) → create a **Redis** database in a region near `eu-central`.
   From Vercel the easiest path is **Storage → Marketplace → Upstash**, which injects the
   env vars into the project automatically.
2. Two env vars, both **secret**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Leave them unset and the app runs exactly as it does today, unthrottled, with a warning
in the logs.
