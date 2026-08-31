"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/TextField";
import { LogoBadge } from "@/components/ui/LogoBadge";

/**
 * Spend a reset token and set a new password. See PLAN/password-reset.md.
 *
 * The token arrives as a prop from the server component rather than being read from
 * `location` here, so an absent token is handled before this renders at all.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const { t, bi } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // A UX guard only — the route re-compares these server-side, because a client
    // check is never the security boundary (same rule as the sign-up form's).
    if (password !== confirm) {
      setError(t.authUi.resetMismatch);
      return;
    }

    setState("saving");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: password,
          confirmPassword: confirm,
        }),
      });

      if (res.status === 429) {
        setError(t.errors.rateLimited);
        setState("idle");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error === "INVALID_OR_EXPIRED_TOKEN"
            ? t.authUi.resetInvalid
            : body?.error === "PASSWORDS_DO_NOT_MATCH"
              ? t.authUi.resetMismatch
              : t.common.somethingWrong
        );
        setState("idle");
        return;
      }

      setState("done");
      // Refresh so the login page below is reached with no stale router cache.
      router.refresh();
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
        {t.authUi.resetTitle}
      </h1>
      <p className="mt-2 text-sm text-text-muted">{t.authUi.resetSub}</p>

      {state === "done" ? (
        <>
          <p
            role="status"
            className="mt-6 rounded border border-border-dark bg-surface-dark p-4 text-sm text-on-dark"
          >
            {t.authUi.resetDone}
          </p>
          {/* An anchor, not a Button: Button renders a <button> and has no
              asChild. buttonStyles is exported for exactly this case. */}
          <Link
            href="/login"
            className={buttonStyles({ variant: "gold", className: "mt-4 w-full" })}
          >
            {t.authUi.forgotBackToLogin}
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="mt-6" noValidate>
          <PasswordField
            name="newPassword"
            labelEn={bi((d) => d.auth.password).en}
            labelAr={bi((d) => d.auth.password).ar}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.authUi.passwordPlaceholder}
            autoComplete="new-password"
            required
          />
          <PasswordField
            name="confirmPassword"
            labelEn={bi((d) => d.auth.confirmPassword).en}
            labelAr={bi((d) => d.auth.confirmPassword).ar}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t.authUi.passwordPlaceholder}
            autoComplete="new-password"
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
            disabled={state === "saving"}
          >
            {state === "saving" ? t.authUi.resetSaving : t.authUi.resetSubmit}
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
