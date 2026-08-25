// PATCH /api/account — update the signed-in member's own name/phone/photo.
// Ownership is implicit: this always acts on the session's own user, never an
// `:id` param, per PLAN/LOG_SIGN_AUTH_IN.md §5b's API surface table. Email is
// deliberately not writable here — see updateAccountSchema.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { updateAccountSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  return handle("PATCH /api/account", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const parsed = await parseBody(request, updateAccountSchema);
    if ("response" in parsed) return parsed.response;

    await connectDB();
    const updated = await User.findByIdAndUpdate(
      auth.user.id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return jsonError("Not found", 404);

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
