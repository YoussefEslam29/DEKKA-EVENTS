import Link from "next/link";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { fill, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import { eventTitle, type EventDTO } from "@/lib/data";
import { formatNumber, formatTime, toLocalInputValue } from "@/lib/format";

/**
 * "Tonight at Dekka" (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.2): a slim band at the very top of
 * the homepage, above the hero, one row per night happening today (usually one). On a phone
 * the hero fills the first screen, so under it would be below the fold. Renders nothing
 * on a night without an event. The page is `force-dynamic`, so it's always current.
 */
export function TonightBanner({
  events,
  counts,
  now,
  locale,
  t,
}: {
  events: EventDTO[];
  counts: Record<string, number>;
  now: Date;
  locale: Locale;
  t: Dict;
}) {
  if (events.length === 0) return null;

  return (
    <section aria-label={t.tonight.tonight} className="border-b border-gold-accent/40 bg-gold-accent/10">
      <ul className="mx-auto max-w-[1180px] divide-y divide-gold-accent/20 px-4 md:px-8">
        {events.map((event) => {
          const started = new Date(event.startsAt).getTime() <= now.getTime();
          // A start before 17:00 Cairo is a daytime activity: "today", and a sun.
          const daytime = Number(toLocalInputValue(event.startsAt).slice(11, 13)) < 17;
          const eyebrow = started ? t.tonight.onNow : daytime ? t.tonight.today : t.tonight.tonight;
          const Icon = daytime ? Sun : Moon;
          const spotsLeft = event.capacity != null ? Math.max(event.capacity - (counts[event.id] ?? 0), 0) : null;
          const open = event.status === "published" && spotsLeft !== 0 && !started;

          return (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-accent/20 text-gold-accent">
                  <Icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-gold-accent">
                    {eyebrow}
                    {started ? <span className="ms-2 inline-block h-2 w-2 animate-pulse rounded-full bg-good align-middle motion-reduce:animate-none" aria-hidden /> : null}
                  </span>
                  <span className="block truncate font-bold text-on-dark">
                    {/* Isolated, so a title ending in Latin ("… Dekka Band") can't pull the time into it. */}
                    <bdi>{eventTitle(event, locale)}</bdi>
                    <span className="ms-2 text-sm font-semibold text-text-muted">{formatTime(event.startsAt, locale)}</span>
                  </span>
                </span>
              </div>
              <Link
                href={`/events/${event.id}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold-accent/50 px-4 text-sm font-bold text-gold-accent transition-colors hover:bg-gold-accent/15"
              >
                {open
                  ? t.tonight.reserve
                  : spotsLeft === 0 && !started
                    ? t.event.full
                    : t.tonight.details}
                {open && spotsLeft != null ? (
                  <span className="text-xs font-semibold text-text-muted">
                    · {fill(t.event.spotsLeft, { n: formatNumber(spotsLeft, locale) })}
                  </span>
                ) : null}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
