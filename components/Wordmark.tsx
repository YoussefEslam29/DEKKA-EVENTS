import { cn } from "@/lib/utils";

/**
 * The دكة wordmark. Rather than shipping a raster logo, the Arabic glyphs are
 * filled with the tatreez pattern via background-clip, so it stays crisp at any
 * size and picks up the brand texture used elsewhere on the page.
 */
export function Wordmark({
  className,
  size = "md",
  withLatin = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  withLatin?: boolean;
}) {
  const sizes = {
    sm: { ar: "text-2xl", latin: "text-[0.6rem] tracking-[0.35em]" },
    md: { ar: "text-3xl", latin: "text-[0.65rem] tracking-[0.4em]" },
    lg: { ar: "text-6xl", latin: "text-sm tracking-[0.5em]" },
    xl: { ar: "text-7xl md:text-8xl", latin: "text-base tracking-[0.55em]" },
  }[size];

  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)}>
      <span
        className={cn("dk-wordmark font-arabic font-black", sizes.ar)}
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        دكة
      </span>
      {withLatin ? (
        <span className={cn("mt-1 font-semibold uppercase text-ink-soft", sizes.latin)}>
          Dekka
        </span>
      ) : null}
    </span>
  );
}
