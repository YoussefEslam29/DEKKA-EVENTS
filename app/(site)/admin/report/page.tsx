import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getMonthlyReport } from "@/lib/data";
import { formatMoney, formatShortDate, monthKey, formatMonth } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { MonthPicker } from "@/components/MonthPicker";

export const dynamic = "force-dynamic";

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale, t } = await getI18n();
  const { month: requested } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(requested ?? "")
    ? (requested as string)
    : monthKey(new Date());

  const report = await getMonthlyReport(month);

  const tiles = [
    {
      label: t.admin.totalRevenue,
      value: `${formatMoney(report.totalRevenue, locale)} ${t.common.egp}`,
    },
    { label: t.admin.totalAttendees, value: String(report.totalAttendees) },
    { label: t.admin.eventsCount, value: String(report.events.length) },
  ];

  return (
    <div>
      <FadeUp>
        <PageHeader
          title={`${t.admin.report} — ${formatMonth(month, locale)}`}
          action={<MonthPicker month={month} />}
        />

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <Card key={tile.label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {tile.label}
              </p>
              <p className="mt-1 text-2xl font-black">{tile.value}</p>
            </Card>
          ))}
        </div>
      </FadeUp>

      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
          {t.admin.byMethod}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t.event.cash}</span>
            <span className="font-black">
              {formatMoney(report.byMethod.cash, locale)} {t.common.egp}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t.event.instapay}</span>
            <span className="font-black">
              {formatMoney(report.byMethod.instapay, locale)} {t.common.egp}
            </span>
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-bold">{t.admin.perEvent}</h2>
      {report.events.length === 0 ? (
        <EmptyState>{t.admin.noRevenue}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-2 text-start font-semibold">{t.admin.events}</th>
                <th className="px-4 py-2 text-start font-semibold">{t.event.date}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.admin.reservations}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.admin.attendees}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.event.cash}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.event.instapay}</th>
                <th className="px-4 py-2 text-end font-semibold">{t.admin.revenue}</th>
              </tr>
            </thead>
            <tbody>
              {report.events.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/events/${row.id}`}
                      className="font-bold hover:text-gold-deep"
                    >
                      {locale === "ar" ? row.titleAr || row.titleEn : row.titleEn || row.titleAr}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-soft">
                    {formatShortDate(row.startsAt, locale)}
                  </td>
                  <td className="px-4 py-2 text-end">{row.reservations}</td>
                  <td className="px-4 py-2 text-end">{row.attendees}</td>
                  <td className="px-4 py-2 text-end">{formatMoney(row.cash, locale)}</td>
                  <td className="px-4 py-2 text-end">{formatMoney(row.instapay, locale)}</td>
                  <td className="px-4 py-2 text-end font-black">
                    {formatMoney(row.revenue, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink bg-cream">
                <td className="px-4 py-2 font-bold" colSpan={6}>
                  {t.admin.totalRevenue}
                </td>
                <td className="px-4 py-2 text-end font-black">
                  {formatMoney(report.totalRevenue, locale)} {t.common.egp}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
