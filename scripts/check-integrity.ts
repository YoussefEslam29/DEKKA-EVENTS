/**
 * `npm run check:integrity` — DB-free assertions for the roadmap's integrity phase
 * (`PLAN/SITE_ROADMAP.md` S2, I1–I4). Run it after touching any admin/staff page,
 * the event lifecycle, or anything that reads door records.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  EVENT_STATUSES,
  EVENT_TRANSITIONS,
  canTransition,
  type EventStatus,
} from "../lib/constants";
import { shiftCafeDays } from "../lib/templates";
import { diffCheckIn, snapshotCheckIn } from "../lib/checkin-audit";

const ROOT = path.resolve(__dirname, "..");
let failures = 0;
let passes = 0;

function check(ok: boolean, label: string) {
  if (ok) passes++;
  else {
    failures++;
    console.error(`✗ ${label}`);
  }
}

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (entry === "page.tsx") found.push(full);
  }
  return found;
}

// ---------------------------------------------------------------------------
// S2 — every admin/staff page gates itself before reading anything.
//
// The layouts' check is not enough: a layout and its page stream together, so a page
// that fetched before the layout's redirect landed sends its data in the same response
// (proven 2026-10-08 against a local build: a signed-out `curl /admin/customers` carried
// every door record). So the *first* await in the page must be `requireRole(...)`.
// ---------------------------------------------------------------------------
const gated: { dir: string; role: "admin" | "staff" }[] = [
  { dir: "app/(site)/admin", role: "admin" },
  { dir: "app/(site)/staff", role: "staff" },
];

let pageCount = 0;
for (const { dir, role } of gated) {
  for (const file of walk(path.join(ROOT, dir))) {
    pageCount++;
    const rel = path.relative(ROOT, file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    const body = source.slice(source.indexOf("export default async function"));
    const firstAwait = body.match(/await\s+([\w.]+)\(\s*"?(\w*)"?/);
    check(
      firstAwait?.[1] === "requireRole",
      `${rel}: the first await must be requireRole(...), found ${firstAwait?.[1] ?? "none"}`
    );
    check(
      firstAwait?.[2] === role,
      `${rel}: requireRole must ask for "${role}", found "${firstAwait?.[2] ?? ""}"`
    );
  }
}
check(pageCount >= 12, `expected at least 12 admin/staff pages, found ${pageCount}`);

const rbac = readFileSync(path.join(ROOT, "lib/rbac.ts"), "utf8");
check(/export async function requireRole/.test(rbac), "lib/rbac.ts exports requireRole");
check(/redirect\(`\/login\?next=/.test(rbac), "requireRole sends a guest to /login?next=");

// ---------------------------------------------------------------------------
// I1 — the event lifecycle has rules, and the API enforces the same table the UI reads.
// ---------------------------------------------------------------------------
for (const status of EVENT_STATUSES) {
  check(Array.isArray(EVENT_TRANSITIONS[status]), `EVENT_TRANSITIONS has an entry for ${status}`);
  check(canTransition(status, status), `${status} → ${status} (an edit) is allowed`);
}
const forbidden: [EventStatus, EventStatus][] = [
  ["happened", "published"], // re-announcing a past night
  ["archived", "published"],
  ["happened", "draft"], // takings drop out of the monthly report
  ["archived", "draft"],
  ["draft", "happened"],
  ["draft", "archived"],
];
for (const [from, to] of forbidden) check(!canTransition(from, to), `${from} → ${to} is refused`);
const allowed: [EventStatus, EventStatus][] = [
  ["draft", "published"],
  ["published", "closed"],
  ["closed", "published"],
  ["published", "happened"],
  ["happened", "archived"],
  ["happened", "closed"],
  ["archived", "happened"],
];
for (const [from, to] of allowed) check(canTransition(from, to), `${from} → ${to} is allowed`);

const eventRoute = readFileSync(path.join(ROOT, "app/api/events/[id]/route.ts"), "utf8");
check(/canTransition\(before\.status, nextStatus\)/.test(eventRoute), "PATCH checks canTransition");
check(/"INVALID_TRANSITION", 409/.test(eventRoute), "PATCH refuses with 409 INVALID_TRANSITION");
check(
  /nextStatus === "draft"[\s\S]{0,200}countEventRecords/.test(eventRoute),
  "PATCH counts records before allowing → draft"
);
check(
  /nextStatus === "published" && before\.status === "draft" && !before\.firstPublishedAt/.test(eventRoute),
  "push fires only on a first publish from draft"
);
check(!/CheckIn\.deleteMany/.test(eventRoute), "DELETE never deletes door rows");
check(
  /records\.checkIns > 0[\s\S]{0,80}EVENT_HAS_RECORDS/.test(eventRoute) ||
    /EVENT_HAS_RECORDS", 409, records\);\s*\}\s*\n\s*const doc = await Event\.findByIdAndDelete/.test(eventRoute),
  "DELETE refuses a night with door records"
);

// ---------------------------------------------------------------------------
// I3 — door rows are voided, never deleted, and voided rows count nowhere.
// ---------------------------------------------------------------------------
const checkinRoute = readFileSync(path.join(ROOT, "app/api/checkins/[id]/route.ts"), "utf8");
check(!/findByIdAndDelete|deleteOne|deleteMany/.test(checkinRoute), "check-in DELETE voids instead of deleting");
check(/voidedAt: new Date\(\)/.test(checkinRoute), "check-in DELETE sets voidedAt");
check(/reservation: null/.test(checkinRoute), "a void hands the reservation back");
check((checkinRoute.match(/recordCheckInAudit\(/g) ?? []).length === 2, "PATCH and DELETE both write the door log");
const createRoute = readFileSync(path.join(ROOT, "app/api/events/[id]/checkins/route.ts"), "utf8");
check(/recordCheckInAudit\(/.test(createRoute), "POST check-in writes the door log");

const data = readFileSync(path.join(ROOT, "lib/data.ts"), "utf8");
const lookups = data.match(/from: CheckIn\.collection\.name,[\s\S]{0,300}?as: "/g) ?? [];
check(lookups.length >= 3, `found the CheckIn $lookups (${lookups.length})`);
for (const lookup of lookups) {
  check(/voidedAt: null/.test(lookup), `every $lookup on CheckIn filters voidedAt: ${lookup.slice(0, 60)}…`);
}
for (const find of data.match(/CheckIn\.find\([^)]*\)/g) ?? []) {
  check(/voidedAt: null/.test(find), `every CheckIn.find filters voidedAt: ${find}`);
}
check(/const match: Record<string, unknown> = \{ voidedAt: null \}/.test(data), "getAllCheckIns filters voidedAt");

check(diffCheckIn({ amount: 100 }, { amount: 100 }).length === 0, "re-saving a value unchanged is not an edit");
check(diffCheckIn({ amount: 100, name: "A" }, { amount: 50 }).length === 1, "only sent fields are compared");
check(diffCheckIn({ note: undefined }, { note: "" }).length === 0, "empty and absent notes are the same");
const changed = diffCheckIn({ paymentMethod: "cash" }, { paymentMethod: "instapay" })[0];
check(changed?.from === "cash" && changed?.to === "instapay", "a change records from → to");
check(
  snapshotCheckIn({ name: "A", amount: 0, gender: null }, "out").map((c) => c.field).join() === "name,amount",
  "a snapshot keeps 0 and drops null"
);

// ---------------------------------------------------------------------------
// I4 — Cairo time: a week later is the same Cairo wall-clock time, across DST.
// Egypt's 2026 summer time runs 24 Apr → 29/30 Oct (UTC+3), UTC+2 otherwise.
// ---------------------------------------------------------------------------
const shifts: [string, number, string][] = [
  ["2026-10-28T17:00:00.000Z", 7, "2026-11-04T18:00:00.000Z"], // Wed 20:00 across autumn DST
  ["2026-04-22T18:00:00.000Z", 7, "2026-04-29T17:00:00.000Z"], // Wed 20:00 across spring DST
  ["2026-12-02T18:00:00.000Z", 7, "2026-12-09T18:00:00.000Z"], // no DST change
  ["2026-12-02T22:30:00.000Z", 7, "2026-12-09T22:30:00.000Z"], // 00:30 Cairo, after midnight
];
for (const [from, days, expected] of shifts) {
  const got = shiftCafeDays(from, days)?.toISOString();
  check(got === expected, `shiftCafeDays(${from}, ${days}) = ${expected} (got ${got})`);
}
const duplicate = readFileSync(path.join(ROOT, "components/DuplicateEventButton.tsx"), "utf8");
check(/shiftCafeDays\(event\.startsAt, 7\)/.test(duplicate), "Duplicate shifts by Cairo days");
check(!/setDate\(/.test(duplicate), "Duplicate no longer uses the browser's setDate");
const staffPage = readFileSync(path.join(ROOT, "app/(site)/staff/page.tsx"), "utf8");
check(!/toDateString/.test(staffPage) && /dayKey\(/.test(staffPage), "the staff picker decides 'today' in Cairo");

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.error(`\ncheck-integrity: ${failures} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-integrity: all ${passes} checks pass — all ${pageCount} admin/staff pages gate themselves first; the lifecycle table refuses re-announcing or un-booking a past night; door rows are voided, logged, and excluded everywhere; a week later stays the same Cairo time across DST.`
);
