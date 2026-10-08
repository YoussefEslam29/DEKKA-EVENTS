import { getI18n } from "@/lib/i18n";
import { getEventTemplates } from "@/lib/data";
import { dayKey } from "@/lib/format";
import { isRealDate } from "@/lib/templates";
import { PageHeader } from "@/components/ui/Surface";
import { BackButton } from "@/components/ui/BackButton";
import { FadeUp } from "@/components/ui/Motion";
import { EventForm } from "@/components/EventForm";
import { TemplateLauncher } from "@/components/templates/TemplateLauncher";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * New event: from a saved template (two taps) or from scratch (the full form).
 *
 * `?date=YYYY-MM-DD` is what the admin calendar links an empty day to
 * (`MonthCalendar`); both paths start on that day. It was planned in
 * `PLAN/FIX_ADMIN_DASH.md` §4 but nothing read it until templates needed it.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  // First, before any read: see requireRole() for why the layout's check isn't enough.
  await requireRole("admin", "/admin/events/new");
  const { t } = await getI18n();
  const { date: requested } = await searchParams;
  const date = requested && isRealDate(requested) ? requested : undefined;
  const templates = await getEventTemplates();

  return (
    <div>
      <FadeUp>
        <BackButton fallbackHref="/admin/events" />

        <PageHeader title={t.admin.newEvent} />
        <TemplateLauncher templates={templates} initialDate={date ?? dayKey(new Date())} />
        <EventForm defaultDate={date} />
      </FadeUp>
    </div>
  );
}
