import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PushOptIn } from "@/components/PushOptIn";
import { CookieConsent } from "@/components/CookieConsent";
import { SkipLink } from "@/components/SkipLink";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppTabBar } from "@/components/layout/AppTabBar";
import { getI18n } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import { UsageBeacon } from "@/components/UsageBeacon";
import { DemoRibbon } from "@/components/DemoRibbon";
import { isDemo } from "@/lib/demo";

/**
 * Everything with site chrome: the public app plus the back-office tools.
 *
 * Installed as an app (`standalone:`, PLAN/DEKKA_PWA_APP.md §2) the same tree
 * gains a bottom tab bar, and the page pads its bottom by the bar's height plus
 * the home-indicator inset so the last row of content is never underneath it.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, user, demo] = await Promise.all([getI18n(), currentUser(), isDemo()]);

  return (
    <div
      // Staff and admins aren't counted in the anonymous totals (lib/stats-client.ts).
      // Decided here, on the server, so the beacon never learns who anyone is.
      data-stats-off={hasRole(user, "staff") ? "" : undefined}
      className="flex min-h-screen flex-col standalone:pb-[calc(4rem+env(safe-area-inset-bottom))]"
    >
      {/* `contents`: no box on screen, so nothing moves; `print:hidden`: a printed page
          (the QR poster) is the page alone. */}
      <div className="contents print:hidden">
        <SkipLink label={t.common.skipToContent} />
        {demo ? <DemoRibbon /> : null}
        <Navbar />
        <InstallPrompt />
      </div>
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <div className="contents print:hidden">
        <Footer />
        <AppTabBar />
      </div>
      {/* Mounted once for the whole site: the one-shot post-auth push toast
          (`PLAN/LOG_SIGN_AUTH_IN.md` §6) reads its own "did we just sign in"
          flag from sessionStorage and renders nothing otherwise. */}
      <div className="contents print:hidden">
        <PushOptIn variant="toast" />
        {/* Mounted here rather than the root layout so it never covers the
            full-bleed auth screens, which load no third-party embed anyway. */}
        <CookieConsent />
      </div>
      <UsageBeacon />
    </div>
  );
}
