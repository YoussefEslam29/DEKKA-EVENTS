/**
 * `npm run check:owner-tools` — DB-free assertions for the owner-tools phase
 * (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c; `PLAN/SITE_ROADMAP.md` F2, F5): anonymous counters
 * that can't learn who anyone is, demo mode that can't write or leak, the QR poster, CSV
 * exports that are safe to open in Excel, and admin push alerts.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { statsSchema } from "../lib/validation";
import { UsageCounter } from "../models/UsageCounter";
import { DEMO_COOKIE, DEMO_MAX_AGE_SECONDS, demoBlocks } from "../lib/demo-guard";
import { config as proxyConfig } from "../proxy";
import { DEMO_CODES, demoEvents, demoMenu, demoReservations } from "../lib/demo-fixtures";
import { cafeNightBounds, hasEnded } from "../lib/staff";
import { RESERVATION_CODE_ALPHABET } from "../models/Reservation";
import { posterUrl, qrPath } from "../lib/qr";
import { csvCell, toCsv } from "../lib/csv";
import { nightFullAlert, pitchAlert } from "../lib/admin-alerts";
import { LEGAL_UPDATED_AT } from "../lib/legal";
import { isInSeason } from "../lib/menu";
import { dayKey } from "../lib/format";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}
function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) filesUnder(rel, found);
    else if (/\.(ts|tsx)$/.test(entry)) found.push(rel);
  }
  return found;
}
const id = (n: number) => n.toString(16).padStart(24, "0");

// --- The beacon's body ------------------------------------------------------------------------
const views = statsSchema.safeParse({ metric: "menu_item_view", items: [id(1), id(1), id(2).toUpperCase()] });
check(views.success && views.data.metric === "menu_item_view" && views.data.items.length === 2, "item views are de-duplicated (case-insensitively)");
check(!statsSchema.safeParse({ metric: "menu_item_view", items: Array.from({ length: 101 }, (_, i) => id(i + 1)) }).success, "at most 100 items a beacon");
check(!statsSchema.safeParse({ metric: "menu_item_view", items: [] }).success, "at least one item");
check(!statsSchema.safeParse({ metric: "menu_item_view", items: ["nope"] }).success, "item ids must be ids");
for (const metric of ["install_prompt_shown", "install_prompt_accepted", "app_open", "qr_scan"]) {
  check(statsSchema.safeParse({ metric }).success, `"${metric}" is a plain tally`);
}
check(!statsSchema.safeParse({ metric: "app_open", items: [id(1)] }).success, "a tally carries no items (strict)");
check(!statsSchema.safeParse({ metric: "app_open", userId: id(1) }).success, "nothing else rides along (strict)");
check(!statsSchema.safeParse({ metric: "page_view" }).success, "unknown metrics are refused");

// --- Nothing about who --------------------------------------------------------------------------
const paths = Object.keys(UsageCounter.schema.paths).sort();
check(JSON.stringify(paths) === JSON.stringify(["_id", "count", "day", "item", "metric"]), `the counter holds metric, day, item, count only (${paths.join(", ")})`);
check(!UsageCounter.schema.get("timestamps"), "…and no timestamps finer than the day");
const statsRoute = read("app/api/stats/route.ts");
check(!/currentUser|from "@\/auth"|cookies\(|headers\(\)|getToken/.test(statsRoute), "POST /api/stats never reads the session or a cookie");
check(/createHash\("sha256"\)\.update\(clientIp\(request\)\)/.test(statsRoute) && /rateLimit\("stats-ip", ipHash\)/.test(statsRoute), "…and is rate-limited on a hashed IP");
check(/MenuItem\.find\(\{ _id: \{ \$in: parsed\.data\.items \} \}\)/.test(statsRoute), "…and counts only items that exist");
check(/new NextResponse\(null, \{ status: 204 \}\)/.test(statsRoute), "…answering 204");
const layout = read("app/(site)/layout.tsx");
check(/data-stats-off=\{hasRole\(user, "staff"\) \? "" : undefined\}/.test(layout), "staff and admins are marked not-counted, on the server");
check(/document\.querySelector\("\[data-stats-off\]"\)/.test(read("lib/stats-client.ts")), "…and the client respects it");
const board = read("components/menu/MenuBoard.tsx");
check(/threshold: 0\.5/.test(board) && /setTimeout\(\(\) => countItemView\(id\), 1000\)/.test(board), "a view = half on screen for a second");
check(/navigator\.sendBeacon\?\.\("\/api\/stats"/.test(read("lib/stats-client.ts")), "the last batch survives the page closing (sendBeacon)");
check(/url\.searchParams\.delete\("from"\)/.test(read("components/UsageBeacon.tsx")), "a QR arrival drops its marker, so a reload doesn't recount");

// --- Demo mode: it can't write --------------------------------------------------------------------
for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
  check(demoBlocks(method, "/api/events/abc/reservations"), `${method} to the API is refused`);
}
check(!demoBlocks("GET", "/api/menu") && !demoBlocks("HEAD", "/api/menu") && !demoBlocks("OPTIONS", "/api/stats"), "reads pass");
check(!demoBlocks("POST", "/api/auth/signout") && !demoBlocks("POST", "/api/auth/callback/credentials"), "signing in and out still work");
check(demoBlocks("POST", "/api/stats") && demoBlocks("post", "/api/demo"), "the beacon and the switch itself are refused too");
check(!demoBlocks("POST", "/events/demo-tonight") && !demoBlocks("POST", "/api-docs"), "only /api/* is in scope");
const matcher = proxyConfig.matcher[0];
check(matcher.source === "/api/:path*" && matcher.has?.[0]?.type === "cookie" && matcher.has[0].key === DEMO_COOKIE, "the proxy only runs for /api/* with the demo cookie");
check(/demoBlocks\(request\.method, request\.nextUrl\.pathname\)/.test(read("proxy.ts")) && /status: 409/.test(read("proxy.ts")), "…and answers 409 DEMO_MODE");
const demoRoute = read("app/api/demo/route.ts");
check(/guard\("admin"\)/.test(demoRoute) && /maxAge: DEMO_MAX_AGE_SECONDS/.test(demoRoute) && DEMO_MAX_AGE_SECONDS === 7200, "only an admin starts it, for two hours");

// --- …and it can't leak ---------------------------------------------------------------------------
const apiFiles = filesUnder("app/api");
const aware = apiFiles.filter((f) => /from "@\/lib\/demo(-fixtures)?"/.test(read(f)));
check(aware.length === 0, `no API route reads demo mode or its fixtures (${aware.join(", ") || "none"})`);
for (const file of ["app/sitemap.ts", "app/robots.ts", "lib/og/card.tsx", "lib/calendar.ts"]) {
  check(!/lib\/demo/.test(read(file)), `${file} never sees demo data`);
}
for (const page of ["app/(site)/page.tsx", "app/(site)/events/[id]/page.tsx", "app/(site)/menu/page.tsx", "app/(site)/my-events/page.tsx", "app/(site)/admin/page.tsx"]) {
  check(/await isDemo\(\)/.test(read(page)), `${page} has its demo branch`);
}
check(/\{demo \? <DemoRibbon \/> : null\}/.test(layout), "the ribbon is on every page while it's on");

// --- Fixtures: there is always a night tonight -------------------------------------------------------
let alwaysTonight = true;
const start = Date.parse("2026-10-27T00:00:00Z"); // across the fall-back night (29–30 Oct)
for (let t = start; t < start + 5 * 86_400_000; t += 37 * 60_000) {
  const now = new Date(t);
  const tonight = demoEvents(now).tonight[0];
  const { start: from, end } = cafeNightBounds(now);
  const at = new Date(tonight.startsAt);
  if (!(at >= from && at < end) || hasEnded(tonight.startsAt, now)) alwaysTonight = false;
}
check(alwaysTonight, "at any hour, the sample has a night tonight in Cairo that hasn't ended");
const sample = demoEvents(new Date("2026-10-09T12:00:00Z"));
check(sample.upcoming.every((e) => e.id.startsWith("demo-")) && sample.past.every((e) => e.id.startsWith("demo-")), "every sample id starts demo-");
check(
  Object.values(DEMO_CODES).every((code) => code.length === 6 && [...code].every((c) => RESERVATION_CODE_ALPHABET.includes(c))),
  "sample door codes use the real alphabet"
);
check(demoReservations().length === 2, "two sample spots on My Events");
const menu = demoMenu(new Date("2026-10-09T12:00:00Z"));
const items = menu.flatMap((c) => c.items);
check(items.some((i) => i.variants.length > 1) && items.some((i) => !i.available) && items.some((i) => i.isFeatured), "the sample menu has sizes, a sold-out item and picks");
check(menu.some((c) => c.endsOn) && menu.every((c) => isInSeason(c, dayKey(new Date("2026-10-09T12:00:00Z")))), "…and a seasonal section in season");

// --- The QR poster -------------------------------------------------------------------------------
check(posterUrl("https://dekka.example") === "https://dekka.example/get-app?from=qr", "the poster points at /get-app?from=qr");
const qr = qrPath(posterUrl("https://dekka-events.vercel.app"));
check((qr.size - 8 - 17) % 4 === 0 && qr.size >= 29, `a whole QR version plus a 4-module quiet zone (${qr.size} modules)`);
check(/^(M\d+ \d+h1v1h-1z)+$/.test(qr.path), "one path of unit squares");
const qrPage = read("app/(site)/admin/qr/page.tsx");
check(/requireRole\("admin", "\/admin\/qr"\)/.test(qrPage), "the poster page is admin-only, before any read");
check(/@page \{ size: A4; margin: 12mm; \}/.test(qrPage), "it prints on A4");
check(/<div className="contents print:hidden">/.test(layout) && /print:hidden/.test(read("app/(site)/admin/layout.tsx")), "the site chrome stays off the printout");
check(!/"use client"/.test(read("lib/qr.ts")) && !/from "uqr"/.test(filesUnder("components").map(read).join("\n")), "the encoder never ships to the browser");

// --- CSV ------------------------------------------------------------------------------------------
const csv = toCsv([["Name", "Note"], ["سارة, \"س\"", "line1\nline2"], ["=HYPERLINK(\"x\")", -50]]);
check(csv.charCodeAt(0) === 0xfeff, "a UTF-8 byte-order mark first, so Excel reads Arabic");
// Three rows, each ending CRLF; the newline inside a quoted cell stays a bare LF.
check(csv.endsWith("\r\n") && csv.split("\r\n").length === 4, "CRLF rows");
check(csv.includes(`"سارة, ""س"""`) && csv.includes(`"line1\nline2"`), "commas, quotes and newlines are quoted");
check(csvCell("=1+1") === "'=1+1" && csvCell("+20100") === "'+20100" && csvCell("-x") === "'-x" && csvCell("@SUM") === "'@SUM", "a cell that would run as a formula is defused");
check(csvCell(-50) === "-50" && csvCell(null) === "" && csvCell("Sara") === "Sara", "numbers and plain text are left alone");
for (const route of ["app/api/reports/monthly/csv/route.ts", "app/api/reports/customers/route.ts"]) {
  const src = read(route);
  check(/guard\("admin"\)/.test(src) && src.indexOf('guard("admin")') < src.indexOf("await get"), `${route} is admin-only, before any read`);
  check(/csvHeaders\(/.test(src), `${route} downloads as CSV`);
}
check(/"Cache-Control": "private, no-store"/.test(read("lib/csv.ts")), "exports are never cached");

// --- Admin alerts ----------------------------------------------------------------------------------
check(pitchAlert("Band").url === "/admin/submissions" && /New pitch/.test(pitchAlert("Band").title), "a pitch alert opens Submissions");
check(nightFullAlert({ id: id(9), titleAr: "ليلة", titleEn: "" }).body === "ليلة" && nightFullAlert({ id: id(9), titleAr: "", titleEn: "N" }).url === `/admin/events/${id(9)}`, "a night-full alert names the night and opens it");
const alerts = read("lib/admin-alerts.ts");
check(/User\.find\(\{ role: "admin" \}\)/.test(alerts) && /PushSubscription\.find\(\{ user: \{ \$in:/.test(alerts), "alerts go to admins' own devices only");
check(/after\(\(\) => notifyAdmins\(pitchAlert\(submission\.bandName\), "push-pitch"\)\)/.test(read("app/api/submissions/route.ts")), "a new pitch alerts the admins, after the response");
const reserve = read("app/api/events/[id]/reservations/route.ts");
check(/const fillsTheNight = event\.capacity != null && taken \+ 1 === event\.capacity;/.test(reserve), "only the spot that fills the night alerts");
check((reserve.match(/alertIfFull\(\);/g) ?? []).length === 2, "…whether the spot is new or revived");

// --- The legal pages say so ------------------------------------------------------------------------
const legal = read("lib/i18n/legal-content.ts");
check(/Anonymous totals/.test(legal) && /إحصاءات مجمّعة مجهولة الهوية/.test(legal), "the privacy policy describes the counters, in both languages");
check(!/runs no analytics or advertising tools of any kind\./.test(legal) && /no third-party analytics/.test(legal), "…and no longer says there are none at all");
check((legal.match(/dekka_demo/g) ?? []).length === 2, "the cookie list names dekka_demo, in both languages");
check(LEGAL_UPDATED_AT.cookies >= "2026-10-08" && LEGAL_UPDATED_AT.privacy >= "2026-10-08", "both policies' dates are bumped");

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error(`\ncheck-owner-tools: ${failures.length} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-owner-tools: all ${passes} checks pass — counters can't learn who, demo mode can't write or leak, the QR is server-only and prints alone, CSVs are Excel-safe, alerts reach admins only.`
);
