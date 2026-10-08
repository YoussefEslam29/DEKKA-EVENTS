/**
 * `npm run check:seo` — DB-free assertions for findability (`PLAN/SITE_ROADMAP.md` D1):
 * every page has its own title, private pages stay out of search, structured data is
 * well-formed and can't be broken out of.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import robots from "../app/robots";
import { PRIVATE_PATHS, SITE_OPEN_GRAPH, cafeJsonLd, eventJsonLd, jsonLdString, pageMetadata } from "../lib/seo";
import { EVENT_DEFAULT_DURATION_MIN } from "../lib/constants";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else failures.push(label);
}
function pagesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) pagesUnder(rel, found);
    else if (entry === "page.tsx") found.push(rel);
  }
  return found;
}

// --- robots.txt --------------------------------------------------------------------------
const r = robots();
const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
const disallow = ([] as string[]).concat(rules?.disallow ?? []);
for (const p of ["/admin", "/staff", "/account", "/my-events", "/api/"]) {
  check(disallow.includes(p), `robots.txt disallows ${p}`);
}
check(typeof r.sitemap === "string" && /^https:\/\/[^/]+\/sitemap\.xml$/.test(r.sitemap), "robots.txt points at an absolute sitemap");

// --- Titles everywhere, noindex where private ------------------------------------------------
const layout = read("app/layout.tsx");
check(/metadataBase: new URL\(site\.url\)/.test(layout), "root metadataBase is the site URL");
check(/template: "%s · دكة Dekka"/.test(layout), "titles get the brand through one template");
check(/openGraph: SITE_OPEN_GRAPH/.test(layout), "the layout's share card is the shared one");
check(SITE_OPEN_GRAPH.images[0].url === "/brand/dekka-banner.jpg", "a default share image");
// Next.js replaces the layout's whole `openGraph` with a page's, so every page repeats it.
type Og = { images?: { url: string }[]; siteName?: string; title?: string; url?: string };
const og = pageMetadata({ title: "Y", path: "/y" }).openGraph as Og;
check(og.images?.[0]?.url === "/brand/dekka-banner.jpg" && og.siteName === "دكة · Dekka", "a page keeps the site's image and name");
check(og.title === "Y" && og.url === "/y", "…with its own title and URL");
const own = pageMetadata({ title: "Z", path: "/z", image: { url: "/card.png", width: 1200, height: 630, alt: "Z" } }).openGraph as Og;
check(own.images?.length === 1 && own.images[0].url === "/card.png", "a page's own image replaces the banner");
check(/image: \{ url: `\/api\/events\/\$\{event\.id\}\/og`, width: 1200, height: 630/.test(read("app/(site)/events/[id]/page.tsx")), "an event page shares its own card");

const publicPages = [...pagesUnder("app/(site)"), ...pagesUnder("app/(auth)")].filter(
  (p) => !p.includes("/admin/") && !p.includes("/staff/")
);
for (const page of publicPages) {
  const src = read(page);
  check(/export (async function generateMetadata|const metadata)/.test(src), `${page} declares its metadata`);
}
for (const [page, mustNoindex] of [
  ["app/(site)/my-events/page.tsx", true],
  ["app/(site)/account/page.tsx", true],
  ["app/(auth)/forgot-password/page.tsx", true],
  ["app/(auth)/reset-password/page.tsx", true],
  ["app/(auth)/verify-email/page.tsx", true],
  ["app/(site)/menu/page.tsx", false],
] as const) {
  check(/noindex: true/.test(read(page)) === mustNoindex, `${page} is ${mustNoindex ? "" : "not "}noindex`);
}
for (const layoutFile of ["app/(site)/admin/layout.tsx", "app/(site)/staff/layout.tsx"]) {
  check(/robots: \{ index: false, follow: false \}/.test(read(layoutFile)), `${layoutFile} is noindex`);
}
const eventPage = read("app/(site)/events/[id]/page.tsx");
check(/if \(!event \|\| event\.status === "draft"\) return \{ robots: \{ index: false, follow: false \} \}/.test(eventPage), "a draft's metadata is the default, unindexed");
check(/export const getEvent = cache\(/.test(read("lib/data.ts")), "metadata and page share one event read");
const meta = pageMetadata({ title: "X", path: "/x", noindex: true });
check(
  JSON.stringify(meta.robots) === JSON.stringify({ index: false, follow: false }) &&
    (meta.alternates as { canonical: string }).canonical === "/x",
  "pageMetadata sets canonical and robots"
);
check(PRIVATE_PATHS.includes("/admin") && PRIVATE_PATHS.includes("/verify-email"), "one list of private paths");

// --- The sitemap is read per request ---------------------------------------------------------
const sitemap = read("app/sitemap.ts");
check(/export const dynamic = "force-dynamic"/.test(sitemap), "the sitemap never touches the database at build time");
check(/status: \{ \$in: \["published", "closed", "happened", "archived"\] \}/.test(sitemap), "the sitemap lists public nights only");

// --- Structured data ----------------------------------------------------------------------
const cafe = cafeJsonLd();
check(cafe["@type"] === "CafeOrCoffeeShop" && cafe.address.addressLocality === "Alexandria", "the cafe is a CafeOrCoffeeShop in Alexandria");
const ev = eventJsonLd(
  {
    id: "abc",
    titleAr: "ليلة",
    titleEn: "Night </script><script>alert(1)</script>",
    descriptionAr: "",
    descriptionEn: "Live music",
    locationEn: "",
    coverImage: "/uploads/events/x.jpg",
    startsAt: "2026-12-02T18:00:00.000Z",
    price: 150,
    capacity: 40,
    status: "published",
  },
  0
);
check(ev["@type"] === "Event" && ev.offers.priceCurrency === "EGP" && ev.offers.price === 150, "an Event with an EGP offer");
check(new Date(ev.endDate).getTime() - new Date(ev.startDate).getTime() === EVENT_DEFAULT_DURATION_MIN * 60000, "endDate is start + the default length");
check(ev.offers.availability.endsWith("SoldOut"), "no spots left reads as sold out");
check(ev.image[0].startsWith("https://"), "the image is absolute");
const html = jsonLdString(ev);
check(!html.includes("</script") && !html.includes("<"), "a title can't close the script tag");
check(JSON.parse(html.replace(/\\u003c/g, "<")).name.includes("</script>"), "…and the data survives intact");

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error(`\ncheck-seo: ${failures.length} failed, ${passes} passed.`);
  process.exit(1);
}
console.log(
  `check-seo: all ${passes} checks pass — ${publicPages.length} public pages declare their own metadata, private pages are noindex and disallowed, the sitemap is per-request, structured data is sound and unbreakable.`
);
