import Link from "next/link";
import { Coffee } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { EmptyState, PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { buttonStyles } from "@/components/ui/Button";

/**
 * Placeholder for the Menu tab until the real menu ships
 * (PLAN/DEKKA_PWA_APP.md §3). The installed app's tab bar links here from day
 * one, so it has to land somewhere warm rather than on a 404.
 */
export default async function MenuPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-10 md:px-8">
      <FadeUp>
        <PageHeader title={t.cafeMenu.title} />
        <EmptyState>
          <Coffee className="mx-auto mb-3 h-10 w-10 text-gold-accent" aria-hidden />
          <p className="text-lg font-bold text-on-dark">{t.cafeMenu.comingSoonTitle}</p>
          <p className="mx-auto mt-2 max-w-md">{t.cafeMenu.comingSoonBody}</p>
          <Link href="/" className={`${buttonStyles({ variant: "outline" })} mt-6`}>
            {t.home.browseEvents}
          </Link>
        </EmptyState>
      </FadeUp>
    </div>
  );
}
