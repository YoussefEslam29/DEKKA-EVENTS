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

  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={hrefForMonth(shiftMonth(month, -1))}
          aria-label={labels.previousMonth}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-ink-soft transition-colors hover:bg-gold-wash"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <h2 className="text-lg font-bold">{formatMonth(month, locale)}</h2>
        <Link
          href={hrefForMonth(shiftMonth(month, 1))}
          aria-label={labels.nextMonth}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-ink-soft transition-colors hover:bg-gold-wash"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
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

          // One event → straight to it. Several (or none) → the day's own
          // starting point: the create form, pre-dated to this day at 20:00
          // cafe time, which is when a Dekka night usually starts.
          const href =
            dayEvents.length === 1
              ? `/admin/events/${dayEvents[0].id}`
              : `/admin/events/new?date=${key}`;

          return (
            <StaggerItem key={key}>
              <Link
                href={href}
                title={
                  booked
                    ? dayEvents.map(titleOf).join(" · ")
                    : isKaraokeDay
                      ? labels.karaokeHint
                      : labels.newEvent
                }
                className={cn(
                  // min-h-20 keeps every square a comfortable tap target and
                  // leaves room for one event chip without the grid reflowing.
                  "flex min-h-20 flex-col rounded-[4px] border p-1.5 text-start transition-colors sm:min-h-24",
                  booked
                    ? "border-gold/50 bg-gold-wash/70 hover:border-gold"
                    : "dk-hairline border-dashed hover:bg-gold-wash/40",
                  isToday && "ring-2 ring-gold/60"
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      booked ? "text-ink" : "text-ink-faint"
                    )}
                  >
                    {day}
                  </span>
                  {isKaraokeDay ? (
                    <Mic2
                      className="h-3 w-3 shrink-0 text-gold-deep/70"
                      aria-label={labels.karaokeHint}
                    />
                  ) : null}
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
                        <span className="block truncate text-[0.7rem] font-semibold leading-tight text-ink">
                          {titleOf(event)}
                        </span>
                        <span className="block truncate text-[0.65rem] leading-tight text-ink-faint">
                          {formatTime(event.startsAt, locale)}
                        </span>
                      </span>
                    </span>
                  ))}
                  {dayEvents.length > 2 ? (
                    <span className="block text-[0.65rem] font-semibold text-ink-faint">
                      +{dayEvents.length - 2}
                    </span>
                  ) : null}
                </span>
              </Link>
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
