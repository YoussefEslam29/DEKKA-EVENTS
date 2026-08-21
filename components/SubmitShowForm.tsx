"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Surface";

/** Maps a bilingual pair onto the label props the field components expect. */
function labels(pair: { en: string; ar: string }) {
  return { labelEn: pair.en, labelAr: pair.ar };
}

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
  const { t, bi } = useI18n();
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
        <p className="mt-2 text-text-muted">{t.submit.doneBody}</p>
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
          <TextField
            name="bandName"
            {...labels(bi((d) => d.submit.bandName))}
            value={form.bandName}
            onChange={set("bandName")}
            required
          />
          <TextField
            name="genre"
            {...labels(bi((d) => d.submit.genre))}
            value={form.genre}
            onChange={set("genre")}
          />
          <TextField
            name="contactName"
            {...labels(bi((d) => d.submit.contactName))}
            value={form.contactName}
            onChange={set("contactName")}
            required
          />
          <TextField
            name="email"
            type="email"
            dir="ltr"
            {...labels(bi((d) => d.submit.email))}
            value={form.email}
            onChange={set("email")}
            required
          />
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            {...labels(bi((d) => d.submit.phone))}
            value={form.phone}
            onChange={set("phone")}
          />
          <TextField
            name="preferredDates"
            {...labels(bi((d) => d.submit.preferredDates))}
            value={form.preferredDates}
            onChange={set("preferredDates")}
          />
        </div>

        <TextAreaField
          name="links"
          dir="ltr"
          rows={3}
          hint={t.submit.linksHint}
          {...labels(bi((d) => d.submit.links))}
          value={form.links}
          onChange={set("links")}
        />

        <TextAreaField
          name="pitch"
          rows={5}
          {...labels(bi((d) => d.submit.pitch))}
          value={form.pitch}
          onChange={set("pitch")}
        />

        {error ? <p className="mb-3 text-sm font-semibold text-bad">{error}</p> : null}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.submit.sending : t.submit.send}
        </Button>
      </form>
    </Card>
  );
}
