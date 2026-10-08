// PATCH  /api/menu/categories/:id — rename / show / hide / set the season of a section (admin)
// DELETE /api/menu/categories/:id — remove an *empty* section (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { MenuItem } from "@/models/MenuItem";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateMenuCategorySchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { seasonRangeOk } from "@/lib/menu";

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

    // A season end sent as `null` is cleared ($unset), not stored as null.
    const { startsOn, endsOn, ...fields } = parsed.data;
    const set: Record<string, unknown> = { ...fields };
    const unset: Record<string, 1> = {};
    for (const [key, value] of [["startsOn", startsOn], ["endsOn", endsOn]] as const) {
      if (value === null) unset[key] = 1;
      else if (value !== undefined) set[key] = value;
    }

    await connectDB();
    if (startsOn !== undefined || endsOn !== undefined) {
      // Only one end sent: check it against the end already stored.
      const current = await MenuCategory.findById(id).select("startsOn endsOn").lean();
      if (!current) return jsonError("Not found", 404);
      const from = startsOn === undefined ? current.startsOn : startsOn;
      const until = endsOn === undefined ? current.endsOn : endsOn;
      if (!seasonRangeOk(from, until)) return jsonError("SEASON_RANGE", 400);
    }

    const doc = await MenuCategory.findByIdAndUpdate(
      id,
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!doc) return jsonError("Not found", 404);

    return NextResponse.json({
      data: {
        id: String(doc._id),
        nameAr: doc.nameAr,
        nameEn: doc.nameEn,
        order: doc.order,
        isActive: doc.isActive,
        startsOn: doc.startsOn ?? null,
        endsOn: doc.endsOn ?? null,
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
