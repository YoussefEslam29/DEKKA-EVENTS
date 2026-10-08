// POST /api/uploads — upload an image (any signed-in member), returns its
// public URL. Widened from admin-only to member per
// PLAN/LOG_SIGN_AUTH_IN.md §5b item 1, so a member can upload their own
// account photo — event-poster callers stay admin-gated one layer up, in
// EventForm.tsx's own admin-only page, so this doesn't open posters to
// non-admins.
//
// The file's own bytes decide its type, and every image is re-encoded before it is
// stored (lib/image-processing.ts): no metadata (a phone photo's GPS position included)
// survives, and nothing the image decoder didn't understand is kept (PLAN/SITE_ROADMAP.md S9).
//
// Where the bytes actually land is `lib/storage.ts`'s decision: Vercel Blob
// when `BLOB_READ_WRITE_TOKEN` is set, local `public/uploads/events/` otherwise.
import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { MAX_UPLOAD_BYTES, storeUpload } from "@/lib/storage";
import { processImage, sniffImageType } from "@/lib/image-processing";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle("POST /api/uploads", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    // Keyed by user id, not IP: uploads are authenticated, and an IP key would
    // make one guest on cafe wifi throttle everyone else on it.
    const rl = await rateLimit("upload", auth.user.id);
    if ("response" in rl) return rl.response;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("Image is too large (max 5MB)", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return jsonError("Unsupported image type", 400);

    let processed;
    try {
      processed = await processImage(bytes, type);
    } catch {
      // Right signature, but the decoder can't read it: a corrupt or crafted file.
      return jsonError("Unsupported image type", 400);
    }

    const url = await storeUpload(processed.buffer, processed.type, processed.ext);

    return NextResponse.json({ data: { url } }, { status: 201 });
  });
}
