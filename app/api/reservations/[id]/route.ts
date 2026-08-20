// DELETE /api/reservations/:id — a member cancels their own spot (admin may cancel any)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Reservation } from "@/models/Reservation";
import { handle, isValidId, jsonError } from "@/lib/api";
import { currentUser, hasRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/reservations/:id", async () => {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const reservation = await Reservation.findById(id);
    if (!reservation) return jsonError("Not found", 404);

    const isOwner = String(reservation.user) === user.id;
    if (!isOwner && !hasRole(user, "admin")) return jsonError("Forbidden", 403);

    // Cancel rather than delete so the spot frees up but the history survives.
    reservation.status = "cancelled";
    await reservation.save();

    return NextResponse.json({ data: { success: true } });
  });
}
