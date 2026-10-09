import Link from "next/link";
import { Coffee } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { getMenu } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { buttonStyles } from "@/components/ui/Button";
import { MenuBoard } from "@/components/menu/MenuBoard";
import { MenuCacheWarmer } from "@/components/menu/MenuCacheWarmer";
import { VisitRow } from "@/components/VisitRow";
import { isDemo } from "@/lib/demo";
import { demoMenu } from "@/lib/demo-fixtures";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.cafeMenu.title, description: t.cafeMenu.subtitle, path: "/menu" });
}

// Sold-out flips and price changes should show on the next load, not after a cache expires.
export const dynamic = "force-dynamic";

/**
 * The cafe menu (`PLAN/DEKKA_PWA_APP.md` §3) — the installed app's Menu tab.
 * Until the admin adds a first section with an item, it says so warmly
 * instead of showing an empty page.
 */
export default async function MenuPage() {
  const { t } = await getI18n();
  // Demo mode (PLAN/DEKKA_PWA_APP.md §5.4, 4c.3): a full sample menu on this device only.
  // GET /api/menu never looks at the cookie, so nothing sample reaches the offline cache.
  const categories = (await isDemo()) ? demoMenu() : await getMenu();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-10 md:px-8">
      <FadeUp>
        <PageHeader
          title={t.cafeMenu.title}
          subtitle={categories.length > 0 ? t.cafeMenu.subtitle : undefined}
        />
        <VisitRow t={t} className="-mt-2 mb-6" />
      </FadeUp>

      {categories.length === 0 ? (
        <EmptyState>
          <Coffee className="mx-auto mb-3 h-10 w-10 text-gold-accent" aria-hidden />
          <p className="text-lg font-bold text-on-dark">{t.cafeMenu.comingSoonTitle}</p>
          <p className="mx-auto mt-2 max-w-md">{t.cafeMenu.comingSoonBody}</p>
          <Link href="/" className={`${buttonStyles({ variant: "outline" })} mt-6`}>
            {t.home.browseEvents}
          </Link>
        </EmptyState>
      ) : (
        <>
          <MenuBoard categories={categories} />
          <MenuCacheWarmer />
        </>
      )}
    </div>
  );
}
