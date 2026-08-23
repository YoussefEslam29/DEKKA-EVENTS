// PATCH  /api/checkins/:id — correct a door entry in place (staff/admin)
// DELETE /api/checkins/:id — undo a mistyped door entry (staff/admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CheckIn } from "@/models/CheckIn";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateCheckInSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

/**
 * Backs the inline-edit grid (`PLAN/FIX_ADMIN_DASH.md` §2b). Fixing a mistyped
 * name or phone used to mean deleting the row and re-adding it, which threw
 * away the original timestamp and the reservation link along with it.
 *
 * Same `guard("staff")` rank as POST/DELETE on this resource: anyone trusted to
 * record a payment at the door is trusted to correct one. The schema is strict
 * and partial, so this `$set` can only touch the fields a human actually types
 * — `event`, `reservation` and `recordedBy` stay exactly as first written.
 */
export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/checkins/:id", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, updateCheckInSchema);
    if ("response" in parsed) return parsed.response;

    // `.partial()` means an empty object validates too. Treat that as a bad
    // request rather than spending a write on a no-op.
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) return jsonError("Nothing to update", 400);

    await connectDB();
    const updated = await CheckIn.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return jsonError("Not found", 404);

    return NextResponse.json({
      data: {
        id: String(updated._id),
        eventId: String(updated.event),
        name: updated.name,
        phone: updated.phone,
        paymentMethod: updated.paymentMethod,
        amount: updated.amount,
        reservationId: updated.reservation ? String(updated.reservation) : null,
        createdAt: new Date(updated.createdAt).toISOString(),
        note: updated.note ?? "",
      },
    });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/checkins/:id", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const removed = await CheckIn.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("Not found", 404);

    return NextResponse.json({ data: { success: true } });
  });
}
