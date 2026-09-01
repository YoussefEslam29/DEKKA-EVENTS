# Dekka — Coffee Loader (coffee-loader.md)

Plan for **Phase 1** of `PLAN/HOME_PAGE.md` §1 — the loading screen.

Today there is a single `app/loading.tsx` holding a grey pulse skeleton (a title bar plus
four card blocks). It is honest and it works, but it is generic: nothing about it is
Dekka. §1 asks for a coffee cup filling instead — a loading indicator that *is* the
product rather than a spinner borrowed from a component library.

The interesting decisions here are not the animation. They are **when it appears**,
**which variant appears**, and **what happens before React has hydrated**.

---

## 1. Where the file goes, and what it displaces

`app/(site)/loading.tsx` — new, and it takes over from `app/loading.tsx` for every route
under the `(site)` group, which is the whole public app plus the back-office. Next nests
`loading.tsx` inside the layout of its own segment and wraps `page.tsx` in a Suspense
boundary; the deeper boundary is the one that renders, so the existing root skeleton
stops being reachable from `/`, `/events/*`, `/admin/*` and friends.

`app/loading.tsx` **stays**, unchanged. It is still the fallback for the `(auth)` group
(`/login`, `/signup`) and for the case where the `(site)` layout itself suspends. Deleting
it would leave those with nothing. Two files, two jobs — not a leftover.

The homepage is already `force-dynamic` and does real async work (`getPublicEvents` twice,
then `countReservationsForEvents`), so this is a real Suspense boundary with a real wait
behind it, not a decorative one.

---

## 2. The two tiers, and why the *server* renders the full one

§1 wants the elaborate splash once per browser session and something small every other
time. `sessionStorage` is the gate. The non-obvious part is which variant the server
should render, because the server cannot read `sessionStorage` and guessing wrong means a
visible flash of the wrong variant.

The traffic shape settles it:

| How the loader is reached | Almost always | So the right variant is |
|---|---|---|
| Hard load (typed URL, link from Instagram, refresh) | the first view of the session | **full** |
| Client-side navigation (clicking the logo, back to `/`) | the flag is already set | **compact** |

A hard load is the one case where server-rendered HTML is what the visitor actually sees
before hydration — and a hard load is overwhelmingly a first visit. So **the server
renders the full variant**, and the client downgrades to compact when it finds the flag.
The downgrade lands inside the appearance delay (§3), so it is never seen.

The reverse default (server renders compact, client upgrades) was rejected: it gets the
common case backwards, and the upgrade would be the visible one.

Flag: `dekka_splash_seen` in `sessionStorage`, written the first time the loader mounts.
Reading and writing are both wrapped in `try/catch` — private mode and blocked storage
throw on access, and the failure mode there is "always show the full splash", which is
merely repetitive rather than broken. Same defensive shape `PushOptIn.tsx` already uses
for its one-shot toast flag.

---

## 3. The appearance delay is CSS, not a `setTimeout`

§1 asks for ~150–200ms before the splash is allowed to appear, so an instant fetch does
not flash a cup for one frame. The obvious implementation is a timer in an effect. That
is wrong here, for a reason specific to a Suspense fallback:

**On a hard load the fallback is streamed as HTML and painted long before React
hydrates.** A JS-driven delay cannot start until hydration, so on the exact path the
splash exists for — a cold first visit, which is also the slowest path — the timer would
still be waiting when the real page arrives, and the splash would never appear at all.

So the delay is a CSS animation on the outer container: `opacity 0` held through a 180ms
`animation-delay`, then a 200ms fade in, `animation-fill-mode: both`. It runs from the
first paint, with or without JS, and it doubles as the cover for §2's variant swap.

Under `prefers-reduced-motion` the *delay* is kept and the *fade* is dropped
(`animation-duration: 0ms`) — the delay is a debounce, not decoration, and dropping it
would reintroduce the flash for exactly the people least likely to want one.

New class `.dk-loader-appear` in `app/globals.css`, next to the other `.dk-*` component
classes.

---

## 4. No minimum duration, anywhere

There is no `await sleep()`, no "let the animation finish" hold, and no state machine
keeping the loader alive after the data lands. The component is a Suspense fallback:
React unmounts it the moment the page resolves, mid-fill or not. That is the whole point
of §1 and the one thing in this phase that would be easy to quietly betray.

