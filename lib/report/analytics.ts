import { CAFE_TIMEZONE } from "@/lib/format";
import type { EventReportData, ReportPersonRow } from "@/lib/data";
import type { PaymentMethod } from "@/lib/constants";

/**
 * The "Analytics" section of the report (Admin_Event_PDF.md §6), derived
 * purely from the merged per-person list in `EventReportData`. No database
 * access, no clock reads — the same input always gives the same output, so
 * this is trivial to check against a real event's door table by hand.
 */
export type ReportAnalytics = {
  money: {
    total: number;
    byMethod: Record<PaymentMethod, number>;
    /** Share of `total` per method, 0–1 (0 when nothing was collected). */
    pctByMethod: Record<PaymentMethod, number>;
    /** `total` ÷ people who actually attended (0 when nobody did). */
    avgPerAttendee: number;
  };
  attendance: {
    reserved: number;
    attended: number;
    noShows: number;
    walkIns: number;
    /** attended + walk-ins — everyone through the door. */
    totalAttendees: number;
    /** no-shows ÷ reservations, 0–1 (0 when nobody reserved). */
    noShowRate: number;
    /** walk-ins ÷ total attendees, 0–1 (0 when nobody attended). */
    walkInRate: number;
  };
  capacity: {
    /** null when the event has no cap — it never goes "Full". */
    limit: number | null;
    filled: number;
    /** filled ÷ limit, 0–1 — null when there's no cap. */
    pct: number | null;
  };
  /** Arrivals bucketed into half-hour windows, cafe time, earliest first. */
  timing: { window: string; count: number }[];
};

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "instapay"];

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** "HH:MM" start of the half-hour `iso` falls in, in cafe local time. */
function halfHourWindow(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAFE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return `${hour}:${minute < 30 ? "00" : "30"}`;
}

export function computeAnalytics(data: EventReportData): ReportAnalytics {
  const { rows } = data;
  const attendees = rows.filter((r) => r.checkedIn);

  const byMethod: Record<PaymentMethod, number> = { cash: 0, instapay: 0 };
  for (const r of attendees) {
    if (r.paymentMethod) byMethod[r.paymentMethod] += r.amount ?? 0;
  }
  const total = byMethod.cash + byMethod.instapay;

  const reserved = rows.filter((r) => r.reserved).length;
  const attended = rows.filter((r) => r.status === "attended").length;
  const noShows = rows.filter((r) => r.status === "no-show").length;
  const walkIns = rows.filter((r) => r.status === "walk-in").length;
  const totalAttendees = attendees.length;

  const timingMap = new Map<string, number>();
  for (const r of attendees) {
    if (!r.checkInAt) continue;
    const w = halfHourWindow(r.checkInAt);
    timingMap.set(w, (timingMap.get(w) ?? 0) + 1);
  }
  const timing = [...timingMap.entries()]
    .map(([window, count]) => ({ window, count }))
    .sort((a, b) => a.window.localeCompare(b.window));

  const limit = data.event.capacity;

  return {
    money: {
      total,
      byMethod,
      pctByMethod: {
        cash: ratio(byMethod.cash, total),
        instapay: ratio(byMethod.instapay, total),
      },
      avgPerAttendee: ratio(total, totalAttendees),
    },
    attendance: {
      reserved,
      attended,
      noShows,
      walkIns,
      totalAttendees,
      noShowRate: ratio(noShows, reserved),
      walkInRate: ratio(walkIns, totalAttendees),
    },
    capacity: {
      limit,
      filled: totalAttendees,
      pct: limit && limit > 0 ? ratio(totalAttendees, limit) : null,
    },
    timing,
  };
}

export type { EventReportData, ReportPersonRow };
export { PAYMENT_METHODS };
