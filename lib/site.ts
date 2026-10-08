import { parseOpeningHours } from "@/lib/hours";

/** "lat,lng" of the cafe: the point the embedded map already shows. */
const DEFAULT_COORDS = "31.2067034,29.9258693";
const coords = /^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(process.env.NEXT_PUBLIC_CAFE_COORDS ?? "")
  ? process.env.NEXT_PUBLIC_CAFE_COORDS!
  : DEFAULT_COORDS;

/**
 * Cafe-level details that belong to Dekka rather than to any one event.
 * Defaults are the real accounts/location; env vars only need to be set if
 * these ever change without a code deploy.
 */
export const site = {
  /**
   * The public origin, for anything that needs an absolute URL: share cards, the sitemap,
   * structured data, calendar entries, the QR poster (`PLAN/SITE_ROADMAP.md` D1). Set
   * `NEXT_PUBLIC_SITE_URL` once Dekka has its own domain; no trailing slash.
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://dekka-events.vercel.app").replace(/\/+$/, ""),
  instagram:
    process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/dekkacafe/",
  facebook:
    process.env.NEXT_PUBLIC_FACEBOOK_URL ||
    "https://www.facebook.com/profile.php?id=61555621156612",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "https://www.tiktok.com/@dekka061",
  maps: process.env.NEXT_PUBLIC_MAPS_URL || "https://maps.app.goo.gl/bTqMRWQ7UjFFVf2D7",
  // Google Maps "share" link doesn't embed directly; this is the same place
  // (resolved coordinates) in the query form the /maps embed endpoint accepts.
  mapsEmbed:
    process.env.NEXT_PUBLIC_MAPS_EMBED_URL ||
    "https://www.google.com/maps?q=31.2067034,29.9258693&z=17&output=embed",
  addressAr: process.env.NEXT_PUBLIC_ADDRESS_AR || "الإسكندرية، مصر",
  addressEn: process.env.NEXT_PUBLIC_ADDRESS_EN || "Alexandria, Egypt",
  // The legal pages (/privacy, /terms, /cookies, /refund-policy) all point
  // data and refund requests here, so this one can't be blank the way `phone`
  // still is — swap it for a dedicated inbox the day there is one.
  phone: process.env.NEXT_PUBLIC_CAFE_PHONE || "",
  email: process.env.NEXT_PUBLIC_CAFE_EMAIL || "yousef.islam.hussein@gmail.com",
  hoursAr: process.env.NEXT_PUBLIC_HOURS_AR || "يومياً من 10 ص حتى 1 ص",
  hoursEn: process.env.NEXT_PUBLIC_HOURS_EN || "Daily, 10am – 1am",
  /**
   * The same hours, structured, for "Open now" (`lib/hours.ts`; `NEXT_PUBLIC_OPENING_HOURS`).
   * The two text lines above stay the display copy: change both together.
   */
  openingHours: parseOpeningHours(process.env.NEXT_PUBLIC_OPENING_HOURS),
  /**
   * One-tap directions (`components/DirectionsLink.tsx`): turn-by-turn straight away, not
   * the place page and a second tap like `maps`. Built from `NEXT_PUBLIC_CAFE_COORDS`.
   */
  directionsGoogle: `https://www.google.com/maps/dir/?api=1&destination=${coords}`,
  directionsApple: `https://maps.apple.com/?daddr=${coords}`,
  // Legal identity, shown in the business-info block on /privacy. Dekka trades
  // under its own name with no separate registered company, so both stay blank
  // and their rows simply don't render — deliberately not filled with a
  // plausible-looking placeholder, since a made-up entity name or registry
  // number on a legal page is worse than no line at all.
  legalEntityName: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "",
  registrationNumber: process.env.NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER || "",
};
