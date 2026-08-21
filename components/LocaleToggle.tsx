"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";

/** Flips between Arabic and English. The label always shows the *other* language. */
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setLocale(locale === "ar" ? "en" : "ar"))}
      className={cn(
        "rounded-lg border border-border-dark px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-gold-accent/60 hover:text-on-dark disabled:opacity-50",
        className
      )}
      aria-label={t.common.language}
    >
      {t.common.language}
    </button>
  );
}
