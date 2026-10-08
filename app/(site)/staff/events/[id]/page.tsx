import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { getEvent, getEventReservations, getCheckIns, eventTitle } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { PageHeader } from "@/components/ui/Surface";
import { BackButton } from "@/components/ui/BackButton";
import { FadeUp } from "@/components/ui/Motion";
import { DoorTable } from "@/components/DoorTable";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function DoorCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // First, before any read: see requireRole() for why the layout's check isn't enough.
  await requireRole("staff", "/staff");
  const { id } = await params;
  const { locale } = await getI18n();

  const event = await getEvent(id);
  if (!event) notFound();

  const [reservations, checkIns] = await Promise.all([
    getEventReservations(id),
    getCheckIns(id),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-8">
      <FadeUp>
        <BackButton fallbackHref="/staff" />

        <PageHeader
          title={eventTitle(event, locale)}
          subtitle={formatWhen(event.startsAt, locale)}
        />
      </FadeUp>

      <DoorTable
        eventId={event.id}
        defaultPrice={event.price}
        paymentMethods={event.paymentMethods}
        initialReservations={reservations}
        initialCheckIns={checkIns}
      />
    </div>
  );
}
