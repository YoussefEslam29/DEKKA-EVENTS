// POST /api/uploads — upload an image (any signed-in member), returns its
// public URL. Widened from admin-only to member per
// PLAN/LOG_SIGN_AUTH_IN.md §5b item 1, so a member can upload their own
// account photo — event-poster callers stay admin-gated one layer up, in
// EventForm.tsx's own admin-only page, so this doesn't open posters to
// non-admins. Files land in public/uploads/events/ and are served
// statically — see the Known Gaps note in developer-guide.md for why that's
// a deliberate, dev-scale tradeoff rather than a full object-storage
// integration.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "events");
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  return handle("POST /api/uploads", async () => {
    const auth = await guard("member");
    if ("response" in auth) return auth.response;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) return jsonError("Unsupported image type", 400);
    if (file.size > MAX_BYTES) return jsonError("Image is too large (max 5MB)", 400);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json(
      { data: { url: `/uploads/events/${filename}` } },
      { status: 201 }
    );
  });
}
