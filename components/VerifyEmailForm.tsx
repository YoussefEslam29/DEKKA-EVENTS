"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { buttonStyles } from "@/components/ui/Button";
import { LogoBadge } from "@/components/ui/LogoBadge";

/**
 * Spends an email-verification token (`PLAN/SITE_ROADMAP.md` S3). Runs once, on mount, in
 * the browser: a link scanner fetching the page doesn't execute this, so only the person
 * actually opening it verifies the address.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"checking" | "done" | "invalid" | "error">("checking");
  const started = useRef(false);

  useEffect(() => {
    // Strict Mode mounts effects twice in development; the token is single-use.
    if (started.current) return;
    started.current = true;
    fetch("/api/auth/verify-email/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) setState("done");
        else if (res.status === 400) setState("invalid");
        else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  const message =
    state === "checking"
      ? t.authUi.verifyChecking
      : state === "done"
        ? t.authUi.verifyDone
        : state === "invalid"
          ? t.authUi.verifyInvalid
          : t.common.somethingWrong;

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex justify-center lg:justify-start">
        <LogoBadge />
      </div>
      <h1 className="text-[28px] font-semibold text-on-dark lg:text-gold-accent">
        {t.authUi.verifyTitle}
      </h1>
      <p
        role="status"
        className={`mt-6 rounded border p-4 text-sm text-on-dark ${
          state === "invalid" || state === "error"
            ? "border-bad/40 bg-bad/10"
            : "border-border-dark bg-surface-dark"
        }`}
      >
        {message}
      </p>
      {state !== "checking" ? (
        <Link href="/account" className={buttonStyles({ variant: "gold", className: "mt-4 w-full" })}>
          {t.authUi.verifyToAccount}
        </Link>
      ) : null}
    </div>
  );
}
