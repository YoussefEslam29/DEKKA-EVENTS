import Link from "next/link";
import { MapPin, Smartphone } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { site } from "@/lib/site";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/BrandIcons";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";

export async function Footer() {
  const { t, locale } = await getI18n();
  const socials = [
    { href: site.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: site.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: site.tiktok, label: "TikTok", Icon: TikTokIcon },
    { href: site.maps, label: "Google Maps", Icon: MapPin },
  ];

  return (
    <footer className="border-t border-border-dark bg-ink-black">
      {/* Installed app: the tab bar replaces this whole block, but the legal
          bar below stays — "Manage cookies" has to be reachable everywhere. */}
      <PatternAccent className="standalone:hidden" />
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 md:grid-cols-3 md:px-8 standalone:hidden">
        <div>
          <LogoBadge size="md" tagline />
          <p className="mt-4 text-sm text-text-muted">{t.brand.tagline}</p>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">
            {t.footer.follow}
          </h2>
          <ul className="space-y-2">
            {socials.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-gold-accent"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">
            {t.about.visit}
          </h2>
          <p className="text-sm text-text-muted">
            {locale === "ar" ? site.addressAr : site.addressEn}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {locale === "ar" ? site.hoursAr : site.hoursEn}
          </p>
          <Link
            href="/submit-show"
            className="mt-4 inline-block text-sm font-bold text-gold-accent hover:underline"
          >
            {t.nav.submitShow}
          </Link>
          <Link
            href="/get-app"
            className="mt-2 flex items-center gap-2 text-sm font-bold text-gold-accent hover:underline"
          >
            <Smartphone className="h-4 w-4" aria-hidden />
            {t.app.install.getApp}
          </Link>
        </div>
      </div>

      {/*
        * Legal links live in the bottom bar rather than as a fourth column, so
        * the three-column grid above keeps its layout untouched. `flex-wrap`
        * with centred content needs no RTL handling of its own.
        */}
      <div className="border-t border-border-dark px-4 py-4 md:px-8">
        <nav
          aria-label={t.footer.legalNav}
          className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
        >
          <Link href="/privacy" className="text-text-muted hover:text-gold-accent hover:underline">
            {t.legal.privacy.title}
          </Link>
          <Link href="/terms" className="text-text-muted hover:text-gold-accent hover:underline">
            {t.legal.terms.title}
          </Link>
          <Link href="/cookies" className="text-text-muted hover:text-gold-accent hover:underline">
            {t.legal.cookies.title}
          </Link>
          <Link
            href="/refund-policy"
            className="text-text-muted hover:text-gold-accent hover:underline"
          >
            {t.legal.refundPolicy.title}
          </Link>
          <CookiePreferencesButton className="text-text-muted hover:text-gold-accent hover:underline" />
        </nav>
        <p className="text-center text-xs text-text-muted">
          © {new Date().getFullYear()} {t.footer.madeWith} — {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
