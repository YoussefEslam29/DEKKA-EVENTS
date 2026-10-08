// GET /api/account/export — everything Dekka holds about the signed-in member, as a
// JSON download (PLAN/SITE_ROADMAP.md F7: the "receive a copy" right the privacy policy
// cites). Only ever the caller's own data; the id comes from the session.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Reservation } from "@/models/Reservation";
import { BandSubmission } from "@/models/BandSubmission";
import { PushSubscription } from "@/models/PushSubscription";
import type { IEvent } from "@/models/Event";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle("GET /api/account/export", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    await connectDB();
    const user = await User.findById(auth.user.id).lean();
    if (!user) return jsonError("Not found", 404);

    const [reservations, submissions, devices] = await Promise.all([
      Reservation.find({ user: user._id })
        .populate<{ event: Pick<IEvent, "titleAr" | "titleEn" | "startsAt"> | null }>("event", "titleAr titleEn startsAt")
        .sort({ createdAt: -1 })
        .lean(),
      BandSubmission.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
      PushSubscription.countDocuments({ user: user._id }),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        photo: user.image ?? "",
        signInMethods: user.providers,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt,
      },
      reservations: reservations.map((r) => ({
        event: r.event ? { titleAr: r.event.titleAr, titleEn: r.event.titleEn, startsAt: r.event.startsAt } : null,
        name: r.name,
        phone: r.phone,
        doorCode: r.code,
        status: r.status,
        reservedAt: r.createdAt,
      })),
      showPitches: submissions.map((s) => ({
        bandName: s.bandName,
        genre: s.genre,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        links: s.links,
        preferredDates: s.preferredDates,
        pitch: s.pitch,
        status: s.status,
        sentAt: s.createdAt,
      })),
      pushNotificationDevices: devices,
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dekka-my-data.json"',
        "Cache-Control": "no-store",
      },
    });
  });
}
