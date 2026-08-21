import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/BrandIcons";
import { getI18n } from "@/lib/i18n";
import { site } from "@/lib/site";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { Card } from "@/components/ui/Surface";
import { PatternAccent } from "@/components/ui/PatternAccent";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { locale, t } = await getI18n();
  const address = locale === "ar" ? site.addressAr : site.addressEn;
  const hours = locale === "ar" ? site.hoursAr : site.hoursEn;

  const socials = [
    { href: site.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: site.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: site.tiktok, label: "TikTok", Icon: TikTokIcon },
  ];

  return (
    <div>
      {/* Same framed-collage header as the events hub. */}
      <section className="border-b border-border-dark bg-surface-dark">
        <PatternAccent />
        <div className="mx-auto max-w-3xl px-4 py-12 text-center md:px-8">
          <LogoBadge size="lg" tagline />
          <h1 className="mt-6 text-2xl font-bold">{t.about.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-text-muted">{t.about.story}</p>
        </div>
        <PatternAccent />
      </section>

      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-10 md:grid-cols-2 md:px-8">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted">
            {t.about.visit}
          </h2>
          <p className="flex items-start gap-2 font-semibold">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
            {address}
          </p>
          <p className="mt-3 flex items-start gap-2 text-text-muted">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
            {hours}
          </p>
          {site.phone ? (
            <p className="mt-3 flex items-start gap-2 text-text-muted">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
              <a href={`tel:${site.phone}`} dir="ltr" className="hover:underline">
                {site.phone}
              </a>
            </p>
          ) : null}
          {site.email ? (
            <p className="mt-3 flex items-start gap-2 text-text-muted">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
              <a href={`mailto:${site.email}`} dir="ltr" className="hover:underline">
                {site.email}
              </a>
            </p>
          ) : null}
          <a
            href={site.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block font-semibold text-gold-accent hover:underline"
          >
            {t.event.directions}
          </a>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted">
            {t.about.follow}
          </h2>
          <ul className="space-y-3">
            {socials.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 font-semibold hover:text-gold-accent"
                >
                  <Icon className="h-5 w-5 text-gold-accent" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        {site.mapsEmbed ? (
          <div className="md:col-span-2">
            <iframe
              src={site.mapsEmbed}
              title="Dekka on Google Maps"
              className="h-80 w-full rounded-xl border border-border-dark"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
