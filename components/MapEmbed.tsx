"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCookieConsent } from "@/components/CookieConsentProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * The Google Maps embed, behind consent.
 *
 * The iframe is the only third-party request this site makes on a normal page
 * view: loading it hands the visitor's IP to Google and lets Google set its own
 * cookies, all before anyone has clicked anything. So it renders only once the
 * visitor has accepted cookies, or clicked through here.
 *
 * Clicking "Load map" deliberately does *not* write the consent cookie — it
 * reveals the map for this pageview only. Someone who chose "Necessary only"
 * and then wants to see the map once shouldn't have that silently converted
 * into a standing yes.
 *
 * The plain external link is always shown, so the address is reachable without
 * loading anything from Google at all.
 */
export function MapEmbed({
  src,
  title,
  className,
  directionsHref,
}: {
  src: string;
  title: string;
  className?: string;
  directionsHref: string;
}) {
  const { t } = useI18n();
  const { mapsAllowed } = useCookieConsent();
  const [clickedThrough, setClickedThrough] = useState(false);

  if (mapsAllowed || clickedThrough) {
    return (
      <iframe
        src={src}
        title={title}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 bg-surface-dark p-6 text-center",
        className
      )}
    >
      <MapPin className="h-6 w-6 text-gold-accent" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-on-dark">{t.legal.mapPlaceholder.title}</p>
        <p className="mt-1 text-sm text-text-muted">{t.legal.mapPlaceholder.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" size="sm" onClick={() => setClickedThrough(true)}>
          {t.legal.mapPlaceholder.loadButton}
        </Button>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-accent hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {t.event.directions}
        </a>
      </div>
    </div>
  );
}
