import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { dictFor } from "@/lib/i18n";
import { enabledOAuthProviders } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { PatternAccent } from "@/components/ui/PatternAccent";

/**
 * Drop a real Dekka interior/event photo at one of these paths and the hero
 * picks it up automatically — no code change. §9.5 flagged that the mockup's
 * cafe photo was stock/generated, so until real photography exists the panel
 * falls back to a brand-derived treatment rather than shipping someone else's
 * café. §3 of LOG_SIGN_AUTH_IN.md adds one photo per mode on top of the
 * original shared file, so a single photo still improves both screens while
 * two photos lets login/signup diverge (calm counter shot vs. packed event
 * night, per the plan's suggested pairing).
 */
const HERO_FILE = "auth-hero.jpg";
const MODE_HERO_FILE: Record<"login" | "signup", string> = {
  login: "auth-hero-login.jpg",
  signup: "auth-hero-signup.jpg",
};
const MODE_HERO_ENV: Record<"login" | "signup", string | undefined> = {
  login: process.env.NEXT_PUBLIC_AUTH_HERO_LOGIN_IMAGE,
  signup: process.env.NEXT_PUBLIC_AUTH_HERO_SIGNUP_IMAGE,
};

/** One resolution tier: an env override, else a file check under `public/brand/`. */
function resolveHero(envValue: string | undefined, file: string): string | null {
  if (envValue) return envValue;
  const local = path.join(process.cwd(), "public", "brand", file);
  return fs.existsSync(local) ? `/brand/${file}` : null;
}

/**
 * Resolution order: mode-specific file/env → shared `auth-hero.jpg`/
 * `NEXT_PUBLIC_AUTH_HERO_IMAGE` → `null` (caller renders `BrandHeroFallback`).
 * With zero source images present (today's state) every tier misses and this
 * returns `null`, exactly as the single-file version did.
 */
function heroImage(mode: "login" | "signup"): string | null {
  return (
    resolveHero(MODE_HERO_ENV[mode], MODE_HERO_FILE[mode]) ??
    resolveHero(process.env.NEXT_PUBLIC_AUTH_HERO_IMAGE, HERO_FILE)
  );
}

/**
 * §4 desktop split screen (60/40) which collapses to §5's single dark column
 * below `lg`.
 */
export async function AuthScreen({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next: string;
}) {
  const photo = heroImage(mode);

  // §4: this panel is always bilingual — bold English line, lighter Arabic
  // beneath — regardless of the active locale, so both dictionaries are read
  // directly rather than the locale-switched one.
  const en = dictFor("en").authUi;
  const ar = dictFor("ar").authUi;
  const headlineEn = mode === "signup" ? en.heroSignupTitle : en.heroLoginTitle;
  const headlineAr = mode === "signup" ? ar.heroSignupTitle : ar.heroLoginTitle;
  const sublineEn = mode === "signup" ? en.heroSignupSub : en.heroLoginSub;

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[3fr_2fr]">
      {/* Left: ambient, full-bleed. Hidden on mobile per §5. */}
      <section className="relative hidden overflow-hidden lg:block">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            sizes="60vw"
            priority
            className="object-cover"
          />
        ) : (
          <BrandHeroFallback />
        )}

        {/* Gradient strongest at bottom-left, for legibility over the art. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,18,13,0.96)_0%,rgba(24,18,13,0.7)_35%,rgba(24,18,13,0.25)_70%,rgba(24,18,13,0.35)_100%)]"
        />

        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <PatternAccent className="mb-6 max-w-[140px] text-gold-accent/40" />
          <h2
            lang="en"
            dir="ltr"
            className="max-w-md text-4xl font-extrabold leading-tight text-cream xl:text-5xl"
          >
            {headlineEn}
          </h2>
          <p className="mt-3 max-w-md text-lg font-light text-cream/75">
            <span lang="ar" dir="rtl" className="font-arabic">
              {headlineAr}
            </span>
          </p>
          <p className="sr-only">{sublineEn}</p>
        </div>
      </section>

      {/* Right: the form panel — the whole screen on mobile. */}
      <section className="flex min-h-screen items-center justify-center bg-ink-black px-5 py-12 sm:px-8 lg:min-h-0 lg:px-10">
        <AuthForm mode={mode} next={next} providers={enabledOAuthProviders} />
      </section>
    </div>
  );
}

/**
 * Stand-in for the cafe photograph: warm pendant-light glow over deep coffee
 * tones, with the tatreez texture and the mark itself. Reads as an intentional
 * brand panel rather than an empty placeholder.
 */
function BrandHeroFallback() {
  return (
    <div aria-hidden className="absolute inset-0 bg-coffee">
      {/* Pendant-light pools, the warmest part of the reference photo. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_30%_12%,rgba(217,165,102,0.4)_0%,transparent_70%),radial-gradient(45%_35%_at_78%_30%,rgba(192,138,82,0.28)_0%,transparent_70%),radial-gradient(80%_60%_at_50%_100%,rgba(24,18,13,0.95)_0%,transparent_70%)]" />
      <PatternAccent variant="field" className="absolute inset-0 text-gold-accent/[0.07]" />
    </div>
  );
}
