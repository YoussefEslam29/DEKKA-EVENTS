// GET  /api/events  — list events (public sees published/past only; admin sees all)
// POST /api/events  — create an event (admin only)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";
import { handle, parseBody } from "@/lib/api";
import { createEventSchema } from "@/lib/validation";
import { currentUser, hasRole, guard } from "@/lib/rbac";
import { toEventDTO } from "@/lib/data";

export async function GET(request: Request) {
  return handle("GET /api/events", async () => {
    const user = await currentUser();
    const url = new URL(request.url);
    const when = url.searchParams.get("when");

    await connectDB();
    const filter: Record<string, unknown> = hasRole(user, "admin")
      ? {}
      : { status: { $in: ["published", "closed", "happened", "archived"] } };

    if (when === "upcoming") filter.startsAt = { $gte: new Date() };
    if (when === "past") filter.startsAt = { $lt: new Date() };

    const docs = await Event.find(filter)
      .sort({ startsAt: when === "past" ? -1 : 1 })
      .limit(100)
      .lean();

    return NextResponse.json({ data: docs.map((d) => toEventDTO(d)) });
  });
}

export async function POST(request: Request) {
  return handle("POST /api/events", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, createEventSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    await connectDB();
    const event = await Event.create({
      ...input,
      startsAt: new Date(input.startsAt),
      doorsOpenAt: input.doorsOpenAt ? new Date(input.doorsOpenAt) : undefined,
      capacity: input.capacity ?? null,
    });

    return NextResponse.json({ data: toEventDTO(event.toObject()) }, { status: 201 });
  });
}
