import { getI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/Surface";
import { EventForm } from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const { t } = await getI18n();
  return (
    <div>
      <PageHeader title={t.admin.newEvent} />
      <EventForm />
    </div>
  );
}
