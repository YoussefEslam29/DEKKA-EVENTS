import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/rbac";
import { getMyReservations, eventTitle } from "@/lib/data";
import { formatDate, formatTime, formatMoney } from "@/lib/format";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui/Surface";
import { buttonStyles } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const { locale, t } = await getI18n();
  const user = await currentUser();
  if (!user) redirect("/login?next=/my-events");

  const rows = await getMyReservations(user.id);
  // Upcoming reads soonest-first (what's next); past reads most-recent-first.
  const upcoming = rows
    .filter((r) => !r.event.isPast)
    .sort(
      (a, b) =>
        new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime()
    );
  const past = rows.filter((r) => r.event.isPast);

  const section = (
    title: string,
    items: typeof rows,
    dim: boolean
  ) =>
    items.length === 0 ? null : (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-text-muted">{title}</h2>
        <div className={`grid gap-3 ${dim ? "opacity-70" : ""}`}>
          {items.map(({ reservation, event }) => (
            <Card key={reservation.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/events/${event.id}`}
                    className="text-lg font-bold hover:text-gold-accent"
                  >
                    {eventTitle(event, locale)}
                  </Link>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatDate(event.startsAt, locale)} · {formatTime(event.startsAt, locale)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gold-accent">
                    {event.price > 0
                      ? `${formatMoney(event.price, locale)} ${t.common.egp} — ${t.event.payAtDoor}`
                      : t.common.free}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t.event.yourCode}
                  </p>
                  <p className="font-mono text-2xl font-black tracking-[0.15em]">
                    {reservation.code}
                  </p>
                  <Badge tone="good" className="mt-1">
                    {t.event.reserved}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-8">
      <PageHeader title={t.myEvents.title} subtitle={t.myEvents.subtitle} />

      {rows.length === 0 ? (
        <EmptyState>
          <p>{t.myEvents.empty}</p>
          <Link href="/" className={`${buttonStyles({ variant: "outline" })} mt-4`}>
            {t.home.browseEvents}
          </Link>
        </EmptyState>
      ) : (
        <>
          {section(t.myEvents.upcoming, upcoming, false)}
          {section(t.myEvents.past, past, true)}
        </>
      )}
    </div>
  );
}
