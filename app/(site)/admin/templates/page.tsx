import { getEventTemplates } from "@/lib/data";
import { FadeUp } from "@/components/ui/Motion";
import { BackButton } from "@/components/ui/BackButton";
import { TemplateManager } from "@/components/templates/TemplateManager";

export const dynamic = "force-dynamic";

/**
 * Saved nights & activities (`PLAN/DEKKA_PWA_APP.md` §4). Admin-only through
 * `app/(site)/admin/layout.tsx`, the one gate for this route group.
 */
export default async function AdminTemplatesPage() {
  const templates = await getEventTemplates();

  return (
    <div>
      <BackButton fallbackHref="/admin/events" />
      <FadeUp>
        <TemplateManager initial={templates} />
      </FadeUp>
    </div>
  );
}
