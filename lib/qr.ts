// QR codes for the table poster (PLAN/DEKKA_PWA_APP.md §5.4, 4c.2). Server-side: the
// encoder (uqr, MIT, no dependencies) never ships to the browser, only the SVG it yields.
import { encode } from "uqr";

/**
 * `text` as one SVG path: error correction Q (a quarter of the code can be scuffed or
 * covered and it still scans), with the 4-module quiet zone scanners expect. One unit per
 * module, so the caller scales it with `width`/`height`.
 */
export function qrPath(text: string): { size: number; path: string } {
  const { data, size } = encode(text, { ecc: "Q", border: 4 });
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y][x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}

/** Where the poster sends people; `from=qr` is counted once, then dropped (`UsageBeacon`). */
export const posterUrl = (origin: string) => `${origin}/get-app?from=qr`;
