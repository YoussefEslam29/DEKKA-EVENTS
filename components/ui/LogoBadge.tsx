import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * §1 + §6 `LogoBadge` — the real دكة lockup on a cream plate.
 *
 * The brand artwork is dark brown ink; on `ink-black` it all but disappears
 * (verified against the real file). So anywhere the logo meets a dark surface it
 * sits inside this cream badge, exactly as the reference mockups do — only with
 * the real mark instead of the fabricated "COFFEE & COMMUNITY" circle.
 *
 * The optional tagline is "COFFEE SHOP", the real copy from DEKKA_BANNER.
 */
const SIZES = {
  sm: { box: "h-11 w-11 rounded-[10px] p-1.5", img: 34 },
  md: { box: "h-16 w-16 rounded-2xl p-2.5", img: 52 },
  lg: { box: "h-20 w-20 rounded-2xl p-3", img: 66 },
  xl: { box: "h-32 w-32 rounded-3xl p-5 md:h-40 md:w-40 md:p-6", img: 150 },
} as const;

export function LogoBadge({
  size = "md",
  tagline = false,
  className,
  priority = false,
}: {
  size?: keyof typeof SIZES;
  tagline?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex flex-col items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center bg-cream ring-1 ring-tan-muted/25",
          s.box
        )}
      >
        <Image
          src="/brand/dekka-logo.png"
          alt="Dekka — دكة"
          width={s.img}
          height={Math.round((s.img * 560) / 1200)}
          priority={priority}
          className="h-auto w-full object-contain"
        />
      </span>
      {tagline ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-tan-muted">
          Coffee Shop
        </span>
      ) : null}
    </span>
  );
}

/** The lockup at full width for cream surfaces, where no badge plate is needed. */
export function LogoLockup({
  width = 180,
  className,
  priority = false,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/dekka-logo.png"
      alt="Dekka — دكة"
      width={width}
      height={Math.round((width * 560) / 1200)}
      priority={priority}
      className={cn("h-auto object-contain", className)}
    />
  );
}
