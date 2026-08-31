// GET    /api/events/:id — event detail (drafts are admin-only)
// PATCH  /api/events/:id — edit an event (admin only); a real draft/closed →
//        published transition also fans out a push notification (§6 below)
// DELETE /api/events/:id — delete an event and everything hanging off it (admin only)
import { NextResponse } from "next/server";
import webpush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { connectDB } from "@/lib/db";
import { Event, type IEvent } from "@/models/Event";
import { Reservation } from "@/models/Reservation";
import { CheckIn } from "@/models/CheckIn";
import { PushSubscription } from "@/models/PushSubscription";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { updateEventSchema } from "@/lib/validation";
import { currentUser, hasRole, guard } from "@/lib/rbac";
import { toEventDTO } from "@/lib/data";

type Params = { params: Promise<{ id: string }> };

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

// `setVapidDetails` throws on an empty/malformed value, so this only runs
// once real keys exist (`.env.example` ships blank on purpose — importing
// this route must not crash every GET/DELETE just because push isn't
// configured yet in this environment).
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Fans a "new night" push out to every subscribed device (`PLAN/LOG_SIGN_AUTH_IN.md`
 * §6), only ever called on a genuine draft/closed → published transition (see
 * the `PATCH` handler below). Best-effort end to end: one dead or erroring
 * subscription can't take down the rest (`Promise.allSettled`), and the
 * caller wraps this whole function so nothing it throws can turn a
 * successful publish into a 500 — the event is published either way;
 * notification delivery is best-effort on top of that.
 */
async function notifyEventPublished(doc: IEvent) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn("[events publish] VAPID keys not configured — skipping push fan-out");
    return;
  }

  const subs = await PushSubscription.find().lean();
  if (subs.length === 0) return;

  // i18n note (§6): a push payload is rendered by the OS outside the page —
  // it can't live-switch with the viewer's locale toggle the way in-page
  // text does. Sent as one bilingual string instead, the same "English /
  // Arabic on one line" pattern `BilingualLabel` uses everywhere else.
  const payload = JSON.stringify({
    title: "New night at Dekka / ليلة جديدة في دكة",
    body: doc.titleEn || doc.titleAr,
    url: `/events/${doc._id}`,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the browser unsubscribed or the endpoint expired —
        // clean up so the next publish doesn't keep retrying a dead device.
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error("[events publish] push send failed", statusCode ?? "", err);
          // A push that fails for any reason other than a dead endpoint is invisible
          // otherwise: the publish still succeeds, the admin sees success, and nobody
          // learns that nobody was notified. Reported, not thrown -- one device
          // failing must not abort the fan-out to the rest.
          Sentry.captureException(err, {
            tags: { route: "PATCH /api/events/:id", stage: "push-send" },
            extra: { statusCode },
          });
        }
      }
    })
  );
}

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
      "locationAr", "locationEn", "mapUrl", "coverImage", "isPoster",
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

    // §6: the *previous* status has to be read before the write — a
    // findByIdAndUpdate alone only ever hands back the new document, so
    // there'd be no way to tell "just published" apart from "already
    // published, just editing the description" without this extra read.
    const before = await Event.findById(id).select("status").lean();
    if (!before) return jsonError("Not found", 404);

    const doc = await Event.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return jsonError("Not found", 404);

    // Only a genuine draft/closed → published transition notifies — a
    // re-save of an already-published event must never re-notify.
    if (update.status === "published" && before.status !== "published") {
      try {
        await notifyEventPublished(doc);
      } catch (err) {
        console.error("[PATCH /api/events/:id] push fan-out failed", err);
        // Deliberately swallowed so a push failure never turns a successful publish
        // into a 500 -- but swallowed is not the same as unseen. Without this the
        // whole fan-out can fail silently on every publish forever.
        Sentry.captureException(err, {
          tags: { route: "PATCH /api/events/:id", stage: "push-fanout" },
          extra: { eventId: String(doc._id) },
        });
      }
    }

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
