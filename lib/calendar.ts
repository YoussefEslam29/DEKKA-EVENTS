/**
 * Calendar entries and share links for one night (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.1 and
 * 4a.3). Pure and client-safe: no database, no Next. Text is passed in by the caller, who
 * picks the language.
 */
import { EVENT_DEFAULT_DURATION_MIN } from "@/lib/constants";

export type CalendarEventInput = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string | Date;
  url: string;
  host: string;
  reminder: string;
};

/** "20261202T180000Z": UTC, so the file needs no VTIMEZONE block and no DST knowledge. */
export function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC 5545 text escaping: backslash, semicolon, comma, and newlines as `\n`. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Folds one content line at 75 octets (RFC 5545 §3.1), counting UTF-8 bytes, never
 * splitting a multi-byte character, so an Arabic title stays intact. Continuation lines
 * start with a space, which counts towards their 75.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines carry the leading space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The night's end: events store only a start (`EVENT_DEFAULT_DURATION_MIN`). */
export function eventEnd(startsAt: string | Date): Date {
  return new Date(new Date(startsAt).getTime() + EVENT_DEFAULT_DURATION_MIN * 60_000);
}

/**
 * The .ics file. Its `UID` is stable per event and host, so adding the same night twice
 * updates the entry rather than duplicating it. Reminds two hours before.
 */
export function buildIcs(input: CalendarEventInput, now = new Date()): string {
  const start = new Date(input.startsAt);
  const description = [input.description.slice(0, 300), input.url].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dekka//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.id}@${input.host}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(eventEnd(start))}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(input.location)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(input.reminder)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * The same night as a Google Calendar "add" link. Needed beside the .ics because the
 * Google Calendar app on Android can't open an .ics file.
 */
export function googleCalendarUrl(input: Omit<CalendarEventInput, "id" | "host" | "reminder">): string {
  const start = new Date(input.startsAt);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${icsUtc(start)}/${icsUtc(eventEnd(start))}`,
    details: [input.description.slice(0, 300), input.url].filter(Boolean).join("\n\n"),
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * A WhatsApp "send to…" link carrying a ready-made message: the phone app's chat picker
 * on a phone, WhatsApp Web on a desktop. No script needed.
 */
export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
