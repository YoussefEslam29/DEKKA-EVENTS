import type { Metadata } from "next";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import { getI18n, dictFor } from "@/lib/i18n";
import { Providers } from "@/components/Providers";
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
  icons: { icon: "/brand/dekka-logo-square.png" },
};

/**
 * Root shell only. Site chrome lives in the `(site)` group so the `(auth)`
 * group can render its split screen full-bleed, as the reference mockups do.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir, t } = await getI18n();

  return (
    <html lang={locale} dir={dir} className={`${cairo.variable} ${jakarta.variable}`}>
      {/* Extensions (Grammarly and friends) stamp `data-gr-*` attributes onto
          <body> before React hydrates. Suppressing here covers this one element
          only — a real mismatch anywhere inside still reports. */}
      <body className="min-h-screen bg-ink-black text-on-dark" suppressHydrationWarning>
        <Providers
          locale={locale}
          dir={dir}
          t={t}
          dicts={{ en: dictFor("en"), ar: dictFor("ar") }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
