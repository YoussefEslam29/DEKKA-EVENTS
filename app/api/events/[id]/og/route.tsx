// GET /api/events/:id/og — the night's 1200×630 share card (PLAN/DEKKA_PWA_APP.md §5.2, 4a.3).
//
// A public route on developer-guide.md §3 rule 9's terms: only a public night (a draft or
// unknown id is a 404 for everyone), never reads the session or a cookie, rate-limited per
// IP. Because the answer never depends on the caller, Vercel's edge can cache it.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { handle, isValidId, jsonError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { site } from "@/lib/site";
import { renderEventCard } from "@/lib/og/card";
import { PUBLIC_EVENT_STATUSES } from "@/lib/constants";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle("GET /api/events/:id/og", async () => {
    const rl = await rateLimit("og-ip", clientIp(request));
    if ("response" in rl) return rl.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Not found", 404);

    await connectDB();
    const event = await Event.findOne({ _id: id, status: { $in: PUBLIC_EVENT_STATUSES } })
      .select("titleAr titleEn startsAt price")
      .lean();
    if (!event) return jsonError("Not found", 404);

    const card = renderEventCard({
      titleAr: event.titleAr,
      titleEn: event.titleEn,
      startsAt: event.startsAt,
      price: event.price,
      host: new URL(site.url).host,
    });
    const png = await card.arrayBuffer();
    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  });
}
