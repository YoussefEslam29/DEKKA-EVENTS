import { cn } from "@/lib/utils";

/**
 * Surfaces that work on both themes. Colours come from the `dk-*` classes in
 * globals.css, which flip automatically inside a `.dk-workspace` ancestor, so
 * the same Card renders dark on the public app and cream in the back-office.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dk-card", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "gold" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-current/25 dk-muted",
    gold: "border-gold-accent/40 bg-gold-accent/10 text-gold-accent",
    good: "border-good/40 bg-good/10 text-good",
    warn: "border-warn/40 bg-warn/10 text-warn",
    bad: "border-bad/40 bg-bad/10 text-bad",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="dk-muted mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "dk-muted dk-hairline rounded-2xl border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      {children}
    </div>
  );
}
