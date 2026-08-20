"use client";

import { signOut } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";

export function SignOutButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className}
    >
      {t.nav.logout}
    </button>
  );
}
