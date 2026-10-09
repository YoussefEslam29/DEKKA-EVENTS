"use client";

import { FlaskConical } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { DEMO_COOKIE } from "@/lib/demo-guard";

/** Ends demo mode on this device: the cookie is cleared right here, no request needed. */
export function leaveDemo() {
  document.cookie = `${DEMO_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  window.location.reload();
}

/**
 * On every page while this device is in demo mode (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.3),
 * so nobody mistakes the sample nights for real ones. Rendered only when the server saw
 * the cookie.
 */
export function DemoRibbon() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gold-accent px-4 py-1.5 text-center text-sm font-bold text-ink-black print:hidden"
    >
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="h-4 w-4" aria-hidden />
        {t.demo.ribbon}
      </span>
      <button type="button" onClick={leaveDemo} className="min-h-11 underline underline-offset-2">
        {t.demo.leave}
      </button>
    </div>
  );
}
