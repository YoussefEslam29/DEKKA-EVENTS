import Link from "next/link";
import { Menu } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import { Wordmark } from "@/components/Wordmark";
import { LocaleToggle } from "@/components/LocaleToggle";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Server-rendered so the correct role-specific links are in the first paint —
 * staff shouldn't see the Door link flash in after hydration.
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
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-4 md:px-8">
        <Link href="/" className="shrink-0" aria-label="Dekka">
          <Wordmark size="sm" />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[4px] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-gold-wash hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <LocaleToggle />
          {user ? (
            <SignOutButton className="hidden rounded-[4px] border border-ink/20 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-gold-wash md:block" />
          ) : (
            <Link
              href="/login"
              className="hidden rounded-[4px] bg-ink px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink-soft md:block"
            >
              {t.nav.login}
            </Link>
          )}

          {/* No-JS mobile menu: a native disclosure beats a hydrated drawer here. */}
          <details className="relative md:hidden">
            <summary
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-[4px] border border-ink/20"
              aria-label={t.nav.menu}
            >
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute end-0 mt-2 w-52 rounded-[4px] border border-line bg-paper p-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-[4px] px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-gold-wash"
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-line" />
              {user ? (
                <SignOutButton className="block w-full rounded-[4px] px-3 py-2 text-start text-sm font-semibold text-ink-soft hover:bg-gold-wash" />
              ) : (
                <Link
                  href="/login"
                  className="block rounded-[4px] px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-gold-wash"
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
