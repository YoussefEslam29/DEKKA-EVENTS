// POST /api/events/from-template — make a draft event from a saved template (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { EventTemplate } from "@/models/EventTemplate";
import { handle, jsonError, parseBody } from "@/lib/api";
import { eventFromTemplateSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { toEventDTO } from "@/lib/data";
import { buildEventFromTemplate, startsAtFor } from "@/lib/templates";

/**
 * The "pick a night, pick a date" button (`PLAN/DEKKA_PWA_APP.md` §4).
 *
 * The request names a template and a day — nothing about the event itself. The
 * server reads the stored template and builds every event field from it
 * (`buildEventFromTemplate`), so a caller can't inject a title, a price or a
 * status through here. The result is always a **draft**: publishing stays the
 * one path that announces a night and sends the push, so this route can never
 * notify anyone.
 *
 * Lives at a static segment beside `app/api/events/[id]`; Next resolves the
 * static `from-template` before the dynamic `[id]`.
 */
export async function POST(request: Request) {
  return handle("POST /api/events/from-template", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, eventFromTemplateSchema);
    if ("response" in parsed) return parsed.response;
    const { templateId, date, time } = parsed.data;

    await connectDB();
    const template = await EventTemplate.findById(templateId).lean();
    if (!template) return jsonError("TEMPLATE_NOT_FOUND", 404);

    const startsAt = startsAtFor(date, time ?? template.defaultTime);
    if (!startsAt) return jsonError("INVALID_DATE", 400);

    const event = await Event.create(buildEventFromTemplate(template, startsAt));
    return NextResponse.json({ data: toEventDTO(event.toObject()) }, { status: 201 });
  });
}
