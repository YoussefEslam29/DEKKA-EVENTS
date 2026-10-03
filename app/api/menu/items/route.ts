// POST /api/menu/items — add a menu item (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { MenuItem } from "@/models/MenuItem";
import { handle, jsonError, parseBody } from "@/lib/api";
import { createMenuItemSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { toMenuItemDTO } from "@/lib/data";
import { cheapestVariantPrice } from "@/lib/menu";

export async function POST(request: Request) {
  return handle("POST /api/menu/items", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, createMenuItemSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    await connectDB();
    if (!(await MenuCategory.exists({ _id: input.category }))) {
      return jsonError("UNKNOWN_CATEGORY", 400);
    }

    // New items go to the bottom of their section.
    const last = await MenuItem.findOne({ category: input.category })
      .sort({ order: -1 })
      .select("order")
      .lean();

    const doc = await MenuItem.create({
      ...input,
      // lib/menu.ts's rule: sizes set the price. Whatever `price` was typed is
      // only kept when there are no sizes to price the item by.
      price: cheapestVariantPrice(input.variants) ?? input.price,
      order: (last?.order ?? -1) + 1,
    });

    return NextResponse.json({ data: toMenuItemDTO(doc.toObject()) }, { status: 201 });
  });
}
