// POST /api/event-templates — save a night/activity as a template (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { EventTemplate } from "@/models/EventTemplate";
import { handle, parseBody } from "@/lib/api";
import { createEventTemplateSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { toEventTemplateDTO } from "@/lib/data";

/**
 * Backs both "Save as template" on an event page and "New template" on
 * `/admin/templates` (`PLAN/DEKKA_PWA_APP.md` §4). New templates join the end
 * of the row of buttons; the admin reorders from there.
 */
export async function POST(request: Request) {
  return handle("POST /api/event-templates", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, createEventTemplateSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const last = await EventTemplate.findOne().sort({ order: -1 }).select("order").lean();
    const doc = await EventTemplate.create({
      ...parsed.data,
      capacity: parsed.data.capacity ?? null,
      order: (last?.order ?? -1) + 1,
    });

    return NextResponse.json({ data: toEventTemplateDTO(doc.toObject()) }, { status: 201 });
  });
}
