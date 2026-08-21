/**
 * Turns the supplied brand JPGs into web-ready assets.
 *
 * The real logo ships as dark-brown-and-tan artwork on a solid white JPEG
 * background, which means it vanishes (or shows a white box) the moment it sits
 * on a dark or cream surface. authorization-UI.md §1 calls this out and asks for
 * a transparent PNG before implementation — this script produces one instead of
 * waiting on a manual export, so the asset pipeline is reproducible.
 *
 *   npm run brand:assets
 */
import path from "node:path";
import { mkdir, copyFile } from "node:fs/promises";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_LOGO = path.join(ROOT, "IMGS", "DEKKA LOGO.jpg");
const SRC_BANNER = path.join(ROOT, "IMGS", "DEKKA BANNER.jpg");
const OUT_DIR = path.join(ROOT, "public", "brand");

/**
 * Luminance window over which a pixel fades from opaque to fully transparent.
 * The source is a JPEG, so edges are anti-aliased and carry compression noise;
 * a soft ramp keeps the letterforms smooth instead of producing jagged cutouts,
 * while colours below the floor are passed through untouched so the tan keeps
 * its exact brand value.
 */
const WHITE_CEILING = 250; // at or above this, treat as background
const INK_FLOOR = 236; // at or below this, treat as fully opaque artwork

async function knockOutWhite(input: string) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const luminance =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    if (luminance >= WHITE_CEILING) {
      data[i + 3] = 0;
    } else if (luminance > INK_FLOOR) {
      data[i + 3] = Math.round(
        ((WHITE_CEILING - luminance) / (WHITE_CEILING - INK_FLOOR)) * 255
      );
    }
    // Below INK_FLOOR the pixel is artwork: keep colour and full alpha.
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Full lockup: دكة wordmark + "Dekka", trimmed tight so layout controls the
  // padding rather than the 2048px of empty canvas around the original.
  const logo = await knockOutWhite(SRC_LOGO);
  const lockup = await logo
    .trim()
    .resize({ width: 1200, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  await sharp(lockup.data).toFile(path.join(OUT_DIR, "dekka-logo.png"));
  console.log(
    `dekka-logo.png      ${lockup.info.width}x${lockup.info.height}  ${(lockup.info.size / 1024).toFixed(0)}kb`
  );

  // Small square rendition for favicons and tight avatar slots.
  const mark = await sharp(lockup.data)
    .resize({
      width: 512,
      height: 512,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  await sharp(mark.data).toFile(path.join(OUT_DIR, "dekka-logo-square.png"));
  console.log(`dekka-logo-square.png  512x512  ${(mark.info.size / 1024).toFixed(0)}kb`);

  await copyFile(SRC_BANNER, path.join(OUT_DIR, "dekka-banner.jpg"));
  console.log("dekka-banner.jpg    copied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
