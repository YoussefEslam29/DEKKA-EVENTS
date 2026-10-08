// PATCH  /api/menu/items/:id — edit a menu item, one field or the whole form (admin)
// DELETE /api/menu/items/:id — remove a menu item (admin)
import { NextResponse, after } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { MenuItem } from "@/models/MenuItem";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateMenuItemSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { toMenuItemDTO } from "@/lib/data";
import { cheapestVariantPrice } from "@/lib/menu";
import { releaseUploads } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/menu/items/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, updateMenuItemSchema);
    if ("response" in parsed) return parsed.response;
    // Strict and default-free, so every key here was sent on purpose.
    const update: Record<string, unknown> = { ...parsed.data };
    if (Object.keys(update).length === 0) return jsonError("Nothing to update", 400);

    await connectDB();
    const existing = await MenuItem.findById(id).select("category variants image").lean();
    if (!existing) return jsonError("Not found", 404);

    // lib/menu.ts's pricing rule, enforced on the write rather than trusted to
    // the form: sizes set the price.
    if (parsed.data.variants !== undefined) {
      const cheapest = cheapestVariantPrice(parsed.data.variants);
      // New sizes re-price the item. Clearing them keeps whatever price came
      // with the request, or else the cheapest size it had — the closest thing
      // to "what this used to cost".
      if (cheapest !== null) update.price = cheapest;
    } else if (parsed.data.price !== undefined && existing.variants.length > 0) {
      // A bare price edit on an item with sizes would contradict them. The grid
      // never offers it; this is for any caller that tries anyway.
      return jsonError("PRICE_SET_BY_VARIANTS", 409);
    }

    // Moving to another section: it must exist, and the item joins the bottom.
    const category = parsed.data.category;
    if (category !== undefined && category !== String(existing.category)) {
      if (!(await MenuCategory.exists({ _id: category }))) {
        return jsonError("UNKNOWN_CATEGORY", 400);
      }
      const last = await MenuItem.findOne({ category }).sort({ order: -1 }).select("order").lean();
      update.order = (last?.order ?? -1) + 1;
    }

    const doc = await MenuItem.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return jsonError("Not found", 404);
    // The old file goes once nothing else points at it (PLAN/SITE_ROADMAP.md S9).
    if (existing.image && existing.image !== doc.image) after(() => releaseUploads([existing.image]));

    return NextResponse.json({ data: toMenuItemDTO(doc) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/menu/items/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const removed = await MenuItem.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("Not found", 404);
    // The old file goes once nothing else points at it (PLAN/SITE_ROADMAP.md S9).
    after(() => releaseUploads([removed.image]));

    return NextResponse.json({ data: { success: true } });
  });
}
