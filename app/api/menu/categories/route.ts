// POST /api/menu/categories — add a menu section (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { handle, jsonError, parseBody } from "@/lib/api";
import { createMenuCategorySchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { seasonRangeOk } from "@/lib/menu";

export async function POST(request: Request) {
  return handle("POST /api/menu/categories", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, createMenuCategorySchema);
    if ("response" in parsed) return parsed.response;
    const { startsOn, endsOn, ...fields } = parsed.data;
    if (!seasonRangeOk(startsOn, endsOn)) return jsonError("SEASON_RANGE", 400);

    await connectDB();
    // New sections go to the bottom; the admin moves them from there.
    const last = await MenuCategory.findOne().sort({ order: -1 }).select("order").lean();
    const doc = await MenuCategory.create({
      ...fields,
      ...(startsOn ? { startsOn } : {}),
      ...(endsOn ? { endsOn } : {}),
      order: (last?.order ?? -1) + 1,
    });

    return NextResponse.json(
      {
        data: {
          id: String(doc._id),
          nameAr: doc.nameAr,
          nameEn: doc.nameEn,
          order: doc.order,
          isActive: doc.isActive,
          startsOn: doc.startsOn ?? null,
          endsOn: doc.endsOn ?? null,
          items: [],
        },
      },
      { status: 201 }
    );
  });
}
