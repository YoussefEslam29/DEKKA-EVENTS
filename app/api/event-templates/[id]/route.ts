// PATCH  /api/event-templates/:id — edit a template (admin)
// DELETE /api/event-templates/:id — remove a template (admin)
import { NextResponse, after } from "next/server";
import { connectDB } from "@/lib/db";
import { EventTemplate } from "@/models/EventTemplate";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateEventTemplateSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { toEventTemplateDTO } from "@/lib/data";
import { releaseUploads } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/event-templates/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, updateEventTemplateSchema);
    if ("response" in parsed) return parsed.response;
    // Strict and default-free (see the schema), so every key here was sent.
    const update: Record<string, unknown> = { ...parsed.data };
    if (Object.keys(update).length === 0) return jsonError("Nothing to update", 400);
    if ("capacity" in update) update.capacity = update.capacity ?? null;

    await connectDB();
    const before = await EventTemplate.findById(id).select("coverImage").lean();
    const doc = await EventTemplate.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return jsonError("Not found", 404);
    // The old file goes once nothing else points at it (PLAN/SITE_ROADMAP.md S9).
    if (before?.coverImage && before.coverImage !== doc.coverImage) {
      after(() => releaseUploads([before.coverImage]));
    }

    return NextResponse.json({ data: toEventTemplateDTO(doc) });
  });
}

/**
 * Deleting a template never touches the events made from it — they were copies
 * from the moment they were created, with no link back.
 */
export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/event-templates/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const removed = await EventTemplate.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("Not found", 404);
    // The old file goes once nothing else points at it (PLAN/SITE_ROADMAP.md S9).
    after(() => releaseUploads([removed.coverImage]));

    return NextResponse.json({ data: { success: true } });
  });
}
