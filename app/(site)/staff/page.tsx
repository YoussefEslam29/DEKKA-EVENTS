import Link from "next/link";
import { ChevronRight, Coffee } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { getStaffEvents, eventTitle } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function StaffEventPickerPage() {
  // First, before any read: see requireRole() for why the layout's check isn't enough.
  await requireRole("staff", "/staff");
  const { locale, t } = await getI18n();
  const events = await getStaffEvents();
  const today = new Date().toDateString();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
      <FadeUp>
        <PageHeader title={t.staff.title} subtitle={t.staff.subtitle} />
      </FadeUp>

      {/* The bar's other job: marking menu items sold out (PLAN/DEKKA_PWA_APP.md §3). */}
      <Link href="/staff/menu" className="mb-6 block">
        <Card className="flex items-center gap-3 p-4 transition-colors hover:border-gold">
          <Coffee className="h-5 w-5 shrink-0 text-gold-deep" aria-hidden />
          <span className="flex-1 font-bold">{t.cafeMenu.staff.open}</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint rtl:rotate-180" aria-hidden />
        </Card>
      </Link>

      {events.length === 0 ? (
        <EmptyState>{t.staff.noEvents}</EmptyState>
      ) : (
        <div className="grid gap-3">
          {events.map((event) => {
            const isToday = new Date(event.startsAt).toDateString() === today;
            return (
              <Link key={event.id} href={`/staff/events/${event.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-gold">
                  <div>
                    <p className="text-lg font-bold">{eventTitle(event, locale)}</p>
                    <p className="text-sm text-ink-soft">
                      {formatDate(event.startsAt, locale)} ·{" "}
                      {formatTime(event.startsAt, locale)}
                    </p>
                  </div>
                  {isToday ? (
                    <Badge tone="good">{t.staff.checkInTitle}</Badge>
                  ) : (
                    <Badge>{t.event.status[event.status]}</Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
