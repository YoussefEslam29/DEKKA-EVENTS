/**
 * `npm run check:integrity` — DB-free assertions for the roadmap's integrity phase
 * (`PLAN/SITE_ROADMAP.md` S2, I1–I4). Run it after touching any admin/staff page,
 * the event lifecycle, or anything that reads door records.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

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

if (failures > 0) {
  console.error(`\ncheck-integrity: ${failures} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-integrity: all ${passes} checks pass — every one of the ${pageCount} admin/staff pages gates itself with requireRole before reading anything.`
);
