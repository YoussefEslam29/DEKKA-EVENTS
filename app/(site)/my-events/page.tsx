import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/rbac";
import { getMyReservations, eventTitle } from "@/lib/data";
import { formatMoney, formatWhen } from "@/lib/format";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui/Surface";
import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { cafeNightKey, hasEnded } from "@/lib/staff";
import { DoorCodeButton } from "@/components/DoorCodeButton";
import { CancelReservationButton } from "@/components/CancelReservationButton";
import { EventShareActions } from "@/components/EventShareActions";
import { isDemo } from "@/lib/demo";
import { demoReservations } from "@/lib/demo-fixtures";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.myEvents.title, path: "/my-events", noindex: true });
}

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const { locale, t } = await getI18n();
  // Demo mode (PLAN/DEKKA_PWA_APP.md §5.4, 4c.3): sample spots with door codes, even
  // signed out, so the pitch can show this screen on any phone.
  const demo = await isDemo();
  const user = await currentUser();
  if (!user && !demo) redirect("/login?next=/my-events");

  const rows = demo ? demoReservations() : await getMyReservations(user!.id);
  // "Upcoming" lasts until the night has *ended*, not until it starts: the guest needs
  // their door code at 20:05, when a night that started at 20:00 used to have moved to
  // "past" already. Soonest first; past reads most-recent-first.
  const now = new Date();
  const tonightKey = cafeNightKey(now);
  const upcoming = rows
    .filter((r) => !hasEnded(r.event.startsAt, now))
    .sort(
      (a, b) =>
        new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime()
    );
  const past = rows.filter((r) => hasEnded(r.event.startsAt, now));

  // No `dim` flag any more: fading the past section dropped its already-muted
  // text to ~3.5:1. The section heading is what separates past from upcoming.
  const section = (title: string, items: typeof rows, ahead: boolean) =>
    items.length === 0 ? null : (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-text-muted">{title}</h2>
        <div className="grid gap-3">
          {items.map(({ reservation, event }) => (
            <Card key={reservation.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="text-lg font-bold hover:text-gold-accent"
                    >
                      {eventTitle(event, locale)}
                    </Link>
                    {ahead && cafeNightKey(event.startsAt) === tonightKey ? (
                      <Badge tone="gold">{t.myEvents.tonightBadge}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatWhen(event.startsAt, locale)}
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
              {ahead ? (
                <div className="mt-4 grid gap-3 border-t border-border-dark pt-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                  <div className="flex flex-wrap items-center gap-2">
                    <DoorCodeButton
                      code={reservation.code}
                      title={eventTitle(event, locale)}
                      when={formatWhen(event.startsAt, locale)}
                    />
                    {!event.isPast ? (
                      <CancelReservationButton reservationId={reservation.id} title={eventTitle(event, locale)} />
                    ) : null}
                  </div>
                  {/* A sample night has no real calendar file to offer. */}
                  {demo ? null : <EventShareActions event={event} locale={locale} t={t} share={false} />}
                </div>
              ) : null}
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
          {section(t.myEvents.upcoming, upcoming, true)}
          {section(t.myEvents.past, past, false)}
        </>
      )}
    </div>
  );
}
