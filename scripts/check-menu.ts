/**
 * DB-free checks for the cafe menu (`PLAN/DEKKA_PWA_APP.md` §3).
 *
 * What this guards, and why each matters:
 * - **No defaults leak through an update.** A one-field PATCH (`{ price }`) must
 *   parse to exactly that field. If `available`/`isFeatured` defaults fired,
 *   every price change would un-sell-out and un-feature the item — the same
 *   class of bug that once blanked events on Publish (developer-guide.md §8).
 * - **The staff route can only carry `available`.** Its schema is the
 *   boundary between "staff can mark sold out" and "staff can change prices".
 * - **Every menu write route is guarded at the right rank,** asserted from the
 *   route sources, since a missing `guard()` compiles and runs just fine.
 * - **Photos are uploads only**, the pricing rule, and the reorder contract.
 *
 *   npm run check:menu
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  menuAvailabilitySchema,
  menuOrderSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema,
} from "../lib/validation";
import { cheapestVariantPrice, headlinePrice } from "../lib/menu";

const failures: string[] = [];
let passed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const ID = "0123456789abcdef01234567";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ITEM = { category: ID, nameAr: "لاتيه", nameEn: "Latte", price: 45 };

// --- Create: defaults apply -------------------------------------------------
{
  const parsed = createMenuItemSchema.parse(ITEM);
  check("create applies available=true", parsed.available === true);
  check("create applies isFeatured=false", parsed.isFeatured === false);
  check("create applies empty variants/tags/image", parsed.variants.length === 0 && parsed.tags.length === 0 && parsed.image === "");
  check("create category: names required", !accepts(createMenuCategorySchema, { nameAr: "", nameEn: "Hot" }));
  check("create category defaults isActive=true", createMenuCategorySchema.parse({ nameAr: "سخن", nameEn: "Hot" }).isActive === true);
}

// --- Update: nothing but what was sent --------------------------------------
{
  const price = updateMenuItemSchema.parse({ price: 50 });
  check("update {price} parses to exactly {price}", JSON.stringify(price) === '{"price":50}', JSON.stringify(price));
  const sold = updateMenuItemSchema.parse({ available: false });
  check("update {available} parses to exactly {available}", JSON.stringify(sold) === '{"available":false}', JSON.stringify(sold));
  const rename = updateMenuCategorySchema.parse({ nameEn: "Cold" });
  check("category rename doesn't re-show a hidden section", JSON.stringify(rename) === '{"nameEn":"Cold"}', JSON.stringify(rename));

  for (const [label, body] of [
    ["order", { order: 3 }],
    ["_id", { _id: ID }],
    ["createdAt", { createdAt: "2026-01-01" }],
    ["unknown key", { role: "admin" }],
  ] as const) {
    check(`update rejects ${label}`, !accepts(updateMenuItemSchema, body));
  }
  check("category update rejects order", !accepts(updateMenuCategorySchema, { order: 0 }));
  check("update rejects a malformed category id", !accepts(updateMenuItemSchema, { category: "abc" }));
  check("update rejects a NoSQL operator as category", !accepts(updateMenuItemSchema, { category: { $ne: null } }));
}

// --- Staff availability: one boolean, nothing else --------------------------
{
  check("availability accepts {available:true}", accepts(menuAvailabilitySchema, { available: true }));
  check("availability accepts {available:false}", accepts(menuAvailabilitySchema, { available: false }));
  for (const [label, body] of [
    ["price alongside", { available: true, price: 1 }],
    ["name alongside", { available: false, nameEn: "x" }],
    ["price alone", { price: 1 }],
    ["string boolean", { available: "yes" }],
    ["empty body", {}],
    ["featured alongside", { available: true, isFeatured: true }],
  ] as const) {
    check(`availability rejects ${label}`, !accepts(menuAvailabilitySchema, body));
  }
}

// --- Photos: uploads only ---------------------------------------------------
{
  check("image accepts a local upload", accepts(createMenuItemSchema, { ...ITEM, image: `/uploads/events/${UUID}.jpg` }));
  check(
    "image accepts a Blob upload",
    accepts(createMenuItemSchema, { ...ITEM, image: `https://abc123.public.blob.vercel-storage.com/events/${UUID}.webp` })
  );
  check("image rejects an external URL", !accepts(createMenuItemSchema, { ...ITEM, image: "https://evil.example/x.jpg" }));
  check("image rejects a pasted path", !accepts(updateMenuItemSchema, { image: "/brand/dekka-logo.png" }));
}

// --- Tags & sizes ------------------------------------------------------------
{
  check("tags accept known values", accepts(createMenuItemSchema, { ...ITEM, tags: ["hot", "vegan"] }));
  check("tags reject unknown value", !accepts(createMenuItemSchema, { ...ITEM, tags: ["spicy"] }));
  check("tags reject duplicates", !accepts(createMenuItemSchema, { ...ITEM, tags: ["hot", "hot"] }));
  const size = { labelAr: "صغير", labelEn: "Small", price: 40 };
  check("sizes accept a valid size", accepts(createMenuItemSchema, { ...ITEM, variants: [size] }));
  check("sizes reject a missing label", !accepts(createMenuItemSchema, { ...ITEM, variants: [{ ...size, labelEn: "" }] }));
  check("sizes reject a negative price", !accepts(createMenuItemSchema, { ...ITEM, variants: [{ ...size, price: -1 }] }));
  check("sizes reject an extra key", !accepts(createMenuItemSchema, { ...ITEM, variants: [{ ...size, sku: "x" }] }));
  check("sizes reject more than 8", !accepts(createMenuItemSchema, { ...ITEM, variants: Array(9).fill(size) }));
  check("price rejects negative", !accepts(createMenuItemSchema, { ...ITEM, price: -5 }));
}

// --- Reorder contract --------------------------------------------------------
{
  const other = "0123456789abcdef01234568";
  check("order accepts distinct ids", accepts(menuOrderSchema, { ids: [ID, other] }));
  check("order rejects duplicates (any case)", !accepts(menuOrderSchema, { ids: [ID, ID.toUpperCase()] }));
  check("order rejects an empty list", !accepts(menuOrderSchema, { ids: [] }));
  check("order rejects a bad id", !accepts(menuOrderSchema, { ids: ["nope"] }));
  check("order rejects extra keys", !accepts(menuOrderSchema, { ids: [ID], category: ID }));
}

// --- Pricing rule (lib/menu.ts) ----------------------------------------------
{
  check("no sizes: price is the price", JSON.stringify(headlinePrice({ price: 30, variants: [] })) === '{"amount":30,"from":false}');
  check("one size: its price, no 'from'", JSON.stringify(headlinePrice({ price: 99, variants: [{ price: 40 }] })) === '{"amount":40,"from":false}');
  check(
    "several sizes: 'from' the cheapest",
    JSON.stringify(headlinePrice({ price: 99, variants: [{ price: 55 }, { price: 40 }] })) === '{"amount":40,"from":true}'
  );
  check("cheapestVariantPrice of none is null", cheapestVariantPrice([]) === null);
}

// --- Route guards, read from source ------------------------------------------
{
  const root = path.resolve(import.meta.dirname, "..", "app", "api", "menu");
  // Code only: these routes' comments name the very things they must not do.
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const read = (rel: string) => stripComments(readFileSync(path.join(root, rel), "utf8"));

  const adminRoutes = [
    "categories/route.ts",
    "categories/[id]/route.ts",
    "categories/order/route.ts",
    "items/route.ts",
    "items/[id]/route.ts",
    "items/order/route.ts",
  ];
  for (const rel of adminRoutes) {
    const src = read(rel);
    const handlers = (src.match(/export async function (POST|PATCH|DELETE|PUT)\b/g) ?? []).length;
    const guards = (src.match(/guard\("admin"\)/g) ?? []).length;
    check(`${rel}: every write handler is guard("admin")`, handlers > 0 && guards === handlers, `${handlers} handlers, ${guards} admin guards`);
    check(`${rel}: no staff/member guard`, !/guard\("(staff|member)"\)/.test(src));
  }

  const availability = read("items/[id]/availability/route.ts");
  check("availability: guard(\"staff\")", /guard\("staff"\)/.test(availability));
  check("availability: parses menuAvailabilitySchema only", /parseBody\(request, menuAvailabilitySchema\)/.test(availability) && !/updateMenuItemSchema/.test(availability));
  check(
    "availability: writes exactly the one field",
    /\$set: \{ available: parsed\.data\.available \}/.test(availability) && !/\.\.\.parsed\.data/.test(availability)
  );

  const publicGet = read("route.ts");
  check("GET /api/menu: no write handlers", !/export async function (POST|PATCH|DELETE|PUT)\b/.test(publicGet));
  check("GET /api/menu: never asks who is calling", !/currentUser|guard\(|includeHidden/.test(publicGet));
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\n${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`check-menu: all ${passed} checks pass — updates carry only what was sent, staff can only flip availability, admin routes are admin-guarded, photos are uploads only.`);
console.log("NOT covered here (needs a database): the routes' own STALE_ORDER / CATEGORY_NOT_EMPTY / PRICE_SET_BY_VARIANTS paths — exercised against a local MongoDB instead.");
