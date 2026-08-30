/**
 * Adversarial cases for `UPLOAD_IMAGE_PATTERN` (`lib/validation.ts`).
 *
 * That regex is the only thing standing between a member-reachable string field
 * and `next/image` server-side fetching a URL of the member's choosing (see the
 * comment above the pattern itself). It was widened once already, to let Vercel
 * Blob URLs through — this file exists so the next widening has to prove it
 * didn't reopen the hole.
 *
 *   npx tsx scripts/check-upload-pattern.ts
 */
import { UPLOAD_IMAGE_PATTERN } from "../lib/validation";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BLOB = "abc123xyz.public.blob.vercel-storage.com";

const ACCEPT = [
  ["no photo", ""],
  ["local jpg", `/uploads/events/${UUID}.jpg`],
  ["local png", `/uploads/events/${UUID}.png`],
  ["local webp", `/uploads/events/${UUID}.webp`],
  ["local gif", `/uploads/events/${UUID}.gif`],
  ["blob jpg", `https://${BLOB}/events/${UUID}.jpg`],
  ["blob gif", `https://${BLOB}/events/${UUID}.gif`],
  ["blob, hyphenated store id", `https://my-store-id.public.blob.vercel-storage.com/events/${UUID}.jpg`],
  ["blob, 64-char store id", `https://${"a".repeat(64)}.public.blob.vercel-storage.com/events/${UUID}.jpg`],
] as const;

const REJECT = [
  ["arbitrary https host", `https://evil.example/events/${UUID}.jpg`],
  ["arbitrary http host", `http://evil.example/x.jpg`],
  ["protocol-relative", `//evil.example/events/${UUID}.jpg`],
  ["userinfo prefix", `https://evil.example@${BLOB}/events/${UUID}.jpg`],
  ["host suffix attack", `https://abc123.public.blob.vercel-storage.com.evil.example/events/${UUID}.jpg`],
  ["host as path segment", `https://evil.example/${BLOB}/events/${UUID}.jpg`],
  ["blob over http", `http://${BLOB}/events/${UUID}.jpg`],
  ["uppercase host", `https://ABC123.PUBLIC.BLOB.VERCEL-STORAGE.COM/events/${UUID}.jpg`],
  ["dotted store id", `https://a.b.public.blob.vercel-storage.com/events/${UUID}.jpg`],
  ["empty store id", `https://.public.blob.vercel-storage.com/events/${UUID}.jpg`],
  ["65-char store id", `https://${"a".repeat(65)}.public.blob.vercel-storage.com/events/${UUID}.jpg`],
  ["path traversal", `/uploads/events/../../../etc/passwd`],
  ["encoded traversal", `/uploads/events/..%2f..%2fetc%2fpasswd`],
  ["traversal after valid key", `/uploads/events/${UUID}.jpg/../../secret.jpg`],
  ["wrong directory", `/uploads/other/${UUID}.jpg`],
  ["bare filename", `${UUID}.jpg`],
  ["missing leading slash", `uploads/events/${UUID}.jpg`],
  ["svg extension", `/uploads/events/${UUID}.svg`],
  ["html extension", `/uploads/events/${UUID}.html`],
  ["double extension", `/uploads/events/${UUID}.jpg.svg`],
  ["no extension", `/uploads/events/${UUID}`],
  ["short uuid", `/uploads/events/0f8fad5b.jpg`],
  ["non-hex uuid", `/uploads/events/zzzzzzzz-d9cb-469f-a165-70867728950e.jpg`],
  ["uppercase uuid", `/uploads/events/${UUID.toUpperCase()}.jpg`],
  ["query string", `/uploads/events/${UUID}.jpg?x=1`],
  ["fragment", `/uploads/events/${UUID}.jpg#x`],
  ["extra path segment", `https://${BLOB}/events/sub/${UUID}.jpg`],
  ["blob random suffix", `https://${BLOB}/events/${UUID}-Xy7Qa.jpg`],
  ["trailing newline", `/uploads/events/${UUID}.jpg\n`],
  ["newline then payload", `/uploads/events/${UUID}.jpg\nhttps://evil.example/x.jpg`],
  ["leading space", ` /uploads/events/${UUID}.jpg`],
  ["data uri", `data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=`],
  ["javascript uri", `javascript:alert(1)`],
  ["file uri", `file:///etc/passwd`],
  ["localhost ssrf", `https://127.0.0.1/events/${UUID}.jpg`],
  ["cloud metadata ssrf", `https://169.254.169.254/latest/meta-data/`],
] as const;

let failed = 0;
for (const [name, value] of ACCEPT) {
  if (!UPLOAD_IMAGE_PATTERN.test(value)) {
    console.error(`FAIL  should accept — ${name}: ${JSON.stringify(value)}`);
    failed++;
  }
}
for (const [name, value] of REJECT) {
  if (UPLOAD_IMAGE_PATTERN.test(value)) {
    console.error(`FAIL  should reject — ${name}: ${JSON.stringify(value)}`);
    failed++;
  }
}

const total = ACCEPT.length + REJECT.length;
if (failed) {
  console.error(`\n${failed}/${total} cases failed.`);
  process.exit(1);
}
console.log(`UPLOAD_IMAGE_PATTERN: ${total}/${total} cases pass (${ACCEPT.length} accept, ${REJECT.length} reject).`);
