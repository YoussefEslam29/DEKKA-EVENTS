/**
 * `npm run check:cafe-life` — DB-free assertions for the cafe-life phase
 * (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b): opening hours and "Open now" across midnight and
 * both 2026 clock changes, one-tap directions, and scheduled seasonal menu sections.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CLOSING_SOON_MIN,
  cairoClock,
  openStatus,
  openStatusText,
  parseOpeningHours,
  type WeekHours,
} from "../lib/hours";
import { isInSeason, seasonFilter, seasonRangeOk, seasonState } from "../lib/menu";
import { createMenuCategorySchema, seasonDay, updateMenuCategorySchema } from "../lib/validation";
import { dayKey, formatDayKey } from "../lib/format";
import { site } from "../lib/site";
import { dictionaries } from "../lib/i18n/dictionaries";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}
const at = (iso: string) => new Date(iso);

// --- Hours, parsed --------------------------------------------------------------------------
const daily = parseOpeningHours(undefined);
check(daily.length === 7 && daily.every((d) => d?.opens === "10:00" && d.closes === "01:00"), "default: 10:00–01:00 every day");
check(JSON.stringify(parseOpeningHours("09:00-23:00")) === JSON.stringify(Array(7).fill({ opens: "09:00", closes: "23:00" })), "one range applies to every day");
const week = parseOpeningHours("10:00-01:00,closed,closed,10:00-01:00,10:00-01:00,14:00-02:00,10:00-01:00");
check(week[1] === null && week[2] === null && week[5]?.opens === "14:00", "seven ranges, Sunday first, with closed days");
for (const bad of ["25:00-01:00", "10-1", "10:00-01:00,closed", "nonsense", "10:00-01:00,,,,,,"]) {
  check(JSON.stringify(parseOpeningHours(bad)) === JSON.stringify(daily), `malformed "${bad}" falls back to the default`);
}

// --- Open now: the default week, winter (UTC+2) ---------------------------------------------
const status = (iso: string, hours: WeekHours = daily) => openStatus(at(iso), hours);
check(cairoClock(at("2026-01-16T07:59:00Z")).minutes === 9 * 60 + 59 && cairoClock(at("2026-01-16T07:59:00Z")).weekday === 5, "the Cairo wall clock (Friday 09:59)");
const before = status("2026-01-16T07:59:00Z"); // Fri 09:59
check(before.state === "closed" && before.opensAt === "10:00" && before.opensInDays === 0, "09:59: closed, opens at 10:00 today");
check(status("2026-01-16T08:00:00Z").state === "open" && status("2026-01-16T08:00:00Z").until === "01:00", "10:00: open until 01:00");
check(status("2026-01-16T21:30:00Z").state === "open", "23:30: open (90 minutes left)");
check(status("2026-01-16T22:00:00Z").state === "closingSoon", `00:00: closing soon (${CLOSING_SOON_MIN} minutes left)`);
const spill = status("2026-01-16T22:30:00Z"); // Sat 00:30, Friday's window
check(spill.state === "closingSoon" && spill.until === "01:00", "00:30 Saturday: still Friday's night, closing soon");
check(status("2026-01-16T22:15:00Z").state === "closingSoon", "00:15: closing soon");
check(status("2026-01-16T22:59:00Z").state === "closingSoon", "00:59: closing soon");
const shut = status("2026-01-16T23:00:00Z"); // Sat 01:00
check(shut.state === "closed" && shut.opensAt === "10:00" && shut.opensInDays === 0, "01:00: closed, opens at 10:00 today");

// --- Summer (UTC+3) and both 2026 clock changes ------------------------------------------------
check(status("2026-07-17T07:00:00Z").state === "open", "summer 10:00 (UTC+3): open");
check(status("2026-07-17T06:59:00Z").state === "closed", "summer 09:59: closed");
check(status("2026-04-23T21:59:00Z").state === "open", "23:59 before clocks go forward: open");
check(status("2026-04-23T22:30:00Z").state === "closed", "the spring-forward night: 00:00 jumps to 01:00, already past closing");
check(status("2026-10-29T21:30:00Z").state === "open", "the fall-back night, 23:30 (second time round): open");
check(status("2026-10-29T22:30:00Z").state === "closingSoon", "…00:30: closing soon");
check(status("2026-10-29T23:00:00Z").state === "closed", "…01:00: closed");

// --- Closed days ------------------------------------------------------------------------------------
const mondayNight = status("2026-01-18T22:30:00Z", week); // Mon 00:30, Sunday's window
check(mondayNight.state === "closingSoon", "a closed Monday still finishes Sunday's night");
const mondayNoon = status("2026-01-19T10:00:00Z", week); // Mon 12:00
check(mondayNoon.state === "closed" && mondayNoon.opensInDays === 2 && mondayNoon.opensWeekday === 3, "closed Monday and Tuesday: opens Wednesday");
const tuesday = status("2026-01-20T10:00:00Z", week);
check(tuesday.opensInDays === 1, "closed Tuesday: opens tomorrow");
const never = status("2026-01-19T10:00:00Z", Array(7).fill(null));
check(never.state === "closed" && never.opensAt === undefined, "never open: just closed");

// --- The words ------------------------------------------------------------------------------------
const en = dictionaries.en.visit;
const ar = dictionaries.ar.visit;
check(/^Open now · until 1:00\s?am$/i.test(openStatusText(status("2026-01-16T08:00:00Z"), "en", en)), `"Open now · until 1:00 am" (${openStatusText(status("2026-01-16T08:00:00Z"), "en", en)})`);
check(openStatusText(spill, "en", en).startsWith("Closing soon · "), "closing soon reads so");
check(openStatusText(before, "ar", ar).startsWith("مقفول دلوقتي · بنفتح "), "Arabic: closed, opens at");
check(openStatusText(tuesday, "en", en).startsWith("Closed now · opens tomorrow at"), "opens tomorrow");
check(openStatusText(mondayNoon, "en", en).startsWith("Closed now · opens Wednesday at"), `a named day (${openStatusText(mondayNoon, "en", en)})`);
check(openStatusText(never, "en", en) === "Closed now", "no opening at all");

// --- Directions -------------------------------------------------------------------------------------
check(site.directionsGoogle === "https://www.google.com/maps/dir/?api=1&destination=31.2067034,29.9258693", "Google: turn-by-turn to the cafe's point");
check(site.directionsApple === "https://maps.apple.com/?daddr=31.2067034,29.9258693", "Apple Maps: the same point");
const directionsSrc = read("components/DirectionsLink.tsx");
check(/useSyncExternalStore\(noSubscription, isIOS, \(\) => false\)/.test(directionsSrc), "Google on the server, Apple swapped in on an iPhone");
for (const file of ["components/VisitSection.tsx", "app/(site)/about/page.tsx", "components/MapEmbed.tsx"]) {
  check(/<DirectionsLink/.test(read(file)), `${file} uses one-tap directions`);
}
check(!/directionsHref=/.test(read("app/(site)/events/[id]/page.tsx")), "the event page's cafe map uses one-tap directions");
for (const file of ["app/(site)/page.tsx", "app/(site)/menu/page.tsx", "app/(site)/about/page.tsx"]) {
  check(/<VisitRow /.test(read(file)), `${file} shows "Open now"`);
}
check(!/OpenStatus|VisitRow/.test(read("app/offline/page.tsx")), "/offline has no status (it would be frozen)");

// --- Seasons ----------------------------------------------------------------------------------------
const winter = { isActive: true, startsOn: "2026-12-01", endsOn: "2027-02-28" };
check(isInSeason(winter, "2026-12-01") && isInSeason(winter, "2027-02-28"), "both ends are inclusive");
check(!isInSeason(winter, "2026-11-30") && !isInSeason(winter, "2027-03-01"), "…and nothing outside them");
check(isInSeason({ isActive: true, startsOn: "2026-12-01" }, "2030-01-01") && isInSeason({ isActive: true, endsOn: "2026-12-01" }, "2020-01-01"), "either end may be open");
check(!isInSeason({ ...winter, isActive: false }, "2027-01-01"), "a hidden section stays hidden in season");
check(isInSeason({ isActive: true, startsOn: null, endsOn: null }, "2026-06-01"), "no season: all year");
const lateNight = dayKey(at("2026-12-31T22:30:00Z"));
check(lateNight === "2027-01-01" && !isInSeason({ isActive: true, endsOn: "2026-12-31" }, lateNight), "22:30 UTC on 31 Dec is already 1 Jan in Cairo");

/** Just enough of MongoDB's matching to run `seasonFilter`: equality, null, $lte, $gte, $or, $and. */
function matches(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$and") return (cond as Record<string, unknown>[]).every((f) => matches(doc, f));
    if (key === "$or") return (cond as Record<string, unknown>[]).some((f) => matches(doc, f));
    const value = key.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], doc);
    if (cond === null) return value === null || value === undefined;
    if (typeof cond === "object" && cond) {
      const ops = cond as { $lte?: string; $gte?: string };
      if (value === null || value === undefined) return false;
      return (ops.$lte === undefined || (value as string) <= ops.$lte) && (ops.$gte === undefined || (value as string) >= ops.$gte);
    }
    return value === cond;
  });
}
const samples = [
  winter,
  { isActive: true },
  { isActive: false },
  { isActive: true, startsOn: "2026-12-01" },
  { isActive: true, endsOn: "2026-12-01" },
  { isActive: true, startsOn: null, endsOn: "2027-01-15" },
  { isActive: true, startsOn: "2027-01-01", endsOn: "2027-01-01" },
];
let agree = true;
for (const today of ["2026-11-30", "2026-12-01", "2027-01-01", "2027-01-15", "2027-02-28", "2027-03-01"]) {
  for (const doc of samples) {
    if (matches(doc, seasonFilter(today)) !== isInSeason(doc, today)) agree = false;
    if (matches({ section: doc }, seasonFilter(today, "section.")) !== isInSeason(doc, today)) agree = false;
  }
}
check(agree, "the database filter and isInSeason agree on every sample, joined or not");
check(seasonRangeOk("2026-12-01", "2026-12-01") && seasonRangeOk(null, "2026-12-01") && seasonRangeOk("2026-12-01", undefined), "a one-day season, or an open end, is fine");
check(!seasonRangeOk("2026-12-02", "2026-12-01"), "an end before the start is refused");
check(seasonState(winter, "2026-11-01") === "upcoming" && seasonState(winter, "2027-01-01") === "current" && seasonState(winter, "2027-03-01") === "ended" && seasonState({}, "2027-03-01") === "allYear", "the admin badge's four states");
check(formatDayKey("2026-12-01", "en") === "1 Dec", `a season day reads "1 Dec" (${formatDayKey("2026-12-01", "en")})`);

