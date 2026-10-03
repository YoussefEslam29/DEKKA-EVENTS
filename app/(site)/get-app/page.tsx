import { getI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { InstallPanel } from "@/components/InstallPanel";

/**
 * "Get the app" (PLAN/DEKKA_PWA_APP.md §2) — where the footer link, the
 * `/account` card and the iPhone install strip all point.
 */
export default async function GetAppPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-10 md:px-8">
      <FadeUp>
        <PageHeader title={t.app.getApp.title} subtitle={t.app.getApp.subtitle} />
      </FadeUp>
      <InstallPanel />
    </div>
  );
}
