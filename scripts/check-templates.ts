/**
 * DB-free checks for event templates (`PLAN/DEKKA_PWA_APP.md` §4).
 *
 * What this guards, and why each matters:
 * - **Nothing can ride along into an event.** `POST /api/events/from-template`
 *   takes a template id and a day; the server builds every event field. The
 *   request schema must reject event fields outright, and the builder must copy
 *   exactly the shared field list — never a template's own keys, an `_id`, or a
 *   `status`.
 * - **Always a draft.** Publishing is the one path that notifies members; a
 *   template must not be able to produce a published event, even a doctored one.
 * - **What it builds is a valid event,** per the real `createEventSchema`.
 * - **"20:00" is 8pm in Cairo,** on both sides of Egypt's daylight-saving change.
 * - **No defaults leak through a template update,** and every template route
 *   is admin-guarded (read from source).
 *
 *   npm run check:templates
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createEventSchema,
  createEventTemplateSchema,
  eventFromTemplateSchema,
  updateEventTemplateSchema,
} from "../lib/validation";
import {
  TEMPLATE_EVENT_FIELDS,
  buildEventFromTemplate,
  isRealDate,
  startsAtFor,
  templateFieldsFromEvent,
} from "../lib/templates";

const failures: string[] = [];
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const ID = "0123456789abcdef01234567";
const EVENT_FIELDS = {
  titleAr: "ليلة كاريوكي",
  titleEn: "Karaoke night",
  descriptionAr: "غني معانا",
  descriptionEn: "Sing with us",
  locationAr: "الإسكندرية",
  locationEn: "Alexandria",
  mapUrl: "https://maps.app.goo.gl/x",
  coverImage: "",
  isPoster: false,
  price: 100,
  capacity: 40,
  paymentMethods: ["cash", "instapay"],
  instapayNumber: "0100",
  termsAr: "",
  termsEn: "",
};
const TEMPLATE = { nameAr: "كاريوكي", nameEn: "Karaoke", defaultTime: "20:00", ...EVENT_FIELDS };

// --- Template schemas -----------------------------------------------------------
{
  const parsed = createEventTemplateSchema.parse(TEMPLATE);
  check("create accepts a full template", true);
  check("create defaults kind to night", parsed.kind === "night");
  for (const [label, extra] of [
    ["startsAt", { startsAt: "2026-10-08T17:00:00.000Z" }],
    ["status", { status: "published" }],
    ["doorsOpenAt", { doorsOpenAt: null }],
    ["order", { order: 0 }],
    ["_id", { _id: ID }],
  ] as const) {
    check(`create rejects ${label}`, !accepts(createEventTemplateSchema, { ...TEMPLATE, ...extra }));
  }
  check("update rejects status", !accepts(updateEventTemplateSchema, { status: "published" }));
  const price = updateEventTemplateSchema.parse({ price: 120 });
  check("update {price} parses to exactly {price}", JSON.stringify(price) === '{"price":120}', JSON.stringify(price));
  const name = updateEventTemplateSchema.parse({ nameEn: "Karaoke Wednesday" });
  check("update {nameEn} doesn't reset kind/isPoster/text", JSON.stringify(name) === '{"nameEn":"Karaoke Wednesday"}', JSON.stringify(name));
  for (const ok of ["00:00", "08:30", "20:00", "23:59"]) {
    check(`defaultTime accepts ${ok}`, accepts(createEventTemplateSchema, { ...TEMPLATE, defaultTime: ok }));
  }
  for (const bad of ["24:00", "7:00", "20:60", "8pm", "20:00:00", ""]) {
    check(`defaultTime rejects "${bad}"`, !accepts(createEventTemplateSchema, { ...TEMPLATE, defaultTime: bad }));
  }
  check("payment methods still required (≥1)", !accepts(createEventTemplateSchema, { ...TEMPLATE, paymentMethods: [] }));
}

// --- The from-template request ----------------------------------------------------
{
  check("request accepts {templateId, date}", accepts(eventFromTemplateSchema, { templateId: ID, date: "2026-10-08" }));
  check("request accepts a time", accepts(eventFromTemplateSchema, { templateId: ID, date: "2026-10-08", time: "21:30" }));
  for (const [label, extra] of [
    ["a title", { titleEn: "Free drinks" }],
    ["a price", { price: 0 }],
    ["a status", { status: "published" }],
    ["a startsAt", { startsAt: "2026-10-08T17:00:00.000Z" }],
    ["a capacity", { capacity: 1 }],
  ] as const) {
    check(`request rejects ${label}`, !accepts(eventFromTemplateSchema, { templateId: ID, date: "2026-10-08", ...extra }));
  }
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-5", "08-10-2026", "tomorrow"]) {
    check(`request rejects date "${bad}"`, !accepts(eventFromTemplateSchema, { templateId: ID, date: bad }));
  }
  check("request rejects a bad time", !accepts(eventFromTemplateSchema, { templateId: ID, date: "2026-10-08", time: "25:00" }));
  check("request rejects a NoSQL operator id", !accepts(eventFromTemplateSchema, { templateId: { $ne: null }, date: "2026-10-08" }));
  check("leap day 2028-02-29 is real", isRealDate("2028-02-29"));
  check("2026-02-29 is not", !isRealDate("2026-02-29"));
}

// --- Cairo time -----------------------------------------------------------------
{
  // Egypt observes DST (UTC+3) from late April to late October; UTC+2 otherwise.
  const summer = startsAtFor("2026-10-08", "20:00")?.toISOString();
  const winter = startsAtFor("2026-12-10", "20:00")?.toISOString();
  check("20:00 in October is 17:00Z (UTC+3)", summer === "2026-10-08T17:00:00.000Z", summer);
  check("20:00 in December is 18:00Z (UTC+2)", winter === "2026-12-10T18:00:00.000Z", winter);
  check("an unreal date gives null", startsAtFor("2026-02-30", "20:00") === null);
}

// --- The builder ----------------------------------------------------------------
{
  const doctored = { ...TEMPLATE, _id: ID, kind: "night", order: 3, status: "published", startsAt: "1999-01-01", doorsOpenAt: "x" };
  const startsAt = new Date("2026-10-08T17:00:00.000Z");
  const built = buildEventFromTemplate(doctored, startsAt);
  const keys = Object.keys(built).sort();
  const expected = [...TEMPLATE_EVENT_FIELDS, "startsAt", "status"].sort();
  check("builder copies exactly the shared fields", JSON.stringify(keys) === JSON.stringify(expected), keys.join(","));
  check("builder always makes a draft (even from a doctored template)", built.status === "draft");
  check("builder sets the computed start", built.startsAt === startsAt);
  check("builder turns a missing capacity into null", buildEventFromTemplate({ ...TEMPLATE, capacity: undefined }, startsAt).capacity === null);
  check(
    "what it builds is a valid event (createEventSchema)",
    accepts(createEventSchema, { ...built, startsAt: startsAt.toISOString() }),
    JSON.stringify(createEventSchema.safeParse({ ...built, startsAt: startsAt.toISOString() }).error?.issues?.[0])
  );
  check("the shared list never includes startsAt/status/doorsOpenAt", !(TEMPLATE_EVENT_FIELDS as readonly string[]).some((k) => ["startsAt", "status", "doorsOpenAt"].includes(k)));

  // Round trip: event → "Save as template" → new event keeps every shared value.
  const event = { ...EVENT_FIELDS, startsAt: "2026-10-08T17:00:00.000Z", status: "happened", id: ID };
  const captured = templateFieldsFromEvent(event);
  check("save-as-template takes the start time in Cairo time", captured.defaultTime === "20:00", captured.defaultTime);
  check("save-as-template carries no status/startsAt/id", !("status" in captured) && !("startsAt" in captured) && !("id" in captured));
  const again = buildEventFromTemplate(captured, startsAt);
  check(
    "round trip keeps every shared value",
    TEMPLATE_EVENT_FIELDS.every((k) => JSON.stringify(again[k]) === JSON.stringify((EVENT_FIELDS as Record<string, unknown>)[k]))
  );
}

// --- Route guards, from source --------------------------------------------------
{
  const api = path.resolve(import.meta.dirname, "..", "app", "api");
  // Code only: these files' comments describe what they must not do.
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const read = (rel: string) => stripComments(readFileSync(path.join(api, rel), "utf8"));
  for (const rel of [
    "event-templates/route.ts",
    "event-templates/[id]/route.ts",
    "event-templates/order/route.ts",
    "events/from-template/route.ts",
  ]) {
    const src = read(rel);
    const handlers = (src.match(/export async function (GET|POST|PATCH|DELETE|PUT)\b/g) ?? []).length;
    const guards = (src.match(/guard\("admin"\)/g) ?? []).length;
    check(`${rel}: every handler is guard("admin")`, handlers > 0 && guards === handlers, `${handlers} handlers, ${guards} guards`);
  }
  const fromTemplate = read("events/from-template/route.ts");
  check("from-template: builds via buildEventFromTemplate", /Event\.create\(buildEventFromTemplate\(/.test(fromTemplate));
  check("from-template: never spreads the request into the event", !/\.\.\.parsed\.data/.test(fromTemplate) && !/status:\s*["']published/.test(fromTemplate));
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\n${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`check-templates: all ${passed} checks pass — requests can't carry event fields, every template makes a valid draft, 20:00 means Cairo time, routes are admin-guarded.`);
console.log("NOT covered here (needs a database): TEMPLATE_NOT_FOUND and STALE_ORDER — exercised against a local MongoDB instead.");
