"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches a throw in the **root layout itself** — the one failure `app/error.tsx`
 * cannot catch, because that boundary renders *inside* the layout that just died.
 * Next.js therefore replaces the whole document, so this file owns `<html>`/`<body>`.
 *
 * Three things follow from that, and each is deliberate rather than sloppy:
 *
 *  - **Inline styles, no Tailwind classes.** If the root layout failed, assuming
 *    `globals.css` loaded is exactly the assumption that already broke. Brand colours
 *    are the literal tokens from `app/globals.css`'s `@theme` block.
 *  - **A system font stack.** `next/font` is configured in the root layout; Cairo is
 *    not available here.
 *  - **Both languages at once**, rather than reading the locale. The locale lives in a
 *    cookie the root layout turns into `<html lang dir>` — the very thing that didn't
 *    run. Showing Arabic and English together is the app's existing `BilingualLabel`
 *    convention anyway, so this reads as consistent rather than as a fallback.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#18120d",
          color: "#f5f0ea",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: "26rem" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            حصل خطأ ما.
          </p>
          <p
            lang="en"
            dir="ltr"
            style={{
              fontSize: "1rem",
              margin: "0.5rem 0 0",
              color: "#9c9086",
            }}
          >
            Something went wrong.
          </p>

          {/* A full reload, not `reset()` — the root layout is what failed, so
              re-rendering the same tree would land in the same place. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.5rem",
              minHeight: "44px",
              border: "1px solid #4a3b2c",
              borderRadius: "4px",
              background: "transparent",
              color: "#d9a566",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            حاول مرة أخرى <span lang="en" dir="ltr">/ Try again</span>
          </button>
        </main>
      </body>
    </html>
  );
}
