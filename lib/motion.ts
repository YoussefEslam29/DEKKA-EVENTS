"use client";

import { useMemo } from "react";
import {
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
  type Variants,
} from "framer-motion";

/**
 * The shared motion vocabulary (`PLAN/FIX_ADMIN_DASH.md` §1).
 *
 * One rhythm for the whole app instead of every screen inventing its own
 * timings. Every preset here is a *function of* `reduced` — the value of
 * framer-motion's `useReducedMotion()` — and that argument is deliberately
 * required, so a call site cannot silently skip the accessibility branch. When
 * `reduced` is true every preset collapses to a no-op: the element renders in
 * its final state and nothing moves.
 *
 * Usual way to consume these is `useMotionPresets()`, which binds all of them
 * to the current preference in one go. Call a preset directly only when you
 * already have a `useReducedMotion()` result in hand.
 *
 * Transform/opacity only — never width/height — so everything stays on the
 * compositor.
 */

/** Micro-interaction timings, in seconds. Nothing here leaves the 150–300ms band. */
export const DURATION = {
  /** Press/hover feedback — the fastest thing on screen. */
  press: 0.15,
  /** Entrances and the sliding tab indicator. */
  entrance: 0.22,
} as const;

const EASE_OUT = "easeOut" as const;

/** Gap between staggered siblings — the 30–50ms band the plan asks for. */
const STAGGER_STEP = 0.04;
/**
 * Cap on the accumulated stagger delay. Without it a 200-row table would take
 * eight seconds to finish revealing; with it the last row starts at 240ms and
 * the whole cascade lands inside ~460ms.
 */
const STAGGER_MAX = 0.24;

const INSTANT: Transition = { duration: 0 };

/**
 * Page/section entrance: fade in while rising 10px.
 * Pair with `initial="hidden" animate="show"`.
 *
 * Note that `reduced` changes the *transition*, not the `hidden` keyframe. The
 * server can't read a media query, so it always renders the `hidden` state;
 * flipping that keyframe on the client instead would make the first client
 * render disagree with the server's HTML and trip a hydration mismatch. Keeping
 * the keyframe fixed and zeroing the duration gets the same result — the
 * element is simply on screen, nothing moves — without the mismatch.
 */
export function fadeUp(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduced ? INSTANT : { duration: DURATION.entrance, ease: EASE_OUT },
    },
  };
}

/**
 * List container: reveals its `staggerItem` children a beat apart rather than
 * all at once. Put this on the wrapper (`<div>`, `<tbody>`, …) with
 * `initial="hidden" animate="show"`; children only need `variants`.
 */
export function staggerContainer(reduced: boolean): Variants {
  return {
    hidden: {},
    show: {
      transition: reduced
        ? { delayChildren: 0 }
        : { delayChildren: (i: number) => Math.min(i * STAGGER_STEP, STAGGER_MAX) },
    },
  };
}

/** One row/tile inside a `staggerContainer`. Same hydration note as `fadeUp`. */
export function staggerItem(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduced ? INSTANT : { duration: DURATION.entrance, ease: EASE_OUT },
    },
  };
}

export type PressableProps = {
  whileHover?: TargetAndTransition;
  whileTap?: TargetAndTransition;
};

/**
 * Tap/hover feedback for anything that is actually clickable — cards, tiles,
 * nav links. Spread onto a `motion.*` element. Under reduced motion this is an
 * empty object, so the gestures are never even registered.
 */
export function pressable(reduced: boolean): PressableProps {
  if (reduced) return {};
  return {
    whileHover: {
      scale: 1.01,
      transition: { duration: DURATION.press, ease: EASE_OUT },
    },
    whileTap: {
      scale: 0.97,
      transition: { duration: DURATION.press, ease: EASE_OUT },
    },
  };
}

export type TabIndicatorProps = { layoutId: string; transition: Transition };

/**
 * The sliding pill/underline behind an active tab or nav link. Render the
 * indicator element only under the active item and spread this onto it — the
 * shared `layoutId` makes framer-motion glide it from the old position to the
 * new one instead of cutting.
 *
 * Give each indicator group its own id (`"overviewTab"`, `"navIndicator"`, …);
 * two groups sharing an id would fight over the same element.
 */
export function tabIndicator(reduced: boolean, layoutId: string): TabIndicatorProps {
  return {
    layoutId,
    transition: reduced ? INSTANT : { duration: DURATION.entrance, ease: EASE_OUT },
  };
}

/**
 * Every preset, bound to the viewer's motion preference and memoised so the
 * objects stay referentially stable across re-renders (an entrance therefore
 * plays once on mount and does not re-trigger when the tree re-renders).
 */
export function useMotionPresets() {
  const reduced = useReducedMotion() ?? false;

  return useMemo(
    () => ({
      /** Exposed for the odd case that needs to branch by hand (e.g. chart libraries). */
      reduced,
      fadeUp: fadeUp(reduced),
      staggerContainer: staggerContainer(reduced),
      staggerItem: staggerItem(reduced),
      pressable: pressable(reduced),
      tabIndicator: (layoutId: string) => tabIndicator(reduced, layoutId),
    }),
    [reduced]
  );
}
