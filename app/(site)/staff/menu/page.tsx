import { getI18n } from "@/lib/i18n";
import { getMenu } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { BackButton } from "@/components/ui/BackButton";
import { StaffMenuToggles } from "@/components/menu/StaffMenuToggles";

export const dynamic = "force-dynamic";

/**
 * Sold-out switches for whoever is on shift (`PLAN/DEKKA_PWA_APP.md` §3). Staff
 * or admin, through `app/(site)/staff/layout.tsx`. Shows the menu as guests see
 * it — hidden sections aren't on the menu, so there's nothing there to mark.
 */
export default async function StaffMenuPage() {
  const { t } = await getI18n();
  const categories = await getMenu();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      <BackButton fallbackHref="/staff" />
      <FadeUp>
        <PageHeader title={t.cafeMenu.staff.title} subtitle={t.cafeMenu.staff.subtitle} />
      </FadeUp>
      {categories.length === 0 ? (
        <EmptyState>{t.cafeMenu.comingSoonTitle}</EmptyState>
      ) : (
        <StaffMenuToggles categories={categories} />
      )}
    </div>
  );
}
