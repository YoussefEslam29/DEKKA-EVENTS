import Link from "next/link";
import { ChevronLeft, ChevronRight, Mic2 } from "lucide-react";
import { Card } from "@/components/ui/Surface";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import { dayKey, formatMonth, formatTime, shiftMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { EventDTO } from "@/lib/data";

/**
 * Month grid for the events manager (`PLAN/FIX_ADMIN_DASH.md` §4).
 *
 * Answers the one question the flat table could not: is that Wednesday free?
 * Days that already hold an event are tinted and dotted in the event's own
 * status colour, so the calendar and the table tell the same story.
 *
 * Nothing here is generated or enforced. A Wednesday is marked "usually
 * karaoke" as a reminder to whoever is planning the month, but an empty
 * Wednesday behaves like any other empty day — the decision locked in the plan
 * was visual-only, event-driven, and this keeps to it: the shading comes from
 * real `Event` documents and nothing else.
 */

const STATUS_DOT = {
  draft: "bg-ink-faint",
  published: "bg-good",
  closed: "bg-warn",
  happened: "bg-gold",
  archived: "bg-ink-faint/60",
} as const;

/** Wednesday. `Date.getUTCDay()` counts from Sunday. */
const KARAOKE_WEEKDAY = 3;

/**
 * Weeks run Saturday → Friday, which is how a calendar reads in Egypt.
 * Anchored on 2024-01-06, a Saturday, purely to name the seven columns.
 */
const WEEK_ANCHOR = Date.UTC(2024, 0, 6);

function weekdayNames(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(WEEK_ANCHOR + i * 86_400_000))
  );
}

export function MonthCalendar({
  month,
  events,
  locale,
  labels,
  hrefForMonth,
  dayHref,
}: {
  /** "YYYY-MM". */
  month: string;
  /** Every event; this filters to the month itself. */
  events: EventDTO[];
  locale: Locale;
  labels: {
    karaokeHint: string;
    newEvent: string;
    previousMonth: string;
    nextMonth: string;
  };
  /** Lets the caller keep its other query params (`view=calendar`) intact. */
  hrefForMonth: (month: string) => string;
  /**
   * Where a day cell links. Defaults to the admin behaviour: one event opens
   * it, anything else opens the create form pre-dated to that day. The public
   * hub passes its own, since guests can neither edit nor create events —
   * returning `null` renders the cell as a plain, unlinked square.
   */
  dayHref?: (dayEvents: EventDTO[], dateKey: string) => string | null;
}) {
  const [year, monthNumber] = month.split("-").map(Number);

  // Pure calendar arithmetic in UTC — no timezone belongs in the grid itself.
  // Only the *bucketing* of events below is timezone-aware, via `dayKey`.
  const firstOfMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  // Saturday-first: Saturday (6) becomes column 0.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 1) % 7;

  const byDay = new Map<string, EventDTO[]>();
  for (const event of events) {
    const key = dayKey(event.startsAt);
    if (!key.startsWith(month)) continue;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }
  for (const bucket of byDay.values()) {
    bucket.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }

  const todayKey = dayKey(new Date());
  const names = weekdayNames(locale);

  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const titleOf = (event: EventDTO) =>
    locale === "ar" ? event.titleAr || event.titleEn : event.titleEn || event.titleAr;

  const linkFor =
    dayHref ??
    ((dayEvents: EventDTO[], dateKey: string) =>
      dayEvents.length === 1
        ? `/admin/events/${dayEvents[0].id}`
        : `/admin/events/new?date=${dateKey}`);

  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={hrefForMonth(shiftMonth(month, -1))}
          aria-label={labels.previousMonth}
          className="dk-icon-btn inline-flex h-11 w-11 items-center justify-center rounded-[4px] transition-colors"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <h2 className="text-lg font-bold">{formatMonth(month, locale)}</h2>
        <Link
          href={hrefForMonth(shiftMonth(month, 1))}
          aria-label={labels.nextMonth}
          className="dk-icon-btn inline-flex h-11 w-11 items-center justify-center rounded-[4px] transition-colors"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-semibold uppercase tracking-wider dk-muted">
        {names.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      <Stagger className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} aria-hidden="true" />;
          }

          const key = `${month}-${String(day).padStart(2, "0")}`;
          const dayEvents = byDay.get(key) ?? [];
          const booked = dayEvents.length > 0;
          const isKaraokeDay =
            new Date(`${key}T00:00:00Z`).getUTCDay() === KARAOKE_WEEKDAY;
          const isToday = key === todayKey;

          const href = linkFor(dayEvents, key);
          const title = booked
            ? dayEvents.map(titleOf).join(" · ")
            : isKaraokeDay
              ? labels.karaokeHint
              : href
                ? labels.newEvent
                : undefined;

          const cellClassName = cn(
            // min-h-20 keeps every square a comfortable tap target and
            // leaves room for one event chip without the grid reflowing.
            // relative anchors the karaoke-day watermark below.
            "relative flex min-h-20 flex-col overflow-hidden rounded-[4px] border p-1.5 text-start transition-colors sm:min-h-24",
            booked
              ? "dk-daycell-booked"
              : "dk-hairline border-dashed dk-cell-hover",
            isToday && "dk-ring-today",
            !href && "cursor-default"
          );

          const content = (
            <>
              {isKaraokeDay && !booked ? (
                // A watermark, not an event — same "hint, not a rule" the
                // pure-date check above already establishes. Purely
                // decorative (the title attribute carries the real label), so
                // it's aria-hidden rather than duplicating karaokeHint here.
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute -bottom-1.5 -end-1.5 h-10 w-10 text-gold-deep/20 sm:h-12 sm:w-12"
                >
                  <circle cx="12" cy="12" r="10.5" strokeWidth="1.1" />
                  <rect x="9.5" y="6" width="5" height="8" rx="2.5" />
                  <path d="M7.5 12.5a4.5 4.5 0 0 0 9 0" />
                  <line x1="12" y1="17" x2="12" y2="19" />
                </svg>
              ) : null}

              <span className="relative flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-xs font-bold",
                    booked ? "dk-strong" : "dk-muted"
                  )}
                >
                  {day}
                </span>
              </span>

              <span className="mt-1 flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((event) => (
                  <span key={event.id} className="flex items-start gap-1">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[event.status]
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="dk-strong block truncate text-[0.7rem] font-semibold leading-tight">
                        {titleOf(event)}
                      </span>
                      <span className="dk-muted block truncate text-[0.65rem] leading-tight">
                        {formatTime(event.startsAt, locale)}
                      </span>
                    </span>
                  </span>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="dk-muted block text-[0.65rem] font-semibold">
                    +{dayEvents.length - 2}
                  </span>
                ) : null}
              </span>
            </>
          );

          return (
            <StaggerItem key={key}>
              {href ? (
                <Link href={href} title={title} className={cellClassName}>
                  {content}
                </Link>
              ) : (
                <div title={title} className={cellClassName}>
                  {content}
                </div>
              )}
            </StaggerItem>
          );
        })}
      </Stagger>

      <p className="dk-muted mt-3 flex items-center gap-1.5 text-xs">
        <Mic2 className="h-3 w-3 text-gold-deep/70" aria-hidden="true" />
        {labels.karaokeHint}
      </p>
    </Card>
  );
}
