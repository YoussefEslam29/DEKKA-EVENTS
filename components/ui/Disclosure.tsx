"use client";

import { useRef, useState } from "react";

/**
 * A native `<details>` disclosure with the two things `<details>` doesn't give
 * you for free: `aria-expanded` on the trigger, and Escape to close.
 *
 * Staying on `<details>` rather than a hydrated dropdown is deliberate — it is
 * what makes the navbar menu work with JavaScript off — but a menu you can open
 * with the keyboard and not close with the keyboard is its own problem, and
 * that is all this adds.
 */
export function Disclosure({
  summary,
  summaryClassName,
  summaryAriaLabel,
  className,
  children,
}: {
  summary: React.ReactNode;
  summaryClassName?: string;
  summaryAriaLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <details
      ref={detailsRef}
      className={className}
      // The native toggle event is the source of truth: it fires for clicks,
      // Enter/Space on the summary, and find-in-page expansion alike, so state
      // can't drift from what the element is actually doing.
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        const details = detailsRef.current;
        if (!details?.open) return;
        event.preventDefault();
        details.open = false;
        setOpen(false);
        // Focus would otherwise be left on a link inside a panel that no
        // longer exists.
        summaryRef.current?.focus();
      }}
    >
      <summary
        ref={summaryRef}
        className={summaryClassName}
        aria-expanded={open}
        aria-label={summaryAriaLabel}
      >
        {summary}
      </summary>
      {children}
    </details>
  );
}
