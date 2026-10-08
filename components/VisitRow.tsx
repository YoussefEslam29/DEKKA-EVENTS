import { Navigation } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { openStatus } from "@/lib/hours";
import { site } from "@/lib/site";
import { OpenStatus } from "@/components/OpenStatus";
import { DirectionsLink } from "@/components/DirectionsLink";
import { cn } from "@/lib/utils";

/**
 * "Open now" and "Take me there" side by side (`PLAN/DEKKA_PWA_APP.md` §5.3): on the
 * homepage's visit card, `/menu` and `/about`. Not on `/offline`, which is precached once,
 * so a status there would be frozen at whenever it was saved.
 */
export function VisitRow({ t, directions = true, className }: { t: Dict; directions?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <OpenStatus initial={openStatus(new Date(), site.openingHours)} />
      {directions ? (
        <DirectionsLink className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-gold-accent hover:underline">
          <Navigation className="h-4 w-4" aria-hidden />
          {t.visit.directions}
        </DirectionsLink>
      ) : null}
    </div>
  );
}
