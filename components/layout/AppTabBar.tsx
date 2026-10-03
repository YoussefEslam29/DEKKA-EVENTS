"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CircleUser, Coffee, House, Ticket } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { isActive } from "@/components/layout/NavLinks";
import { useMotionPresets } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Same reason as in `NavLinks`: press feedback belongs on the anchor itself. */
const MotionLink = motion.create<ComponentProps<typeof Link>, "a">(Link);

/**
 * The installed app's bottom tab bar (PLAN/DEKKA_PWA_APP.md §2) — the four
 * places a regular goes, within thumb reach.
 *
 * Always in the markup, shown only by the `standalone:` variant, so a browser
 * visitor never sees it and there is no client-side detection to flash on. Four
 * tabs, not five: Submit-a-Show, About, the door and the admin dashboard stay in
 * the header's menu, which the installed app keeps.
 *
 * A grid, not a hand-ordered row, so Arabic reverses the order by itself: Home
 * is the first tab under the reader's thumb in both directions.
 */
export function AppTabBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { pressable, tabIndicator } = useMotionPresets();

  const tabs = [
    { href: "/", label: t.app.tabs.home, Icon: House },
    { href: "/menu", label: t.app.tabs.menu, Icon: Coffee },
    { href: "/my-events", label: t.app.tabs.myEvents, Icon: Ticket },
    { href: "/account", label: t.app.tabs.account, Icon: CircleUser },
  ];

  return (
    <nav
      aria-label={t.app.tabsLabel}
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border-dark bg-ink-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur standalone:block"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-4">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <MotionLink
                href={href}
                aria-current={active ? "page" : undefined}
                {...pressable}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition-colors",
                  active ? "text-gold-accent" : "text-text-muted hover:text-on-dark"
                )}
              >
                {active ? (
                  <motion.span
                    {...tabIndicator("appTab")}
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gold-accent"
                  />
                ) : null}
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span>{label}</span>
              </MotionLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
