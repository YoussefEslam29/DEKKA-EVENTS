"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useMotionPresets } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The nav's link lists, split out of `Navbar.tsx` so the bar itself can stay an
 * async server component.
 *
 * `Navbar` still owns the decisions that need the server — `getI18n()` for the
 * labels and `currentUser()`/`hasRole()` for which destinations a viewer is even
 * allowed to see — and hands the finished array down. Everything that needs the
 * browser lives here: `usePathname()` (which link is active) and the
 * `layoutId` indicator that glides between them.
 */

export type NavLinkItem = { href: string; label: string };

/**
 * `Link` with the motion props attached.
 *
 * The press feedback has to sit on the anchor itself rather than on a wrapper:
 * `whileTap` makes framer-motion mark its element focusable, and on a wrapper
 * `<div>` that means a second, empty tab stop in front of every link. On the
 * anchor it is a no-op, since a link is already in the tab order.
 *
 * Typed as `"a"` because that is what `Link` renders — the tag argument is what
 * gives the result `href`/anchor typing instead of `motion.div`'s.
 */
const MotionLink = motion.create<ComponentProps<typeof Link>, "a">(Link);

/**
 * Which nav entry the current URL belongs to. Every destination is a section
 * root, so a prefix match keeps the section lit while you're drilled into it
 * (`/admin/events/abc` still highlights "Admin").
 *
 * "/" is the events hub and would prefix-match every route, so it matches
 * exactly — plus `/events/[id]`, the detail page that has no nav entry of its
 * own and belongs to the hub.
 */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/events");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop: the centered link pill.
 *
 * Positioned out of the header's flex flow (`absolute start-1/2`) so it sits on
 * the row's true midpoint rather than wherever the logo and the right-hand
 * controls happen to leave it — the logo is one width for everyone, but the
 * controls are not (a signed-in admin's row differs from a guest's), and a
 * flex-centered group would drift with them.
 *
 * The half-width shift back is written as an `ltr:`/`rtl:` pair rather than a
 * bare `-translate-x-1/2`: `start-1/2` resolves to `right: 50%` under Arabic,
 * where the correction has to run the other way. Two mutually exclusive
 * variants also means neither has to out-specify the other.
 */
export function NavLinks({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();
  const { pressable, tabIndicator } = useMotionPresets();

  return (
    <nav className="absolute start-1/2 hidden items-center gap-1 rounded-full border border-border-dark bg-surface-dark/80 p-1 ltr:-translate-x-1/2 rtl:translate-x-1/2 lg:flex">
      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <MotionLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            {...pressable}
            className={cn(
              "relative rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
              active ? "text-on-dark" : "text-text-muted hover:text-on-dark"
            )}
          >
            {active ? (
              <motion.span
                {...tabIndicator("navIndicator")}
                aria-hidden
                className="absolute inset-0 rounded-full bg-coffee ring-1 ring-gold-accent/25"
              />
            ) : null}
            {/* Above the indicator by paint order — both are positioned, the
                label comes second, so no z-index juggling is needed. */}
            <span className="relative">{link.label}</span>
          </MotionLink>
        );
      })}
    </nav>
  );
}

/**
 * Mobile: the rows inside the header's native `<details>` disclosure.
 *
 * No sliding indicator here — that's a persistent-horizontal-nav affordance,
 * and this is a dropdown list where the pill would have nowhere to glide from.
 * The rows get the same press feedback and a static highlight instead.
 */
export function NavMenuLinks({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname();
  const { pressable } = useMotionPresets();

  return (
    <>
      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <MotionLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            {...pressable}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-coffee hover:text-on-dark",
              active ? "bg-coffee text-on-dark" : "text-text-muted"
            )}
          >
            {link.label}
          </MotionLink>
        );
      })}
    </>
  );
}
