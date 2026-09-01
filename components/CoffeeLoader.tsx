"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/components/I18nProvider";
import { BilingualLabel } from "@/components/ui/BilingualLabel";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { cn } from "@/lib/utils";

/**
 * The coffee-cup loading screen (`PLAN/HOME_PAGE.md` §1, planned in
 * `PLAN/coffee-loader.md`).
 *
 * Two tiers off one implementation: a full-screen splash once per browser
 * session, and a small centred mark every other time `loading.tsx` fires.
 * `SessionGatedCoffeeLoader` at the bottom of this file is what decides which;
 * `CoffeeLoader` itself is pure presentation and takes the variant as a prop.
 *
 * There is **no artificial minimum duration** anywhere in here. This renders as
 * a Suspense fallback, so React unmounts it the instant the real page resolves,
 * mid-fill or not — that is the whole premise of §1. What the fill does instead
 * is loop, so a slow fetch gets a second pour rather than a frozen full cup.
 *
 * Transform/opacity only, matching `lib/motion.ts`'s rule — the liquid rises by
 * translating a clipped group, never by animating a height.
 */

export type CoffeeLoaderVariant = "full" | "compact";

/**
 * Set the first time the loader mounts in a browser session; its presence is
 * what downgrades every later trigger to the compact variant. Exported so the
 * flag exists as one literal rather than two copies that could drift.
 */
export const SPLASH_SEEN_KEY = "dekka_splash_seen";

// --- Geometry -------------------------------------------------------------
// One 64×64 viewBox, single stroke weight, drawn in Dekka's own line-art
// language rather than traced from either reference image.

/** Tapered body, rounded bottom corners. */
const CUP_BODY = "M18 24 H44 L42 41 A7 7 0 0 1 35 48 H27 A7 7 0 0 1 20 41 Z";
/** Semicircular side handle, meeting the body just inside its right edge. */
const CUP_HANDLE = "M44 29 H48 a6 6 0 0 1 0 12 H42.6";
/** The interior, inset inside the stroke — the liquid is clipped to this. */
const CUP_INTERIOR =
  "M19.3 25.3 H42.7 L40.8 40.8 A5.8 5.8 0 0 1 35 46.6 H27 A5.8 5.8 0 0 1 21.2 40.8 Z";

/**
 * One liquid surface: a 26-wide sine run repeated eight times, wide enough that
 * drifting it a full period sideways never uncovers either edge of the cup.
 * Its own top edge sits at local y=0, so the group transform below is the fill
 * level in cup coordinates.
 */
const WAVE =
  "M-26 0 q6.5 -2.2 13 0 t13 0 t13 0 t13 0 t13 0 t13 0 t13 0 t13 0 V26 H-26 Z";
/** One full period — the drift distance that loops seamlessly. */
const WAVE_PERIOD = 26;

/** Fill level, in viewBox units, measured from the surface's full position. */
const EMPTY = 20;
const FULL = 0;
/** Rise, hold, fade, repeat. §4 of the plan — a long fetch pours again. */
const POUR_DURATION = 1.7;

const STEAM = [
  "M25 18 c-2.5 -3 2.5 -5 0 -8",
  "M32 16 c-2.5 -3 2.5 -5 0 -8",
  "M39 18 c-2.5 -3 2.5 -5 0 -8",
];

/**
 * The mark itself. `reduced` is a required argument for the same reason every
 * preset in `lib/motion.ts` takes one: a call site must not be able to skip the
 * accessibility branch by forgetting an optional prop. When it is true this
 * renders the static final frame — a full cup, nothing moving.
 */
