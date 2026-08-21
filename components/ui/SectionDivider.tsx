import { cn } from "@/lib/utils";

/**
 * §6 `SectionDivider` — centred uppercase label with a hairline either side.
 * Used for "OR CONTINUE WITH" on the auth screens, and to break up sections
 * elsewhere.
 */
export function SectionDivider({
  label,
  className,
  tone = "dark",
}: {
  label: React.ReactNode;
  className?: string;
  tone?: "dark" | "light";
}) {
  const line = tone === "dark" ? "bg-border-dark" : "bg-line";
  const text = tone === "dark" ? "text-text-muted" : "text-ink-faint";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("h-px flex-1", line)} />
      <span className={cn("text-[0.65rem] font-semibold uppercase tracking-[0.18em]", text)}>
        {label}
      </span>
      <span className={cn("h-px flex-1", line)} />
    </div>
  );
}
