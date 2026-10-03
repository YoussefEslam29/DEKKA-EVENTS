// PATCH /api/menu/categories/order — set the section sequence (admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuCategory } from "@/models/MenuCategory";
import { handle, jsonError, parseBody } from "@/lib/api";
import { menuOrderSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

/**
 * Takes the *complete* new sequence and rewrites every `order` from it, rather
 * than nudging one row: a partial list would leave the rows it didn't mention
 * holding stale positions that collide with the new ones. If the list doesn't
 * match what's in the database — another admin added or deleted a section a
 * moment ago — it's refused as stale, and the screen reloads instead of
 * guessing.
 */
export async function PATCH(request: Request) {
  return handle("PATCH /api/menu/categories/order", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, menuOrderSchema);
    if ("response" in parsed) return parsed.response;
    const { ids } = parsed.data;

    await connectDB();
    const [matching, total] = await Promise.all([
      MenuCategory.countDocuments({ _id: { $in: ids } }),
      MenuCategory.estimatedDocumentCount(),
    ]);
    if (matching !== ids.length || total !== ids.length) return jsonError("STALE_ORDER", 409);

    await MenuCategory.bulkWrite(
      ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } }))
    );

    return NextResponse.json({ data: { success: true } });
  });
}
