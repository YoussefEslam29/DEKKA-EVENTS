import Link from "next/link";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionaries";
import { site } from "@/lib/site";
import { InstagramIcon } from "@/components/BrandIcons";
import { buttonStyles } from "@/components/ui/Button";

/**
 * "Come by" on the homepage (`PLAN/HOME_PAGE.md` §5: the About/location teaser and the
 * Instagram card; `PLAN/SITE_ROADMAP.md` §2.5). Practical info first, then the social
 * link-out. A link, not an embedded feed, which would need Instagram API tokens. The
 * gallery from the same section waits for real photos. `children` is where the cafe-life
 * phase puts "Open now" and one-tap directions.
 */
export function VisitSection({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: Dict;
  children?: React.ReactNode;
}) {
  const address = locale === "ar" ? site.addressAr : site.addressEn;
  const hours = locale === "ar" ? site.hoursAr : site.hoursEn;
  const handle = site.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "");

  return (
    <section aria-labelledby="visit-title" className="mx-auto max-w-[1180px] px-4 pb-10 md:px-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="dk-card p-5">
          <h2 id="visit-title" className="text-xl font-bold tracking-tight">
            {t.home.visit.title}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t.home.visit.body}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-accent" aria-hidden />
              {address}
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-accent" aria-hidden />
              {hours}
            </li>
          </ul>
          {children}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={site.maps}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "outline", className: "min-h-11" })}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {t.home.visit.directions}
            </a>
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-bold text-gold-accent hover:underline"
            >
              {t.home.visit.about}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>

        <a
          href={site.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="dk-card group flex items-center gap-4 p-5 transition-colors hover:border-gold-accent/50"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-accent/10 text-gold-accent">
            <InstagramIcon className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold group-hover:text-gold-accent">{t.home.visit.follow}</span>
            <span className="block text-sm text-text-muted" dir="ltr">
              {handle}
            </span>
            <span className="mt-1 block text-sm text-text-muted">{t.home.visit.followBody}</span>
          </span>
        </a>
      </div>
    </section>
  );
}
