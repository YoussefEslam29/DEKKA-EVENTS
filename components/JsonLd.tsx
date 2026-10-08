import { jsonLdString } from "@/lib/seo";

/**
 * Structured data for search engines (`PLAN/SITE_ROADMAP.md` D1). A data block, never run
 * as a script; `jsonLdString` escapes `<` so admin-typed text can't break out of it.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
