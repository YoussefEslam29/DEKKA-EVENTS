"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useMotionPresets } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The one back affordance for every back-office drill-in
 * (`PLAN/FIX_ADMIN_DASH.md` §7).
 *
 * It goes to *where the viewer actually came from*, not to a hardcoded parent:
 * an event opened from a filtered list returns to that filtered list, with its
 * tab and scroll position intact, because `router.back()` replays the real
 * browser history entry.
 *
 * It renders as an anchor pointing at `fallbackHref` rather than as a
 * `<button>`, which buys three things at once: the fallback needs no code path
 * of its own (when there is no history to pop we simply don't intercept the
 * click and the browser follows the href); the control keeps link semantics, so
 * ctrl/middle-click opens the parent section in a new tab; and framer-motion's
 * `whileTap` — which makes its element focusable — lands on something already in
 * the tab order instead of inventing a stray tab stop.
 */

/**
 * `Link` with the motion props attached. Typed as `"a"` because that is what
 * `Link` renders, which is what gives the result anchor typing rather than
 * `motion.div`'s. (`NavLinks.tsx` builds the same thing for the nav.)
 */
const MotionLink = motion.create<ComponentProps<typeof Link>, "a">(Link);

/** A click the browser should own — new tab, new window, download, aux button. */
function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  );
}

export function BackButton({
  fallbackHref,
  className,
}: {
  /** Parent route to fall back to when there is no in-app history to pop. */
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { pressable } = useMotionPresets();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || isModifiedEvent(event)) return;

    // Read `window` here and only here: there is no history on the server, and a
    // value captured at render time would go stale as the viewer navigates. A
    // length of 1 means this page is the whole session — a bookmarked or shared
    // link opened cold — so leave the event alone and let `href` do the work.
    if (window.history.length <= 1) return;

    event.preventDefault();
    router.back();
  }

  return (
    <MotionLink
      href={fallbackHref}
      onClick={goBack}
      {...pressable}
      className={cn(
        // `min-h-11` + inline padding is the 44px touch target; `-ms-2` pulls the
        // padding back out of the flow so the label still lines up with the page
        // title beneath it, and `mb-2` keeps the gap to that title where the
        // hardcoded links used to leave it.
        "-ms-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink",
        className
      )}
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      {t.common.back}
    </MotionLink>
  );
}
