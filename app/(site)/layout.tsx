import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PushOptIn } from "@/components/PushOptIn";

/** Everything with site chrome: the public app plus the back-office tools. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      {/* Mounted once for the whole site: the one-shot post-auth push toast
          (`PLAN/LOG_SIGN_AUTH_IN.md` §6) reads its own "did we just sign in"
          flag from sessionStorage and renders nothing otherwise. */}
      <PushOptIn variant="toast" />
    </div>
  );
}
