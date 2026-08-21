import { cn } from "@/lib/utils";

/**
 * §6 `PatternAccent` — the nested-diamond tatreez motif pulled from the logo's
 * texture. Rendered as a CSS mask tinted by `color`, so the same component works
 * as a divider on dark panels, a watermark on cream cards, or a skeleton
 * texture, just by changing the text colour.
 *
 * §4.9 asks for this to stay *thin and low-opacity*, so the defaults are
 * deliberately faint — it should read as a woven edge, not a border.
 */
export function PatternAccent({
  variant = "band",
  className,
}: {
  variant?: "band" | "field";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        variant === "band"
          ? "dk-tatreez h-3.5 w-full text-gold-accent/20"
          : "dk-tatreez-field h-full w-full text-gold-accent/10",
        className
      )}
    />
  );
}
