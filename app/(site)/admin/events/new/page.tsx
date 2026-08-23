import { getI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/Surface";
import { BackButton } from "@/components/ui/BackButton";
import { FadeUp } from "@/components/ui/Motion";
import { EventForm } from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const { t } = await getI18n();
  return (
    <div>
      <FadeUp>
        <BackButton fallbackHref="/admin/events" />

        <PageHeader title={t.admin.newEvent} />
        <EventForm />
      </FadeUp>
    </div>
  );
}
