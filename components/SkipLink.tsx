/**
 * Skip-to-content link — the first thing in the tab order, invisible until it
 * takes focus.
 *
 * Without it a keyboard user tabs through the whole sticky header (up to six
 * nav links, the language toggle and the account menu) on every single page
 * before reaching anything on it. Both layouts put `id="main-content"` on their
 * main region for this to land on.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-surface-dark focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-dark focus:outline-none focus:ring-2 focus:ring-gold-accent focus:ring-offset-2 focus:ring-offset-ink-black"
    >
      {label}
    </a>
  );
}
