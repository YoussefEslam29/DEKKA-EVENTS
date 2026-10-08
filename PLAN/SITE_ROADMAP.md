# Dekka — Site Audit & Roadmap (SITE_ROADMAP.md)

Written 2026-10-08 after reading `developer-guide.md` (all 1,900 lines), every doc in `PLAN/`,
`README.md`, `HANDOFF.md`, the design system, and the code that matters (auth, rbac, every
API route, models, `lib/data.ts`, `lib/validation.ts`, the service worker, the main pages).

**Status: proposal. Nothing in this file has been built.** It follows the repo's rule: plan,
get approval, then build one phase at a time and stop after each for review
(`developer-guide.md` §0, §5). Each phase below gets its own short `PLAN/*.md` spec when it
starts. Commit to `main`, no branches, no pushing unless asked (§6).

This sits **above** `PLAN/DEKKA_PWA_APP.md`. That file's phase 4 (extras 4a/4b/4c) is still
the feature plan; this file decides *when* it gets built relative to fixes, and adds what
the audit found.

---

## 0. What was verified, and what was not

| Check | Result | How |
|---|---|---|
| `npm run typecheck`, `npm run lint` | clean | ran them |
| All 8 `npm run check:*` scripts | pass | ran them |
| `npm audit --omit=dev` | **6 vulnerabilities: 1 critical, 5 high** (§2, S1) | ran it |
| Frankfurt region move (`vercel.json`) | **live**: `x-vercel-id: fra1::fra1` | `curl -I` on production |
| Security headers on pages | only HSTS (added by Vercel). No CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. `X-Powered-By: Next.js` is exposed | `curl -I` |
| `/robots.txt`, `/sitemap.xml` | both **404** | `curl` |
| **Rate limiting in production** | **INACTIVE** right now. A fresh process logged `[ratelimit] … rate limiting is INACTIVE` (region fra1, `nodejs24.x`) | Vercel runtime logs after a `/api/health` request |
| React 19 and `javascript:` links | blocked by React itself | grep of `react-dom` |
| `web-push` and arbitrary endpoints | always `https.request`, so HTTPS-only | read the library |

**Not verified:** `npm run build` (not run), any end-to-end flow, a real phone (install or push),
which env vars exist on Vercel (the connector returns 403 on env listing), and whether Vercel's
own image optimizer is exposed to the Next.js image advisories. Findings marked *Read* come
from reading code, not from running an attack. S2 is *Documented*: Next's own docs describe
it, but I did not test exploitation.

---

## 1. Where the project stands

The product in `PLAN/idea.md` is fully built and live: auth, events hub, reservations,
Submit-a-Show, door table, admin dashboard, monthly report, PDF event report, legal pages,
cookie consent, password reset (dormant), Sentry, and three of four PWA phases (installable
app, cafe menu, event templates). The code is consistent, well commented and unusually well
documented. The patterns (`handle`/`guard`/`parseBody`, `stripDefaults`, DB-free check scripts)
are sound and are followed everywhere I looked.

What the audit found is not sloppiness. It is three kinds of gap:

1. **Things that were true when written and aged**: a Next.js version with advisories
   published since; a rate limiter that was built and verified but never connected.
2. **Places where the UI and API allow a sequence nobody intended**: re-publishing a past
   night, unpublishing a night that has revenue, deleting an event and its money record.
3. **Plans that were never finished** or are waiting on the owner (PWA phase 4, parts of
   `HOME_PAGE.md` and `design-ui-layouts-website.md`).

---

## 2. Findings, ranked

Severity is my judgement for *this* app (a cafe, real member phone numbers, cash at the door).
Effort: **S** under half a day, **M** about a day, **L** several days.
Confidence: **V** verified by running something, **R** read in code, **D** documented by
Next but not exploited.

### 2.1 Security

