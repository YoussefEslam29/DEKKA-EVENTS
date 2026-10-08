"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { TextField, PasswordField } from "@/components/ui/TextField";

/**
 * "Your data" on `/account` (`PLAN/SITE_ROADMAP.md` F7): download a copy of everything
 * Dekka holds, or delete the account. These are the rights the privacy policy cites,
 * self-service instead of "email us". Deletion asks for the password, or for the
 * email when the account has no password, then signs out.
 */
export function AccountDataSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const { t, bi } = useI18n();
  const d = t.account.data;
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(d.confirmQuestion)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasPassword ? { password: proof } : { confirmEmail: proof.trim().toLowerCase() }),
      });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "WRONG_PASSWORD"
          ? d.wrongPassword
          : body.error === "EMAIL_MISMATCH"
            ? d.emailMismatch
            : body.error === "LAST_ADMIN"
              ? d.lastAdmin
              : res.status === 429
                ? t.errors.rateLimited
                : t.common.somethingWrong
      );
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold">{d.title}</h2>
      <p className="mt-1 text-sm text-text-muted">{d.body}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* A plain download link: the route answers with an attachment. */}
        <a href="/api/account/export" download className={buttonStyles({ variant: "outline", className: "min-h-11" })}>
          <Download className="h-4 w-4" aria-hidden />
          {d.export}
        </a>
        {!open ? (
          <Button variant="ghost" className="min-h-11 text-bad" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {d.deleteTitle}
          </Button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={remove} className="mt-5 rounded-xl border border-bad/40 bg-bad/5 p-4">
          <p className="mb-3 text-sm text-on-dark">{d.deleteBody}</p>
          {hasPassword ? (
            <PasswordField
              name="deletePassword"
              labelEn={bi((x) => x.account.data.passwordLabel).en}
              labelAr={bi((x) => x.account.data.passwordLabel).ar}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              autoComplete="current-password"
              required
            />
          ) : (
            <TextField
              name="deleteEmail"
              type="email"
              labelEn={bi((x) => x.account.data.emailLabel).en}
              labelAr={bi((x) => x.account.data.emailLabel).ar}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder={email}
              autoComplete="off"
              required
            />
          )}
          {error ? (
            <p role="alert" className="mb-3 text-sm font-semibold text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" className="min-h-11" disabled={busy || !proof}>
              {busy ? d.deleting : d.confirm}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)} disabled={busy}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
