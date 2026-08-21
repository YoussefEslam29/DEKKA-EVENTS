import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock } from "lucide-react";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n";
import { fill } from "@/lib/i18n";
import { dateParts, formatTime, formatMoney, formatNumber } from "@/lib/format";
import { eventText, eventTitle, type EventDTO } from "@/lib/data";
import { Badge } from "@/components/ui/Surface";

/**
 * One night on the events hub. The date block on the start edge is the anchor —
 * people scan for "which day", then decide.
 */
export function EventCard({
  event,
  reserved,
  locale,
  t,
}: {
  event: EventDTO;
  reserved?: number;
  locale: Locale;
  t: Dict;
}) {
  const parts = dateParts(event.startsAt, locale);
  const location = eventText(event, locale, "location");
  const isPast = event.isPast;
  // Availability only means something while the night is still ahead and open.
  const spotsLeft =
    !isPast && event.status === "published" && event.capacity != null
      ? Math.max(event.capacity - (reserved ?? 0), 0)
      : null;
  const isFull = spotsLeft === 0;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex overflow-hidden rounded-xl border border-border-dark bg-surface-dark transition-colors hover:border-gold"
    >
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-e border-border-dark bg-coffee px-2 py-4 text-on-dark md:w-24">
        <span className="text-3xl font-black leading-none">{parts.day}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-gold-accent">
          {parts.month}
        </span>
        <span className="mt-2 text-[0.65rem] text-on-dark/60">{parts.year}</span>
      </div>

      {event.coverImage ? (
        <div className="relative hidden w-40 shrink-0 sm:block">
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="160px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-bold group-hover:text-gold-accent">
            {eventTitle(event, locale)}
          </h3>
          {isPast ? null : event.status === "closed" ? (
            <Badge tone="warn">{t.event.closed}</Badge>
          ) : isFull ? (
            <Badge tone="bad">{t.event.full}</Badge>
          ) : spotsLeft != null ? (
            <Badge tone="gold">
              {fill(t.event.spotsLeft, { n: formatNumber(spotsLeft, locale) })}
            </Badge>
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm text-text-muted">
          {eventText(event, locale, "description")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(event.startsAt, locale)}
          </span>
          {location ? (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
          ) : null}
          <span className="font-semibold text-gold-accent">
            {event.price > 0
              ? `${formatMoney(event.price, locale)} ${t.common.egp}`
              : t.common.free}
          </span>
        </div>
      </div>
    </Link>
  );
}
