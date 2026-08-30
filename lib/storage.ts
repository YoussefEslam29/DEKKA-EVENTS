// Where uploaded images physically live.
//
// Two backends, picked by whether `BLOB_READ_WRITE_TOKEN` is set:
//
//   - **Vercel Blob** (production). Vercel's runtime filesystem is ephemeral and
//     read-only, so the old `writeFile` into `public/uploads/` silently lost
//     every poster between invocations. `put()` returns a permanent CDN URL.
//   - **Local disk** (`next dev`, or any single persistent server). Keeps the
//     original behaviour so `npm run dev` needs no Blob store and no token.
//
// The token is the switch rather than `process.env.VERCEL` so that a self-hosted
// deploy can opt into Blob, and so `vercel dev` (which pulls the token down with
// `vercel env pull`) exercises the same path production will.
//
// Both backends return the *same shaped* pathname — `events/<uuid>.<ext>` — which
// is what lets one regex in `lib/validation.ts` (`UPLOAD_IMAGE_PATTERN`) accept
// either form. Keep the two in sync.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "events");

/** The image types `/api/uploads` accepts, and the extension each is stored under. */
export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** True when uploads will go to Vercel Blob rather than local disk. */
export function usingBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Persists an uploaded image and returns the URL to store in the database.
 *
 * `addRandomSuffix: false` matters: we generate the UUID ourselves so the
 * pathname is exactly `events/<uuid>.<ext>`. Letting Blob append its own suffix
 * would produce `events/<uuid>-<random>.<ext>`, which `UPLOAD_IMAGE_PATTERN`
 * would then reject — the upload would succeed and the save would fail.
 */
export async function storeUpload(file: File, ext: string): Promise<string> {
  const key = `events/${randomUUID()}.${ext}`;

  if (usingBlobStorage()) {
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });
    return blob.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(
    path.join(LOCAL_DIR, path.basename(key)),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/${key}`;
}
