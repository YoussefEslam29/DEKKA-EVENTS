import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getAllEvents, countReservationsForEvents, eventTitle } from "@/lib/data";
import { formatDate, formatTime, formatMoney } from "@/lib/format";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui/Surface";
import { buttonStyles } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  published: "good",
  closed: "warn",
  happened: "gold",
  archived: "neutral",
} as const;

export default async function AdminEventsPage() {
  const { locale, t } = await getI18n();
  const events = await getAllEvents();
  const counts = await countReservationsForEvents(events.map((e) => e.id));

  return (
    <div>
      <PageHeader
        title={t.admin.events}
        action={
          <Link href="/admin/events/new" className={buttonStyles({ variant: "primary" })}>
            {t.admin.newEvent}
          </Link>
        }
      />

      {events.length === 0 ? (
        <EmptyState>{t.admin.noEvents}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-2 text-start font-semibold">{t.admin.fields.titleAr}</th>
                <th className="px-4 py-2 text-start font-semibold">{t.event.date}</th>
                <th className="px-4 py-2 text-start font-semibold">{t.admin.fields.status}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.admin.reservations}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.event.price}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-line hover:bg-gold-wash/40">
                  <td className="px-4 py-2">
                    <Link href={`/admin/events/${event.id}`} className="font-bold hover:text-gold-deep">
                      {eventTitle(event, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-soft">
                    {formatDate(event.startsAt, locale)} · {formatTime(event.startsAt, locale)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[event.status]}>{t.event.status[event.status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-end font-semibold">
                    {counts[event.id] ?? 0}
                    {event.capacity != null ? (
                      <span className="text-ink-faint"> / {event.capacity}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-end">
                    {event.price > 0 ? formatMoney(event.price, locale) : t.common.free}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
