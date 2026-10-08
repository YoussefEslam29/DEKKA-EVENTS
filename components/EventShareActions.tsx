import { CalendarPlus, ChevronDown } from "lucide-react";
import { fill, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import { eventText, eventTitle, type EventDTO } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/format";
import { googleCalendarUrl, whatsAppShareUrl } from "@/lib/calendar";
import { site } from "@/lib/site";
import { buttonStyles } from "@/components/ui/Button";

/** WhatsApp's own mark, drawn on lucide's 24px grid like the other brand icons. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}

/**
 * "Add to your calendar" and "Send it to friends on WhatsApp" for one night
 * (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.1 and 4a.3). Both are plain links, and the calendar
 * choice is a native `<details>`, so neither needs JavaScript. Google Calendar sits beside
 * the .ics because the Google Calendar app on Android can't open an .ics file.
 */
export function EventShareActions({
  event,
  locale,
  t,
  share = true,
}: {
  event: EventDTO;
  locale: Locale;
  t: Dict;
  /** The WhatsApp link; My Events shows only the calendar. */
  share?: boolean;
}) {
  const url = `${site.url}/events/${event.id}`;
  const title = eventTitle(event, locale);
  const google = googleCalendarUrl({
    title,
    description: eventText(event, locale, "description"),
    location: eventText(event, locale, "location") || t.calendar.venue,
    startsAt: event.startsAt,
    url,
  });
  const message = `${fill(t.share.message, {
    title,
    date: formatDate(event.startsAt, locale),
    time: formatTime(event.startsAt, locale),
  })}\n${url}`;

  return (
    <div className="flex flex-col gap-2">
      <details className="group rounded-xl border border-border-dark">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-on-dark [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-gold-accent" aria-hidden />
            {t.calendar.add}
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-1 border-t border-border-dark p-2">
          <a href={google} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-coffee">
            {t.calendar.google}
          </a>
          <a href={`/api/events/${event.id}/calendar?lang=${locale}`} className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-coffee">
            {t.calendar.ics}
          </a>
        </div>
      </details>
      {share ? (
        <a
          href={whatsAppShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: "outline", className: "min-h-11 w-full" })}
        >
          <WhatsAppIcon className="h-4 w-4" />
          {t.share.whatsapp}
        </a>
      ) : null}
    </div>
  );
}
