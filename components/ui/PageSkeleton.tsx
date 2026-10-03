import { PatternAccent } from "@/components/ui/PatternAccent";
import { cn } from "@/lib/utils";

/**
 * The installed app's in-app loading state (PLAN/DEKKA_PWA_APP.md §2): page
 * shaped bones textured with the tatreez motif, with a faint gold sheen sweeping
 * across them (`.dk-shimmer` in globals.css). An app that keeps showing the
 * splash cup on every tab switch feels slower than one that sketches the page
 * it's about to show — so the cup stays for the cold launch and this takes
 * every navigation after it.
 *
 * Pure markup and CSS, so it works as a server component and before hydration.
 * Reduced motion drops the sheen in CSS; the static texture stays.
 */
function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("dk-shimmer rounded-xl bg-surface-dark", className)}>
      <PatternAccent variant="field" className="absolute inset-0 text-gold-accent/[0.06]" />
    </div>
  );
}

export function PageSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("mx-auto w-full max-w-[1180px] px-4 py-10 md:px-8", className)}
    >
      <Bone className="mb-2 h-8 w-48" />
      <Bone className="mb-6 h-4 w-64 max-w-full" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
