import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The event-report route (`/api/events/:id/report`) drives headless Chromium
  // for PDF generation. These ship a native binary / do their own `fs` work and
  // must not be traced into the bundle. (Next already auto-externalises both,
  // but pinning it here keeps that guarantee explicit — see Admin_Event_PDF.md.)
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  images: {
    remotePatterns: [
      // Uploaded images (posters + account photos) — `lib/storage.ts` writes
      // these to Vercel Blob whenever BLOB_READ_WRITE_TOKEN is set, and
      // UPLOAD_IMAGE_PATTERN in lib/validation.ts pins them to this host.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Event cover images can *also* be an external URL the admin pastes into
      // the field by hand (EventForm.tsx), so the host isn't knowable ahead of
      // time. That is what keeps this wildcard here, and the wildcard is what
      // makes /_next/image an open image proxy on this domain. Deleting this
      // one line closes that; do it once admins are content to always upload
      // the poster rather than paste a link.
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
