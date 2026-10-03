// POST /api/menu/categories — add a menu section (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { handle, parseBody } from "@/lib/api";
import { createMenuCategorySchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

export async function POST(request: Request) {
  return handle("POST /api/menu/categories", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, createMenuCategorySchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    // New sections go to the bottom; the admin moves them from there.
    const last = await MenuCategory.findOne().sort({ order: -1 }).select("order").lean();
    const doc = await MenuCategory.create({ ...parsed.data, order: (last?.order ?? -1) + 1 });

    return NextResponse.json(
      {
        data: {
          id: String(doc._id),
          nameAr: doc.nameAr,
          nameEn: doc.nameEn,
          order: doc.order,
          isActive: doc.isActive,
          items: [],
        },
      },
      { status: 201 }
    );
  });
}
