"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";

/**
 * "Confirm your email" on `/account` (`PLAN/SITE_ROADMAP.md` S3), shown only to an
 * unverified account on a deploy that can send email. Verifying is what later lets a
 * Google sign-in attach to this account, and what applies an invited staff role.
 */
export function VerifyEmailBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <Card className="flex flex-wrap items-start gap-3 border-gold-accent/40 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
        <MailCheck className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t.account.verify.title}</p>
        <p className="text-sm text-text-muted">{t.account.verify.body}</p>
        {state === "sent" ? (
          <p role="status" className="mt-2 text-sm font-semibold text-good">
            {t.account.verify.sent}
          </p>
        ) : state === "failed" ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-bad">
            {t.account.verify.failed}
          </p>
        ) : (
          <Button variant="outline" className="mt-3 min-h-11" onClick={send} disabled={state === "sending"}>
            {state === "sending" ? t.account.verify.sending : t.account.verify.send}
          </Button>
        )}
      </div>
    </Card>
  );
}
