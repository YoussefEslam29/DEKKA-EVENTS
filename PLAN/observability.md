# Dekka — Error Tracking (observability.md)

Plan for **Phase 1** of `PLAN/Before_Deployment.md` §8 (Logging). Phase 2 (Alerts, §9)
is dashboard configuration against the same tool and is specified there, not here.

The ask, restated so it doesn't drift: **error tracking only.** Not performance
monitoring, not session replay, not log aggregation. The question this has to answer is
"something broke in production — what, where, and how often", cheaply enough that the
free tier is never a thing to babysit.

---

## 1. What exists today

`handle(label, fn)` in `lib/api.ts` wraps every API route so an unexpected throw becomes
a `console.error` plus a clean `500`. `app/error.tsx` is the one React error boundary.
Both work; both write to somewhere nobody is looking. Vercel's function logs have short
retention, no search, and no grouping — five identical failures are five log lines, not
one issue with a count of five.

There is no `instrumentation.ts` and no `app/global-error.tsx` (checked, absent).

---

## 2. Decision — Sentry, error-only

Locked in `Before_Deployment.md` §8. Free tier is 5,000 error events/month, which a cafe
events app will not approach. The parts of Sentry that *do* burn quota are deliberately
all off:

| Feature | Setting | Why |
|---|---|---|
| Error events | on | the entire point |
| Performance tracing | `tracesSampleRate: 0` | §8's "near 0" — the fastest quota consumer, and not what was asked for |
| Session replay | not installed | quota-hungry, useless for a server-rendered booking app |
| Sentry Logs | `enableLogs: false` | the wizard's template turns this on; another stream we didn't ask for |
| User feedback widget | not installed | not asked for |

---

## 3. Activation — absent credentials means absent, not broken

This repo already has two precedents for a feature that switches itself off when its
env var is missing rather than half-working: `enabledOAuthProviders` (`lib/auth.ts`)
hides a social button with no client ID, and `usingBlobStorage()` (`lib/storage.ts`)
falls back to local disk with no token. Sentry follows the same rule:

**`Sentry.init()` runs only when a DSN is present.** No DSN → no init, no network, no
quota, no noise. That single mechanism covers both "there is no Sentry account yet" and
"this is local dev" — so long as the DSN simply isn't put in `.env.local`, which is what
`.env.example` will say.

`withSentryConfig` in `next.config.ts` is likewise applied **only when `SENTRY_ORG` and
`SENTRY_PROJECT` are set**, so a build without them is byte-for-byte the build we have
today. Critically it must preserve `serverExternalPackages` — that's what keeps
`@sparticuz/chromium` out of the traced bundle, and the event-analysis PDF route depends
on it (`developer-guide.md` §7).

---

## 4. Scrubbing — the app-specific part

§8 says *"confirm nothing sensitive leaks into Sentry events — verify rather than
assume for this app's specific field names."* Doing that properly means naming the
actual leak vectors in *this* codebase:

1. **`MONGODB_URI` is a credential.** It's `mongodb+srv://user:pass@cluster/...`, and a
   Mongoose connection failure puts it in the error message. This is the single most
   likely secret to reach Sentry from this app, and no default scrubber catches it,
   because it's a URI rather than a field named `password`.
2. **Plaintext passwords are in POST bodies** at `/api/register`, the credentials
   `authorize()` path, and (Phase 4) forgot-password — under this app's own names:
   `password`, `newPassword`, `confirmPassword`, `currentPassword`.
3. **The session JWT is a cookie**, so any event carrying request headers carries a
   valid session.
4. Later phases add more: `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`,
   `RESEND_API_KEY`, and the Phase 4 reset token itself.

Two layers, because one is not enough:

- **Don't collect it.** `sendDefaultPii: false` (no cookies, headers or IP) and no
  request bodies.
