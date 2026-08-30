import { formatDate, formatTime, formatMoney, formatNumber } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { EventReportData } from "@/lib/data";
import type { ReportAnalytics } from "@/lib/report/analytics";

/**
 * The locale-shaped, presentation-ready view of a report, built once and
 * consumed by both outputs: `lib/report/html.ts` (the PDF) and
 * `toSheetValues()` below (the Google Sheet). Keeping this in one place is
 * what guarantees the PDF and the Sheet always say the same thing
 * (Admin_Event_PDF.md §5 "the same underlying data").
 *
 * Cells are `string | number`: money amounts and arrival counts stay numeric
 * so the admin can actually sort and total them in the Sheet; everything else
 * is a localized string.
 */
export type Cell = string | number;

export type ReportView = {
  title: string;
  subtitle: string;
  generatedNote: string;
  summary: { heading: string; items: { label: string; value: string }[] }[];
  timing: { heading: string; columns: [string, string]; rows: [string, number][]; empty: string };
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

  const summary: ReportView["summary"] = [
    {
      heading: r.money,
      items: [
        { label: r.totalRevenue, value: money(m.total, locale, t) },
        {
          label: t.event.cash,
          value: `${money(m.byMethod.cash, locale, t)} · ${pct(m.pctByMethod.cash, locale)}`,
        },
        {
          label: t.event.instapay,
          value: `${money(m.byMethod.instapay, locale, t)} · ${pct(m.pctByMethod.instapay, locale)}`,
        },
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
        { label: r.noShowRate, value: pct(a.noShowRate, locale) },
        { label: r.walkInRate, value: pct(a.walkInRate, locale) },
      ],
    },
    {
      heading: r.capacity,
      items: [{ label: r.capacity, value: capacityValue }],
    },
  ];

  const timing: ReportView["timing"] = {
    heading: r.timing,
    columns: [r.timeWindow, r.arrivals],
    rows: analytics.timing.map((w) => [w.window, w.count] as [string, number]),
    empty: r.noArrivals,
  };

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
    generatedNote: r.generatedAt
      .replace("{time}", `${formatDate(generatedAt, locale)} · ${formatTime(generatedAt, locale)}`),
    summary,
    timing,
    people,
  };
}

/** Flattens the view into the 2-D value grid the Sheet is written from. */
export function toSheetValues(view: ReportView): Cell[][] {
  const rows: Cell[][] = [];
  rows.push([view.title]);
  rows.push([view.subtitle]);
  rows.push([view.generatedNote]);
  rows.push([]);

  for (const section of view.summary) {
    rows.push([section.heading]);
    for (const item of section.items) rows.push([item.label, item.value]);
    rows.push([]);
  }

  rows.push([view.timing.heading]);
  rows.push([view.timing.columns[0], view.timing.columns[1]]);
  if (view.timing.rows.length === 0) {
    rows.push([view.timing.empty]);
  } else {
    for (const tr of view.timing.rows) rows.push([tr[0], tr[1]]);
  }
  rows.push([]);

  rows.push([view.people.heading]);
  rows.push(view.people.columns);
  if (view.people.rows.length === 0) {
    rows.push([view.people.empty]);
  } else {
    for (const pr of view.people.rows) rows.push(pr);
  }

  return rows;
}
