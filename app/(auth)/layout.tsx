import { getI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/SkipLink";

/**
 * No navbar, no footer — the auth screen owns the full viewport so the split
 * photo panel reads edge-to-edge (§4).
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();

  return (
    <>
      <SkipLink label={t.common.skipToContent} />
      {/* A real <main> landmark: this group has none of the site chrome that
          provides one in `(site)`, so without this the auth screens have no
          landmark at all for a screen reader to jump to. */}
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
    </>
  );
}
