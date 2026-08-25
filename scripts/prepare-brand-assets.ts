/**
 * Turns the supplied brand JPGs into web-ready assets: the trimmed logo
 * lockup, a square mark for favicons/avatars, `app/favicon.ico` itself, and
 * the banner.
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
import { existsSync } from "node:fs";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_LOGO = path.join(ROOT, "IMGS", "DEKKA LOGO.jpg");
const SRC_BANNER = path.join(ROOT, "IMGS", "DEKKA BANNER.jpg");
const OUT_DIR = path.join(ROOT, "public", "brand");
const APP_DIR = path.join(ROOT, "app");

/**
 * Auth hero photos (LOG_SIGN_AUTH_IN.md §3): one per mode, optional. No real
 * photography exists yet, so these two source files are absent today — that's
 * expected, not an error. Unlike the logo/banner they're only *copied* through
 * (a plain JPEG, same as the banner), not knocked-out/resized, since they're
 * full-bleed photos rather than mark artwork on a white background.
 */
const SRC_AUTH_HERO_LOGIN = path.join(ROOT, "IMGS", "auth-hero-login.jpg");
const SRC_AUTH_HERO_SIGNUP = path.join(ROOT, "IMGS", "auth-hero-signup.jpg");

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

/**
 * Packs PNG-compressed frames into a valid multi-resolution ICO container
 * (the PNG-in-ICO format every modern browser/OS accepts since Vista) — no
 * external ico library needed for a handful of small, well-documented fields.
 */
function buildIco(frames: { size: number; png: Buffer }[]): Buffer {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE = 16;
  let offset = HEADER_SIZE + ENTRY_SIZE * frames.length;

  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY_SIZE);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256px
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
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

  // Browser tabs request /favicon.ico directly — Next's `app/favicon.ico`
  // convention wins over metadata.icons regardless of what layout.tsx points
  // at, so the real mark has to live there too, not just in public/brand/.
  const icoSizes = [16, 32, 48];
  const icoFrames = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      png: await sharp(mark.data)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    }))
  );
  const favicon = buildIco(icoFrames);
  await writeFile(path.join(APP_DIR, "favicon.ico"), favicon);
  console.log(`favicon.ico          16/32/48px  ${(favicon.length / 1024).toFixed(0)}kb`);

  await copyFile(SRC_BANNER, path.join(OUT_DIR, "dekka-banner.jpg"));
  console.log("dekka-banner.jpg    copied");

  // Auth hero photos: optional, processed only if the source file exists —
  // both /login and /signup fall back to the gradient + tatreez treatment
  // (BrandHeroFallback in components/auth/AuthScreen.tsx) when absent, so a
  // missing source here is the normal case today, not a failure.
  const authHeroSources: [string, string][] = [
    [SRC_AUTH_HERO_LOGIN, "auth-hero-login.jpg"],
    [SRC_AUTH_HERO_SIGNUP, "auth-hero-signup.jpg"],
  ];
  for (const [src, outName] of authHeroSources) {
    if (existsSync(src)) {
      await copyFile(src, path.join(OUT_DIR, outName));
      console.log(`${outName}  copied`);
    } else {
      console.log(`${outName}  skipped (no source file at IMGS/${outName})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
