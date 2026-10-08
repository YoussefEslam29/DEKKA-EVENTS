/**
 * `npm run check:event-night` — DB-free assertions for the event-night phase
 * (`PLAN/DEKKA_PWA_APP.md` §5.2 4a, `PLAN/SITE_ROADMAP.md` F1/F4): the calendar file, the
 * cafe night's window, the share card's Arabic, a real card render, the public routes'
 * terms, and the reminders' gate.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildIcs, eventEnd, foldLine, googleCalendarUrl, icsEscape, icsUtc, whatsAppShareUrl } from "../lib/calendar";
import { cafeNightBounds, hasEnded } from "../lib/staff";
import { bidiRuns, shapeArabic, toVisual, visualLines } from "../lib/og/bidi";
import { CARD_SIZE, renderEventCard } from "../lib/og/card";
import { cronAuthorized, reminderPayload, remindersEnabled } from "../lib/reminders";
import { EVENT_DEFAULT_DURATION_MIN, PUBLIC_EVENT_STATUSES } from "../lib/constants";
import { formatWhen } from "../lib/format";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}
const bytes = (s: string) => new TextEncoder().encode(s).length;
const cp = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16).toUpperCase());

async function main() {
  // --- The .ics file -----------------------------------------------------------------------
  const start = new Date("2026-12-02T18:00:00.000Z");
  check(icsUtc(start) === "20261202T180000Z", "times are UTC, no zone block needed");
  check(eventEnd(start).getTime() - start.getTime() === EVENT_DEFAULT_DURATION_MIN * 60_000, "a night lasts the default length");
  check(icsEscape("a,b;c\\d\nE") === "a\\,b\\;c\\\\d\\nE", "text is escaped per RFC 5545");

  const longArabic = "أمسية العود والأصوات الجميلة من الإسكندرية مع فرقة الشباب الجديدة في دكة، وضيوف";
  const folded = foldLine(`SUMMARY:${longArabic}`);
  const physical = folded.split("\r\n");
  check(physical.length > 1 && physical.every((l) => bytes(l) <= 75), "folded lines stay within 75 octets");
  check(physical.slice(1).every((l) => l.startsWith(" ")), "continuation lines start with a space");
  check(folded.replace(/\r\n /g, "") === `SUMMARY:${longArabic}`, "folding never splits an Arabic letter");

  const ics = buildIcs(
    {
      id: "665f00000000000000000001",
      title: longArabic,
      description: "Live music, coffee; good company",
      location: "دكة, Alexandria",
      startsAt: start,
      url: "https://dekka.example/events/665f00000000000000000001",
      host: "dekka.example",
      reminder: "الليلة في دكة",
    },
    new Date("2026-11-01T10:00:00.000Z")
  );
  check(ics.endsWith("\r\n") && !/[^\r]\n/.test(ics), "every line ends in CRLF");
  check(ics.split("\r\n").every((l) => bytes(l) <= 75), "no physical line over 75 octets");
  const unfolded = ics.replace(/\r\n /g, "");
  check(unfolded.includes("UID:665f00000000000000000001@dekka.example"), "the UID is stable per night and host");
  check(unfolded.includes("DTSTART:20261202T180000Z") && unfolded.includes("DTEND:20261202T210000Z"), "start, and end = start + 3 h");
  check(/BEGIN:VALARM\r\nTRIGGER:-PT2H\r\n/.test(ics), "a reminder two hours before");
  check(unfolded.includes(`SUMMARY:${icsEscape(longArabic)}`), "the Arabic title survives intact");
  check(unfolded.includes("LOCATION:دكة\\, Alexandria"), "the location is escaped");

  const google = new URL(googleCalendarUrl({ title: "ليلة", description: "", location: "دكة", startsAt: start, url: "https://x/e" }));
  check(google.searchParams.get("dates") === "20261202T180000Z/20261202T210000Z", "the Google link carries the same times");
  check(google.searchParams.get("text") === "ليلة" && google.hostname === "calendar.google.com", "…and the title");
  check(whatsAppShareUrl("ليلة & more") === "https://wa.me/?text=%D9%84%D9%8A%D9%84%D8%A9%20%26%20more", "the WhatsApp text is URL-encoded");

  // --- The cafe night: 05:00 to 05:00 Cairo, across DST ------------------------------------
  const winter = cafeNightBounds(new Date("2026-01-15T12:00:00.000Z"));
  check(winter.key === "2026-01-15" && winter.start.toISOString() === "2026-01-15T03:00:00.000Z", "a winter night starts 05:00 Cairo (UTC+2)");
  const summer = cafeNightBounds(new Date("2026-07-15T12:00:00.000Z"));
  check(summer.key === "2026-07-15" && summer.start.toISOString() === "2026-07-15T02:00:00.000Z", "a summer night starts 05:00 Cairo (UTC+3)");
  const late = cafeNightBounds(new Date("2026-07-16T01:30:00.000Z")); // 04:30 Cairo the next morning
  check(late.key === "2026-07-15", "half past four in the morning still belongs to last night");
  let tiles = true;
  const lengths = new Set<number>();
  for (let day = 0; day < 366; day++) {
    const noon = new Date(Date.UTC(2026, 0, 1 + day, 10));
    const night = cafeNightBounds(noon);
    const next = cafeNightBounds(new Date(noon.getTime() + 86_400_000));
    if (night.end.getTime() !== next.start.getTime() || !(night.start <= noon && noon < night.end)) tiles = false;
    lengths.add((night.end.getTime() - night.start.getTime()) / 3_600_000);
  }
  check(tiles, "a year of nights tiles with no gap or overlap");
  check([...lengths].every((h) => h === 23 || h === 24 || h === 25) && lengths.has(24), "a night is 24 h, 23 or 25 across a clock change");
  check(!hasEnded(start, new Date(start.getTime() + (EVENT_DEFAULT_DURATION_MIN - 1) * 60_000)), "a night still running hasn't ended");
  check(hasEnded(start, new Date(start.getTime() + EVENT_DEFAULT_DURATION_MIN * 60_000)), "…and has once its length is up");

  // --- Share-card Arabic: shaped, in visual order ------------------------------------------
  check(cp(shapeArabic("ليلة")).join(" ") === "FEDF FEF4 FEE0 FE94", "letters take their joined forms (ليلة)");
  check(cp(shapeArabic("دار")).join(" ") === "FEA9 FE8D FEAD", "right-joining letters break the join (دار)");
  check(cp(shapeArabic("سلام")).join(" ") === "FEB3 FEFC FEE1", "lam-alef is one ligature, joined from the right (سلام)");
  check(cp(shapeArabic("الألعاب"))[1] === "FEF7", "a lam-alef after alef stands alone (الأ)");
  check(shapeArabic("تفوّتوا") === shapeArabic("تفوتوا") && shapeArabic("ليـلة") === shapeArabic("ليلة"), "harakat and tatweel are dropped");
  check(cp(shapeArabic("ڤينتاج"))[0] === "FB6C", "ڤ (Egyptian 'v') joins too");

  const samples = [
    "ليلة كاريوكي مع Dekka Band",
    "لا تفوّتوا: ليلة (الألعاب) رقم ٣ ـ سهرة ڤينتاج",
    "الأربعاء ١٤ أكتوبر · ٨:٠٠ م",
    "١٥٠ ج.م · EGP 150",
  ];
  check(samples.every((s) => !/[\u0621-\u064A\u0671-\u06D3\u0640]/.test(toVisual(s))), "no plain Arabic letter ever reaches the renderer");
  const rev = (w: string) => [...shapeArabic(w)].reverse().join("");
  check(toVisual(samples[0]) === `Dekka Band ${rev("مع")} ${rev("كاريوكي")} ${rev("ليلة")}`, "an Arabic line reads right to left; a Latin run keeps its order");
  check(toVisual(samples[2]) === `${rev("م")} ٨:٠٠ · ${rev("أكتوبر")} ١٤ ${rev("الأربعاء")}`, "digits keep their order inside an Arabic line");
  check(toVisual(samples[3]) === `EGP 150 · ${rev("ج.م")} ١٥٠`, "the price reads ١٥٠ ج.م · EGP 150 from the right");
  check(toVisual("موسم٢٠٢٦") === `٢٠٢٦${rev("موسم")}`, "a number glued to a word lands on its reading side");
  const brackets = toVisual("(دكة)");
  check(brackets.startsWith("(") && brackets.endsWith(")"), "brackets are mirrored");
  check(toVisual("Open Mic Night 2") === "Open Mic Night 2", "a Latin-only line is untouched");
  const runs = bidiRuns("٣ ليالي مع Dekka Band 2");
  check(runs.length === 2 && runs[0].text === "٣ ليالي مع" && runs[1].text === "Dekka Band 2", "neutrals ride with their neighbours");

  const longTitle = "أمسية العود والأصوات الجميلة من الإسكندرية مع فرقة الشباب الجديدة في دكة";
  const lines = visualLines(longTitle, 28, 2);
  check(lines.length === 2 && lines[1].startsWith("…"), "a long title is two lines, the ellipsis on the reading end");
  check(lines[0].endsWith(rev("أمسية")), "the first line starts (on the right) with the first word");

  // --- A real card ---------------------------------------------------------------------------
  for (const [name, input] of [
    ["mixed", { titleAr: samples[0], titleEn: "Karaoke Night with Dekka Band", price: 150 }],
    ["long", { titleAr: longTitle, titleEn: "An Evening of Oud and Beautiful Voices from Alexandria", price: 0 }],
  ] as const) {
    const png = Buffer.from(await renderEventCard({ ...input, startsAt: start, host: "dekka.example" }).arrayBuffer());
    const isPng = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    check(isPng && png.readUInt32BE(16) === CARD_SIZE.width && png.readUInt32BE(20) === CARD_SIZE.height, `the ${name} card is a 1200×630 PNG`);
    check(png.length < 300 * 1024, `the ${name} card is under WhatsApp's ~300 KB (${png.length} bytes)`);
  }

  // --- The public routes' terms --------------------------------------------------------------
  check(
    PUBLIC_EVENT_STATUSES.join() === "published,closed,happened,archived",
    "public means published, closed, happened or archived — never a draft"
  );
  for (const route of ["app/api/events/[id]/calendar/route.ts", "app/api/events/[id]/og/route.tsx"]) {
    const src = read(route);
    check(/await rateLimit\("(calendar|og)-ip", clientIp\(request\)\)/.test(src), `${route} is rate-limited per IP`);
    check(/status: \{ \$in: PUBLIC_EVENT_STATUSES \}/.test(src), `${route} serves public nights only`);
    check(!/currentUser|from "@\/auth"|cookies\(|headers\(\)/.test(src), `${route} never reads the session or a cookie`);
  }
  check(/"Cache-Control": "public, s-maxage=3600/.test(read("app/api/events/[id]/og/route.tsx")), "the card is cached at the edge");
  check(/^\s*image: \{ url: `\/api\/events\/\$\{event\.id\}\/og`, width: 1200, height: 630/m.test(read("app/(site)/events/[id]/page.tsx")), "the event page shares its card");

  // --- Tonight, My Events -------------------------------------------------------------------
  const whenAr = formatWhen(start, "ar");
  check(whenAr.includes("، ") && !whenAr.includes("·"), `Arabic joins date and time with its comma (${whenAr})`);
  check(formatWhen(start, "en").includes(" · "), "English keeps the middle dot");
  check(/<bdi>\{eventTitle\(event, locale\)\}<\/bdi>/.test(read("components/TonightBanner.tsx")), "the banner isolates the title from the time beside it");
  const data = read("lib/data.ts");
  check(/getTonightEvents[\s\S]{0,200}cafeNightBounds\(now\)[\s\S]{0,400}!hasEnded\(d\.startsAt, now\)/.test(data), "the Tonight banner shows tonight's nights still running");
  const myEvents = read("app/(site)/my-events/page.tsx");
  check(/\.filter\(\(r\) => !hasEnded\(r\.event\.startsAt, now\)\)/.test(myEvents), "a night in progress stays under Upcoming");
  check(/CancelReservationButton/.test(myEvents) && /DoorCodeButton/.test(myEvents), "My Events can cancel and show the door code");

  // --- Reminders: built, off, and once only --------------------------------------------------
  check(!cronAuthorized("Bearer ", undefined) && !cronAuthorized("Bearer ", ""), "no secret configured lets nobody in");
  check(!cronAuthorized(null, "s3cret") && !cronAuthorized("Bearer s3creT", "s3cret") && !cronAuthorized("Bearer s3cret2", "s3cret"), "a wrong or missing secret is refused");
  check(cronAuthorized("Bearer s3cret", "s3cret"), "the right secret is let in");
  const saved = process.env.REMINDERS_ENABLED;
  delete process.env.REMINDERS_ENABLED;
  const offByDefault = !remindersEnabled();
  process.env.REMINDERS_ENABLED = "true";
  const onlyOne = !remindersEnabled();
  process.env.REMINDERS_ENABLED = "1";
  const on = remindersEnabled();
  if (saved === undefined) delete process.env.REMINDERS_ENABLED;
  else process.env.REMINDERS_ENABLED = saved;
  check(offByDefault && onlyOne && on, "reminders are off unless REMINDERS_ENABLED=1");
  const payload = reminderPayload({ titleAr: "ليلة", titleEn: "Night", startsAt: start });
  check(payload.url === "/my-events" && /Tonight/.test(payload.title) && /الليلة/.test(payload.title), "the reminder is bilingual and opens My Events");

  const cron = read("app/api/cron/reminders/route.ts");
  const at = (s: string) => cron.indexOf(s);
  check(at("cronAuthorized(") > 0 && at("cronAuthorized(") < at("remindersEnabled()") && at("remindersEnabled()") < at("await connectDB()"), "the secret, then the switch, before any database work");
  check(/\{ event: night\._id, status: "confirmed", remindedAt: \{ \$exists: false \} \}/.test(cron), "only confirmed, not-yet-reminded spots are claimed");
  check(/Reservation\.find\(\{ event: night\._id, remindedAt: stamp \}\)/.test(cron), "only the rows this run claimed are sent to");
  check(at("updateMany(") < at("sendToSubscriptions("), "claimed before sending, so a retry can't double-send");
  check(/remindedAt: \{ type: Date \}/.test(read("models/Reservation.ts")), "reservations carry remindedAt");
  const vercel = JSON.parse(read("vercel.json")) as { crons?: { path: string; schedule: string }[] };
  const job = vercel.crons?.find((c) => c.path === "/api/cron/reminders");
  check(Boolean(job) && /^\d+ \d+ \* \* \*$/.test(job!.schedule), "a daily cron calls it (Hobby allows daily only)");

  if (failures.length) {
    for (const f of failures) console.error(`✗ ${f}`);
    console.error(`\ncheck-event-night: ${failures.length} failed, ${passes} passed.`);
    process.exit(1);
  }
  console.log(
    `check-event-night: all ${passes} checks pass — the .ics is RFC-clean, nights tile across DST, card Arabic is shaped and ordered, the card renders under budget, public routes keep their terms, reminders are gated and once-only.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
