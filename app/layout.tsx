import type { Metadata } from "next";
import { Cairo, Outfit } from "next/font/google";
import { getI18n } from "@/lib/i18n";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

// Cairo carries the Arabic side (it sits closest to the angular wordmark);
// Outfit handles the Latin lockup and numerals.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "دكة — Dekka",
  description: "قهوة وموسيقى حيّة — احجز مكانك في حفلات دكة القادمة.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir, t } = await getI18n();

  return (
    <html lang={locale} dir={dir} className={`${cairo.variable} ${outfit.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers locale={locale} dir={dir} t={t}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
