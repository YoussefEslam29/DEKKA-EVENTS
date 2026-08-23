"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "@/components/I18nProvider";
import { useMotionPresets } from "@/lib/motion";
import { eventTitle, type EventDTO, type ReservationDTO, type SubmissionDTO } from "@/lib/data";
import { formatDate, formatShortDate } from "@/lib/format";
import { Card, Badge, EmptyState } from "@/components/ui/Surface";
import { SubmissionRow } from "@/components/SubmissionRow";
import { cn } from "@/lib/utils";

/**
 * The overview's four slices, as tabs.
 *
 * These used to be four KPI tiles linking out to `/admin/events`, which meant
 * "Drafts" and "Upcoming" both landed on the same unfiltered table and the
 * reader had to find their own slice again. Each tile now switches a tab in
 * place and shows exactly the rows it counted.
 *
 * Everything is fetched server-side and passed in — switching tabs is a
 * visibility toggle, not a refetch, so it's instant.
 */

export type OverviewTab = "upcoming" | "drafts" | "reservations" | "submissions";

const TABS: OverviewTab[] = ["upcoming", "drafts", "reservations", "submissions"];

export function isOverviewTab(value: string | undefined): value is OverviewTab {
  return TABS.includes(value as OverviewTab);
}

type Props = {
  initialTab: OverviewTab;
  counts: Record<OverviewTab, number>;
  upcoming: EventDTO[];
  reservationCounts: Record<string, number>;
  drafts: EventDTO[];
  reservations: { reservation: ReservationDTO; event: EventDTO }[];
  submissions: SubmissionDTO[];
};

export function AdminOverviewTabs({
  initialTab,
  counts,
  upcoming,
  reservationCounts,
  drafts,
  reservations,
  submissions,
}: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pressable, tabIndicator, staggerContainer, staggerItem } = useMotionPresets();

  // The URL is the source of truth so Back and a pasted link both land right;
  // `initialTab` is the server's read of it, which keeps the first paint correct
  // instead of flashing the default tab before hydration.
  const fromUrl = searchParams.get("tab") ?? undefined;
  const active: OverviewTab = isOverviewTab(fromUrl) ? fromUrl : initialTab;

  function selectTab(tab: OverviewTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "upcoming") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `/admin?${query}` : "/admin", { scroll: false });
  }

  const labels: Record<OverviewTab, string> = {
    upcoming: t.home.upcoming,
    drafts: t.event.status.draft,
    reservations: t.admin.reservations,
    submissions: t.admin.submissions,
  };

  return (
    <div>
      {/* The tiles are the tab strip: same at-a-glance counts as before, but
          each one now opens the rows it's counting. */}
      <div
        role="tablist"
        aria-label={t.admin.overview}
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {TABS.map((tab) => {
          const selected = tab === active;
          return (
            <motion.button
              key={tab}
              type="button"
              role="tab"
              id={`overview-tab-${tab}`}
              aria-selected={selected}
              aria-controls={`overview-panel-${tab}`}
              onClick={() => selectTab(tab)}
              {...pressable}
              className="relative rounded-xl text-start"
            >
              {selected ? (
                <motion.span
                  {...tabIndicator("overviewTab")}
                  aria-hidden
                  className="absolute inset-0 rounded-xl bg-gold-wash ring-2 ring-gold"
                />
              ) : null}
              <Card
                className={cn(
                  "relative h-full bg-transparent p-4 transition-colors",
                  selected ? "border-transparent" : "hover:border-gold"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  {labels[tab]}
                </p>
                <p className="mt-1 text-3xl font-black">{counts[tab]}</p>
              </Card>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        key={active}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        role="tabpanel"
        id={`overview-panel-${active}`}
        aria-labelledby={`overview-tab-${active}`}
      >
        <h2 className="mb-3 text-lg font-bold">{labels[active]}</h2>

        {active === "upcoming" ? (
          upcoming.length === 0 ? (
            <EmptyState>{t.admin.noEvents}</EmptyState>
          ) : (
            <div className="grid gap-2">
              {upcoming.map((event) => (
                <motion.div key={event.id} variants={staggerItem}>
                  <Link href={`/admin/events/${event.id}`}>
                    <Card className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:border-gold">
                      <div>
                        <p className="font-bold">{eventTitle(event, locale)}</p>
                        <p className="text-sm text-ink-soft">
                          {formatDate(event.startsAt, locale)}
                        </p>
                      </div>
                      <p className="text-sm">
                        <span className="text-ink-faint">{t.admin.reservations}: </span>
                        <strong>{reservationCounts[event.id] ?? 0}</strong>
                        {event.capacity != null ? (
                          <span className="text-ink-faint"> / {event.capacity}</span>
                        ) : null}
                      </p>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )
        ) : null}

        {active === "drafts" ? (
          drafts.length === 0 ? (
            <EmptyState>{t.admin.noEvents}</EmptyState>
          ) : (
            <div className="grid gap-2">
              {drafts.map((event) => (
                <motion.div key={event.id} variants={staggerItem}>
                  <Link href={`/admin/events/${event.id}`}>
                    <Card className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:border-gold">
                      <div>
                        <p className="font-bold">{eventTitle(event, locale)}</p>
                        <p className="text-sm text-ink-soft">
                          {formatDate(event.startsAt, locale)}
                        </p>
                      </div>
                      <Badge tone="neutral">{t.event.status.draft}</Badge>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )
        ) : null}

        {active === "reservations" ? (
          reservations.length === 0 ? (
            <EmptyState>{t.common.none}</EmptyState>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream text-xs uppercase tracking-wider text-ink-faint">
                    <tr>
                      <th className="px-4 py-2 text-start font-semibold">{t.admin.events}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t.staff.name}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t.staff.phone}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t.event.yourCode}</th>
                      <th className="px-4 py-2 text-end font-semibold">{t.staff.checkedIn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(({ reservation, event }) => (
                      <motion.tr
                        key={reservation.id}
                        variants={staggerItem}
                        className="border-t border-line"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="font-semibold hover:text-gold-deep"
                          >
                            {eventTitle(event, locale)}
                          </Link>
                          <span className="block text-xs text-ink-faint">
                            {formatShortDate(event.startsAt, locale)}
                          </span>
                        </td>
                        <td className="px-4 py-2">{reservation.name}</td>
                        <td className="px-4 py-2">{reservation.phone}</td>
                        <td className="px-4 py-2 font-mono text-xs">{reservation.code}</td>
                        <td className="px-4 py-2 text-end">
                          {reservation.checkedIn ? (
                            <Badge tone="good">{t.staff.checkedIn}</Badge>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ) : null}

        {active === "submissions" ? (
          submissions.length === 0 ? (
            <EmptyState>{t.admin.noSubmissions}</EmptyState>
          ) : (
            <div className="grid gap-3">
              {submissions.map((submission) => (
                <motion.div key={submission.id} variants={staggerItem}>
                  <SubmissionRow submission={submission} />
                </motion.div>
              ))}
            </div>
          )
        ) : null}
      </motion.div>
    </div>
  );
}
