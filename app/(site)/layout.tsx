import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PushOptIn } from "@/components/PushOptIn";
import { CookieConsent } from "@/components/CookieConsent";
import { SkipLink } from "@/components/SkipLink";
import { getI18n } from "@/lib/i18n";

/** Everything with site chrome: the public app plus the back-office tools. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink label={t.common.skipToContent} />
      <Navbar />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
      {/* Mounted once for the whole site: the one-shot post-auth push toast
          (`PLAN/LOG_SIGN_AUTH_IN.md` §6) reads its own "did we just sign in"
          flag from sessionStorage and renders nothing otherwise. */}
      <PushOptIn variant="toast" />
      {/* Mounted here rather than the root layout so it never covers the
          full-bleed auth screens, which load no third-party embed anyway. */}
      <CookieConsent />
    </div>
  );
}
