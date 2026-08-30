// GET  /api/events/:id/checkins — the door table for one event (staff/admin)
// POST /api/events/:id/checkins — log an arrival: name, phone, how they paid
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { CheckIn } from "@/models/CheckIn";
import { Reservation } from "@/models/Reservation";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { checkInSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";
import { getCheckIns } from "@/lib/data";

type Params = { params: Promise<{ id: string }> };

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

    const checkIn = await CheckIn.create({
      event: id,
      name: input.name,
      phone: input.phone,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      gender: input.gender ?? null,
      reservation: reservationId,
      recordedBy: auth.user.id,
      note: input.note,
    });

    return NextResponse.json(
      {
        data: {
          id: String(checkIn._id),
          eventId: id,
          name: checkIn.name,
          phone: checkIn.phone,
          paymentMethod: checkIn.paymentMethod,
          amount: checkIn.amount,
          gender: checkIn.gender ?? null,
          reservationId,
          createdAt: checkIn.createdAt.toISOString(),
          note: checkIn.note ?? "",
        },
      },
      { status: 201 }
    );
  });
}
