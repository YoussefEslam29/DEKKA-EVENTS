/**
 * `npm run check:hardening` — DB-free assertions for the roadmap's hardening phase
 * (`PLAN/SITE_ROADMAP.md` S5–S10, R2). Run it after touching push, headers, sessions,
 * uploads, door codes or band links.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MAX_DEVICES_PER_USER, isAllowedPushEndpoint } from "../lib/push";
import { contentSecurityPolicy, cspReportUri, securityHeaders } from "../lib/csp";
import { MAX_IMAGE_SIDE, processImage, sniffImageType } from "../lib/image-processing";
import { bandLink } from "../lib/validation";
import { RESERVATION_CODE_ALPHABET, generateReservationCode } from "../models/Reservation";
import { SESSION_RECHECK_MS, needsRecheck, sessionStillValid } from "../lib/session-check";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}

async function main() {
  // --- S5: push endpoints are real push services, and Publish never waits on them ----
  const allowed = [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QGx8",
  ];
  const refused = [
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://evil.example/fcm/send/abc",
    "https://fcm.googleapis.com.evil.example/x", // host confusion
    "https://evil.example/https://fcm.googleapis.com/",
    "https://user:pass@fcm.googleapis.com/x", // userinfo
    "https://fcm.googleapis.com:8443/x", // port
    "https://evilpush.services.mozilla.com/x", // suffix without the dot
    "https://push.services.mozilla.com/x", // the bare suffix itself
    "https://169.254.169.254/latest/meta-data",
    "not a url",
  ];
  for (const url of allowed) check(isAllowedPushEndpoint(url), `push endpoint allowed: ${url}`);
  for (const url of refused) check(!isAllowedPushEndpoint(url), `push endpoint refused: ${url}`);
  check(MAX_DEVICES_PER_USER === 10, "10 devices per account");

  const subscribe = read("app/api/push/subscribe/route.ts");
  check(/isAllowedPushEndpoint\(endpoint\)/.test(subscribe), "subscribe checks the allowlist");
  check(/rateLimit\("push-subscribe", auth\.user\.id\)/.test(subscribe), "subscribe is rate-limited per user");
  check(/\.skip\(MAX_DEVICES_PER_USER\)/.test(subscribe), "subscribe drops devices past the cap");
  const eventsRoute = read("app/api/events/[id]/route.ts");
  check(!/from "web-push"/.test(eventsRoute), "the events route no longer sends push itself");
  check(/after\(async \(\) => \{\s*try \{\s*await notifyEventPublished\(doc\)/.test(eventsRoute), "the publish fan-out runs in after()");
  check(/isAllowedPushEndpoint\(sub\.endpoint\)/.test(read("lib/push.ts")), "old rows outside the allowlist are skipped and removed");

  // --- S6: security headers -----------------------------------------------------------
  const csp = contentSecurityPolicy(null);
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) {
    check(csp.includes(directive), `CSP has ${directive}`);
  }
  check(!csp.includes("report-uri"), "no report-uri without a DSN");
  check(
    cspReportUri("https://abc123@o9.ingest.de.sentry.io/4507") ===
      "https://o9.ingest.de.sentry.io/api/4507/security/?sentry_key=abc123",
    "report-uri derived from the Sentry DSN"
  );
  check(cspReportUri("not a dsn") === null && cspReportUri(undefined) === null, "a bad DSN gives no report-uri");
  const headers = Object.fromEntries(securityHeaders(undefined).map((h) => [h.key, h.value]));
  check(headers["X-Content-Type-Options"] === "nosniff", "nosniff");
  check(headers["X-Frame-Options"] === "DENY", "X-Frame-Options DENY");
  check(/screen-wake-lock=\(self\)/.test(headers["Permissions-Policy"] ?? ""), "Wake Lock stays allowed for the door code");
  check("Content-Security-Policy-Report-Only" in headers, "CSP ships report-only");

  // --- S7: cover images are uploads only ------------------------------------------------
  const validation = read("lib/validation.ts");
  check(/coverImage: z\s*\.string\(\)\s*\.trim\(\)\s*\.max\(800\)\s*\.regex\(UPLOAD_IMAGE_PATTERN/.test(validation), "coverImage must be an upload");
  check(!/hostname: "\*\*"/.test(read("next.config.ts")), "no wildcard image host");

  // --- S8: sessions can be revoked ------------------------------------------------------
  const now = Date.now();
  check(needsRecheck(undefined, now), "a session never checked is checked");
  check(!needsRecheck(now - 1000, now), "a fresh check is reused");
  check(needsRecheck(now - SESSION_RECHECK_MS - 1, now), "an old check is redone");
  check(sessionStillValid(undefined, { sessionVersion: 0 }), "pre-existing sessions survive the deploy");
  check(sessionStillValid(2, { sessionVersion: 2 }), "matching versions are valid");
  check(!sessionStillValid(0, { sessionVersion: 1 }), "a bumped version ends the session");
  check(!sessionStillValid(1, null), "a deleted account ends the session");
  const auth = read("lib/auth.ts");
  check(/token\.sv = dbUser\.sessionVersion \?\? 0/.test(auth), "sign-in stamps the version");
  check(/trigger === "update" \|\| needsRecheck\(token\.checkedAt, now\)/.test(auth), "update() re-checks too");
  check(/!sessionStillValid\(token\.sv, account\)\) return null/.test(auth), "an invalid session returns null");
  check(/\$inc: \{ sessionVersion: 1 \}/.test(read("app/api/auth/reset-password/route.ts")), "a reset bumps the version");
  const pwRoute = read("app/api/account/password/route.ts");
  check(/sessionVersion = \(user\.sessionVersion \?\? 0\) \+ 1/.test(pwRoute), "a password change bumps the version");
  check(/rateLimit\("password-change", auth\.user\.id\)/.test(pwRoute), "password change is rate-limited");
  check(/sessionStillValid\(claims\.sv, account\)/.test(read("lib/rbac.ts")), "mobile tokens are revocable too");

  // --- S9: uploads are sniffed and re-encoded -------------------------------------------
  const png = await sharp({ create: { width: 3000, height: 1200, channels: 3, background: "#d9a566" } })
    .png()
    .toBuffer();
  const jpegWithExif = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#3b2a1f" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "dekka-check", Artist: "someone@home" } })
    .toBuffer();
  check(sniffImageType(png) === "image/png", "sniffs PNG");
  check(sniffImageType(jpegWithExif) === "image/jpeg", "sniffs JPEG");
  check(sniffImageType(Buffer.from("GIF89a......")) === "image/gif", "sniffs GIF");
  check(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ")) === "image/webp", "sniffs WEBP");
  check(sniffImageType(Buffer.from("<html><script>alert(1)</script>")) === null, "HTML is not an image");
  check(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')) === null, "SVG is refused");
  check(sniffImageType(Buffer.from([0xff, 0xd8])) === null, "a truncated header is refused");
  check(Boolean((await sharp(jpegWithExif).metadata()).exif), "the test JPEG really carries EXIF");
  const cleaned = await processImage(jpegWithExif, "image/jpeg");
  check(!(await sharp(cleaned.buffer).metadata()).exif, "re-encoding drops EXIF");
  const shrunk = await processImage(png, "image/png");
  const shrunkMeta = await sharp(shrunk.buffer).metadata();
  check(shrunkMeta.width === MAX_IMAGE_SIDE && (shrunkMeta.height ?? 0) <= MAX_IMAGE_SIDE, "a 3000px image fits inside 2000px");
  let corruptRefused = false;
  try {
    await processImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]), "image/jpeg");
  } catch {
    corruptRefused = true;
  }
  check(corruptRefused, "a JPEG signature on junk is refused by the decoder");
  const uploads = read("app/api/uploads/route.ts");
  check(/sniffImageType\(bytes\)/.test(uploads) && /processImage\(bytes, type\)/.test(uploads), "the upload route sniffs and re-encodes");
  check(!/file\.type/.test(uploads), "the upload route never trusts the declared type");
  const storage = read("lib/storage.ts");
  for (const model of ["Event", "EventTemplate", "MenuItem", "User"]) {
    check(new RegExp(`${model}\\.exists\\(`).test(storage), `releaseUploads checks ${model} before deleting`);
  }
  for (const route of [
    "app/api/menu/items/[id]/route.ts",
    "app/api/event-templates/[id]/route.ts",
    "app/api/events/[id]/route.ts",
    "app/api/account/route.ts",
  ]) {
    check(/after\(\(\) => releaseUploads\(/.test(read(route)), `${route} releases replaced uploads`);
  }

  // --- S10: door codes, band links ------------------------------------------------------
  const codes = new Set(Array.from({ length: 2000 }, () => generateReservationCode()));
  check([...codes].every((c) => c.length === 6 && [...c].every((ch) => RESERVATION_CODE_ALPHABET.includes(ch))), "door codes use the safe alphabet");
  check(codes.size > 1990, "2000 door codes are (almost) all distinct");
  const reservationCode = read("models/Reservation.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  check(!/Math\.random/.test(reservationCode), "door codes don't use Math.random");
  check(/uniqueReservationCode\(id\)/.test(read("app/api/events/[id]/reservations/route.ts")), "reservations ask for a code unique to the night");
  const link = (v: string) => bandLink.safeParse(v);
  check(link("instagram.com/dekkaband").data === "https://instagram.com/dekkaband", "a bare domain gets https://");
  check(link("https://soundcloud.com/x").data === "https://soundcloud.com/x", "an https link is kept");
  check(link("").success && link("").data === "", "an empty link is fine (filtered later)");
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x", "ftp://files.example.com/x", "not a link"]) {
    check(!link(bad).success, `band link refused: ${bad}`);
  }

  // --- R2: the pool ---------------------------------------------------------------------
  check(/maxPoolSize: 10/.test(read("lib/db.ts")), "Mongo pool capped at 10 per instance");

  if (failures.length) {
    for (const f of failures) console.error(`✗ ${f}`);
    console.error(`\ncheck-hardening: ${failures.length} failed, ${passes} passed.`);
    process.exit(1);
  }
  console.log(
    `check-hardening: all ${passes} checks pass — push goes only to real push services and never blocks Publish; security headers and a report-only CSP; uploads are sniffed, re-encoded without EXIF and capped at ${MAX_IMAGE_SIDE}px; sessions end when the account's version moves; crypto door codes; web-only band links.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
