/**
 * Cafe-level details that belong to Dekka rather than to any one event.
 * Defaults are the real accounts/location; env vars only need to be set if
 * these ever change without a code deploy.
 */
export const site = {
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
  phone: process.env.NEXT_PUBLIC_CAFE_PHONE || "",
  email: process.env.NEXT_PUBLIC_CAFE_EMAIL || "",
  hoursAr: process.env.NEXT_PUBLIC_HOURS_AR || "يومياً من 10 ص حتى 1 ص",
  hoursEn: process.env.NEXT_PUBLIC_HOURS_EN || "Daily, 10am – 1am",
};
