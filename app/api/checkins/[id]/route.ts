// PATCH  /api/checkins/:id — correct a door entry in place (staff/admin)
// DELETE /api/checkins/:id — remove a door entry: voids it, never deletes it (staff/admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CheckIn } from "@/models/CheckIn";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateCheckInSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { diffCheckIn, recordCheckInAudit, snapshotCheckIn } from "@/lib/checkin-audit";

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
 *
 * Every edit lands in the door log with who made it and what changed
 * (`PLAN/SITE_ROADMAP.md` I3); a voided row can't be edited at all.
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
    const before = await CheckIn.findById(id).lean();
    if (!before) return jsonError("Not found", 404);
    if (before.voidedAt) return jsonError("CHECKIN_VOIDED", 409);

    const updated = await CheckIn.findOneAndUpdate(
      { _id: id, voidedAt: null },
      { $set: patch },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!updated) return jsonError("CHECKIN_VOIDED", 409);

    await recordCheckInAudit({
      checkIn: id,
      event: String(updated.event),
      action: "update",
      user: auth.user,
      changes: diffCheckIn(before, patch),
    });

    return NextResponse.json({
      data: {
        id: String(updated._id),
        eventId: String(updated.event),
        name: updated.name,
        phone: updated.phone,
        paymentMethod: updated.paymentMethod,
        amount: updated.amount,
        gender: updated.gender ?? null,
        reservationId: updated.reservation ? String(updated.reservation) : null,
        createdAt: new Date(updated.createdAt).toISOString(),
        note: updated.note ?? "",
      },
    });
  });
}

/**
 * "Remove" at the door. Door rows are the record of cash taken, so this voids the row:
 * it drops out of every total, the guest can be checked in again (the reservation link
 * moves to `voidedReservation`, which frees the unique partial index), and the door log
 * keeps the row's values and who removed it. The update is conditional on the row still
 * being live, so two staff removing the same row log one removal, not two.
 */
export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/checkins/:id", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const live = await CheckIn.findOne({ _id: id, voidedAt: null }).lean();
    if (!live) return jsonError("Not found", 404);

    const voided = await CheckIn.findOneAndUpdate(
      { _id: id, voidedAt: null },
      {
        $set: {
          voidedAt: new Date(),
          voidedBy: auth.user.id,
          voidedReservation: live.reservation ?? null,
          reservation: null,
        },
      },
      { returnDocument: "after" }
    ).lean();
    if (!voided) return jsonError("Not found", 404);

    await recordCheckInAudit({
      checkIn: id,
      event: String(live.event),
      action: "void",
      user: auth.user,
      changes: snapshotCheckIn(live, "out"),
    });

    return NextResponse.json({ data: { success: true } });
  });
}
