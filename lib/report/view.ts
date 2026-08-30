import { formatDate, formatTime, formatMoney, formatNumber } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { EventReportData } from "@/lib/data";
import type { ReportAnalytics } from "@/lib/report/analytics";

/**
 * The locale-shaped, presentation-ready view of a report — built once by
 * `buildReportView()` and rendered to PDF by `lib/report/html.ts`
 * (Admin_Event_PDF.md §5/§6). Every string here is already localized and
 * every number is display-ready; `html.ts` does layout only, no formatting
 * and no dictionary access.
 */
export type Cell = string | number;

export type ReportView = {
  title: string;
  subtitle: string;
  generatedNote: string;
  /** The four headline figures, big, across the top. */
  stats: { label: string; value: string }[];
  charts: {
    arrivalsHeading: string;
    /** `count` drives the bar height; `countLabel` is what's printed on it. */
    arrivals: { window: string; count: number; countLabel: string }[];
    arrivalsEmpty: string;
    paymentHeading: string;
    payment: { key: "cash" | "instapay"; value: number; legend: string }[];
    paymentEmpty: string;
    attendanceHeading: string;
    attendance: { key: "attended" | "walkin" | "noshow"; value: number; legend: string }[];
    attendanceEmpty: string;
  };
  detailsHeading: string;
  summary: { heading: string; items: { label: string; value: string }[] }[];
  people: { heading: string; columns: string[]; rows: Cell[][]; empty: string };
};

function pct(value: number, locale: Locale): string {
  return `${formatNumber(Math.round(value * 100), locale)}%`;
}

function money(value: number, locale: Locale, t: Dict): string {
  return `${formatMoney(value, locale)} ${t.common.egp}`;
}

export function eventReportTitle(data: EventReportData, locale: Locale, t: Dict): string {
  const name =
    locale === "ar"
      ? data.event.titleAr || data.event.titleEn
      : data.event.titleEn || data.event.titleAr;
  return `${t.admin.eventReport.docTitle} — ${name} — ${formatDate(data.event.startsAt, locale)}`;
}

export function buildReportView(
  data: EventReportData,
  analytics: ReportAnalytics,
  locale: Locale,
  t: Dict,
  generatedAt: Date
): ReportView {
  const r = t.admin.eventReport;
  const { money: m, attendance: a, capacity: c } = analytics;

  const capacityValue =
    c.limit == null
      ? r.noCapacity
      : r.spotsFilled
          .replace("{filled}", formatNumber(c.filled, locale))
          .replace("{capacity}", formatNumber(c.limit, locale))
          .replace("{pct}", c.pct == null ? "—" : pct(c.pct, locale));

  const stats: ReportView["stats"] = [
    { label: r.totalRevenue, value: money(m.total, locale, t) },
    { label: r.totalAttendees, value: formatNumber(a.totalAttendees, locale) },
    { label: r.noShowRate, value: pct(a.noShowRate, locale) },
    c.pct == null
      ? { label: r.walkInRate, value: pct(a.walkInRate, locale) }
      : { label: r.fillRate, value: pct(c.pct, locale) },
  ];

  const charts: ReportView["charts"] = {
    arrivalsHeading: r.timing,
    arrivals: analytics.timing.map((w) => ({
      window: w.window,
      count: w.count,
      countLabel: formatNumber(w.count, locale),
    })),
    arrivalsEmpty: r.noArrivals,
    paymentHeading: r.money,
    payment: [
      {
        key: "cash",
        value: m.byMethod.cash,
        legend: `${t.event.cash} · ${money(m.byMethod.cash, locale, t)} · ${pct(m.pctByMethod.cash, locale)}`,
      },
      {
        key: "instapay",
        value: m.byMethod.instapay,
        legend: `${t.event.instapay} · ${money(m.byMethod.instapay, locale, t)} · ${pct(m.pctByMethod.instapay, locale)}`,
      },
    ],
    paymentEmpty: r.noPayments,
    attendanceHeading: r.attendance,
    attendance: [
      {
        key: "attended",
        value: a.attended,
        legend: `${r.statusAttended} · ${formatNumber(a.attended, locale)}`,
      },
      {
        key: "walkin",
        value: a.walkIns,
        legend: `${r.statusWalkIn} · ${formatNumber(a.walkIns, locale)}`,
      },
      {
        key: "noshow",
        value: a.noShows,
        legend: `${r.statusNoShow} · ${formatNumber(a.noShows, locale)}`,
      },
    ],
    attendanceEmpty: r.noPeople,
  };

  const summary: ReportView["summary"] = [
    {
      heading: r.money,
      items: [
        { label: r.totalRevenue, value: money(m.total, locale, t) },
        { label: t.event.cash, value: money(m.byMethod.cash, locale, t) },
        { label: t.event.instapay, value: money(m.byMethod.instapay, locale, t) },
        { label: r.avgPerAttendee, value: money(m.avgPerAttendee, locale, t) },
      ],
    },
    {
      heading: r.attendance,
      items: [
        { label: r.reserved, value: formatNumber(a.reserved, locale) },
        { label: r.attended, value: formatNumber(a.attended, locale) },
        { label: r.noShows, value: formatNumber(a.noShows, locale) },
        { label: r.walkIns, value: formatNumber(a.walkIns, locale) },
        { label: r.totalAttendees, value: formatNumber(a.totalAttendees, locale) },
      ],
    },
    {
      heading: r.capacity,
      items: [{ label: r.capacity, value: capacityValue }],
    },
  ];

  const statusLabel: Record<string, string> = {
    attended: r.statusAttended,
    "no-show": r.statusNoShow,
    "walk-in": r.statusWalkIn,
  };

  const people: ReportView["people"] = {
    heading: r.people,
    columns: [
      r.colName,
      r.colPhone,
      r.colReserved,
      r.colCode,
      r.colCheckedIn,
      r.colStatus,
      r.colMethod,
      r.colAmount,
      r.colCheckInTime,
    ],
    rows: data.rows.map((row) => [
      row.name,
      row.phone,
      row.reserved ? t.common.yes : t.common.no,
      row.code,
      row.checkedIn ? t.common.yes : t.common.no,
      statusLabel[row.status] ?? row.status,
      row.paymentMethod
        ? row.paymentMethod === "cash"
          ? t.event.cash
          : t.event.instapay
        : "",
      row.amount == null ? "" : row.amount,
      row.checkInAt ? formatTime(row.checkInAt, locale) : "",
    ]),
    empty: r.noPeople,
  };

  return {
    title: eventReportTitle(data, locale, t),
    subtitle: `${formatDate(data.event.startsAt, locale)} · ${formatTime(data.event.startsAt, locale)}`,
    generatedNote: r.generatedAt.replace(
      "{time}",
      `${formatDate(generatedAt, locale)} · ${formatTime(generatedAt, locale)}`
    ),
    stats,
    charts,
    detailsHeading: r.details,
    summary,
    people,
  };
}
