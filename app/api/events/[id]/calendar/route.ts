// GET /api/events/:id/calendar?lang=ar|en — one night as an .ics file (PLAN/DEKKA_PWA_APP.md
// §5.2, 4a.1). Opens the Calendar sheet on iPhone; imports into Outlook, Apple and Samsung
// calendars.
//
// A public route, on developer-guide.md §3 rule 9's terms: it returns only what any guest
// can already see on the event page, it never reads the session or a cookie (so the answer
// can't depend on who asks), and it is rate-limited per IP. A draft or unknown id is a 404
// for everyone, the admin included.
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { handle, isValidId, jsonError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { dictFor } from "@/lib/i18n";
import { site } from "@/lib/site";
import { buildIcs } from "@/lib/calendar";
import { dayKey } from "@/lib/format";
import { PUBLIC_EVENT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

const langSchema = z.enum(["ar", "en"]).catch("ar");

export async function GET(request: Request, { params }: Params) {
  return handle("GET /api/events/:id/calendar", async () => {
    const rl = await rateLimit("calendar-ip", clientIp(request));
    if ("response" in rl) return rl.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Not found", 404);
    const lang = langSchema.parse(new URL(request.url).searchParams.get("lang") ?? "ar");

    await connectDB();
    const event = await Event.findOne({ _id: id, status: { $in: PUBLIC_EVENT_STATUSES } }).lean();
    if (!event) return jsonError("Not found", 404);

    const t = dictFor(lang);
    const url = `${site.url}/events/${id}`;
    const ics = buildIcs({
      id,
      host: new URL(site.url).host,
      title: lang === "ar" ? event.titleAr || event.titleEn : event.titleEn || event.titleAr,
      description: lang === "ar" ? event.descriptionAr || event.descriptionEn : event.descriptionEn || event.descriptionAr,
      location: (lang === "ar" ? event.locationAr || event.locationEn : event.locationEn || event.locationAr) || t.calendar.venue,
      startsAt: event.startsAt,
      url,
      reminder: t.calendar.reminder,
    });

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="dekka-${dayKey(event.startsAt)}.ics"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  });
}
