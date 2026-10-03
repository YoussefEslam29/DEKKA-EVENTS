// PATCH /api/menu/items/order — set the item sequence within one section (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuItem } from "@/models/MenuItem";
import { handle, jsonError, parseBody } from "@/lib/api";
import { menuOrderSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

/**
 * Same contract as the section route: the complete sequence for *one* section,
 * or nothing. Every id must be an item in the same section, and together they
 * must be all of that section's items — otherwise it's stale (or mixes two
 * sections) and is refused rather than half-applied.
 */
export async function PATCH(request: Request) {
  return handle("PATCH /api/menu/items/order", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, menuOrderSchema);
    if ("response" in parsed) return parsed.response;
    const { ids } = parsed.data;

    await connectDB();
    const items = await MenuItem.find({ _id: { $in: ids } }).select("category").lean();
    if (items.length !== ids.length) return jsonError("STALE_ORDER", 409);

    const sections = new Set(items.map((item) => String(item.category)));
    if (sections.size !== 1) return jsonError("MIXED_CATEGORIES", 400);

    const inSection = await MenuItem.countDocuments({ category: items[0].category });
    if (inSection !== ids.length) return jsonError("STALE_ORDER", 409);

    await MenuItem.bulkWrite(
      ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } }))
    );

    return NextResponse.json({ data: { success: true } });
  });
}
