import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import {
  getEvent,
  getEventReservations,
  getCheckIns,
  eventTitle,
} from "@/lib/data";
import { formatDate, formatTime, formatMoney } from "@/lib/format";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui/Surface";
import { BackButton } from "@/components/ui/BackButton";
import { FadeUp } from "@/components/ui/Motion";
import { EventForm } from "@/components/EventForm";
import { EventAdminActions } from "@/components/EventAdminActions";
import { DuplicateEventButton } from "@/components/DuplicateEventButton";

export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({
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

  const revenue = checkIns.reduce((sum, c) => sum + c.amount, 0);

  const stats = [
    { label: t.admin.reservations, value: String(reservations.length) },
    { label: t.admin.attendees, value: String(checkIns.length) },
    {
      label: t.admin.revenue,
      value: `${formatMoney(revenue, locale)} ${t.common.egp}`,
    },
  ];

  return (
    <div>
      <FadeUp>
        <BackButton fallbackHref="/admin/events" />

        <PageHeader
          title={eventTitle(event, locale)}
          subtitle={`${formatDate(event.startsAt, locale)} · ${formatTime(event.startsAt, locale)}`}
          action={<Badge tone="gold">{t.event.status[event.status]}</Badge>}
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <EventAdminActions eventId={event.id} status={event.status} />
          <DuplicateEventButton event={event} />
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-black">{stat.value}</p>
            </Card>
          ))}
        </div>
      </FadeUp>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">{t.admin.reservations}</h2>
        {reservations.length === 0 ? (
          <EmptyState>{t.common.none}</EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-4 py-2 text-start font-semibold">{t.staff.name}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t.staff.phone}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t.event.yourCode}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t.staff.checkedIn}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-2 font-semibold">{r.name}</td>
                    <td className="px-4 py-2" dir="ltr">{r.phone}</td>
                    <td className="px-4 py-2 font-mono">{r.code}</td>
                    <td className="px-4 py-2 text-end">
                      {r.checkedIn ? (
                        <Badge tone="good">{t.staff.checkedIn}</Badge>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.admin.attendees}</h2>
          <Link
            href={`/staff/events/${event.id}`}
            className="text-sm font-semibold text-gold-deep hover:underline"
          >
            {t.staff.checkInTitle}
          </Link>
        </div>
        {checkIns.length === 0 ? (
          <EmptyState>{t.staff.noAttendees}</EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-4 py-2 text-start font-semibold">{t.staff.name}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t.staff.phone}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t.staff.method}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t.staff.amount}</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-2 font-semibold">{row.name}</td>
                    <td className="px-4 py-2" dir="ltr">{row.phone}</td>
                    <td className="px-4 py-2">
                      {row.paymentMethod === "cash" ? t.event.cash : t.event.instapay}
                    </td>
                    <td className="px-4 py-2 text-end font-semibold">
                      {formatMoney(row.amount, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t.admin.editEvent}</h2>
        <EventForm event={event} />
      </section>
    </div>
  );
}