| ID | Sev | Conf | Finding | Fix | Effort |
|---|---|---|---|---|---|
| **S1** | Critical | V | `next` is pinned at exactly **16.3.1**. `npm audit` lists 9 advisories against it: unauthenticated RCE in the image optimizer (AVIF), RCE in `next/og`, SSRF in the image optimizer, cache poisoning, and more. The first release outside every advisory range is **16.3.8** (npm suggests 16.4.0). Also high: `sharp`, `undici`, `brace-expansion`, `fast-uri`, `source-map-js` (all fixed by `npm audit fix`). Vercel runs image optimization on its own infrastructure, so live exposure may be lower; not verified, and no reason to wait. | Read the upgrade notes in `node_modules/next/dist/docs/` first (`AGENTS.md`). Bump `next` and `eslint-config-next` together, run `npm audit fix`, then the full verification. **PWA 4a's `next/og` route must not be built before this lands.** | S |
| **S2** | High | D | Admin and staff pages are protected **only by their layout**. No `page.tsx` under `admin/` or `staff/` checks the role, and neither do the `lib/data.ts` readers (`getAllCheckIns`, `getSubmissions`, `getAllReservations`, `getMonthlyReport`, `getAdminOverview`). Next's docs say layout checks do not re-run on client navigation and that a layout "does not control whether the rest of the route renders" (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350`). `developer-guide.md` §2 currently says the layout is "the *only* gate". | Prove it first on the throwaway database (§11): an RSC request that claims the layout is already loaded. Then add a `requireRole()` helper called at the top of every admin/staff page, and keep the layout check too. Update §2. | M |
| **S3** | High (dormant) | R | **No email verification.** (a) Once Google is enabled, the `signIn` callback (`lib/auth.ts:115-141`) links a Google login to an existing account **by email alone**. Anyone who pre-registered a victim's address with a password keeps that password on the victim's merged account. (b) `ADMIN_EMAILS`/`STAFF_EMAILS` promote whoever registers a listed address first, with no proof they own it. | Add `emailVerified` to `User`. Send a verification mail (needs a domain and Resend, see P-ID in §5). Link OAuth only when the provider asserts a verified email **and** the existing account's email is verified. Apply role bootstrap only after verification. **Until then: do not set `AUTH_GOOGLE_*`**, and confirm every listed admin/staff address already has its account. | M |
| **S4** | Medium | V | **Rate limiting is off in production** (see §0). Every limited endpoint (sign-in, register, forgot-password, pitch submission, reserve, upload, health) accepts unlimited requests. The code and the `KV_REST_API_*` support are done; it needs the Upstash integration connected in Vercel. | Owner action: connect Upstash to the Vercel project, redeploy, then re-run the log check from §0 and expect no warning. Then observe one real 429. | S (ops) |
| **S5** | Medium | R | `POST /api/push/subscribe` accepts **any URL** as `endpoint`. On every publish the server POSTs to every stored endpoint (blind HTTPS-only SSRF, no response returned). The route has no rate limit and no per-user cap, and `PATCH /api/events/:id` **awaits the whole fan-out** (`PushSubscription.find()`, unbounded) before replying. A flood of junk subscriptions makes Publish slow or time out. | Allowlist push-service hosts (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`); cap subscriptions per user; add a rate bucket; run the fan-out in Next's `after()` in batches, with Sentry on partial failure. | M |
| **S6** | Medium | V | No security headers on pages (§0). | `headers()` in `next.config.ts`: nosniff, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`, `poweredByHeader: false`. Add a CSP as **Report-Only first** (the app has an inline early script, a Google Maps iframe, Sentry, Speed Insights, Blob images), then enforce. `check:config` must keep passing. | M |
| **S7** | Medium | R | `next.config.ts:69` still allows images from **any HTTPS host**, so `/_next/image` is an open proxy (known gap, and S1 includes an image SSRF). Only the event `coverImage` field needs it (admin-pasted URLs). | Make `coverImage` upload-only, like menu photos. Check production read-only first for events that use a pasted URL and re-upload those. Then delete the wildcard. | S–M |
| **S8** | Medium | R | JWT sessions cannot be revoked. Three gaps in §7 of the guide share one cause: a role change needs a re-login, a password reset does not evict a stolen session, and a deleted user keeps working until the token expires (up to 30 days). | One mechanism: store `sessionVersion` on `User`; the `jwt` callback (`lib/auth.ts:144`) re-reads role, existence and version every few minutes. Bump the version on password reset/change and role change. Costs one cheap read per session per interval. | M |
| **S9** | Low–Med | R | Uploads trust the client's MIME type and keep EXIF (GPS) in public avatars; orphaned blobs accumulate. | Sniff magic bytes, re-encode with `sharp` (move it to `dependencies`), strip metadata, cap dimensions; `del()` the old blob on replace/delete. | M |
| **S10** | Low | R | Door codes use `Math.random()` and the `code` index is not unique. Band-pitch `links` are not checked as http(s) (React blocks `javascript:`, so this is defense in depth only). No rate bucket on `PATCH /api/account/password` or `push/subscribe`. | `crypto.randomInt`; unique `{ event, code }`; http(s)-only link schema; two more buckets. | S |

### 2.2 Data integrity (the money and the history)

| ID | Sev | Conf | Finding | Fix | Effort |
|---|---|---|---|---|---|
| **I1** | High | R | **The event lifecycle has no rules.** `EventAdminActions` offers *Publish* from `happened` and `archived`, and the API accepts any status. A `happened → published` change takes the `before.status !== "published"` branch and **push-notifies every member about a past night**. *Unpublish* is offered from `happened`/`archived`; it sets `draft`, which `getMonthlyReport` excludes and the PDF route refuses, so **that night's revenue vanishes from the reports** (the check-ins are still stored). | One transition table in `lib/constants.ts`, enforced in `PATCH` (`409 INVALID_TRANSITION`) and used by the UI to offer only valid buttons. Decision needed: notify only on `draft → published` (recommended), not on re-opening a `closed` night. | S–M |
| **I2** | High | R | `DELETE /api/events/:id` cascades to **all reservations and check-ins**, the record of money taken, behind a generic `window.confirm`. | Refuse with `409 EVENT_HAS_RECORDS` when the night is `happened`/`archived` or has any check-in; point to *Archive*. The confirm names how many records go. | S |
| **I3** | Medium–High | R | **No audit trail on cash records.** Any staff account can edit a check-in's amount or hard-delete the row (`removeCheckIn` has no confirmation at all), and nothing records who did it. In a cash business that is a trust gap for the owner. | Void instead of delete (`voidedAt/By`), an edit log (who, when, old → new) visible to admin on the event page, a confirm on delete. All additive. Needs your OK (Q5). | M |
| **I4** | Medium | R | Cairo-time slips: `staff/page.tsx:14,36` decides "today" with the server's `toDateString()` (UTC), so nights after midnight Cairo are mislabelled; `DuplicateEventButton` adds 7 days in the browser's local time. The guide's own rule is "go through `dayKey` / `startsAtFor`". | Use those helpers in both places. | S |
| **I5** | Medium | R | Nothing moves a night to `happened`. The PDF report and revenue attribution depend on an admin remembering to click it for every event. | Dashboard prompt: "2 nights need closing out" (recommended; no cron). A daily Vercel Cron is the alternative (Q6). | S |
| **I6** | Low | R | Capacity check race (accepted in §4.4); `PATCH` publish can double-notify if two admins click at once. | Leave. Revisit only if scale changes. | — |

### 2.3 Reliability and process

| ID | Sev | Conf | Finding | Fix | Effort |
|---|---|---|---|---|---|
| **R1** | Medium | R | **No CI** (no `.github/`). Every push to `main` deploys. `next build` typechecks, but lint and the 8 check scripts run only if someone remembers. | GitHub Actions: `npm ci`, typecheck, lint, all `check:*`, build with dummy env. A `check:all` script chains them. Weekly `npm audit --omit=dev --audit-level=high`. | S |
| **R2** | Medium | R | `lib/db.ts` uses Mongoose's default pool (100 per instance). Serverless instances multiply that against the Atlas connection cap (500 on the free M0). | `maxPoolSize` about 10 and a sensible `serverSelectionTimeoutMS`. Needs the Atlas tier (Q3). | S |
| **R3** | Medium | R | **The door tool has no offline path.** The cafe's Wi-Fi on a packed night is exactly when a `fetch` fails, and a failed add just shows an error. | Local pending queue (IndexedDB) with retry and a "pending sync" row. Each check-in carries a client-generated `clientId` (unique sparse index) so a retried POST cannot record someone twice. Needs no change to the service worker's "never cache `/staff`" rule. | L |
| **R4** | Low | V | Production runs `nodejs24.x`; `@types/node` is `^20`; no `engines`. Several minor updates are pending (`zod` 4.6, `mongoose` 9.11, `@sentry/nextjs` 10.76, `@upstash/*`). `stripDefaults()` touches Zod internals, so a Zod bump needs all `check:*` re-run. | Add `engines`, align `@types/node`, bump minors in a separate commit after P0. | S |
| **R5** | Low | R | `lib/data.ts` is 1,044 lines covering five domains. Not a bug; the guide's own "one job per file" rule says split when next touched. | Split into `lib/data/{events,reservations,reports,menu,templates}.ts` the next time one of them changes. No standalone refactor. | — |
| **R6** | Low | R | Every phase repeats the §11 verification ritual by hand (Docker, throwaway DB, marker proof, puppeteer). | Optional: a `verify:local` script that does the marker proof and refuses to run against a non-`dekka_verify` database. Worth it only if more than two more phases follow. | M |

### 2.4 Findability and sharing

| ID | Sev | Conf | Finding | Fix | Effort |
|---|---|---|---|---|---|
| **D1** | Medium | V | Every page has the **same title** (`app/layout.tsx` is the only `metadata`); no `metadataBase`, Open Graph, `robots.txt`, `sitemap.xml` or structured data. A shared event link is a bare URL, and search engines are free to index `/account`. | `metadataBase` + title template; `robots.ts` (disallow `/admin`, `/staff`, `/account`, `/my-events`, `/api`); `sitemap.ts` (public routes + published events); JSON-LD `CafeOrCoffeeShop` and `Event`. Event-page `generateMetadata` and the OG image are already specified in PWA 4a.3; build them there. | M |

### 2.5 Plans that were started and not finished

Verified by grep: none of these exist in the code.

| Source | Item | Recommendation |
|---|---|---|
| `HOME_PAGE.md` §5 | About/location teaser, photo gallery shell, Instagram "Follow" card on the homepage | Build the Instagram card and the About teaser (small, no content dependency). Drop the gallery until real photos exist. |
| `design-ui-layouts-website.md` §3-4 | Reserve-button → confirmation morph, route transitions, `PatternAccent` draw-on, `.dk-staff` density layer | Polish, not need. Park explicitly so they stop reading as debt; revisit after P5. |
| `HOME_PAGE.md` §2 | Hero entrance motion | Same: park. |
| `DEKKA_MOBILE_APP.MD` | Native Kotlin app | Stays parked (PWA supersedes). `mobile-login` and `lib/mobile-token.ts` remain as unused surface; S8 should cover them, or remove them. |
| `PLAN/idea.md` §8 | Reminders before a reserved event | Now cheap because push exists. See F1. |

### 2.6 Documentation drift

- `README.md`: route and API tables omit `/menu`, `/get-app`, `/account`, `/admin/menu`, `/admin/templates`, `/admin/customers` and about a dozen API routes; one path (`app/staff/layout.tsx`) is outdated.
- `developer-guide.md` §0: the Frankfurt move is now **confirmed live**; "rerun the phone timings" remains open. §2 must change with S2.
- `HANDOFF.md` is a labelled 2026-08-26 snapshot. Fine; leave.
- `graphify-out/` (about 35 tracked files) is a snapshot from 2026-08-21, 92 commits ago. Regenerate it or stop tracking it.

---

## 3. Feature and UX ideas

**Already planned and approved in principle:** PWA phase 4a (event night), 4b (cafe life), 4c
(owner tools). Their detail, copy and the owner's Q1–Q5 live in `DEKKA_PWA_APP.md` §5. I
have nothing to add except sequencing (§5) and the dependency on S1.

**New, from this audit.** Each is a *suggestion*, not something you asked for:

| ID | Idea | Why | Depends on |
|---|---|---|---|
| **F1** | **Reminders**: push to members with a reservation, the day before and two hours before | The strongest use of the push system already built; cuts no-shows (the PDF report already measures them). Reverses `idea.md` §8's "out of scope". | Real-device push verified (Gate G1); Vercel Cron |
| **F2** | **Admin alerts**: push or email the admin on a new band pitch and when a night fills | The admin currently has to open the dashboard to learn a pitch exists. | Push to admin role (no domain needed) |
| **F3** | **Acknowledge and answer pitches by email** | `idea.md` §4 asks for it ("some kind of acknowledgment"). | Domain + Resend |
| **F4** | **Cancel from My Events**, and a real "Show at the door" screen | Cancelling is only possible from the event page today. The door-code screen is 4a.4. | — |
| **F5** | **CSV export** of the monthly report and the customers grid | Bookkeeping; trivial once the data is shaped. | — |
| **F6** | **A real category on events** (`tags`, set in the form and in templates) | The homepage filters "live / karaoke / open mic" by **matching words in the title and description** (`FILTER_KEYWORDS`). Rename a night and it vanishes from its filter. | Additive field |
| **F7** | **Self-service account deletion and data export** | The privacy policy promises deletion "by hand, by email". Fine for now; self-service is the cleaner answer to the Egyptian PDPL rights it cites. | S8 (revocation) first |
| **F8** | **Waitlist when a night is full** | Out of scope for v1; revisit after F1. | F1 |
| **X1** | **"Next night" card under the hero** on the homepage | On a phone the first screen is logo, tagline and search; the thing a visitor came for is below the fold. 4a's Tonight banner covers the same-day case only. | — |
| **X2** | **Pin "Tonight" at the top of the staff picker**; today it lists every upcoming and past night newest first | One tap faster on the busiest evening. | I4 |
| **X3** | **Re-run the accessibility audit** (the `accesslint` tooling is available) at the end of each phase | The last pass shipped with the legal-pages commit (`dd39554`). | — |
| **X4** | **Check Speed Insights after a week of data** before deciding more performance work | Insights was added in `65fbff2` and has no data yet; the speed pass was measured only in lab emulation. | — |

---

## 4. Sequencing options

- **A. Safety first, then features (recommended).** Patch and wire up what is already built
  (P0–P2), protect the money (P1), make the door resilient (P3), then ship the owner-visible
  phase 4 work on a safe base. Phases P0–P2 are small, so the owner waits only a few sessions
  for new features.
- **B. Finish PWA phase 4 first**, interleaving fixes. Faster owner-visible wins, but it
  builds a `next/og` image route on a version with a published RCE advisory, and keeps
  production unthrottled while adding more public routes (phase 4 adds three: the
  calendar file, the OG image and the stats beacon).
- **C. One long hardening sprint.** Same content as A, but it breaks the repo's
  "stop after each phase" rhythm for no gain.

Recommendation: **A**.

---

## 5. Phased roadmap

Every phase ends the same way (`developer-guide.md` §10): typecheck, lint, build, all
`check:*` plus a new mutation-tested check where there is logic, a local-throwaway-DB end-to-end
run (§11), a Feature Log entry with a plain Verification / Not-verified paragraph, updates to
§0 and §7, a commit to `main`, **then stop for review**. Schema changes stay additive and
optional so a rollback is data-safe (§9).

### P0 — Safe base · about 1 session
S1 (Next + `npm audit fix`), R4 (`engines`, `@types/node`), R1 (CI + `check:all`), the
`developer-guide.md` §0 refresh, and **S4 as an owner action** (connect Upstash).
**Done when:** `npm audit --omit=dev` shows no high or critical (or a written exception);
CI is green on `main`; the §0 log check shows rate limiting active in production; one real 429
observed.

### P1 — Integrity · 1–2 sessions
I1 (lifecycle table), I2 (delete protection), I3 (void + audit trail, once approved), I4
(Cairo time), I5 (close-out prompt), **S2** (`requireRole` in every admin/staff page, proven
first).
**Done when:** a `check:lifecycle` script fails if any invalid transition is accepted
(mutation-tested); an end-to-end run shows `happened → published` refused, an event with
check-ins undeletable, a voided row excluded from totals but visible in the log, and a
signed-out RSC request to an admin page returning nothing.

### P2 — Hardening · 2 sessions
S5 (push route + `after()`), S6 (headers; CSP report-only), S7 (`coverImage` upload-only, then
delete the `**` pattern), S8 (`sessionVersion`), S9 (uploads), S10, R2.
**Done when:** `check:config` and the other checks pass; a junk push subscription is rejected;
a reset password evicts an existing session in an end-to-end run; CSP reports are quiet for a
week, then enforced.

### Gate G1 — Real phones (owner + dev, any time before P5's reminders)
Install on a real iPhone (Safari, iOS 16.4+) and a real Android (Chrome); launch, switch tabs,
airplane mode lands on `/offline`; **subscribe to push and receive one**. The checklist in
`developer-guide.md` §9 already lists the steps. Nothing that promises push (F1, F2) ships
before this passes.

### P3 — Door night · 1–2 sessions
R3 (offline queue with idempotent `clientId`), X2 (pin Tonight). The `DataGrid`-backed door
table keeps its quick-entry form (muscle memory, per `FIX_ADMIN_DASH.md` §2b).
**Done when:** with the network switched off, three check-ins queue, show "pending sync", and
sync exactly once on reconnect, including a deliberate double-send.

### P4 — Found and shared · 1 session
D1 (site-wide metadata, `robots`, `sitemap`, JSON-LD), the homepage Instagram card and About
teaser (§2.5), X1 (next-night card).
**Done when:** `/robots.txt` and `/sitemap.xml` return 200, private paths are `noindex`, every
public page has its own title, and the structured data validates.

### P5 — Event night · PWA 4a as specified
Add-to-calendar, Tonight banner, WhatsApp share and the OG image (**after P0**), big door
code, plus F4 (cancel from My Events). **F1 reminders** join here once G1 has passed.

### P6 — Cafe life · PWA 4b as specified
Open now / closes at, one-tap directions, scheduled seasonal sections. Bumps `sw.js` to `v3`.

### P7 — Owner tools · PWA 4c as specified, plus F2 and F5
Privacy-safe counters, QR poster, demo mode (the legal wording needs the owner's sign-off),
admin alerts, CSV export. 4c adds a public stats route (4a adds two more), so P0's rate
limiting must be live before any of phase 4 ships.

### P-ID — Identity · starts the day a domain and Resend exist; slot after P2
S3 (email verification, safe OAuth linking, role bootstrap after verification), then enable
Google, then F3 (pitch emails) and F7 (self-service deletion).
**Done when:** a pre-registered unverified account can no longer be taken over by a Google
login (shown end to end), and a real reset and verification email arrive at a real inbox.

---

## 6. Things only the owner can do

These are not code, and several unblock code.

1. **Connect Upstash** in Vercel (Storage → Marketplace). Blocks S4. Costs nothing at this scale.
2. **Buy a domain** (for example a `.cafe` or `.com` for Dekka). Unblocks email, verification,
   Google sign-in under the cafe's name, a canonical URL for SEO, and a sender address that
   is not a personal Gmail. `site.email` currently shows a personal address on the public
   legal pages.
3. **Verify the domain in Resend**, set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **Sentry:** confirm the "new issue" alert and the Vercel deploy-failure notification
   (`Before_Deployment.md` §9), and add an uptime monitor on `/api/health`.
5. **Google Cloud OAuth** (only after S3 is done).
6. **A real iPhone and a real Android** for Gate G1.
7. **Real content:** dish and room photography, the menu (items and prices), and sign-off on
   the privacy wording that 4c changes.
8. **One practice rollback** (`developer-guide.md` §9 notes it was never drilled).

---

## 7. Decisions I need from you

Defaults are my recommendation; say "defaults" to accept them all.

| # | Question | Default |
|---|---|---|
| Q1 | Approve sequencing **A** (§4)? | Yes |
| Q2 | Will you buy a domain? Roughly when? It decides when P-ID can start. | Yes, soon |
| Q3 | Which Atlas tier is the production cluster (M0 free or paid)? Sets the pool size in R2. | Assume M0 |
| Q4 | PWA phase 4 questions Q1–Q5 from `DEKKA_PWA_APP.md` §5.5 (QR encoder, demo mode, calendar length, extra counters, opening hours). | The plan's own recommendations |
| Q5 | Cash records: OK to **void instead of delete**, with a visible edit log (I3)? Staff will see their edits are recorded. | Yes |
| Q6 | A night never closes itself. Dashboard prompt (default) or a daily cron that marks it `happened`? | Prompt |
| Q7 | Re-publishing a closed night: notify again, or only notify on the first publish (I1)? | First publish only |
| Q8 | Reverse "reminders are out of scope" (F1) once phones pass Gate G1? | Yes |
| Q9 | Does any live event use a pasted cover-image URL? I can check read-only at the start of P2 (S7). | I'll check |
| Q10 | Park the unfinished polish in §2.5 (gallery, morph, route transitions, `.dk-staff`)? | Park |

---

## 8. Rules for every phase (restated)

- Plan before code; one phase at a time; stop after each for review.
- Commit straight to `main`; never branch or use a worktree; **do not push**, the owner pushes
  and a push deploys to production.
- Every API route guarded; every write through `parseBody` + a Zod schema; update schemas via
  `stripDefaults().partial().strict()`.
- Arabic first, both languages for every string; logical Tailwind properties only.
- The dev server talks to the live database. **Anything that writes is verified on the local
  throwaway `dekka_verify` database** (§11), with the marker proof first.
- Before touching Next.js APIs, read the matching guide in `node_modules/next/dist/docs/`.
- Say plainly what was and was not verified.
