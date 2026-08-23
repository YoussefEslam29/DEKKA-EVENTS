import { getI18n } from "@/lib/i18n";
import { getAllCheckIns, getAllEvents, eventTitle } from "@/lib/data";
import { PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { BackButton } from "@/components/ui/BackButton";
import { CustomersGrid } from "@/components/CustomersGrid";

export const dynamic = "force-dynamic";

/**
 * Every attendee across every night (`PLAN/FIX_ADMIN_DASH.md` §2c).
 *
 * Admin-only by way of `app/(site)/admin/layout.tsx`, which is the single gate
 * for this whole route group — staff still record the door through their own
 * event's table, and never see the cross-event roll-up.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; q?: string }>;
}) {
  const { locale, t } = await getI18n();
  const { eventId = "", q = "" } = await searchParams;

  const [rows, events] = await Promise.all([
    getAllCheckIns({ eventId: eventId || undefined, q: q || undefined }),
    getAllEvents(),
  ]);

  return (
    <div>
      <BackButton fallbackHref="/admin" />
      <FadeUp>
        <PageHeader title={t.customers.title} subtitle={t.customers.subtitle} />
      </FadeUp>

      <CustomersGrid
        rows={rows}
        events={events.map((event) => ({
          id: event.id,
          title: eventTitle(event, locale),
        }))}
        eventId={eventId}
        query={q}
      />
    </div>
  );
}
