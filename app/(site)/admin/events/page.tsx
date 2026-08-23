import Link from "next/link";
import { CalendarDays, Table2 } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { getAllEvents, countReservationsForEvents, eventTitle } from "@/lib/data";
import { formatDate, formatTime, formatMoney, monthKey } from "@/lib/format";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui/Surface";
import { FadeUp, StaggerRow, StaggerRows } from "@/components/ui/Motion";
import { MonthCalendar } from "@/components/MonthCalendar";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "neutral",
  published: "good",
  closed: "warn",
  happened: "gold",
  archived: "neutral",
} as const;

/**
 * The events manager, in two views (`PLAN/FIX_ADMIN_DASH.md` §4).
 *
 * Which view is showing lives in `?view=`, and the calendar's month in
 * `?month=`, rather than in client state. That costs nothing here — the page
 * is `force-dynamic` and both views render from the same single query — and it
 * buys a shareable link to a specific month plus a browser Back that actually
 * returns to the month you were looking at.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { locale, t } = await getI18n();
  const { view, month: requested } = await searchParams;

  const calendar = view === "calendar";
  const month = /^\d{4}-\d{2}$/.test(requested ?? "")
    ? (requested as string)
    : monthKey(new Date());

  const events = await getAllEvents();
  const counts = await countReservationsForEvents(events.map((e) => e.id));

  const hrefFor = (nextView: "table" | "calendar", nextMonth = month) =>
    nextView === "calendar"
      ? `/admin/events?view=calendar&month=${nextMonth}`
      : "/admin/events";

  const toggle = (
    <div className="dk-hairline inline-flex rounded-[4px] border p-0.5">
      <Link
        href={hrefFor("table")}
        aria-current={calendar ? undefined : "page"}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-[3px] px-3 text-sm font-semibold transition-colors",
          calendar ? "text-ink-soft hover:bg-gold-wash" : "bg-ink text-cream"
        )}
      >
        <Table2 className="h-4 w-4" />
        {t.admin.tableView}
      </Link>
      <Link
        href={hrefFor("calendar")}
        aria-current={calendar ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-[3px] px-3 text-sm font-semibold transition-colors",
          calendar ? "bg-ink text-cream" : "text-ink-soft hover:bg-gold-wash"
        )}
      >
        <CalendarDays className="h-4 w-4" />
        {t.admin.calendarView}
      </Link>
    </div>
  );

  return (
    <div>
      <FadeUp>
        <PageHeader
          title={t.admin.events}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {toggle}
              <Link
                href="/admin/events/new"
                className={buttonStyles({ variant: "lightPrimary" })}
              >
                {t.admin.newEvent}
              </Link>
            </div>
          }
        />
      </FadeUp>

      {calendar ? (
        <MonthCalendar
          month={month}
          events={events}
          locale={locale}
          hrefForMonth={(next) => hrefFor("calendar", next)}
          labels={{
            karaokeHint: t.admin.karaokeHint,
            newEvent: t.admin.newEvent,
            previousMonth: t.admin.previousMonth,
            nextMonth: t.admin.nextMonth,
          }}
        />
      ) : events.length === 0 ? (
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
            <StaggerRows>
              {events.map((event) => (
                <StaggerRow key={event.id} className="border-t border-line hover:bg-gold-wash/40">
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
                </StaggerRow>
              ))}
            </StaggerRows>
          </table>
        </Card>
      )}
    </div>
  );
}
