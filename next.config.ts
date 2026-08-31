import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

/**
 * Sourcemap upload needs an org, a project and an auth token. With any of them missing
 * the wrapper is skipped entirely, so a build without Sentry credentials is the build
 * this repo had before Sentry existed — which is the point: the app has to keep
 * building for anyone who hasn't set the account up (PLAN/observability.md §3).
 *
 * `withSentryConfig` returns a *new* config object rather than mutating this one, so
 * `serverExternalPackages` above survives — that's what keeps @sparticuz/chromium out
 * of the traced bundle, and the event-report PDF route depends on it. Verified by
 * diffing the resolved config with and without these vars set.
 */
const sentryConfigured = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default sentryConfigured
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Keep CI logs quiet locally, verbose where someone is actually watching.
      silent: !process.env.CI,
      webpack: {
        treeshake: {
          // Drop the SDK's own console logging from production bundles.
          removeDebugLogging: true,
          // We run `tracesSampleRate: 0` everywhere, so the tracing half of the SDK is
          // dead weight — strip it rather than ship it. (These are webpack-side
          // options; this project builds with Turbopack, where they are a harmless
          // no-op, but they apply the moment a webpack build is used.)
          removeTracing: true,
        },
      },
    })
  : nextConfig;
