import { cn } from "@/lib/utils";

/** A sheet of paper: the default container for content blocks. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[4px] border border-line bg-paper", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "gold" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-cream text-ink-soft border-line",
    gold: "bg-gold-wash text-gold-deep border-gold/40",
    good: "bg-good/10 text-good border-good/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** The tatreez divider — the wordmark's texture used as a rule between sections. */
export function TatreezDivider({ className }: { className?: string }) {
  return <div className={cn("dk-tatreez h-4 w-full opacity-80", className)} aria-hidden />;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-soft">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="dk-tatreez-field rounded-[4px] border border-dashed border-line px-6 py-12 text-center text-ink-soft">
      {children}
    </div>
  );
}
