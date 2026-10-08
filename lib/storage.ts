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

// The accepted types and their extensions live in lib/image-processing.ts (`EXT_FOR`),
// decided from the file's bytes rather than the browser's say-so.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** True when uploads will go to Vercel Blob rather than local disk. */
export function usingBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Persists an already-processed image (`lib/image-processing.ts`) and returns the URL to
 * store in the database.
 *
 * `addRandomSuffix: false` matters: we generate the UUID ourselves so the
 * pathname is exactly `events/<uuid>.<ext>`. Letting Blob append its own suffix
 * would produce `events/<uuid>-<random>.<ext>`, which `UPLOAD_IMAGE_PATTERN`
 * would then reject — the upload would succeed and the save would fail.
 */
export async function storeUpload(bytes: Buffer, contentType: string, ext: string): Promise<string> {
  const key = `events/${randomUUID()}.${ext}`;

  if (usingBlobStorage()) {
    const blob = await put(key, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return blob.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, path.basename(key)), bytes);
  return `/uploads/${key}`;
}

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/events\//;

/**
 * Deletes uploaded images that nothing points at any more (`PLAN/SITE_ROADMAP.md` S9). A
 * replaced poster or photo used to stay in Vercel Blob forever, and Blob bills for it.
 *
 * "Nothing" is checked across every collection that can hold an upload, because one file
 * is often shared: Duplicate and event templates copy an event's poster URL, so deleting
 * on the first event that lets go of it would break all the others. Only Blob URLs are
 * touched; local-disk files (development) are left alone. Never throws: it runs after the
 * response, and a leftover file is a cost, not an error.
 */
export async function releaseUploads(urls: (string | null | undefined)[]): Promise<void> {
  if (!usingBlobStorage()) return;
  const candidates = [...new Set(urls.filter((u): u is string => !!u && BLOB_URL.test(u)))];
  if (candidates.length === 0) return;
  try {
    // Imported here, not at the top: lib/storage.ts is also used by routes that never
    // release anything, and the models pull in Mongoose.
    const [{ connectDB }, { Event }, { EventTemplate }, { MenuItem }, { User }, { del }] =
      await Promise.all([
        import("@/lib/db"),
        import("@/models/Event"),
        import("@/models/EventTemplate"),
        import("@/models/MenuItem"),
        import("@/models/User"),
        import("@vercel/blob"),
      ]);
    await connectDB();
    for (const url of candidates) {
      const refs = await Promise.all([
        Event.exists({ coverImage: url }),
        EventTemplate.exists({ coverImage: url }),
        MenuItem.exists({ image: url }),
        User.exists({ image: url }),
      ]);
      if (refs.every((r) => !r)) await del(url);
    }
  } catch (error) {
    console.error("[storage] releasing old uploads failed", error);
  }
}
