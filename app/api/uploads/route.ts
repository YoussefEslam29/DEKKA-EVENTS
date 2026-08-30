// POST /api/uploads — upload an image (any signed-in member), returns its
// public URL. Widened from admin-only to member per
// PLAN/LOG_SIGN_AUTH_IN.md §5b item 1, so a member can upload their own
// account photo — event-poster callers stay admin-gated one layer up, in
// EventForm.tsx's own admin-only page, so this doesn't open posters to
// non-admins.
//
// Where the bytes actually land is `lib/storage.ts`'s decision: Vercel Blob
// when `BLOB_READ_WRITE_TOKEN` is set, local `public/uploads/events/` otherwise.
import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { EXT_BY_TYPE, MAX_UPLOAD_BYTES, storeUpload } from "@/lib/storage";

export async function POST(request: Request) {
  return handle("POST /api/uploads", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) return jsonError("Unsupported image type", 400);
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("Image is too large (max 5MB)", 400);

    const url = await storeUpload(file, ext);

    return NextResponse.json({ data: { url } }, { status: 201 });
  });
}
