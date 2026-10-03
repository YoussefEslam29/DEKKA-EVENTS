// PATCH /api/menu/items/:id/availability — mark sold out / back on (staff+)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuItem } from "@/models/MenuItem";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { menuAvailabilitySchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

/**
 * The only menu write staff can make (`PLAN/DEKKA_PWA_APP.md` §3): whoever is
 * behind the bar knows the oat milk ran out before the admin does.
 *
 * A route of its own, rather than letting staff through `PATCH
 * /api/menu/items/:id`, so the boundary is structural: this handler's schema
 * admits `{ available: boolean }` and nothing else, and it writes exactly that
 * one field. No request shape reaches a price or a name from here.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("PATCH /api/menu/items/:id/availability", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, menuAvailabilitySchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const doc = await MenuItem.findByIdAndUpdate(
      id,
      { $set: { available: parsed.data.available } },
      { new: true }
    )
      .select("available")
      .lean();
    if (!doc) return jsonError("Not found", 404);

    return NextResponse.json({ data: { id: String(doc._id), available: doc.available } });
  });
}