- **Scrub what gets through.** `lib/sentry-scrub.ts` — a `beforeSend` that walks the
  event and (a) rewrites any `scheme://user:pass@host` credential pair to
  `scheme://<redacted>@host`, which covers Mongo today and Upstash Redis in Phase 3,
  and (b) drops values under keys matching this app's sensitive names.

Layer (a) is the one that matters most, and it is the one a default install does not
give you.

---

## 5. Files

| File | Status | What |
|---|---|---|
| `instrumentation.ts` | new | `register()` → server/edge config; `onRequestError` |
| `instrumentation-client.ts` | new | browser init (this is the current filename; `sentry.client.config.ts` is the Pages-Router-era name) |
| `sentry.server.config.ts` | new | Node runtime init |
| `sentry.edge.config.ts` | new | Edge runtime init |
| `lib/sentry-scrub.ts` | new | shared `beforeSend` — §4 |
| `app/global-error.tsx` | new | catches a throw in the **root layout** itself, which `app/error.tsx` cannot |
| `app/error.tsx` | edit | report to Sentry; rename its function `GlobalError` → `RouteError` (it is not the global one, and the name will actively mislead once `global-error.tsx` exists) |
| `lib/api.ts` | edit | `handle()` gains `Sentry.captureException` beside the existing `console.error` — one call site, every API route covered |
| `next.config.ts` | edit | conditional `withSentryConfig` |
| `.env.example` | edit | the new vars |

**`global-error.tsx` renders bilingually by showing both languages at once**, rather
than reading the locale. It replaces the root layout — including the `<html lang/dir>`
the locale cookie drives — so there is no locale to read at that point. Showing
`العربية / English` together is the app's existing `BilingualLabel` pattern anyway, so
this is consistent rather than a special case. It ships its own inline styles for the
same reason: it cannot assume the stylesheet loaded.

---

## 6. Env vars (for Vercel)

| Var | Scope | Required? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | all | to activate | Safe to expose — a DSN is a write-only ingest key, not a secret |
| `SENTRY_DSN` | server | optional | Falls back to the public one; set separately only to split client/server projects |
| `SENTRY_ORG` | build | for sourcemaps | Org slug |
| `SENTRY_PROJECT` | build | for sourcemaps | Project slug |
| `SENTRY_AUTH_TOKEN` | build | for sourcemaps | **Secret.** Never prefix `NEXT_PUBLIC_`. Without it the build still succeeds; stack traces are just minified |

Leave every one of these unset and the app builds and runs exactly as it does today.

---

## 7. Verification

No test suite (`developer-guide.md` §5), so: `npm run typecheck`, `npm run lint`,
`npm run build` clean, **plus** proof the two things that could actually be wrong are
not:

1. **The build is unchanged without Sentry env vars** — that `withSentryConfig` is
   genuinely skipped and `serverExternalPackages` survives.
2. **The scrubber works** — `scripts/check-sentry-scrub.ts`, run the same way
   `scripts/check-upload-pattern.ts` is: a real `mongodb+srv://` URI with a password, a
   body carrying each of this app's four password field names, and a cookie header, all
   fed through `beforeSend` and asserted redacted. This is the claim §8 asks to be
   verified rather than assumed, so it gets a runnable check rather than a paragraph.

Not verifiable from here, and will be stated as such: **that events actually arrive in a
Sentry project.** That needs a real DSN and a deploy.

---

## 8. Open questions

1. **Sentry account/org** — needs to exist before any of §6 can be filled in. Free tier,
   sign-up only; nothing in this plan depends on the paid tier.
2. **Sourcemaps** — worth the `SENTRY_AUTH_TOKEN` setup? Without it, production stack
   traces point at minified code, which makes the whole feature substantially less
   useful. Recommendation: yes, set it.
3. **PII posture** — this plan sends no user identity at all (`sendDefaultPii: false`).
   The tradeoff is that an error can't be tied to "which member hit this". For a cafe
   app holding real names and phone numbers that is the right default; revisit only if
   a real bug proves un-diagnosable without it.
