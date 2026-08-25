// POST   /api/push/subscribe — upsert this browser/device's push subscription.
// DELETE /api/push/subscribe — remove one device's subscription (e.g. an
//        explicit "turn off notifications" control).
// PLAN/LOG_SIGN_AUTH_IN.md §6. Ownership is implicit for POST (the session's
// own user id is written, never a caller-supplied one); DELETE additionally
// scopes to `user` so one member can't unsubscribe someone else's device by
// guessing its endpoint.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PushSubscription } from "@/models/PushSubscription";
import { handle, parseBody } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return handle("POST /api/push/subscribe", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, pushSubscribeSchema);
    if ("response" in parsed) return parsed.response;
    const { endpoint, keys } = parsed.data;

    await connectDB();
    // Upsert by endpoint — the same browser subscribing again (e.g. after
    // clearing site data and re-enabling) replaces its own row rather than
    // duplicating; the same endpoint reappearing under a different signed-in
    // user (a shared/public machine) re-points it at whoever asked last.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { $set: { endpoint, keys, user: auth.user.id } },
      { upsert: true, runValidators: true }
    );

    return NextResponse.json({ data: { success: true } }, { status: 200 });
  });
}

export async function DELETE(request: Request) {
  return handle("DELETE /api/push/subscribe", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, pushUnsubscribeSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    await PushSubscription.deleteOne({
      endpoint: parsed.data.endpoint,
      user: auth.user.id,
    });

    return NextResponse.json({ data: { success: true } });
  });
}
