"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { LogoBadge } from "@/components/ui/LogoBadge";

/**
 * Request a reset link. See PLAN/password-reset.md.
 *
 * The success state is shown for *every* well-formed submission, including addresses
 * with no account — mirroring the endpoint's own refusal to distinguish them. A screen
 * that said "no account with that email" would hand back exactly the enumeration oracle
 * the API was written to deny.
 */
export function ForgotPasswordForm() {
  const { t, bi } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // A 429 is an expected outcome, not a crash — rendered inline like any other
      // form error rather than falling through to the generic boundary.
      if (res.status === 429) {
        setError(t.errors.rateLimited);
        setState("idle");
        return;
      }
      if (!res.ok) {
        setError(t.common.somethingWrong);
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError(t.common.somethingWrong);
      setState("idle");
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex justify-center lg:justify-start">
        <LogoBadge />
      </div>

      <h1 className="text-[28px] font-semibold text-on-dark lg:text-gold-accent">
        {t.authUi.forgotTitle}
      </h1>
      <p className="mt-2 text-sm text-text-muted">{t.authUi.forgotSub}</p>

      {state === "sent" ? (
        <p
          role="status"
          className="mt-6 rounded border border-border-dark bg-surface-dark p-4 text-sm text-on-dark"
        >
          {t.authUi.forgotSent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6" noValidate>
          <TextField
            name="email"
            type="email"
            labelEn={bi((d) => d.auth.email).en}
            labelAr={bi((d) => d.auth.email).ar}
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.authUi.emailPlaceholder}
            autoComplete="email"
            required
          />

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded border border-bad/40 bg-bad/10 p-3 text-sm text-on-dark"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={state === "sending"}
          >
            {state === "sending" ? t.authUi.forgotSending : t.authUi.forgotSubmit}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm lg:text-start">
        <Link href="/login" className="font-semibold text-gold-accent hover:underline">
          {t.authUi.forgotBackToLogin}
        </Link>
      </p>
    </div>
  );
}
