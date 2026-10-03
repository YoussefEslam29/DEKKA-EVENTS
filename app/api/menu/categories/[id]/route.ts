// PATCH  /api/menu/categories/:id — rename / show / hide a section (admin)
// DELETE /api/menu/categories/:id — remove an *empty* section (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { MenuItem } from "@/models/MenuItem";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateMenuCategorySchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/menu/categories/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, updateMenuCategorySchema);
    if ("response" in parsed) return parsed.response;
    if (Object.keys(parsed.data).length === 0) return jsonError("Nothing to update", 400);

    await connectDB();
    const doc = await MenuCategory.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return jsonError("Not found", 404);

    return NextResponse.json({
      data: {
        id: String(doc._id),
        nameAr: doc.nameAr,
        nameEn: doc.nameEn,
        order: doc.order,
        isActive: doc.isActive,
      },
    });
  });
}

/**
 * Refuses while the section still holds items. Cascading the delete would take
 * every item — names, prices, photos — with one mis-tap on the section row;
 * hiding the section (`isActive: false`) is the reversible way to take it off
 * the menu, and emptying it first makes deleting a deliberate act.
 */
export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/menu/categories/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    if (await MenuItem.exists({ category: id })) {
      return jsonError("CATEGORY_NOT_EMPTY", 409);
    }

    const removed = await MenuCategory.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("Not found", 404);

    return NextResponse.json({ data: { success: true } });
  });
}
