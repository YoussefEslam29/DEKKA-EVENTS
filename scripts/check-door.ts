/**
 * `npm run check:door` — DB-free assertions for the door-night phase (`PLAN/SITE_ROADMAP.md`
 * R3, X2): the offline queue, the server's idempotent check-in, and the staff picker's
 * grouping by Cairo night.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CLIENT_ID_PATTERN,
  outcomeFor,
  queueKey,
  readQueue,
  writeQueue,
  type QueuedCheckIn,
} from "../lib/door-queue";
import { cafeNightKey, groupStaffEvents } from "../lib/staff";
import { checkInSchema } from "../lib/validation";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}

/** A Storage stand-in, with switches to make it throw like private mode does. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    broken: false,
    getItem(k: string) {
      if (this.broken) throw new Error("SecurityError");
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      if (this.broken) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
  };
}

// --- The queue survives a reload, per night, and never throws ---------------------------
const store = memoryStorage();
const entry = (n: number): QueuedCheckIn => ({
  clientId: `0000000${n}-0000-4000-8000-000000000000`,
  payload: {
    clientId: `0000000${n}-0000-4000-8000-000000000000`,
    name: `Guest ${n}`,
    phone: "0100000000",
    paymentMethod: "cash",
    amount: 100,
  },
  createdAt: new Date(0).toISOString(),
});
writeQueue(store, "night-a", [entry(1), entry(2)]);
writeQueue(store, "night-b", [entry(3)]);
check(readQueue(store, "night-a").length === 2, "a night's queue reads back");
check(readQueue(store, "night-b")[0]?.payload.name === "Guest 3", "nights don't mix");
writeQueue(store, "night-a", []);
check(!store.data.has(queueKey("night-a")), "an empty queue removes its key");
store.data.set(queueKey("night-c"), "{not json");
check(readQueue(store, "night-c").length === 0, "corrupt storage reads as empty");
store.data.set(queueKey("night-d"), JSON.stringify([{ nope: true }, entry(4)]));
check(readQueue(store, "night-d").length === 1, "malformed entries are skipped");
store.broken = true;
let threw = false;
try {
  check(readQueue(store, "night-b").length === 0, "blocked storage reads as empty");
  writeQueue(store, "night-b", [entry(5)]);
} catch {
  threw = true;
}
check(!threw, "blocked storage never throws");
check(readQueue(null, "x").length === 0, "no storage at all is fine");

// --- What a send attempt means ----------------------------------------------------------
check(outcomeFor(201) === "synced" && outcomeFor(200) === "synced", "2xx (incl. a replay) is synced");
check(outcomeFor("network") === "retry", "no signal: retry");
check(outcomeFor(429) === "retry" && outcomeFor(503) === "retry" && outcomeFor(500) === "retry", "throttled or server trouble: retry");
check(outcomeFor(409) === "rejected" && outcomeFor(400) === "rejected", "a refusal waits for a person");

// --- The server answers a resend with the row it already has -----------------------------
const id = "3f2b9c1e-8a4d-4c7e-9b1a-2d3e4f5a6b7c";
check(CLIENT_ID_PATTERN.test(id), "a UUID is a valid clientId");
check(checkInSchema.safeParse({ name: "A", phone: "0100", paymentMethod: "cash", amount: 1, clientId: id }).success, "the check-in schema takes a clientId");
check(!checkInSchema.safeParse({ name: "A", phone: "0100", paymentMethod: "cash", amount: 1, clientId: "x; drop" }).success, "…and nothing else in it");
const route = read("app/api/events/[id]/checkins/route.ts");
const replayAt = route.indexOf("CheckIn.findOne({ clientId: input.clientId })");
const reservationAt = route.indexOf('jsonError("ALREADY_CHECKED_IN", 409)');
check(replayAt > 0 && replayAt < reservationAt, "the replay lookup runs before the already-checked-in rule");
check(/code === 11000 && input\.clientId/.test(route), "a duplicate-key race answers with the winner's row");
check(/"CLIENT_ID_REUSED", 409/.test(route), "a clientId from another night is refused");
const model = read("models/CheckIn.ts");
check(/index\(\{ clientId: 1 \}, \{ unique: true, sparse: true \}\)/.test(model), "clientId is unique and sparse");

// --- The door table uses it ----------------------------------------------------------------
const door = read("components/DoorTable.tsx");
check(/newClientId\(\)/.test(door), "every entry gets a clientId");
check(/addEventListener\("online"/.test(door), "it retries when the phone is back online");
check(/setInterval\(/.test(door), "…and on a timer");
check(/if \(outcome === "retry"\) break;/.test(door), "a waiting entry keeps its place in line");
check(/\n  function addAttendee\(e: React\.FormEvent\) \{/.test(door), "adding is synchronous: it never waits on the network");
check(/commitQueue\(\[\n\s*\.\.\.queueRef\.current,/.test(door), "an entry is saved to the queue before anything is sent");

// --- The staff picker: tonight first, by Cairo night ---------------------------------------
// 2026-12-02 is winter time (UTC+2).
const now = new Date("2026-12-02T20:00:00Z"); // 22:00 Cairo
check(cafeNightKey("2026-12-02T22:30:00Z") === "2026-12-02", "00:30 Cairo belongs to the night before");
check(cafeNightKey("2026-12-03T04:30:00Z") === "2026-12-03", "06:30 Cairo is the next day");
const groups = groupStaffEvents(
  [
    { id: "past", startsAt: "2026-11-25T18:00:00Z" },
    { id: "late", startsAt: "2026-12-02T22:30:00Z" }, // 00:30 Cairo, tonight
    { id: "tonight", startsAt: "2026-12-02T18:00:00Z" },
    { id: "next", startsAt: "2026-12-09T18:00:00Z" },
    { id: "soon", startsAt: "2026-12-04T18:00:00Z" },
  ],
  now
);
check(groups.tonight.map((e) => e.id).join() === "tonight,late", "tonight holds both of tonight's starts, in order");
check(groups.upcoming.map((e) => e.id).join() === "soon,next", "coming up is soonest first");
check(groups.earlier.map((e) => e.id).join() === "past", "earlier nights after");
const atHalfPast = groupStaffEvents([{ id: "tonight", startsAt: "2026-12-02T18:00:00Z" }], new Date("2026-12-02T22:30:00Z"));
check(atHalfPast.tonight.length === 1, "at 00:30 the door still shows the evening's night as tonight");

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error(`\ncheck-door: ${failures.length} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-door: all ${passes} checks pass — door entries are saved first and sent after, a resend records nothing twice, a refusal waits for a person, and the picker shows tonight first by Cairo night.`
);
