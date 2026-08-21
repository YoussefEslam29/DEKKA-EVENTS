import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getStaffEvents, eventTitle } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui/Surface";

export const dynamic = "force-dynamic";

export default async function StaffEventPickerPage() {
  const { locale, t } = await getI18n();
  const events = await getStaffEvents();
  const today = new Date().toDateString();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
      <PageHeader title={t.staff.title} subtitle={t.staff.subtitle} />

      {events.length === 0 ? (
        <EmptyState>{t.staff.noEvents}</EmptyState>
      ) : (
        <div className="grid gap-3">
          {events.map((event) => {
            const isToday = new Date(event.startsAt).toDateString() === today;
            return (
              <Link key={event.id} href={`/staff/events/${event.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-gold">
                  <div>
                    <p className="text-lg font-bold">{eventTitle(event, locale)}</p>
                    <p className="text-sm text-ink-soft">
                      {formatDate(event.startsAt, locale)} ·{" "}
                      {formatTime(event.startsAt, locale)}
                    </p>
                  </div>
                  {isToday ? (
                    <Badge tone="good">{t.staff.checkInTitle}</Badge>
                  ) : (
                    <Badge>{t.event.status[event.status]}</Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
