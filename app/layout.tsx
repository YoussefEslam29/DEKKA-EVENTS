import type { Metadata, Viewport } from "next";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import { getI18n, dictFor } from "@/lib/i18n";
import { getCookieConsent } from "@/lib/cookie-consent";
import { EARLY_APP_SCRIPT } from "@/lib/pwa";
import { Providers } from "@/components/Providers";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

// Cairo carries the Arabic side (closest to the angular wordmark); Plus Jakarta
// Sans is the rounded geometric Latin face called for in authorization-UI.md §3.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "دكة — Dekka",
  description: "قهوة وموسيقى حيّة — احجز مكانك في حفلات دكة القادمة.",
  icons: {
    icon: "/brand/dekka-logo-square.png",
    // Opaque cream plate: iOS paints a transparent touch icon black.
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS ignores most of the manifest; these are what make "Add to Home Screen"
  // launch full-screen with Dekka's name under the icon. `black` rather than
  // `black-translucent`: the bar then sits above the page instead of over it,
  // so no screen — the auth split screen included — has to pad for it.
  appleWebApp: { capable: true, title: "Dekka", statusBarStyle: "black" },
};

/**
 * `viewportFit: "cover"` lets the installed app use the full screen down to the
 * home indicator; the bottom tab bar pads itself by `safe-area-inset-bottom`,
 * and `globals.css` pads the body sideways for the landscape notch. Theme colour
 * is `ink-black`, matching the manifest, so Android's status bar blends in.
 */
export const viewport: Viewport = {
  themeColor: "#18120d",
  viewportFit: "cover",
};

/**
 * Root shell only. Site chrome lives in the `(site)` group so the `(auth)`
 * group can render its split screen full-bleed, as the reference mockups do.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ locale, dir, t }, cookieConsent] = await Promise.all([
    getI18n(),
    getCookieConsent(),
  ]);

  return (
    // `suppressHydrationWarning` covers this element only: `EARLY_APP_SCRIPT`
    // adds `data-app` to <html> before React hydrates, on purpose.
    <html
      lang={locale}
      dir={dir}
      className={`${cairo.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Must run before first paint — see EARLY_APP_SCRIPT in lib/pwa.ts. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_APP_SCRIPT }} />
      </head>
      {/* Extensions (Grammarly and friends) stamp `data-gr-*` attributes onto
          <body> before React hydrates. Suppressing here covers this one element
          only — a real mismatch anywhere inside still reports. */}
      <body className="min-h-screen bg-ink-black text-on-dark" suppressHydrationWarning>
        <Providers
          locale={locale}
          dir={dir}
          t={t}
          dicts={{ en: dictFor("en"), ar: dictFor("ar") }}
          cookieConsent={cookieConsent}
        >
          {children}
        </Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
