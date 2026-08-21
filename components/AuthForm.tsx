"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowRight, Mail, Lock, User, Phone } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { TextField, PasswordField } from "@/components/ui/TextField";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { BilingualLabel } from "@/components/ui/BilingualLabel";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { GoogleIcon, FacebookIcon, AppleIcon } from "@/components/BrandIcons";

export type OAuthAvailability = {
  google: boolean;
  facebook: boolean;
  apple: boolean;
};

type Props = {
  mode: "login" | "signup";
  next: string;
  providers: OAuthAvailability;
};

/**
 * The right-hand panel of the split auth screen (§4), which is also the whole
 * screen on mobile (§5). Guests are never blocked: §7's "Continue as Guest"
 * sits below the switch link — one tap away, but not competing with the
 * primary sign-in action.
 */
export function AuthForm({ mode, next, providers }: Props) {
  const { t, bi } = useI18n();
  const router = useRouter();
  const isSignup = mode === "signup";

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
      if (isSignup) {
        if (form.password.length < 8) {
          setError(t.auth.passwordShort);
          return;
        }
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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
    providers.google && {
      id: "google",
      short: "Google",
      full: bi((d) => d.auth.withGoogle),
      Icon: GoogleIcon,
    },
    providers.facebook && {
      id: "facebook",
      short: "Facebook",
      full: bi((d) => d.auth.withFacebook),
      Icon: FacebookIcon,
    },
    providers.apple && {
      id: "apple",
      short: "Apple",
      full: bi((d) => d.authUi.withApple),
      Icon: AppleIcon,
    },
  ].filter(Boolean) as {
    id: string;
    short: string;
    full: { en: string; ar: string };
    Icon: (p: { className?: string }) => React.ReactElement;
  }[];

  return (
    <div className="w-full max-w-[420px]">
      {/* 1. Logo badge — real mark on a cream plate, real "COFFEE SHOP" tagline. */}
      <div className="flex justify-center lg:justify-start">
        <LogoBadge size="md" tagline priority />
      </div>

      {/* 2. Heading — gold on the desktop panel, plain white on mobile per §5. */}
      <h1 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-on-dark lg:text-start lg:text-gold-accent">
        {isSignup ? t.authUi.createAccount : t.authUi.welcomeBack}
      </h1>
      <p className="mt-2 text-center text-sm text-text-muted lg:text-start">
        {isSignup ? t.authUi.createAccountSub : t.authUi.welcomeBackSub}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-7">
        {isSignup ? (
          <>
            <TextField
              name="name"
              labelEn={bi((d) => d.auth.name).en}
              labelAr={bi((d) => d.auth.name).ar}
              icon={User}
              value={form.name}
              onChange={set("name")}
              placeholder={t.authUi.namePlaceholder}
              autoComplete="name"
              required
            />
            <TextField
              name="phone"
              labelEn={bi((d) => d.auth.phone).en}
              labelAr={bi((d) => d.auth.phone).ar}
              icon={Phone}
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={form.phone}
              onChange={set("phone")}
              placeholder={t.authUi.phonePlaceholder}
              autoComplete="tel"
              required
            />
          </>
        ) : null}

        <TextField
          name="email"
          labelEn={bi((d) => d.auth.email).en}
          labelAr={bi((d) => d.auth.email).ar}
          icon={Mail}
          type="email"
          dir="ltr"
          value={form.email}
          onChange={set("email")}
          placeholder={t.authUi.emailPlaceholder}
          autoComplete="email"
          required
        />

        <PasswordField
          name="password"
          labelEn={bi((d) => d.auth.password).en}
          labelAr={bi((d) => d.auth.password).ar}
          icon={Lock}
          dir="ltr"
          value={form.password}
          onChange={set("password")}
          placeholder={t.authUi.passwordPlaceholder}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          // §4.4: "Forgot?" sits opposite the label.
          action={
            isSignup ? undefined : (
              <Link
                href="/login"
                className="text-xs font-semibold text-gold-accent hover:underline"
              >
                {t.authUi.forgotShort}
              </Link>
            )
          }
        />

        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm font-semibold text-bad"
          >
            {error}
          </p>
        ) : null}

        {/* 5. Primary action — gold gradient, full width, bilingual + arrow. */}
        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            t.common.loading
          ) : (
            <>
              <BilingualLabel
                {...(isSignup ? bi((d) => d.auth.signup) : bi((d) => d.authUi.signInLink))}
              />
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </>
          )}
        </Button>
      </form>

      {socials.length > 0 ? (
        <>
          {/* 6. Divider */}
          <SectionDivider label={t.authUi.orContinueWith} className="my-6" />

          {/* 7. Social buttons: side-by-side on mobile (§5), stacked on desktop (§4). */}
          <div
            className={
              socials.length > 1
                ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1"
                : "grid gap-3"
            }
          >
            {socials.map(({ id, short, full, Icon }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="lg"
                onClick={() => signIn(id, { callbackUrl: next })}
                aria-label={`${full.en} / ${full.ar}`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span className="lg:hidden">{short}</span>
                <span className="hidden lg:inline">
                  <BilingualLabel {...full} />
                </span>
              </Button>
            ))}
          </div>
        </>
      ) : null}

      {/* 8. Switch link, then 7's guest escape hatch below it. */}
      <div className="mt-7 text-center text-sm">
        <p className="text-text-muted">
          {isSignup ? t.authUi.haveAccountQ : t.authUi.newHere}{" "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-bold text-gold-accent hover:underline"
          >
            <BilingualLabel
              {...(isSignup ? bi((d) => d.authUi.signInLink) : bi((d) => d.authUi.signUpLink))}
            />
          </Link>
        </p>

        <Link
          href="/"
          className="mt-3 inline-block text-sm text-text-muted transition-colors hover:text-gold-accent"
        >
          <BilingualLabel {...bi((d) => d.authUi.guest)} />
        </Link>
      </div>

      {/* 9. Tatreez flourish, tying the form back to the brand mark. */}
      <PatternAccent className="mx-auto mt-8 max-w-[220px] text-tan-muted/25" />
    </div>
  );
}
