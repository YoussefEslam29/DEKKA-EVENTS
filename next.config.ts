import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The event-report route (`/api/events/:id/report`) drives headless Chromium
  // for PDF generation. These ship a native binary / do their own `fs` work and
  // must not be traced into the bundle. (Next already auto-externalises both,
  // but pinning it here keeps that guarantee explicit — see Admin_Event_PDF.md.)
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  images: {
    // Cover images are URLs typed in by the admin, so the host isn't known
    // ahead of time. Narrow this list if you settle on one image host.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
