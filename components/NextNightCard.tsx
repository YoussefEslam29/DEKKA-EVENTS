import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Ticket } from "lucide-react";
import { fill, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import { eventTitle, type EventDTO } from "@/lib/data";
import { dateParts, formatMoney, formatNumber, formatTime } from "@/lib/format";
import { buttonStyles } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Surface";
import { PatternAccent } from "@/components/ui/PatternAccent";

/**
 * The next night, big, right under the hero (`PLAN/SITE_ROADMAP.md` X1). On a phone the
 * hero fills the first screen, so before this the thing a visitor came for sat below the
 * fold. Tonight's nights are the Tonight banner's job; this is the one after.
 */
export function NextNightCard({
  event,
  reserved,
  locale,
  t,
}: {
  event: EventDTO;
  reserved: number;
  locale: Locale;
  t: Dict;
}) {
  const parts = dateParts(event.startsAt, locale);
  const spotsLeft = event.capacity != null ? Math.max(event.capacity - reserved, 0) : null;
  const open = event.status === "published" && spotsLeft !== 0;

  return (
    <section aria-labelledby="next-night-title" className="mx-auto max-w-[1180px] px-4 pt-8 md:px-8">
      <div className="dk-card overflow-hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="relative aspect-[16/9] bg-coffee md:aspect-auto md:min-h-56">
          {event.coverImage ? (
            <Image
              src={event.coverImage}
              alt={event.isPoster ? eventTitle(event, locale) : ""}
              fill
              sizes="(min-width: 768px) 470px, 100vw"
              className="object-cover"
            />
          ) : (
            <PatternAccent variant="field" className="absolute inset-0 text-gold-accent/10" />
          )}
          <div className="absolute start-3 top-3 flex flex-col items-center rounded-xl bg-ink-black/85 px-3 py-2 text-on-dark">
            <span className="text-2xl font-black leading-none">{parts.day}</span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-gold-accent">{parts.month}</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 p-5 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">{t.home.nextNight.eyebrow}</p>
          <h2 id="next-night-title" className="text-2xl font-extrabold leading-tight text-on-dark md:text-3xl">
            {eventTitle(event, locale)}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden />
              {parts.weekday} · {formatTime(event.startsAt, locale)}
            </span>
            <span className="font-semibold text-gold-accent">
              {event.price > 0 ? `${formatMoney(event.price, locale)} ${t.common.egp}` : t.common.free}
            </span>
            {spotsLeft != null ? (
              <Badge tone={spotsLeft === 0 ? "bad" : "gold"}>
                {spotsLeft === 0 ? t.event.full : fill(t.event.spotsLeft, { n: formatNumber(spotsLeft, locale) })}
              </Badge>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link
              href={`/events/${event.id}`}
              className={buttonStyles({ variant: open ? "gold" : "outline", size: "lg" })}
            >
              {open ? <Ticket className="h-4 w-4" aria-hidden /> : null}
              {open ? t.home.nextNight.reserve : t.home.nextNight.details}
              {!open ? <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden /> : null}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
