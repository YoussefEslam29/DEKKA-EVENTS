"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input, FormRow } from "@/components/ui/Field";
import { TatreezDivider } from "@/components/ui/Surface";

type Props = {
  mode: "login" | "signup";
  next: string;
  providers: { google: boolean; facebook: boolean };
};

/**
 * One component for both halves of the auth screen. Guests are never blocked:
 * "continue as guest" is always on screen, per the auth stories in idea.md.
 */
export function AuthForm({ mode, next, providers }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "signup") {
        if (form.password.length < 8) {
          setError(t.auth.passwordShort);
          return;
        }
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            body.error === "EMAIL_TAKEN" ? t.auth.emailTaken : t.common.somethingWrong
          );
          return;
        }
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError(t.auth.invalid);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  const socials = [
    providers.google ? { id: "google", label: t.auth.withGoogle } : null,
    providers.facebook ? { id: "facebook", label: t.auth.withFacebook } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div>
      {socials.length > 0 ? (
        <>
          <div className="grid gap-2">
            {socials.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                size="lg"
                onClick={() => signIn(provider.id, { callbackUrl: next })}
              >
                {provider.label}
              </Button>
            ))}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            {t.auth.or}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        {mode === "signup" ? (
          <>
            <FormRow label={t.auth.name} htmlFor="name">
              <Input id="name" value={form.name} onChange={set("name")} required autoComplete="name" />
            </FormRow>
            <FormRow label={t.auth.phone} htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={set("phone")}
                required
                autoComplete="tel"
                dir="ltr"
              />
            </FormRow>
          </>
        ) : null}

        <FormRow label={t.auth.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            autoComplete="email"
            dir="ltr"
          />
        </FormRow>

        <FormRow label={t.auth.password} htmlFor="password">
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            dir="ltr"
          />
        </FormRow>

        {error ? <p className="mb-3 text-sm font-semibold text-bad">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? t.common.loading : mode === "signup" ? t.auth.signup : t.auth.login}
        </Button>
      </form>

      <TatreezDivider className="my-6" />

      <div className="text-center text-sm">
        {mode === "signup" ? (
          <p className="text-ink-soft">
            {t.auth.haveAccount}{" "}
            <Link href="/login" className="font-semibold text-gold-deep hover:underline">
              {t.auth.login}
            </Link>
          </p>
        ) : (
          <p className="text-ink-soft">
            {t.auth.noAccount}{" "}
            <Link href="/signup" className="font-semibold text-gold-deep hover:underline">
              {t.auth.signup}
            </Link>
          </p>
        )}
        <Link
          href="/"
          className="mt-3 inline-block font-semibold text-ink-soft hover:text-ink hover:underline"
        >
          {t.auth.continueGuest}
        </Link>
        <p className="mt-2 text-xs text-ink-faint">{t.auth.guestNote}</p>
      </div>
    </div>
  );
}
