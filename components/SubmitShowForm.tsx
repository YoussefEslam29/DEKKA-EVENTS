"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, FormRow } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surface";

const empty = {
  bandName: "",
  genre: "",
  contactName: "",
  email: "",
  phone: "",
  links: "",
  preferredDates: "",
  pitch: "",
};

/** The in-app replacement for the Google Form. No account required. */
export function SubmitShowForm() {
  const { t } = useI18n();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof empty) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // The textarea is one link per line; the API stores an array.
          links: form.links
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setError(t.common.somethingWrong);
        return;
      }
      setDone(true);
      setForm(empty);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <Check className="mx-auto h-10 w-10 text-good" />
        <h2 className="mt-3 text-xl font-bold">{t.submit.doneTitle}</h2>
        <p className="mt-2 text-ink-soft">{t.submit.doneBody}</p>
        <Button variant="outline" className="mt-5" onClick={() => setDone(false)}>
          {t.submit.another}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label={t.submit.bandName} htmlFor="bandName">
            <Input id="bandName" value={form.bandName} onChange={set("bandName")} required />
          </FormRow>
          <FormRow label={t.submit.genre} htmlFor="genre" hint={t.common.optional}>
            <Input id="genre" value={form.genre} onChange={set("genre")} />
          </FormRow>
          <FormRow label={t.submit.contactName} htmlFor="contactName">
            <Input
              id="contactName"
              value={form.contactName}
              onChange={set("contactName")}
              required
            />
          </FormRow>
          <FormRow label={t.submit.email} htmlFor="email">
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={set("email")}
              required
            />
          </FormRow>
          <FormRow label={t.submit.phone} htmlFor="phone" hint={t.common.optional}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={form.phone}
              onChange={set("phone")}
            />
          </FormRow>
          <FormRow
            label={t.submit.preferredDates}
            htmlFor="preferredDates"
            hint={t.common.optional}
          >
            <Input
              id="preferredDates"
              value={form.preferredDates}
              onChange={set("preferredDates")}
            />
          </FormRow>
        </div>

        <FormRow label={t.submit.links} htmlFor="links" hint={t.submit.linksHint}>
          <Textarea id="links" dir="ltr" value={form.links} onChange={set("links")} rows={3} />
        </FormRow>

        <FormRow label={t.submit.pitch} htmlFor="pitch">
          <Textarea id="pitch" value={form.pitch} onChange={set("pitch")} rows={5} />
        </FormRow>

        {error ? <p className="mb-3 text-sm font-semibold text-bad">{error}</p> : null}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.submit.sending : t.submit.send}
        </Button>
      </form>
    </Card>
  );
}
