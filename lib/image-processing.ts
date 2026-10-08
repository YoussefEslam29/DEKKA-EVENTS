// What happens to an uploaded image between the request and storage
// (`PLAN/SITE_ROADMAP.md` S9). Server-only.
//
// Two jobs: decide the real type from the bytes (the browser's declared MIME type is
// whatever the client says it is), and re-encode the picture. Re-encoding throws away
// every byte the decoder didn't understand, and drops all metadata, including the GPS
// position phones write into a photo, which on a public account picture would say where
// a member lives. It also caps the size: a 5 MB phone photo becomes a few hundred KB.
import sharp from "sharp";

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const EXT_FOR: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Longest side, in pixels, after processing. Plenty for a 1200px-wide event hero. */
export const MAX_IMAGE_SIDE = 2000;

/** The type the file's own first bytes say it is, or `null` for anything else. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)
  ) {
    return "image/png";
  }
  if (bytes.length >= 6) {
    const head = String.fromCharCode(...bytes.slice(0, 6));
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Re-encodes an image of a sniffed type: applies the EXIF rotation (so a portrait phone
 * photo stays upright once its EXIF is gone), fits it inside `MAX_IMAGE_SIDE`, and writes
 * it back out in the same format with no metadata. Throws on a file the decoder
 * rejects; the route turns that into a 400.
 */
export async function processImage(
  input: Buffer,
  type: ImageType
): Promise<{ buffer: Buffer; type: ImageType; ext: string }> {
  const animated = type === "image/gif" || type === "image/webp";
  let pipeline = sharp(input, { animated, limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true });

  if (type === "image/jpeg") pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  else if (type === "image/png") pipeline = pipeline.png({ compressionLevel: 9 });
  else if (type === "image/webp") pipeline = pipeline.webp({ quality: 85 });
  else pipeline = pipeline.gif();

  // sharp writes no metadata unless asked to (`withMetadata`), so EXIF, GPS, XMP and
  // ICC profiles are all dropped here.
  const buffer = await pipeline.toBuffer();
  return { buffer, type, ext: EXT_FOR[type] };
}
