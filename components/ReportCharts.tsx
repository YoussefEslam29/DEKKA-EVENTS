"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/I18nProvider";
import { Card, EmptyState } from "@/components/ui/Surface";
import { useMotionPresets } from "@/lib/motion";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { MonthlyReport } from "@/lib/data";

/**
 * The month, drawn (`PLAN/FIX_ADMIN_DASH.md` §5).
 *
 * Additive on purpose: the per-event table underneath stays exactly where it
 * was. A chart is not readable by a screen reader and cannot be copied into a
 * message, so it earns its place beside the numbers rather than in place of
 * them.
 *
 * Colours are the workspace tokens from `design-system/01-colors.md` — gold for
 * money, coffee ink for people — so the charts sit inside the brand instead of
 * importing a chart library's default palette. Series are also labelled
 * directly, never distinguished by colour alone.
 */

/** Straight from `app/globals.css`'s `@theme` block. */
const COLORS = {
  gold: "#c08b4a",
  goldDeep: "#9a6b33",
  ink: "#241611",
  inkSoft: "#4a342a",
  inkFaint: "#8a7466",
  line: "#e2d6c2",
  paper: "#fffbf3",
} as const;

const AXIS_TICK = { fill: COLORS.inkFaint, fontSize: 11 };

export function ReportCharts({ report }: { report: MonthlyReport }) {
  const { t, locale } = useI18n();
  const { reduced } = useMotionPresets();
  const rtl = locale === "ar";

  const perEvent = useMemo(
    () =>
      report.events.map((event) => ({
        id: event.id,
        name:
          (locale === "ar"
            ? event.titleAr || event.titleEn
            : event.titleEn || event.titleAr) || "—",
        date: formatShortDate(event.startsAt, locale),
        revenue: event.revenue,
        attendees: event.attendees,
      })),
    [report.events, locale]
  );

  const split = useMemo(
    () =>
      [
        { key: "cash", name: t.event.cash, value: report.byMethod.cash, fill: COLORS.gold },
        {
          key: "instapay",
          name: t.event.instapay,
          value: report.byMethod.instapay,
          fill: COLORS.inkSoft,
        },
      ].filter((slice) => slice.value > 0),
    [report.byMethod, t]
  );

  // A month with no events at all gets one honest message rather than three
  // empty axis frames.
  if (perEvent.length === 0) {
    return (
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
          {t.charts.title}
        </h2>
        <EmptyState>{t.charts.noData}</EmptyState>
      </Card>
    );
  }

  const money = (value: number) => `${formatMoney(value, locale)} ${t.common.egp}`;

  const tooltipStyle = {
    background: COLORS.paper,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    fontSize: 12,
    color: COLORS.ink,
  } as const;

  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-3">
      {/* Discrete event-nights, not a continuous series — bars, not a line. */}
      <Card className="p-4 lg:col-span-2">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-faint">
          {t.charts.revenueByEvent}
        </h2>
        <p className="dk-muted mb-3 text-xs">{t.charts.revenueAxis}</p>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perEvent} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: COLORS.line }}
                reversed={rtl}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={56}
                orientation={rtl ? "right" : "left"}
                tickFormatter={(value: unknown) => formatMoney(Number(value), locale)}
              />
              {/* Formatters take `unknown` deliberately: recharts types their
                  value as a broad union, and a narrower parameter would not be
                  assignable under `strictFunctionTypes`. */}
              <Tooltip
                cursor={{ fill: `${COLORS.gold}1a` }}
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [money(Number(value)), t.admin.revenue]}
                labelFormatter={(_label: unknown, payload: readonly { payload?: { name?: string } }[]) =>
                  payload?.[0]?.payload?.name ?? ""
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: COLORS.inkSoft }}
                formatter={() => t.admin.revenue}
              />
              <Bar
                dataKey="revenue"
                name={t.admin.revenue}
                fill={COLORS.gold}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!reduced}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Two categories only, which is well inside where a donut still reads. */}
      <Card className="p-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-faint">
          {t.admin.byMethod}
        </h2>
        <p className="dk-muted mb-3 text-xs">{t.charts.splitAxis}</p>
        {split.length === 0 ? (
          <EmptyState className="py-8">{t.admin.noRevenue}</EmptyState>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={split}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke={COLORS.paper}
                  strokeWidth={2}
                  isAnimationActive={!reduced}
                >
                  {split.map((slice) => (
                    <Cell key={slice.key} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown, name: unknown) => [
                    money(Number(value)),
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: COLORS.inkSoft }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Horizontal: event names are long, and they stay readable on a phone
          this way where rotated vertical labels would not. */}
      <Card className="p-4 lg:col-span-3">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-faint">
          {t.charts.attendeesByEvent}
        </h2>
        <p className="dk-muted mb-3 text-xs">{t.charts.attendeesAxis}</p>
        <div
          dir="ltr"
          // Grows with the data instead of squeezing 20 nights into 256px.
          style={{ height: Math.max(200, perEvent.length * 38 + 48) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={perEvent}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke={COLORS.line} horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: COLORS.line }}
                reversed={rtl}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={140}
                orientation={rtl ? "right" : "left"}
              />
              <Tooltip
                cursor={{ fill: `${COLORS.inkSoft}12` }}
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [Number(value), t.admin.attendees]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: COLORS.inkSoft }}
                formatter={() => t.admin.attendees}
              />
              <Bar
                dataKey="attendees"
                name={t.admin.attendees}
                fill={COLORS.inkSoft}
                radius={[0, 4, 4, 0]}
                isAnimationActive={!reduced}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
