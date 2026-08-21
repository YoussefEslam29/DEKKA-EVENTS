import { cn } from "@/lib/utils";

/**
 * §3 `BilingualLabel` — enforces the `English / العربية` pattern app-wide:
 * English first, forward slash, Arabic second, on one line.
 *
 * Each half is wrapped with its own `lang` so the browser picks the right face
 * (Cairo for Arabic, Plus Jakarta Sans for Latin) and applies correct bidi
 * handling, rather than letting one font render both scripts.
 */
export function BilingualLabel({
  en,
  ar,
  className,
  separator = "/",
}: {
  en: string;
  ar: string;
  className?: string;
  separator?: string;
}) {
  // When both dictionaries carry identical text (proper nouns, "COFFEE SHOP"),
  // showing it twice would just look like a mistake.
  if (en.trim() === ar.trim()) {
    return <span className={className}>{en}</span>;
  }

  return (
    // §3 fixes the order as English-then-Arabic. Without an explicit `dir` the
    // whole run reverses inside the RTL (Arabic) layout and renders Arabic-first.
    <span
      dir="ltr"
      className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}
    >
      <span lang="en" dir="ltr">
        {en}
      </span>
      <span aria-hidden className="opacity-45">
        {separator}
      </span>
      <span lang="ar" dir="rtl" className="font-arabic">
        {ar}
      </span>
    </span>
  );
}
