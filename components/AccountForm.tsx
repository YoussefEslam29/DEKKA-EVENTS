"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Mail, Lock, User as UserIcon, Phone, Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { TextField, PasswordField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Surface";
import { DURATION, useMotionPresets } from "@/lib/motion";
import type { AccountDTO } from "@/lib/data";

type Props = { account: AccountDTO };

// Mirrors the server-side limit in app/api/uploads/route.ts — checked here
// too so an oversized file fails instantly instead of after a round trip.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Provider ids are brand names, identical in both languages (§3 typography
 * rule: a proper noun renders once, not bilingual-paired). "credentials"
 * is the one id that isn't a brand — it gets the translated label instead. */
const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
};

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

/**
 * `/account` (`PLAN/LOG_SIGN_AUTH_IN.md` §5b): profile photo, name/phone, a
 * read-only sign-in-methods line, and the set/change password action that
 * closes §4b's gap. Three `Card` sections, each mounting with `fadeUp` — the
 * same page-entry convention used everywhere else in the app.
 */
export function AccountForm({ account }: Props) {
  const { t, bi } = useI18n();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { fadeUp, reduced } = useMotionPresets();

  // --- Photo ---------------------------------------------------------
  const [image, setImage] = useState(account.image);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared by upload and remove: writes the new image, then refreshes the
  // session (so the navbar's AccountMenu picks up an updated photo/name the
  // same way it does after a profile save) and the server components on this
  // route.
  async function saveImage(url: string) {
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: url }),
    });
    if (!res.ok) throw new Error("save failed");
    setImage(url);
    await updateSession();
    router.refresh();
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the member re-pick the same file after a failed upload
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError(t.account.uploadTooBig);
      return;
    }

    setUploading(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setPhotoError(
          json.error === "Unsupported image type"
            ? t.account.uploadBadType
            : t.common.somethingWrong
        );
        return;
      }
      await saveImage(json.data.url as string);
    } catch {
      setPhotoError(t.common.somethingWrong);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    setPhotoError(null);
    try {
      await saveImage("");
    } catch {
      setPhotoError(t.common.somethingWrong);
    } finally {
      setUploading(false);
    }
  }

  // --- Name / phone ----------------------------------------------------
  const [profile, setProfile] = useState({ name: account.name, phone: account.phone });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const setProfileField =
    (key: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfile((p) => ({ ...p, [key]: e.target.value }));
      setProfileSaved(false);
    };

  async function onProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      if (!res.ok) {
        setProfileError(t.common.somethingWrong);
        return;
      }
      setProfileSaved(true);
      // The navbar's AccountMenu trigger shows the session's name, not a DB
      // read — update() re-runs the jwt callback (lib/auth.ts) so the new
      // name is in the cookie before refresh() re-renders the server tree.
      await updateSession();
      router.refresh();
    } catch {
      setProfileError(t.common.somethingWrong);
    } finally {
      setProfileBusy(false);
    }
  }

  // --- Password --------------------------------------------------------
  const [hasPassword, setHasPassword] = useState(account.hasPassword);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const setPwField =
    (key: keyof typeof pw) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setPw((f) => ({ ...f, [key]: e.target.value }));
      setPwSaved(false);
    };

  // Same rule as §2's confirm-password field on sign-up: non-empty and
  // equal, nothing more — no debounce, so it disappears the instant the
  // fields diverge.
  const passwordsMatch =
    pw.confirmPassword.length > 0 && pw.confirmPassword === pw.newPassword;
  const matchTransition = reduced
    ? { duration: 0 }
    : { duration: DURATION.press, ease: "easeOut" as const };

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);

    if (pw.newPassword.length < 8) {
      setPwError(t.auth.passwordShort);
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      setPwError(t.auth.passwordMismatch);
      return;
    }

    setPwBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Omitted entirely (not sent as an empty string) when there is no
          // password yet — the route treats a missing key as "nothing to
          // prove", matching §4b's no-current-password-step rule.
          currentPassword: hasPassword ? pw.currentPassword : undefined,
          newPassword: pw.newPassword,
          confirmPassword: pw.confirmPassword,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPwError(
          body.error === "CURRENT_PASSWORD_INVALID"
            ? t.account.currentPasswordInvalid
            : body.error === "PASSWORD_MISMATCH"
              ? t.auth.passwordMismatch
              : t.common.somethingWrong
        );
        return;
      }
      setHasPassword(true);
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwSaved(true);
    } catch {
      setPwError(t.common.somethingWrong);
    } finally {
      setPwBusy(false);
    }
  }

  const providerLabels = account.providers.map(
    (p) => PROVIDER_LABEL[p] ?? t.account.emailPassword
  );

  return (
    <div className="grid gap-6">
      {/* §5b items 1, 2, 5: photo, name/phone, and the read-only email. */}
      <Card variants={fadeUp} initial="hidden" animate="show" className="p-6">
        <h2 className="mb-4 text-lg font-bold">{t.account.profileTitle}</h2>

        <div className="mb-6 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border-dark bg-coffee">
            {image ? (
              <Image src={image} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gold-accent">
                {initials(account.name)}
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoFile}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? t.account.uploading : t.account.uploadPhoto}
              </Button>
              {image ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={handleRemovePhoto}
                >
                  {t.account.removePhoto}
                </Button>
              ) : null}
            </div>
            {photoError ? (
              <p className="mt-2 text-sm font-semibold text-bad">{photoError}</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={onProfileSubmit} noValidate>
          <TextField
            name="name"
            labelEn={bi((d) => d.auth.name).en}
            labelAr={bi((d) => d.auth.name).ar}
            icon={UserIcon}
            value={profile.name}
            onChange={setProfileField("name")}
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
            value={profile.phone}
            onChange={setProfileField("phone")}
            required
          />
          <TextField
            name="email"
            labelEn={bi((d) => d.auth.email).en}
            labelAr={bi((d) => d.auth.email).ar}
            icon={Mail}
            type="email"
            dir="ltr"
            value={account.email}
            disabled
            className="opacity-60"
          />

          {profileError ? (
            <p role="alert" className="mb-3 text-sm font-semibold text-bad">
              {profileError}
            </p>
          ) : null}
          {profileSaved ? (
            <p className="mb-3 text-sm font-semibold text-good">{t.account.profileSaved}</p>
          ) : null}

          <Button type="submit" size="lg" disabled={profileBusy}>
            {profileBusy ? t.common.saving : t.common.save}
          </Button>
        </form>
      </Card>

      {/* §5b item 3: read-only, so a member can see why the Google button
          linked instead of erroring (ties back to §4). */}
      <Card variants={fadeUp} initial="hidden" animate="show" className="p-6">
        <h2 className="mb-2 text-lg font-bold">{t.account.signInTitle}</h2>
        <p className="text-sm text-text-muted">
          {t.account.signedInWith}{" "}
          <span className="font-semibold text-on-dark">{providerLabels.join(", ")}</span>
        </p>
      </Card>

      {/* §4b + §5b item 4: set (no current-password step) or change
          (current password required) — the branch is driven by whether the
          account already has a passwordHash. */}
      <Card variants={fadeUp} initial="hidden" animate="show" className="p-6">
        <h2 className="mb-1 text-lg font-bold">
          {hasPassword ? t.account.changePasswordTitle : t.account.setPasswordTitle}
        </h2>
        {!hasPassword ? (
          <p className="mb-4 text-sm text-text-muted">{t.account.setPasswordHint}</p>
        ) : (
          <div className="mb-4" />
        )}

        <form onSubmit={onPasswordSubmit} noValidate>
          {hasPassword ? (
            <PasswordField
              name="currentPassword"
              labelEn={bi((d) => d.account.currentPassword).en}
              labelAr={bi((d) => d.account.currentPassword).ar}
              icon={Lock}
              dir="ltr"
              value={pw.currentPassword}
              onChange={setPwField("currentPassword")}
              autoComplete="current-password"
              required
            />
          ) : null}

          <PasswordField
            name="newPassword"
            labelEn={bi((d) => d.account.newPassword).en}
            labelAr={bi((d) => d.account.newPassword).ar}
            icon={Lock}
            dir="ltr"
            value={pw.newPassword}
            onChange={setPwField("newPassword")}
            autoComplete="new-password"
            required
          />

          <div className="mb-4">
            <PasswordField
              name="confirmPassword"
              labelEn={bi((d) => d.auth.confirmPassword).en}
              labelAr={bi((d) => d.auth.confirmPassword).ar}
              icon={Lock}
              dir="ltr"
              value={pw.confirmPassword}
              onChange={setPwField("confirmPassword")}
              autoComplete="new-password"
              required
              containerClassName="mb-0"
            />
            {/* Identical pattern to AuthForm.tsx's confirm-password
                indicator (§2) — reused, not reinvented, so the app has one
                "this matches" visual language. */}
            <AnimatePresence>
              {passwordsMatch ? (
                <motion.span
                  key="match"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={matchTransition}
                  className="mt-1.5 inline-flex items-center gap-1 text-good"
                >
                  <Check aria-hidden className="h-4 w-4" />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          {pwError ? (
            <p role="alert" className="mb-3 text-sm font-semibold text-bad">
              {pwError}
            </p>
          ) : null}
          {pwSaved ? (
            <p className="mb-3 text-sm font-semibold text-good">{t.account.passwordUpdated}</p>
          ) : null}

          <Button type="submit" size="lg" disabled={pwBusy}>
            {pwBusy
              ? t.common.saving
              : hasPassword
                ? t.account.changePasswordButton
                : t.account.setPasswordButton}
          </Button>
        </form>
      </Card>
    </div>
  );
}
