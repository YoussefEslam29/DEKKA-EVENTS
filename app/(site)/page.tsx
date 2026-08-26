import Link from "next/link";
import { Search } from "lucide-react";
import { getI18n, type Locale } from "@/lib/i18n";
import { getPublicEvents, countReservationsForEvents, eventTitle, type EventDTO } from "@/lib/data";
import { dateParts, formatMoney, formatTime, monthKey } from "@/lib/format";
import type { Dict } from "@/lib/i18n/dictionaries";
import { EventCard } from "@/components/EventCard";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { EmptyState } from "@/components/ui/Surface";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { MonthCalendar } from "@/components/MonthCalendar";
import { cn } from "@/lib/utils";

// The hub reflects reservation counts and admin publishes immediately.
export const dynamic = "force-dynamic";

type Filter = "all" | "live" | "karaoke" | "openmic";

const FILTER_KEYWORDS: Record<Exclude<Filter, "all">, string[]> = {
  live: ["live", "band", "concert", "حي", "حية", "فرقة"],
  karaoke: ["karaoke", "كاريوكي"],
  openmic: ["open mic", "open-mic", "openmic", "أوبن مايك", "مايك مفتوح"],
};

function haystackOf(event: EventDTO): string {
  return `${event.titleEn} ${event.titleAr} ${event.descriptionEn} ${event.descriptionAr}`.toLowerCase();
}

function matchesSearch(event: EventDTO, q: string): boolean {
  return !q || haystackOf(event).includes(q.toLowerCase());
}

function matchesFilter(event: EventDTO, filter: Filter): boolean {
  return filter === "all" || FILTER_KEYWORDS[filter].some((k) => haystackOf(event).includes(k));
}

/** Compact row for the "soonest first" sidebar — a date pill plus one line, unlike the full `EventCard`. */
function UpcomingRailItem({ event, locale, t }: { event: EventDTO; locale: Locale; t: Dict }) {
  const parts = dateParts(event.startsAt, locale);
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center gap-3 rounded-xl border border-border-dark bg-surface-dark p-2.5 transition-colors hover:border-gold-accent/50"
    >
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-coffee py-1.5">
        <span className="text-lg font-black leading-none text-on-dark">{parts.day}</span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-gold-accent">
          {parts.month}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-dark">{eventTitle(event, locale)}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {formatTime(event.startsAt, locale)}
          {" · "}
          {event.price > 0 ? `${formatMoney(event.price, locale)} ${t.common.egp}` : t.common.free}
        </p>
      </div>
    </Link>
  );
}

export default async function EventsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; filter?: string }>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const currentMonth = monthKey(new Date());
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? (params.month as string) : currentMonth;
  const q = params.q?.trim() ?? "";
  const filter: Filter =
    params.filter === "live" || params.filter === "karaoke" || params.filter === "openmic"
      ? params.filter
      : "all";

  const [allUpcoming, allPast] = await Promise.all([
    getPublicEvents({ when: "upcoming", limit: 100 }),
    getPublicEvents({ when: "past", limit: 6 }),
  ]);
  const upcoming = allUpcoming.filter((e) => matchesSearch(e, q) && matchesFilter(e, filter));
  const past = allPast.filter((e) => matchesSearch(e, q) && matchesFilter(e, filter));

  const counts = await countReservationsForEvents(upcoming.map((e) => e.id));

  const buildHref = (overrides: { month?: string; filter?: Filter }) => {
    const nextMonth = overrides.month ?? month;
    const nextFilter = overrides.filter ?? filter;
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (nextFilter !== "all") search.set("filter", nextFilter);
    if (nextMonth !== currentMonth) search.set("month", nextMonth);
    const qs = search.toString();
    return qs ? `/?${qs}` : "/";
  };

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t.home.filterAll },
    { value: "live", label: t.home.filterLive },
    { value: "karaoke", label: t.home.filterKaraoke },
    { value: "openmic", label: t.home.filterOpenMic },
  ];

  return (
    <div>
      {/* Framed-collage header, echoing the banner treatment in the brand assets. */}
      <section className="border-b border-border-dark bg-surface-dark">
        <PatternAccent />
        <div className="mx-auto max-w-[1180px] px-4 py-12 text-center md:px-8 md:py-16">
          <LogoBadge size="xl" tagline priority />
          <p className="mt-4 text-lg font-semibold text-on-dark">{t.home.heroLine}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted">{t.home.heroBody}</p>

          <form action="/" className="mx-auto mt-6 max-w-md">
            {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4 w-4 text-text-muted"
              />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={t.home.searchPlaceholder}
                aria-label={t.common.search}
                className="dk-field w-full rounded-full ps-11"
              />
            </div>
          </form>
        </div>
        <PatternAccent />
      </section>

      <section className="mx-auto max-w-[1180px] px-4 pt-8 md:px-8">
        <div className="flex flex-wrap justify-center gap-2">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={buildHref({ filter: f.value })}
              aria-current={filter === f.value ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                filter === f.value
                  ? "border-gold-accent bg-gold-accent/15 text-gold-accent"
                  : "border-border-dark text-text-muted hover:border-gold-accent/40 hover:text-on-dark"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <MonthCalendar
            month={month}
            events={upcoming}
            locale={locale}
            hrefForMonth={(next) => buildHref({ month: next })}
            dayHref={(dayEvents) => (dayEvents.length > 0 ? `/events/${dayEvents[0].id}` : null)}
            labels={{
              karaokeHint: t.admin.karaokeHint,
              newEvent: "",
              previousMonth: t.admin.previousMonth,
              nextMonth: t.admin.nextMonth,
            }}
          />

          <aside className="dk-card p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-on-dark">
              {t.home.upcomingSoonest}
            </h3>
            {upcoming.length === 0 ? (
              <p className="dk-muted text-sm">{q || filter !== "all" ? t.home.searchEmpty : t.home.upcomingEmpty}</p>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 4).map((event) => (
                  <UpcomingRailItem key={event.id} event={event} locale={locale} t={t} />
                ))}
              </div>
            )}
            {upcoming.length > 4 ? (
              <Link
                href="#all-nights"
                className="mt-3 inline-block text-sm font-semibold text-gold-accent hover:underline"
              >
                {t.home.seeAll}
              </Link>
            ) : null}
          </aside>
        </div>
      </section>

      <section id="all-nights" className="mx-auto max-w-[1180px] px-4 py-10 md:px-8">
        <h2 className="mb-5 text-xl font-bold tracking-tight md:text-2xl">
          {t.home.upcoming}
        </h2>

        {upcoming.length === 0 ? (
          <EmptyState>{q || filter !== "all" ? t.home.searchEmpty : t.home.upcomingEmpty}</EmptyState>
        ) : (
          <div className="grid gap-4">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                reserved={counts[event.id] ?? 0}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mx-auto max-w-[1180px] px-4 pb-16 md:px-8">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-text-muted">
            {t.home.past}
          </h2>
          <div className="grid gap-4 opacity-75">
            {past.map((event) => (
              <EventCard key={event.id} event={event} locale={locale} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
