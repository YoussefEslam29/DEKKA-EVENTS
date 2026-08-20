// GET    /api/events/:id — event detail (drafts are admin-only)
// PATCH  /api/events/:id — edit an event (admin only)
// DELETE /api/events/:id — delete an event and everything hanging off it (admin only)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { Reservation } from "@/models/Reservation";
import { CheckIn } from "@/models/CheckIn";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateEventSchema } from "@/lib/validation";
import { currentUser, hasRole, guard } from "@/lib/rbac";
import { toEventDTO } from "@/lib/data";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle("GET /api/events/:id", async () => {
    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const doc = await Event.findById(id).lean();
    if (!doc) return jsonError("Not found", 404);

    const user = await currentUser();
    if (doc.status === "draft" && !hasRole(user, "admin")) {
      return jsonError("Not found", 404);
    }

    return NextResponse.json({ data: toEventDTO(doc) });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/events/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, updateEventSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    // Build the update explicitly — no spreading of caller-controlled keys.
    const update: Record<string, unknown> = {};
    const passthrough = [
      "titleAr", "titleEn", "descriptionAr", "descriptionEn",
      "locationAr", "locationEn", "mapUrl", "coverImage",
      "instapayNumber", "termsAr", "termsEn", "status", "paymentMethods",
    ] as const;
    for (const key of passthrough) {
      if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.price !== undefined) update.price = input.price;
    if (input.capacity !== undefined) update.capacity = input.capacity ?? null;
    if (input.startsAt !== undefined) update.startsAt = new Date(input.startsAt);
    if (input.doorsOpenAt !== undefined) {
      update.doorsOpenAt = input.doorsOpenAt ? new Date(input.doorsOpenAt) : null;
    }

    await connectDB();
    const doc = await Event.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return jsonError("Not found", 404);

    return NextResponse.json({ data: toEventDTO(doc) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/events/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const doc = await Event.findByIdAndDelete(id).lean();
    if (!doc) return jsonError("Not found", 404);

    // Reservations and door rows are meaningless without their event.
    await Promise.all([
      Reservation.deleteMany({ event: id }),
      CheckIn.deleteMany({ event: id }),
    ]);

    return NextResponse.json({ data: { success: true } });
  });
}
