import Link from "next/link";
import { Menu } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { NavLinks, NavMenuLinks } from "@/components/layout/NavLinks";
import { LocaleToggle } from "@/components/LocaleToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { AccountMenu } from "@/components/AccountMenu";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Dark brand chrome, kept dark even above the cream back-office workspace so the
 * bar reads as one consistent piece of the app rather than re-skinning per route.
 *
 * Laid out as a three-track grid — logo (start) | centered link pill | controls
 * (end). The pill is rendered by `NavLinks`, the one client-side piece: this
 * component has to stay a server component because `getI18n()` and
 * `currentUser()` are server-only, and the array they produce is all the client
 * needs.
 *
 * The desktop/mobile switch follows the link count rather than being fixed:
 * how much room the pill needs is a function of how many destinations the
 * viewer can see, and that is a role question answered right here. A guest (3
 * links) and a member (4) fit alongside the logo and controls at `md`; staff (5)
 * and an admin (6) don't, and switch at `lg` instead. Pinning everyone to `lg`
 * to cover the admin case would handed the majority of visitors a hamburger
 * menu at tablet widths they had no need for.
 */
export async function Navbar() {
  const { t } = await getI18n();
  const user = await currentUser();

  const links = [
    { href: "/", label: t.nav.events },
    ...(user ? [{ href: "/my-events", label: t.nav.myEvents }] : []),
    { href: "/submit-show", label: t.nav.submitShow },
    { href: "/about", label: t.nav.about },
    ...(hasRole(user, "staff") ? [{ href: "/staff", label: t.nav.door }] : []),
    ...(hasRole(user, "admin") ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  // Staff and admin rows are the wide ones; everyone else fits a breakpoint earlier.
  const wide = links.length > 4;

  return (
    <header className="sticky top-0 z-40 border-b border-border-dark bg-ink-black/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-[1180px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-8">
        <Link href="/" aria-label="Dekka" className="justify-self-start">
          <LogoBadge size="sm" />
        </Link>

        <NavLinks links={links} wide={wide} />

        <div className="flex items-center gap-2 justify-self-end">
          <LocaleToggle />
          {user ? (
            <AccountMenu
              name={user.name ?? ""}
              className={cn("hidden", wide ? "lg:block" : "md:block")}
            />
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonStyles({ variant: "gold", size: "sm" }),
                "hidden",
                wide ? "lg:inline-flex" : "md:inline-flex"
              )}
            >
              {t.nav.login}
            </Link>
          )}

          {/* No-JS mobile menu: a native disclosure beats a hydrated drawer here. */}
          <details className={cn("relative", wide ? "lg:hidden" : "md:hidden")}>
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border-dark text-on-dark"
              aria-label={t.nav.menu}
            >
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute end-0 mt-2 w-56 rounded-xl border border-border-dark bg-surface-dark p-2">
              <NavMenuLinks links={links} />
              <div className="my-1 h-px bg-border-dark" />
              {user ? (
                <>
                  <Link
                    href="/account"
                    className="block rounded-lg px-3 py-2 text-start text-sm font-semibold text-text-muted hover:bg-coffee"
                  >
                    {t.nav.account}
                  </Link>
                  <SignOutButton className="block w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-text-muted hover:bg-coffee" />
                </>
              ) : (
                <Link
                  href="/login"
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-gold-accent hover:bg-coffee"
                >
                  {t.nav.login}
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
