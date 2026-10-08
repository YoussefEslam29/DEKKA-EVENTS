// GET  /api/events/:id/checkins — the door table for one event (staff/admin)
// POST /api/events/:id/checkins — log an arrival: name, phone, how they paid
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { CheckIn, type ICheckIn } from "@/models/CheckIn";
import { Reservation } from "@/models/Reservation";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { checkInSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { getCheckIns } from "@/lib/data";
import { recordCheckInAudit, snapshotCheckIn } from "@/lib/checkin-audit";

type Params = { params: Promise<{ id: string }> };

/** The door-row shape the door table works with (same as `getCheckIns`). */
function toDTO(row: ICheckIn) {
  return {
    id: String(row._id),
    eventId: String(row.event),
    name: row.name,
    phone: row.phone,
    paymentMethod: row.paymentMethod,
    amount: row.amount,
    gender: row.gender ?? null,
    reservationId: row.reservation ? String(row.reservation) : null,
    createdAt: new Date(row.createdAt).toISOString(),
    note: row.note ?? "",
  };
}

export async function GET(_request: Request, { params }: Params) {
  return handle("GET /api/events/:id/checkins", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    return NextResponse.json({ data: await getCheckIns(id) });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle("POST /api/events/:id/checkins", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, checkInSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    await connectDB();
    const event = await Event.findById(id).select("_id paymentMethods").lean();
    if (!event) return jsonError("Not found", 404);

    // A resend of an entry the door phone already sent (lib/door-queue.ts, roadmap R3):
    // answer with the row that's there, recording nothing new. Checked before the
    // reservation rule below, or a replay of a reserved guest would read as "already
    // checked in" and the phone would show an error for an entry that worked.
    if (input.clientId) {
      const existing = await CheckIn.findOne({ clientId: input.clientId }).lean();
      if (existing) {
        if (String(existing.event) !== id) return jsonError("CLIENT_ID_REUSED", 409);
        return NextResponse.json({ data: toDTO(existing), replayed: true });
      }
    }

    let reservationId: string | null = null;
    if (input.reservationId) {
      if (!isValidId(input.reservationId)) return jsonError("Invalid reservation", 400);
      const reservation = await Reservation.findOne({
        _id: input.reservationId,
        event: id,
      }).select("_id");
      if (!reservation) return jsonError("Reservation not found", 404);

      const already = await CheckIn.findOne({ reservation: reservation._id }).select("_id");
      if (already) return jsonError("ALREADY_CHECKED_IN", 409);

      reservationId = String(reservation._id);
    }

    let checkIn;
    try {
      checkIn = await CheckIn.create({
        event: id,
        name: input.name,
        phone: input.phone,
        paymentMethod: input.paymentMethod,
        amount: input.amount,
        gender: input.gender ?? null,
        reservation: reservationId,
        recordedBy: auth.user.id,
        note: input.note,
        ...(input.clientId ? { clientId: input.clientId } : {}),
      });
    } catch (error) {
      // Two copies of the same entry racing each other: the unique index let one in.
      // Answer the loser with the winner's row, exactly like a replay.
      if ((error as { code?: number })?.code === 11000 && input.clientId) {
        const winner = await CheckIn.findOne({ clientId: input.clientId }).lean();
        if (winner) return NextResponse.json({ data: toDTO(winner), replayed: true });
      }
      throw error;
    }

    await recordCheckInAudit({
      checkIn: String(checkIn._id),
      event: id,
      action: "create",
      user: auth.user,
      changes: snapshotCheckIn(checkIn, "in"),
    });

    return NextResponse.json({ data: toDTO(checkIn.toObject()) }, { status: 201 });
  });
}