function CoffeeCup({ reduced, className }: { reduced: boolean; className?: string }) {
  // Unique per instance is unnecessary — the full and compact variants never
  // render at the same time, and a duplicate id would still resolve correctly.
  const clipId = "dk-cup-interior";

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("text-gold-accent", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={CUP_INTERIOR} />
        </clipPath>
      </defs>

      {/* Liquid, behind the outline so the stroke reads as the cup's edge. */}
      <g clipPath={`url(#${clipId})`}>
        <motion.g
          // `initial` is the same empty cup either way, for the reason
          // `lib/motion.ts` spells out on `fadeUp`: the server cannot read the
          // media query, so branching the *keyframe* on `reduced` would make
          // the first client render disagree with the streamed HTML. Reduced
          // motion changes the transition instead — the cup simply is full.
          initial={{ y: EMPTY, opacity: 1 }}
          animate={
            reduced ? { y: FULL, opacity: 1 } : { y: [EMPTY, FULL, FULL], opacity: [1, 1, 1, 0] }
          }
          transition={
            reduced
              ? { duration: 0 }
              : {
                  y: {
                    duration: POUR_DURATION,
                    times: [0, 0.72, 1],
                    ease: "easeOut",
                    repeat: Infinity,
                  },
                  opacity: {
                    duration: POUR_DURATION,
                    times: [0, 0.72, 0.9, 1],
                    ease: "linear",
                    repeat: Infinity,
                  },
                }
          }
        >
          {/* Two surfaces at different phases and speeds, so it reads as
              liquid rather than as a rectangle sliding up.

              The phase offset is an SVG `transform` attribute on a wrapping
              `<g>`, never on the animated node itself: framer-motion writes a
              CSS `transform`, and a CSS transform *replaces* the presentation
              attribute rather than composing with it, so the offset would be
              silently dropped the moment the drift started. */}
          <g transform="translate(0 27)">
            <g transform="translate(13 1.5)">
              <motion.path
                d={WAVE}
                fill="currentColor"
                opacity={0.28}
                animate={reduced ? undefined : { x: [0, -WAVE_PERIOD] }}
                transition={
                  reduced ? undefined : { duration: 3.6, ease: "linear", repeat: Infinity }
                }
              />
            </g>
            <motion.path
              d={WAVE}
              fill="currentColor"
              opacity={0.6}
              animate={reduced ? undefined : { x: [0, -WAVE_PERIOD] }}
              transition={
                reduced ? undefined : { duration: 2.4, ease: "linear", repeat: Infinity }
              }
            />
          </g>
        </motion.g>
      </g>

      {/* Outline: cup, handle, and a saucer hairline broken by a short gap. */}
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={CUP_BODY} />
        <path d={CUP_HANDLE} />
        <path d="M14 53 H38" />
        <path d="M43 53 H50" />
      </g>

      {/* Steam — the motif §1 asks to reuse in the hero for brand continuity. */}
      <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        {STEAM.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            initial={{ opacity: 0, y: 2 }}
            animate={reduced ? { opacity: 0.35, y: 0 } : { opacity: [0, 0.75, 0], y: [2, -6] }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 2.2,
                    ease: "easeOut",
                    repeat: Infinity,
                    delay: i * 0.5,
                  }
            }
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * The bilingual line under the cup, cross-fading between the two languages.
 *
 * Under reduced motion it collapses to the app-wide `English / العربية`
 * one-liner instead of freezing on whichever half the cycle stopped on — a
 * better static answer, and the pattern every other shared label already uses.
 */
function BrewingLine({ reduced }: { reduced: boolean }) {
  const { bi } = useI18n();
  const brewing = bi((d) => d.loader.brewing);

  if (reduced) {
    return (
      <BilingualLabel
        en={brewing.en}
        ar={brewing.ar}
        aria-hidden
        className="text-sm font-semibold text-tan-muted"
      />
    );
  }

  // One fades fully out before the other starts in. A true overlapping
  // cross-fade was tried first and, with two scripts stacked in the same box,
  // the halfway frame reads as a rendering fault rather than as a transition.
  const cycle = {
    duration: 4,
    times: [0, 0.4, 0.46, 0.5, 0.9, 0.96, 1],
    repeat: Infinity,
    ease: "linear" as const,
  };

  return (
    // Fixed height + absolutely positioned halves: the two languages share one
    // slot rather than pushing each other around as they fade.
    <div aria-hidden className="relative h-6 w-full text-sm font-semibold text-tan-muted">
      <motion.span
        lang="ar"
        dir="rtl"
        className="font-arabic absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0, 0, 0, 0, 1] }}
        transition={cycle}
      >
        {brewing.ar}
      </motion.span>
      <motion.span
        lang="en"
        dir="ltr"
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0, 1, 1, 0, 0] }}
        transition={cycle}
      >
        {brewing.en}
      </motion.span>
    </div>
  );
}

/**
 * `full` — the once-per-session welcome: an ink-black takeover carrying the
 * same tatreez texture the homepage header already opens with, so two seconds
 * of loading don't look like a different app.
 *
 * `compact` — every other trigger: the same cup and the same gold liquid at a
 * fraction of the footprint, so a repeat navigation reads as quick rather than
 * as the splash again.
 */
export function CoffeeLoader({ variant }: { variant: CoffeeLoaderVariant }) {
  const { t, locale } = useI18n();
  const reduced = useReducedMotion() ?? false;

  if (variant === "compact") {
    return (
      <div
        role="status"
        aria-label={t.common.loading}
        className="dk-loader-appear flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24"
      >
        <CoffeeCup reduced={reduced} className="h-14 w-14" />
        <span aria-hidden lang={locale} className="text-xs font-semibold text-text-muted">
          {t.loader.brewing}
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={t.common.loading}
      className="dk-loader-appear fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink-black px-6"
    >
      {/* The same top-and-bottom tatreez banding the homepage header opens
          with, so the splash and the page it hands over to read as one piece.
          The full-bleed `field` variant was tried first and, tiled across a
          whole viewport, reads as dither rather than as a woven edge. */}
      <PatternAccent className="absolute inset-x-0 top-0" />
      <CoffeeCup reduced={reduced} className="h-40 w-40" />
      <div className="w-full max-w-xs">
        <BrewingLine reduced={reduced} />
      </div>
      <PatternAccent className="absolute inset-x-0 bottom-0" />
    </div>
  );
}

/**
 * Picks the variant (`PLAN/coffee-loader.md` §2).
 *
 * The server cannot read `sessionStorage`, so it has to guess — and it guesses
 * **full**, because the only time server-rendered fallback HTML is what a
 * visitor actually looks at is a hard load, and a hard load is overwhelmingly
 * the first view of a session. Client-side navigations, where the flag is
 * already set, are downgraded here on mount; that swap lands inside
 * `.dk-loader-appear`'s 180ms delay, so it is never on screen.
 *
 * Guessing the other way round would get the common case backwards *and* make
 * the correction the visible one.
 */
export function SessionGatedCoffeeLoader() {
  const [variant, setVariant] = useState<CoffeeLoaderVariant>("full");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_SEEN_KEY)) {
        // Client-only value with no render-time equivalent: `sessionStorage`
        // does not exist on the server, and reading it during render would
        // disagree with the HTML React is hydrating.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVariant("compact");
      } else {
        sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
      }
    } catch {
      // Private mode or blocked storage. Failing here means every load gets
      // the full splash — repetitive, but never broken.
    }
  }, []);

  return <CoffeeLoader variant={variant} />;
}