What §1 does ask for is that a *long* wait not freeze on a full cup. So the fill loops:
it rises over ~1.2s, holds full for ~0.3s, fades out, and starts again. A fetch that
finishes early cuts it off wherever it is; a fetch that runs long gets a second pour.

---

## 5. The mark

Original, not a trace of either reference image. In Dekka's own language: single-stroke
line art (`design-system/04-components.md`'s "SVG icons, one consistent stroke style,
never emoji"), `gold-accent` on `ink-black`, 64×64 viewBox.

- **Cup** — gently tapered body, rounded bottom corners, a semicircular side handle, and
  a saucer hairline beneath it broken by a short gap on the trailing side.
- **Liquid** — two wave layers inside an SVG `clipPath` of the cup's interior. The back
  layer is fainter, phase-offset, and drifts at a different speed than the front one, so
  the surface reads as liquid rather than as a rising rectangle. Both ride one group that
  translates upward: **the fill is a `transform`, never a `height`.**
- **Steam** — three wisps above the rim, opacity + `translateY`, staggered.

Every animated property is `transform` or `opacity`, per `lib/motion.ts`'s own rule.

**Reduced motion:** the static final frame — cup full, waves still, steam at a fixed low
opacity. Nothing moves. This matches how every preset in `lib/motion.ts` degrades, and the
`reduced` argument is required rather than optional here too, so a call site cannot skip
the branch.

---

## 6. Copy

New `t.loader.brewing` in both dictionaries — `"جاري التحضير…"` / `"Brewing…"`, the exact
pair §1 names. Its own namespace rather than a key in `common`, so the loading-screen copy
stays discoverable in one place.

Deliberately **not** a new key: the accessible label. `t.common.loading` already exists
("جارٍ التحميل…" / "Loading…") and is the right string for `role="status"`.

- **Full variant** cross-fades the two languages, ~4s cycle, opposite phase. Under reduced
  motion it falls back to `BilingualLabel` — the standard `English / العربية` one-liner —
  which is a better static answer than freezing on one language.
- **Compact variant** shows the active locale's line only, small and muted. It is the
  quick tier; a cross-fade there would be the repetition §1 is trying to avoid.

The visible text is `aria-hidden`; the container carries one `role="status"` +
`aria-label`, so a screen reader hears "Loading" once instead of a cross-fade narrating
itself twice a cycle.

---

## 7. Files

| File | Change |
|---|---|
| `components/CoffeeLoader.tsx` | **new** — `CoffeeLoader({ variant })` plus `SessionGatedCoffeeLoader`, the §2 wrapper |
| `app/(site)/loading.tsx` | **new** — server component, renders the gate, nothing else |
| `app/globals.css` | `.dk-loader-appear` + its keyframes (§3) |
| `lib/i18n/dictionaries.ts` | `loader: { brewing }`, `ar` + `en` |

No new dependencies. `framer-motion` is already here.

---

## 8. Known trade-offs, recorded

- **The full overlay covers the navbar.** Next keeps shared layouts interactive during a
  segment load; a `fixed inset-0` overlay takes that away for the duration. Accepted —
  §1 asks for a full-screen takeover, it is gated to once per session, and that session's
  one occurrence is nearly always a hard load where nothing was interactive yet anyway.
- **`z-50` ties with `PushOptIn`'s toast.** The loader renders inside `<main>` and the
  toast after it, so the toast wins the tie. That is the right priority — the loader is
  transient.
- **Slow hydration on a hard load degrades to compact-after-the-fact, not to nothing.**
  If the page resolves before hydration, the server's full variant is what was on screen
  the whole time, which is correct. The only lost case is a repeat *hard* refresh in the
  same session, where the full splash paints before JS can downgrade it. Rare, and one
  extra splash is a smaller cost than getting the first visit wrong.

---

## 9. Verification plan

No test suite (`developer-guide.md` §9), so: `npm run typecheck`, `npm run lint`,
`npm run build` clean, plus by hand against the real dev server —

- hard refresh of `/` → full splash, once
- navigate away and back to `/` → compact, not the splash
- new tab / new session → full splash again
- DevTools network throttling to force a long fetch → the fill loops, does not freeze
- `prefers-reduced-motion: reduce` forced in DevTools → static full cup, bilingual line,
  and the 180ms delay still applied
- both locales, RTL and LTR
- 375px width

No database writes of any kind in this phase — `MONGODB_URI` is the live cluster and this
touches nothing that reads or writes it.
