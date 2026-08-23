import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import {
  getAdminOverview,
  getPublicEvents,
  getAllEvents,
  getAllReservations,
  getSubmissions,
  countReservationsForEvents,
} from "@/lib/data";
import { monthKey } from "@/lib/format";
import { PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { buttonStyles } from "@/components/ui/Button";
import { AdminOverviewTabs, isOverviewTab } from "@/components/AdminOverviewTabs";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { t } = await getI18n();
  const { tab } = await searchParams;

  // All four slices up front, in parallel: the tabs are a client-side toggle, so
  // a per-tab fetch would only add a waterfall the reader would feel on every
  // switch. At cafe scale each of these is a small, capped query.
  const [overview, upcoming, allEvents, reservations, submissions] = await Promise.all([
    getAdminOverview(),
    getPublicEvents({ when: "upcoming", limit: 5 }),
    getAllEvents(),
    getAllReservations(),
    getSubmissions("pending"),
  ]);

  const drafts = allEvents.filter((event) => event.status === "draft");
  const reservationCounts = await countReservationsForEvents(upcoming.map((e) => e.id));

  return (
    <div>
      <FadeUp>
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
      </FadeUp>

      <AdminOverviewTabs
        initialTab={isOverviewTab(tab) ? tab : "upcoming"}
        counts={{
          upcoming: overview.upcoming,
          drafts: overview.drafts,
          reservations: overview.totalReservations,
          submissions: overview.pendingSubmissions,
        }}
        upcoming={upcoming}
        reservationCounts={reservationCounts}
        drafts={drafts}
        reservations={reservations}
        submissions={submissions}
      />
    </div>
  );
}
