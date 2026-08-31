// GET  /api/events/:id/reservations — the door list (staff/admin)
// POST /api/events/:id/reservations — hold a spot for the signed-in member
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { Reservation, generateReservationCode } from "@/models/Reservation";
import { User } from "@/models/User";
import { handle, isValidId, jsonError } from "@/lib/api";
import { currentUser, guard } from "@/lib/rbac";
import { getEventReservations } from "@/lib/data";
import { rateLimit } from "@/lib/ratelimit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle("GET /api/events/:id/reservations", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    return NextResponse.json({ data: await getEventReservations(id) });
  });
}

export async function POST(_request: Request, { params }: Params) {
  return handle("POST /api/events/:id/reservations", async () => {
    const user = await currentUser();
    if (!user) return jsonError("Unauthorized", 401);

    // Booking spam on a real event night. Keyed by user id -- authenticated, and
    // an IP key would throttle a whole table of friends on the same wifi.
    const rl = await rateLimit("reserve", user.id);
    if ("response" in rl) return rl.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const event = await Event.findById(id).lean();
    if (!event) return jsonError("Not found", 404);
    if (event.status !== "published") return jsonError("RESERVATIONS_CLOSED", 409);
    if (new Date(event.startsAt).getTime() < Date.now()) {
      return jsonError("RESERVATIONS_CLOSED", 409);
    }

    const existing = await Reservation.findOne({ event: id, user: user.id });
    if (existing?.status === "confirmed") {
      return NextResponse.json({
        data: { id: String(existing._id), code: existing.code, alreadyHeld: true },
      });
    }

    // Capacity is checked here rather than enforced by an index: at cafe scale a
    // simultaneous double-booking is far less likely than it is confusing to
    // debug, and an admin can always close the event by hand.
    if (event.capacity != null) {
      const taken = await Reservation.countDocuments({
        event: id,
        status: "confirmed",
      });
      if (taken >= event.capacity) return jsonError("EVENT_FULL", 409);
    }

    const profile = await User.findById(user.id).lean();
    const name = profile?.name ?? user.name ?? "";
    const phone = profile?.phone ?? user.phone ?? "";
    if (!phone) return jsonError("PHONE_REQUIRED", 422);

    if (existing) {
      // Re-reserving after a cancellation reuses the row (unique event+user).
      existing.status = "confirmed";
      existing.name = name;
      existing.phone = phone;
      existing.code = generateReservationCode();
      await existing.save();
      return NextResponse.json(
        { data: { id: String(existing._id), code: existing.code } },
        { status: 201 }
      );
    }

    const reservation = await Reservation.create({
      event: id,
      user: user.id,
      name,
      phone,
      code: generateReservationCode(),
      status: "confirmed",
    });

    return NextResponse.json(
      { data: { id: String(reservation._id), code: reservation.code } },
      { status: 201 }
    );
  });
}
