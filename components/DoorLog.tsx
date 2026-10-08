import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { CheckInAuditDTO } from "@/lib/data";
import { formatMoney, formatShortDate, formatTime } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/Surface";

/**
 * One night's door log (`PLAN/SITE_ROADMAP.md` I3), for the admin event page: every
 * check-in, edit and removal on the door table, who did it and when. Read-only by design;
 * nothing in the app edits the log.
 */
export function DoorLog({
  entries,
  locale,
  t,
}: {
  entries: CheckInAuditDTO[];
  locale: Locale;
  t: Dict;
}) {
  const fieldLabel: Record<string, string> = {
    name: t.staff.name,
    phone: t.staff.phone,
    paymentMethod: t.staff.method,
    amount: t.staff.amount,
    gender: t.staff.gender,
  };

  const show = (field: string, value: string | number | null) => {
    if (value === null || value === "") return "—";
    if (field === "paymentMethod") return value === "cash" ? t.event.cash : t.event.instapay;
    if (field === "gender") return value === "male" ? t.staff.male : t.staff.female;
    if (field === "amount" && typeof value === "number") return formatMoney(value, locale);
    return String(value);
  };

  const tone = { create: "text-good", update: "text-gold-deep", void: "text-bad" } as const;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold">{t.admin.doorLog.title}</h2>
      <p className="dk-muted mb-3 text-sm">{t.admin.doorLog.hint}</p>
      {entries.length === 0 ? (
        <EmptyState>{t.admin.doorLog.empty}</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3 text-sm">
              <p>
                <span className={`font-bold ${tone[entry.action]}`}>
                  {t.admin.doorLog.actions[entry.action]}
                </span>
                {" · "}
                <span className="font-semibold">
                  {entry.byName || t.admin.doorLog.unknownUser}
                </span>
                <span className="dk-muted ms-2 text-xs">
                  {formatShortDate(entry.createdAt, locale)} · {formatTime(entry.createdAt, locale)}
                </span>
              </p>
              {entry.changes.length > 0 ? (
                <ul className="dk-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {entry.changes.map((change) => (
                    <li key={change.field}>
                      {fieldLabel[change.field] ?? change.field}:{" "}
                      {entry.action === "update" ? (
                        <>
                          <span className="line-through">{show(change.field, change.from)}</span>
                          {" → "}
                          <span className="font-semibold text-ink">{show(change.field, change.to)}</span>
                        </>
                      ) : (
                        <span dir="auto">
                          {show(change.field, entry.action === "void" ? change.from : change.to)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
