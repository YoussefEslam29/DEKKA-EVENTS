/**
 * Cafe-level details that belong to Dekka rather than to any one event.
 * Everything is env-overridable so the owner can change it without a deploy.
 */
export const site = {
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/",
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://facebook.com/",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "https://tiktok.com/",
  maps:
    process.env.NEXT_PUBLIC_MAPS_URL ||
    "https://www.google.com/maps/search/?api=1&query=Dekka+cafe",
  mapsEmbed: process.env.NEXT_PUBLIC_MAPS_EMBED_URL || "",
  addressAr: process.env.NEXT_PUBLIC_ADDRESS_AR || "القاهرة، مصر",
  addressEn: process.env.NEXT_PUBLIC_ADDRESS_EN || "Cairo, Egypt",
  phone: process.env.NEXT_PUBLIC_CAFE_PHONE || "",
  email: process.env.NEXT_PUBLIC_CAFE_EMAIL || "",
  hoursAr: process.env.NEXT_PUBLIC_HOURS_AR || "يومياً من 10 ص حتى 1 ص",
  hoursEn: process.env.NEXT_PUBLIC_HOURS_EN || "Daily, 10am – 1am",
};
