import { Suspense } from "react";
import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import {
  getAdminOverview,
  getAllEvents,
  getAllReservations,
  getSubmissions,
  countReservationsForEvents,
} from "@/lib/data";
import { monthKey } from "@/lib/format";
import { PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { buttonStyles } from "@/components/ui/Button";
import {
  AdminOverviewTabs,
  type OverviewTab,
} from "@/components/AdminOverviewTabs";

export const dynamic = "force-dynamic";

const TABS = ["upcoming", "drafts", "reservations", "submissions"] as const;

/**
 * The admin overview (`PLAN/FIX_ADMIN_DASH.md` §3).
 *
 * Every slice the four tabs can show is fetched here, in one parallel pass,
 * and handed down — so switching tabs costs nothing and there is no per-tab
 * spinner. That is affordable precisely because these are small, capped
 * queries at cafe scale; if any of them ever stops being small, this is the
 * place to split them back out into per-tab fetches.
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { t } = await getI18n();
  const { tab } = await searchParams;
  const active: OverviewTab = TABS.includes(tab as OverviewTab)
    ? (tab as OverviewTab)
    : "upcoming";

  const [overview, allEvents, reservations, submissions] = await Promise.all([
    getAdminOverview(),
    getAllEvents(),
    getAllReservations({ limit: 200 }),
    getSubmissions("pending"),
  ]);

  // Rendered once per request (async server component, `force-dynamic`), so there is no
  // re-render for this to destabilise -- "now" is request time by design.
  // eslint-disable-next-line react-hooks/purity -- see above
  const now = Date.now();
  const upcoming = allEvents
    .filter(
      (event) =>
        event.status === "published" && new Date(event.startsAt).getTime() >= now
    )
    // `getAllEvents` sorts newest-first, which is right for a management table
    // and wrong for "what's coming up" — soonest first is the useful order here.
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const drafts = allEvents.filter((event) => event.status === "draft");

  // One aggregation for both lists rather than one per tab.
  const counts = await countReservationsForEvents(
    [...upcoming, ...drafts].map((event) => event.id)
  );

  return (
    <div>
      <FadeUp>
        <PageHeader
          title={t.admin.title}
          action={
            <div className="flex gap-2">
              <Link
                href="/admin/events/new"
                className={buttonStyles({ variant: "lightPrimary" })}
              >
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

      {/* `useSearchParams` inside the tabs needs a boundary to suspend at. */}
      <Suspense fallback={null}>
        <AdminOverviewTabs
          active={active}
          counts={{
            upcoming: overview.upcoming,
            drafts: overview.drafts,
            reservations: overview.totalReservations,
            submissions: overview.pendingSubmissions,
          }}
          upcoming={upcoming}
          drafts={drafts}
          reservations={reservations}
          submissions={submissions}
          reservationCounts={counts}
        />
      </Suspense>
    </div>
  );
}
