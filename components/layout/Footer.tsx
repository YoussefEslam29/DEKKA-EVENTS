import Link from "next/link";
import { MapPin } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { site } from "@/lib/site";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/BrandIcons";

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
      <PatternAccent />
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 md:grid-cols-3 md:px-8">
        <div>
          <LogoBadge size="md" tagline />
          <p className="mt-4 text-sm text-text-muted">{t.brand.tagline}</p>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">
            {t.footer.follow}
          </h3>
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
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">
            {t.about.visit}
          </h3>
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
        </div>
      </div>

      <div className="border-t border-border-dark px-4 py-4 text-center text-xs text-text-muted md:px-8">
        © {new Date().getFullYear()} {t.footer.madeWith} — {t.footer.rights}
      </div>
    </footer>
  );
}
