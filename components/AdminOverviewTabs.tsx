"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "@/components/I18nProvider";
import { Card, Badge, EmptyState } from "@/components/ui/Surface";
import { useMotionPresets } from "@/lib/motion";
import { formatDate, formatShortDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventDTO, ReservationRowDTO, SubmissionDTO } from "@/lib/data";

export type OverviewTab = "upcoming" | "drafts" | "reservations" | "submissions";

const TABS: OverviewTab[] = ["upcoming", "drafts", "reservations", "submissions"];

const statusTone = {
  draft: "neutral",
  published: "good",
  closed: "warn",
  happened: "gold",
  archived: "neutral",
} as const;

type Props = {
  active: OverviewTab;
  counts: Record<OverviewTab, number>;
  upcoming: EventDTO[];
  drafts: EventDTO[];
  reservations: ReservationRowDTO[];
  submissions: SubmissionDTO[];
  reservationCounts: Record<string, number>;
};

/**
 * The overview, as four real slices (`PLAN/FIX_ADMIN_DASH.md` §3).
 *
 * The tiles used to be links that all landed on the same unfiltered events
 * list, so "Drafts" and "Upcoming" showed identical screens. Now a tile *is*
 * the tab: every slice is fetched on the server up front and passed in, so
 * switching is an instant client-side toggle with no second round trip and no
 * loading state to sit through.
 *
 * The active tab lives in `?tab=`, which keeps it shareable and puts it in
 * real browser history — so `BackButton`'s `router.back()` returns to the tab
 * you drilled in from, not to a reset overview.
 */
