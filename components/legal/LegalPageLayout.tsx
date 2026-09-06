import { PatternAccent } from "@/components/ui/PatternAccent";

export type LegalSection = { heading: string; body: string };

/**
 * The shared shell behind /privacy, /terms, /cookies and /refund-policy.
 *
 * Deliberately one flowing prose column rather than a stack of `Card`s: a
 * policy is read top to bottom, and boxing each clause separately makes it
 * scan like a settings screen. `whitespace-pre-line` is the same treatment the
 * event page gives admin-authored descriptions and terms, so the `\n`-separated
 * lists inside the longer sections (the processor list, the cookie table) keep
 * their line breaks without any markup in the dictionary.
 *
 * `children` renders after the sections — used by /privacy for its business
 * info block.
 */
export function LegalPageLayout({
  title,
  updatedLabel,
  sections,
  children,
}: {
  title: string;
  updatedLabel: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <section className="border-b border-border-dark bg-surface-dark">
        <PatternAccent />
        <div className="mx-auto max-w-3xl px-4 py-10 text-center md:px-8">
          <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-text-muted">{updatedLabel}</p>
        </div>
        <PatternAccent />
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        {sections.map((section) => (
          <section key={section.heading} className="mb-8 last:mb-0">
            <h2 className="mb-2 text-lg font-bold text-gold-accent">{section.heading}</h2>
            <p className="whitespace-pre-line text-base leading-relaxed text-text-muted">
              {section.body}
            </p>
          </section>
        ))}
        {children}
      </div>
    </div>
  );
}
