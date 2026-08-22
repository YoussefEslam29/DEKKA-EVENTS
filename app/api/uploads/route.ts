// POST /api/uploads — upload an image (admin only), returns its public URL.
// Files land in public/uploads/events/ and are served statically — see the
// Known Gaps note in developer-guide.md for why that's a deliberate,
// dev-scale tradeoff rather than a full object-storage integration.
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
    const auth = await guard("admin");
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
