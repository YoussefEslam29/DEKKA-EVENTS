// Per-page metadata and structured data (`PLAN/SITE_ROADMAP.md` D1). Server-only use.
import type { Metadata } from "next";
import { site } from "@/lib/site";
import { EVENT_DEFAULT_DURATION_MIN } from "@/lib/constants";

/** Paths no search engine should list: personal, back-office, or one-time links. */
export const PRIVATE_PATHS = [
  "/admin",
  "/staff",
  "/account",
  "/my-events",
  "/api/",
  "/offline",
  "/reset-password",
  "/forgot-password",
  "/verify-email",
] as const;

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type OpenGraphImage = { url: string; width: number; height: number; alt: string };

/**
 * The share card's site-wide fields: what WhatsApp or Instagram shows for any link without
 * its own (an event page brings its own image). Next.js doesn't merge `openGraph` between
 * the layout and a page (a page's object replaces the layout's whole), so `pageMetadata`
 * spreads these in again.
 */
export const SITE_OPEN_GRAPH = {
  type: "website",
  siteName: "دكة · Dekka",
  locale: "ar_EG",
  alternateLocale: ["en_GB"],
  title: "دكة — Dekka",
  description: "قهوة وموسيقى حيّة في الإسكندرية — احجز مكانك. Coffee and live music in Alexandria.",
  images: [{ url: "/brand/dekka-banner.jpg", width: 1280, height: 471, alt: "دكة · Dekka" }],
} satisfies OpenGraph;

/**
 * One page's title, description and canonical URL, plus its share card's matching text.
 * Titles go through the root layout's template ("… · دكة Dekka").
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  image,
}: {
  title: string;
  description?: string;
  path: string;
  noindex?: boolean;
  /** This page's own card; the site banner when absent. */
  image?: OpenGraphImage;
}): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      title,
      ...(description ? { description } : {}),
      url: path,
      ...(image ? { images: [image] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** The cafe as schema.org sees it: a coffee shop in Alexandria with its socials. */
export function cafeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: "Dekka · دكة",
    url: site.url,
    image: `${site.url}/brand/dekka-banner.jpg`,
    logo: `${site.url}/brand/dekka-logo-square.png`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Alexandria",
      addressCountry: "EG",
    },
    geo: { "@type": "GeoCoordinates", latitude: 31.2067034, longitude: 29.9258693 },
    sameAs: [site.instagram, site.facebook, site.tiktok].filter(Boolean),
  };
}

type EventForJsonLd = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  locationEn: string;
  coverImage: string;
  startsAt: string;
  price: number;
  capacity: number | null;
  status: string;
};

/** One night as a schema.org Event, so a search can show its date, place and price. */
export function eventJsonLd(event: EventForJsonLd, spotsLeft: number | null) {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + EVENT_DEFAULT_DURATION_MIN * 60_000);
  const url = `${site.url}/events/${event.id}`;
  const image = event.coverImage
    ? event.coverImage.startsWith("http")
      ? event.coverImage
      : `${site.url}${event.coverImage}`
    : `${site.url}/brand/dekka-banner.jpg`;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.titleEn || event.titleAr,
    alternateName: event.titleAr && event.titleAr !== event.titleEn ? event.titleAr : undefined,
    description: (event.descriptionEn || event.descriptionAr).slice(0, 500) || undefined,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [image],
    url,
    location: {
      "@type": "Place",
      name: event.locationEn || "Dekka",
      address: { "@type": "PostalAddress", addressLocality: "Alexandria", addressCountry: "EG" },
    },
    organizer: { "@type": "Organization", name: "Dekka", url: site.url },
    offers: {
      "@type": "Offer",
      url,
      price: event.price,
      priceCurrency: "EGP",
      availability:
        event.status !== "published" || spotsLeft === 0
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
    },
  };
}

/**
 * The JSON for a `<script type="application/ld+json">`, with `<` escaped so text from an
 * event (an admin-typed title) can never close the script tag. This is Next's own JSON-LD
 * guide's recommendation.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