// --- Schemas -----------------------------------------------------------------------------------------
check(seasonDay.safeParse("2028-02-29").success && seasonDay.safeParse("2026-12-31").success, "real days pass");
for (const bad of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-1-1", "01-12-2026", ""]) {
  check(!seasonDay.safeParse(bad).success, `"${bad}" is refused, without throwing`);
}
check(createMenuCategorySchema.safeParse({ nameAr: "شتوي", nameEn: "Winter", startsOn: "2026-12-01", endsOn: "2027-02-28" }).success, "create takes a season");
check(!createMenuCategorySchema.safeParse({ nameAr: "x", nameEn: "y", order: 3 }).success, "create stays strict");
const rename = updateMenuCategorySchema.parse({ nameEn: "Winter specials" });
check(!("isActive" in rename) && !("startsOn" in rename), "a rename sets nothing else (no default leaks)");
check(updateMenuCategorySchema.parse({ startsOn: null }).startsOn === null, "null clears a date");
check(!updateMenuCategorySchema.safeParse({ startsOn: "tomorrow" }).success, "update checks the day too");

// --- Sources -----------------------------------------------------------------------------------------
const data = read("lib/data.ts");
check(/includeHidden \? \[\] : \[\{ \$match: seasonFilter\(dayKey\(new Date\(\)\)\) \}\]/.test(data), "the public menu is filtered by season, by Cairo day");
check(/\{ \$match: seasonFilter\(dayKey\(new Date\(\)\), "section\."\) \}/.test(data), "…and so are the homepage's picks");
const menuRoute = read("app/api/menu/route.ts");
check(!/currentUser|from "@\/auth"|cookies\(|headers\(\)/.test(menuRoute), "GET /api/menu still reads no session or cookie");
check(/isInSeason\(c, today\)/.test(read("components/menu/OfflineMenu.tsx")), "the offline menu drops ended seasons");
check(/seasonRangeOk\(startsOn, endsOn\)/.test(read("app/api/menu/categories/route.ts")), "create refuses a reversed season");
const patchRoute = read("app/api/menu/categories/[id]/route.ts");
check(/seasonRangeOk\(from, until\)/.test(patchRoute) && /startsOn === undefined \? current\.startsOn : startsOn/.test(patchRoute), "an edit is checked against the stored other end");
check(/if \(value === null\) unset\[key\] = 1;/.test(patchRoute), "null is cleared with $unset");
check(/const VERSION = "v3";/.test(read("public/sw.js")), "the service worker is v3");

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error(`\ncheck-cafe-life: ${failures.length} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-cafe-life: all ${passes} checks pass — hours parse and fall back, "Open now" holds across midnight and both clock changes, directions are one-tap, seasons are inclusive and agree with the database filter.`
);
