// PATCH  /api/account — update the signed-in member's own name/phone/photo.
// DELETE /api/account — delete the signed-in member's own account (PLAN/SITE_ROADMAP.md F7).
// Ownership is implicit: this always acts on the session's own user, never an
// `:id` param, per PLAN/LOG_SIGN_AUTH_IN.md §5b's API surface table. Email is
// deliberately not writable here — see updateAccountSchema.
import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Reservation } from "@/models/Reservation";
import { CheckIn } from "@/models/CheckIn";
import { CheckInAudit } from "@/models/CheckInAudit";
import { PushSubscription } from "@/models/PushSubscription";
import { BandSubmission } from "@/models/BandSubmission";
import { handle, jsonError, parseBody } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { deleteAccountSchema, updateAccountSchema } from "@/lib/validation";
import { releaseUploads } from "@/lib/storage";
import { rateLimit } from "@/lib/ratelimit";
import { forgetSessionAccount } from "@/lib/session-check";

export async function PATCH(request: Request) {
  return handle("PATCH /api/account", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, updateAccountSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const before = await User.findById(auth.user.id).select("image").lean();
    const updated = await User.findByIdAndUpdate(
      auth.user.id,
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!updated) return jsonError("Not found", 404);
    // The old file goes once nothing else points at it (PLAN/SITE_ROADMAP.md S9).
    if (before?.image && before.image !== updated.image) after(() => releaseUploads([before.image]));

    // Never echo the hash back, even to the account's own owner.
    return NextResponse.json({
      data: {
        id: String(updated._id),
        name: updated.name,
        phone: updated.phone ?? "",
        image: updated.image ?? "",
      },
    });
  });
}

/** What a deleted member's name and phone become wherever a record has to stay. */
const REDACTED = "—";

/**
 * Self-service account deletion (`PLAN/SITE_ROADMAP.md` F7; the privacy policy's "delete
 * your data"). Proof first: a password account re-enters its password, an account with
 * none types its email.
 *
 * What goes and what stays: the account and its push devices are deleted. Reservations
 * and the door rows checked in from them stay, because a night's numbers and the cash
 * record depend on them, but the person's name and phone are replaced on them and in the
 * door log. Show pitches stay with Dekka, unlinked. The session dies at its next check
 * (the account no longer exists; lib/session-check.ts) and the form signs out at once.
 */
export async function DELETE(request: Request) {
  return handle("DELETE /api/account", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const rl = await rateLimit("account-delete", auth.user.id);
    if ("response" in rl) return rl.response;

    const parsed = await parseBody(request, deleteAccountSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const user = await User.findById(auth.user.id).select("+passwordHash").lean();
    if (!user) return jsonError("Not found", 404);

    if (user.passwordHash) {
      const ok =
        parsed.data.password != null && (await bcrypt.compare(parsed.data.password, user.passwordHash));
      if (!ok) return jsonError("WRONG_PASSWORD", 400);
    } else if (parsed.data.confirmEmail !== user.email) {
      return jsonError("EMAIL_MISMATCH", 400);
    }

    // Never leave Dekka without anyone who can run it.
    if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
      return jsonError("LAST_ADMIN", 409);
    }

    const reservationIds = (
      await Reservation.find({ user: user._id }).select("_id").lean()
    ).map((r) => r._id);
    const checkInIds = (
      await CheckIn.find({
        $or: [{ reservation: { $in: reservationIds } }, { voidedReservation: { $in: reservationIds } }],
      })
        .select("_id")
        .lean()
    ).map((c) => c._id);

    // One step at a time, the account itself last: if any step fails the account is
    // still there, and deleting again simply redoes the (idempotent) steps.
    // Atlas could run this as a transaction, but a standalone local MongoDB can't, and
    // ordering gives the same safety here.
    await Reservation.updateMany({ user: user._id }, { $set: { name: REDACTED, phone: REDACTED } });
    await CheckIn.updateMany({ _id: { $in: checkInIds } }, { $set: { name: REDACTED, phone: REDACTED } });
    // The door log's snapshots carry the name and phone too; keep the amounts.
    await CheckInAudit.updateMany(
      { checkIn: { $in: checkInIds } },
      [
        {
          $set: {
            changes: {
              $map: {
                input: "$changes",
                as: "c",
                in: {
                  $cond: [
                    { $in: ["$$c.field", ["name", "phone"]] },
                    {
                      field: "$$c.field",
                      from: { $cond: [{ $eq: ["$$c.from", null] }, null, REDACTED] },
                      to: { $cond: [{ $eq: ["$$c.to", null] }, null, REDACTED] },
                    },
                    "$$c",
                  ],
                },
              },
            },
          },
        },
      ],
      // Mongoose 9 only runs an aggregation-pipeline update when asked to explicitly.
      { updatePipeline: true }
    );
    await PushSubscription.deleteMany({ user: user._id });
    await BandSubmission.updateMany({ user: user._id }, { $set: { user: null } });
    await User.deleteOne({ _id: user._id });
    forgetSessionAccount(String(user._id));
    after(() => releaseUploads([user.image]));

    return NextResponse.json({ data: { deleted: true } });
  });
}
