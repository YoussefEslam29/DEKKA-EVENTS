/**
 * Browser-side image upload to `POST /api/uploads`, shared by the admin forms
 * that take a photo (menu items, event templates). Plain `fetch`, no Node APIs,
 * so client components can import it.
 */

/**
 * Mirrors `MAX_UPLOAD_BYTES` in `lib/storage.ts` (which is server-only — it
 * writes to disk). Checked here too so an oversized photo fails instantly
 * instead of after a slow upload; the server's check is still the real gate.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadResult = { url: string } | { error: "tooBig" | "badType" | "failed" };

export async function uploadImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "tooBig" };
  try {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (res.ok && typeof json?.data?.url === "string") return { url: json.data.url };
    return { error: json?.error === "Unsupported image type" ? "badType" : "failed" };
  } catch {
    return { error: "failed" };
  }
}
