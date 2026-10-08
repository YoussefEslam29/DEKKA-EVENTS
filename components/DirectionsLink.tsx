"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/I18nProvider";
import { isIOS } from "@/lib/pwa";
import { site } from "@/lib/site";

const noSubscription = () => () => {};

/**
 * One-tap directions to the cafe (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b.2): straight into
 * turn-by-turn, where `site.maps` opens the place page first. Google Maps everywhere,
 * rendered on the server; Apple Maps on an iPhone, swapped in after hydration. Only the
 * `href` changes, so nothing shifts.
 */
export function DirectionsLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const apple = useSyncExternalStore(noSubscription, isIOS, () => false);
  return (
    <a
      href={apple ? site.directionsApple : site.directionsGoogle}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <span className="sr-only"> — {t.visit.directionsLabel}</span>
    </a>
  );
}