export function AdminOverviewTabs({
  active,
  counts,
  upcoming,
  drafts,
  reservations,
  submissions,
  reservationCounts,
}: Props) {
  const { t, locale } = useI18n();
  const { tabIndicator, pressable, staggerContainer, staggerItem } = useMotionPresets();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const labels: Record<OverviewTab, string> = useMemo(
    () => ({
      upcoming: t.home.upcoming,
      drafts: t.event.status.draft,
      reservations: t.admin.reservations,
      submissions: t.admin.submissions,
    }),
    [t]
  );

  const select = useCallback(
    (tab: OverviewTab) => {
      const params = new URLSearchParams(searchParams.toString());
      // "upcoming" is the default, so leave it out of the URL rather than
      // pinning ?tab=upcoming onto every visit.
      if (tab === "upcoming") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      // `scroll: false` because the tab panel sits below the fold on a short
      // window and jumping to the top on every switch is disorienting.
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const eventTitleOf = (event: EventDTO) =>
    locale === "ar" ? event.titleAr || event.titleEn : event.titleEn || event.titleAr;

  const reservationEventTitle = (row: ReservationRowDTO) =>
    locale === "ar"
      ? row.eventTitleAr || row.eventTitleEn
      : row.eventTitleEn || row.eventTitleAr;

  return (
    <div>
      {/* The tiles double as the tab strip: same at-a-glance counts as before,
          but clicking one now switches the panel instead of navigating away. */}
      <motion.div
        role="tablist"
        aria-label={t.admin.title}
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
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
              aria-controls="overview-panel"
              onClick={() => select(tab)}
              variants={staggerItem}
              {...pressable}
              className={cn(
                "dk-card relative min-h-11 p-4 text-start transition-colors",
                selected ? "border-gold" : "hover:border-gold/60"
              )}
            >
              {selected ? (
                <motion.span
                  {...tabIndicator("overviewTab")}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gold"
                />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {labels[tab]}
              </p>
              <p className="mt-1 text-3xl font-black">{counts[tab]}</p>
            </motion.button>
          );
        })}
      </motion.div>

      <div
        id="overview-panel"
        role="tabpanel"
        aria-labelledby={`overview-tab-${active}`}
        tabIndex={-1}
      >
        <h2 className="mb-3 text-lg font-bold">{labels[active]}</h2>

        {active === "upcoming" ? (
          <EventList
            events={upcoming}
            counts={reservationCounts}
            empty={t.admin.noEvents}
            reservationsLabel={t.admin.reservations}
            statusLabels={t.event.status}
            titleOf={eventTitleOf}
            locale={locale}
          />
        ) : null}

        {active === "drafts" ? (
          <EventList
            events={drafts}
            counts={reservationCounts}
            empty={t.admin.noDrafts}
            reservationsLabel={t.admin.reservations}
            statusLabels={t.event.status}
            titleOf={eventTitleOf}
            locale={locale}
          />
        ) : null}

        {active === "reservations" ? (
          reservations.length === 0 ? (
            <EmptyState>{t.admin.noReservations}</EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="dk-thead text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-start font-semibold">
                      {t.staff.name}
                    </th>
                    <th scope="col" className="px-4 py-2 text-start font-semibold">
                      {t.staff.phone}
                    </th>
                    <th scope="col" className="px-4 py-2 text-start font-semibold">
                      {t.event.yourCode}
                    </th>
                    <th scope="col" className="px-4 py-2 text-start font-semibold">
                      {t.admin.events}
                    </th>
                    <th scope="col" className="px-4 py-2 text-end font-semibold">
                      {t.staff.checkedIn}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((row) => (
                    <tr key={row.id} className="dk-hairline border-t">
                      <td className="px-4 py-2 font-semibold">{row.name}</td>
                      <td className="px-4 py-2" dir="ltr">
                        {row.phone}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs" dir="ltr">
                        {row.code}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/events/${row.eventId}`}
                          className="font-semibold hover:text-gold-deep"
                        >
                          {reservationEventTitle(row) || "—"}
                        </Link>
                        <span className="dk-muted block text-xs">
                          {row.eventStartsAt
                            ? formatShortDate(row.eventStartsAt, locale)
                            : ""}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-end">
                        {row.checkedIn ? (
                          <Badge tone="good">{t.staff.checkedIn}</Badge>
                        ) : (
                          <Badge tone="neutral">{t.common.no}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
        ) : null}

        {active === "submissions" ? (
          submissions.length === 0 ? (
            <EmptyState>{t.admin.noSubmissions}</EmptyState>
          ) : (
            <div className="grid gap-2">
              {submissions.map((submission) => (
                <Link key={submission.id} href="/admin/submissions">
                  <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{submission.bandName}</p>
                      <p className="dk-muted text-sm">
                        {submission.genre || submission.contactName}
                      </p>
                    </div>
                    <Badge tone="warn">{t.submit.status[submission.status]}</Badge>
                  </Card>
                </Link>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

/** Shared by the Upcoming and Drafts panels — same row, different slice. */
function EventList({
  events,
  counts,
  empty,
  reservationsLabel,
  statusLabels,
  titleOf,
  locale,
}: {
  events: EventDTO[];
  counts: Record<string, number>;
  empty: string;
  reservationsLabel: string;
  statusLabels: Record<EventDTO["status"], string>;
  titleOf: (event: EventDTO) => string;
  locale: "ar" | "en";
}) {
  if (events.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <Link key={event.id} href={`/admin/events/${event.id}`}>
          <Card className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:border-gold">
            <div className="min-w-0">
              <p className="truncate font-bold">{titleOf(event)}</p>
              <p className="dk-muted text-sm">{formatDate(event.startsAt, locale)}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Badge tone={statusTone[event.status]}>{statusLabels[event.status]}</Badge>
              <p>
                <span className="text-ink-faint">{reservationsLabel}: </span>
                <strong>{counts[event.id] ?? 0}</strong>
                {event.capacity != null ? (
                  <span className="text-ink-faint"> / {event.capacity}</span>
                ) : null}
              </p>
              <p className="dk-muted hidden sm:block">
                {event.price > 0 ? formatMoney(event.price, locale) : ""}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
