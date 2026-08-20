import Link from "next/link";
import { MapPin } from "lucide-react";
import { InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/BrandIcons";
import { getI18n } from "@/lib/i18n";
import { site } from "@/lib/site";
import { Wordmark } from "@/components/Wordmark";
import { TatreezDivider } from "@/components/ui/Surface";

export async function Footer() {
  const { t, locale } = await getI18n();
  const socials = [
    { href: site.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: site.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: site.tiktok, label: "TikTok", Icon: TikTokIcon },
    { href: site.maps, label: "Google Maps", Icon: MapPin },
  ];

  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <TatreezDivider />
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
        <div>
          <Wordmark size="md" />
          <p className="mt-3 text-sm text-ink-soft">{t.brand.tagline}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
            {t.footer.follow}
          </h3>
          <ul className="space-y-2">
            {socials.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-gold-deep"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
            {t.about.visit}
          </h3>
          <p className="text-sm text-ink-soft">
            {locale === "ar" ? site.addressAr : site.addressEn}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {locale === "ar" ? site.hoursAr : site.hoursEn}
          </p>
          <Link
            href="/submit-show"
            className="mt-4 inline-block text-sm font-semibold text-gold-deep hover:underline"
          >
            {t.nav.submitShow}
          </Link>
        </div>
      </div>

      <div className="border-t border-line px-4 py-4 text-center text-xs text-ink-faint md:px-8">
        © {new Date().getFullYear()} {t.footer.madeWith} — {t.footer.rights}
      </div>
    </footer>
  );
}
