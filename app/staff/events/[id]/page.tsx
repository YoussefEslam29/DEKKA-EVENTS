import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { getEvent, getEventReservations, getCheckIns, eventTitle } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/Surface";
import { DoorTable } from "@/components/DoorTable";

export const dynamic = "force-dynamic";

export default async function DoorCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n();

  const event = await getEvent(id);
  if (!event) notFound();

  const [reservations, checkIns] = await Promise.all([
    getEventReservations(id),
    getCheckIns(id),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-8">
      <Link
        href="/staff"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        {t.common.back}
      </Link>

      <PageHeader
        title={eventTitle(event, locale)}
        subtitle={`${formatDate(event.startsAt, locale)} · ${formatTime(event.startsAt, locale)}`}
      />

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
