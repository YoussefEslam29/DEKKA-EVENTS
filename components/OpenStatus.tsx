"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { openStatus, openStatusText, type OpenStatus as Status } from "@/lib/hours";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const DOT: Record<Status["state"], string> = {
  open: "bg-good",
  closingSoon: "bg-gold-accent",
  closed: "bg-bad",
};

/**
 * "Open now · until 1 am" (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b.1). The server works out the
 * first state and passes it in, so there's no flash; after that it recomputes on each
 * minute, so a page left open across closing time catches up. The dot's colour repeats
 * what the words say, never replaces them.
 */
export function OpenStatus({ initial, className }: { initial: Status; className?: string }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const tick = () => setStatus(openStatus(new Date(), site.openingHours));
    let every: ReturnType<typeof setInterval> | undefined;
    // First on the next minute boundary, then every minute.
    const first = setTimeout(() => {
      tick();
      every = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(first);
      if (every) clearInterval(every);
    };
  }, []);

  return (
    <p
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border-dark bg-surface-dark px-3 py-1.5 text-sm font-semibold text-on-dark",
        className
      )}
    >
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[status.state])} />
      {openStatusText(status, locale, t.visit)}
    </p>
  );
}
