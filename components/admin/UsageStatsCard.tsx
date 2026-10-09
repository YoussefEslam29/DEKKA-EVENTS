import { BarChart3 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { UsageStats } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { localName } from "@/lib/menu";
import { Card } from "@/components/ui/Surface";

/**
 * The owner's numbers (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.1) on `/admin`: anonymous daily
 * totals for the last 30 days. Plain figures, no chart; the caveat says honestly what a
 * "view" is.
 */
export function UsageStatsCard({ stats, locale, t }: { stats: UsageStats; locale: Locale; t: Dict }) {
  const s = t.stats;
  const n = (value: number) => formatNumber(value, locale);
  const empty =
    stats.topItems.length === 0 && !stats.promptShown && !stats.promptAccepted && !stats.appOpens && !stats.qrScans;
  const rate = stats.promptShown > 0 ? Math.round((stats.promptAccepted / stats.promptShown) * 100) : null;

  const figures = [
    { label: s.promptShown, value: n(stats.promptShown) },
    { label: s.promptAccepted, value: n(stats.promptAccepted), extra: rate === null ? null : s.acceptRate.replace("{n}", n(rate)) },
    { label: s.appOpens, value: n(stats.appOpens) },
    { label: s.qrScans, value: n(stats.qrScans) },
  ];

  return (
    <Card className="mb-6 p-5" aria-labelledby="usage-stats-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="usage-stats-title" className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="h-5 w-5" aria-hidden />
          {s.heading}
        </h2>
        <p className="dk-muted text-sm">{s.title}</p>
      </div>

      {empty ? (
        <p className="dk-muted text-sm">{s.empty}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <dl className="grid grid-cols-2 gap-3">
            {figures.map(({ label, value, extra }) => (
              <div key={label} className="dk-hairline rounded-[4px] border p-3">
                <dt className="dk-muted text-xs font-semibold">{label}</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums">{value}</dd>
                {extra ? <dd className="dk-muted text-xs">{extra}</dd> : null}
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-bold">{s.topItems}</h3>
            {stats.topItems.length === 0 ? (
              <p className="dk-muted text-sm">{s.empty}</p>
            ) : (
              <ol className="grid gap-1.5 text-sm">
                {stats.topItems.map((item, i) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="dk-muted me-2 tabular-nums">{n(i + 1)}.</span>
                      {localName(item, locale)}
                    </span>
                    <span className="dk-muted whitespace-nowrap tabular-nums">{s.views.replace("{n}", n(item.views))}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="dk-muted mt-3 text-xs">{s.viewsCaveat}</p>
          </div>
        </div>
      )}
      <p className="dk-muted mt-4 text-xs">{s.note}</p>
    </Card>
  );
}
