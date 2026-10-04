// PATCH /api/event-templates/order — set the order of the template buttons (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { EventTemplate } from "@/models/EventTemplate";
import { handle, jsonError, parseBody } from "@/lib/api";
import { menuOrderSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

/**
 * Same contract as the menu's reorder routes (and the same `{ ids }` schema):
 * the complete sequence or nothing. A list that doesn't match what's stored —
 * someone saved or deleted a template a moment ago — is refused as stale, and
 * the screen reloads rather than guessing.
 */
export async function PATCH(request: Request) {
  return handle("PATCH /api/event-templates/order", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, menuOrderSchema);
    if ("response" in parsed) return parsed.response;
    const { ids } = parsed.data;

    await connectDB();
    const [matching, total] = await Promise.all([
      EventTemplate.countDocuments({ _id: { $in: ids } }),
      EventTemplate.estimatedDocumentCount(),
    ]);
    if (matching !== ids.length || total !== ids.length) return jsonError("STALE_ORDER", 409);

    await EventTemplate.bulkWrite(
      ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } }))
    );

    return NextResponse.json({ data: { success: true } });
  });
}
