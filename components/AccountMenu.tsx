"use client";

import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  className?: string;
};

/**
 * Desktop account trigger, replacing the bare `<SignOutButton>` that used to
 * sit alone in the navbar (`PLAN/LOG_SIGN_AUTH_IN.md` §5a). Reuses the same
 * no-JS `<details>`/`<summary>` disclosure `Navbar.tsx` already uses for the
 * mobile hamburger menu two lines below it, rather than pulling in a
 * hydrated dropdown library for one more menu.
 *
 * Mobile gets the same two destinations, but as plain sibling rows inside
 * the navbar's existing mobile `<details>` panel — a second nested
 * disclosure there would have nowhere sensible to open from.
 */
export function AccountMenu({ name, className }: Props) {
  const { t } = useI18n();

  return (
    <details className={cn("relative", className)}>
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border-dark px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-gold-accent/60 hover:text-on-dark"
      >
        <User className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[8rem] truncate">{name || t.nav.account}</span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </summary>
      <div className="absolute end-0 z-10 mt-2 w-48 rounded-xl border border-border-dark bg-surface-dark p-2">
        <Link
          href="/account"
          className="block rounded-lg px-3 py-2 text-start text-sm font-semibold text-text-muted hover:bg-coffee hover:text-on-dark"
        >
          {t.nav.account}
        </Link>
        <div className="my-1 h-px bg-border-dark" />
        <SignOutButton className="block w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-text-muted hover:bg-coffee" />
      </div>
    </details>
  );
}
