import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { ReloadButton } from "@/components/ReloadButton";
import { OfflineMenu } from "@/components/menu/OfflineMenu";
import { buttonStyles } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "دكة — Dekka",
  robots: { index: false, follow: false },
};

/**
 * The offline fallback (PLAN/DEKKA_PWA_APP.md §2). `public/sw.js` precaches
 * this page plus every `/_next/static` file its HTML references at install
 * time, and serves it whenever a navigation fails for want of a network.
 *
 * Built to render from that cache alone, which is why it looks the way it does:
 * - outside the `(site)` group, so no navbar/footer — those are server
 *   components reading the session, and a frozen copy of someone's signed-in
 *   header is exactly what the worker must never store;
 * - a plain `<img>` for the logo, not `next/image`, whose `/_next/image?...`
 *   URL varies by width and wouldn't be in the cache;
 * - lucide icons render to inline SVG on the server, so they need nothing;
 * - the menu comes from the worker's copy of `GET /api/menu` (`OfflineMenu`).
 */
export default async function OfflinePage() {
  const { t } = await getI18n();

  return (
    <main
      id="main-content"
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <PatternAccent className="absolute inset-x-0 top-0" />

      <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-cream p-3 ring-1 ring-tan-muted/25">
        {/* eslint-disable-next-line @next/next/no-img-element -- must resolve from the service-worker cache; see above */}
        <img src="/brand/dekka-logo.png" alt="Dekka — دكة" width={66} height={31} className="h-auto w-full" />
      </span>

      <div className="max-w-sm">
        <WifiOff className="mx-auto mb-3 h-8 w-8 text-gold-accent" aria-hidden />
        <h1 className="text-2xl font-extrabold tracking-tight">{t.app.offline.title}</h1>
        <p className="mt-2 text-text-muted">{t.app.offline.body}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <ReloadButton label={t.common.tryAgain} />
        <Link href="/" className={`${buttonStyles({ variant: "outline", size: "lg" })} h-12`}>
          {t.app.offline.home}
        </Link>
      </div>

      {/* The menu as last seen online, if the worker has a copy — the one
          thing worth reading in a cafe with no signal. */}
      <OfflineMenu />

      <PatternAccent className="absolute inset-x-0 bottom-0" />
    </main>
  );
}
