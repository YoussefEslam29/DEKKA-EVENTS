import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getAdminOverview, getPublicEvents, countReservationsForEvents, eventTitle } from "@/lib/data";
import { formatDate, monthKey } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui/Surface";
import { buttonStyles } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { locale, t } = await getI18n();
  const [overview, upcoming] = await Promise.all([
    getAdminOverview(),
    getPublicEvents({ when: "upcoming", limit: 5 }),
  ]);
  const counts = await countReservationsForEvents(upcoming.map((e) => e.id));

  const tiles = [
    { label: t.home.upcoming, value: overview.upcoming, href: "/admin/events" },
    { label: t.event.status.draft, value: overview.drafts, href: "/admin/events" },
    { label: t.admin.reservations, value: overview.totalReservations, href: "/admin/events" },
    {
      label: t.admin.submissions,
      value: overview.pendingSubmissions,
      href: "/admin/submissions",
    },
  ];

  return (
    <div>
      <PageHeader
        title={t.admin.title}
        action={
          <div className="flex gap-2">
            <Link href="/admin/events/new" className={buttonStyles({ variant: "lightPrimary" })}>
              {t.admin.newEvent}
            </Link>
            <Link
              href={`/admin/report?month=${monthKey(new Date())}`}
              className={buttonStyles({ variant: "lightOutline" })}
            >
              {t.admin.report}
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="p-4 transition-colors hover:border-gold">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {tile.label}
              </p>
              <p className="mt-1 text-3xl font-black">{tile.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold">{t.home.upcoming}</h2>
      {upcoming.length === 0 ? (
        <EmptyState>{t.admin.noEvents}</EmptyState>
      ) : (
        <div className="grid gap-2">
          {upcoming.map((event) => (
            <Link key={event.id} href={`/admin/events/${event.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:border-gold">
                <div>
                  <p className="font-bold">{eventTitle(event, locale)}</p>
                  <p className="text-sm text-ink-soft">
                    {formatDate(event.startsAt, locale)}
                  </p>
                </div>
                <p className="text-sm">
                  <span className="text-ink-faint">{t.admin.reservations}: </span>
                  <strong>{counts[event.id] ?? 0}</strong>
                  {event.capacity != null ? (
                    <span className="text-ink-faint"> / {event.capacity}</span>
                  ) : null}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
