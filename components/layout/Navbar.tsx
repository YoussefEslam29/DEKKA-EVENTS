import Link from "next/link";
import { Menu } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { NavLinks, NavMenuLinks } from "@/components/layout/NavLinks";
import { LocaleToggle } from "@/components/LocaleToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { buttonStyles } from "@/components/ui/Button";

/**
 * Dark brand chrome, kept dark even above the cream back-office workspace so the
 * bar reads as one consistent piece of the app rather than re-skinning per route.
 *
 * Laid out as logo (start) — centered link pill — controls (end). The pill is
 * rendered by `NavLinks`, the one client-side piece: this component has to stay
 * a server component because `getI18n()` and `currentUser()` are server-only,
 * and the array they produce is all the client needs.
 *
 * The desktop/mobile switch is `lg`, not `md`: an admin sees six links, and a
 * centred group that wide collides with the logo and the sign-out control at
 * tablet widths. Below `lg` the existing `<details>` disclosure takes over.
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

  return (
    <header className="sticky top-0 z-40 border-b border-border-dark bg-ink-black/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-4 md:px-8">
        <Link href="/" aria-label="Dekka" className="shrink-0">
          <LogoBadge size="sm" />
        </Link>

        <NavLinks links={links} />

        <div className="ms-auto flex items-center gap-2">
          <LocaleToggle />
          {user ? (
            <SignOutButton className="hidden rounded-lg border border-border-dark px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-gold-accent/60 hover:text-on-dark lg:block" />
          ) : (
            <Link href="/login" className={`${buttonStyles({ variant: "gold", size: "sm" })} hidden lg:inline-flex`}>
              {t.nav.login}
            </Link>
          )}

          {/* No-JS mobile menu: a native disclosure beats a hydrated drawer here. */}
          <details className="relative lg:hidden">
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
                <SignOutButton className="block w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-text-muted hover:bg-coffee" />
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
