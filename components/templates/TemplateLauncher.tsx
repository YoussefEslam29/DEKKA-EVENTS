"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { FormRow, Input } from "@/components/ui/Field";
import { formatMoney, formatTimeOfDay } from "@/lib/format";
import { isRealDate } from "@/lib/templates";
import type { EventTemplateDTO } from "@/lib/data";
import { cn } from "@/lib/utils";

export const KIND_ICON = { night: Moon, activity: Sun } as const;

/**
 * "Pick a night, pick a date" (`PLAN/DEKKA_PWA_APP.md` §4) — the row of saved
 * templates at the top of `/admin/events` and `/admin/events/new`.
 *
 * Tap a template, check the date (today, or the calendar day you came from) and
 * the time (the template's usual one), press Create: the server builds a draft
 * from the stored template and you land on it, ready to swap the poster and
 * publish. Nothing to retype.
 */
export function TemplateLauncher({
  templates,
  initialDate,
}: {
  templates: EventTemplateDTO[];
  /** "YYYY-MM-DD" in cafe time, computed on the server so both renders agree. */
  initialDate: string;
}) {
  const { t, locale } = useI18n();
  const tt = t.templates;
  const router = useRouter();

  const [selected, setSelected] = useState<EventTemplateDTO | null>(null);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(template: EventTemplateDTO) {
    const same = selected?.id === template.id;
    setSelected(same ? null : template);
    setTime(template.defaultTime);
    setError(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!isRealDate(date)) {
      setError(tt.pickDate);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, date, time }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/admin/events/${body.data.id}`);
        return;
      }
      if (body.error === "TEMPLATE_NOT_FOUND") {
        setError(tt.notFound);
        setSelected(null);
        router.refresh();
      } else {
        setError(body.error === "INVALID_DATE" || body.error === "Validation failed" ? tt.pickDate : t.common.somethingWrong);
      }
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  const label = (template: EventTemplateDTO) =>
    locale === "ar" ? template.nameAr || template.nameEn : template.nameEn || template.nameAr;

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
          {tt.quickTitle}
        </h2>
        <Link
          href="/admin/templates"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-deep hover:underline"
        >
          {tt.manage}
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="dk-muted text-sm">{tt.quickHint}</p>
      ) : (
        <div role="group" aria-label={tt.quickTitle} className="flex flex-wrap gap-2">
          {templates.map((template) => {
            const Icon = KIND_ICON[template.kind];
            const active = selected?.id === template.id;
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={active}
                onClick={() => pick(template)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-[4px] border px-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-ink bg-ink text-cream"
                    : "border-line bg-paper text-ink hover:border-gold hover:bg-gold-wash"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label(template)}
                <span className={cn("text-xs font-normal", active ? "text-cream/80" : "text-ink-faint")}>
                  {formatTimeOfDay(template.defaultTime, locale)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <form onSubmit={create} className="dk-hairline mt-4 border-t pt-4">
          <p className="mb-3 font-semibold">
            {locale === "ar" ? selected.titleAr || selected.titleEn : selected.titleEn || selected.titleAr}
            <span className="dk-muted font-normal">
              {" · "}
              {selected.price > 0 ? `${formatMoney(selected.price, locale)} ${t.common.egp}` : t.common.free}
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-x-3">
            <FormRow label={t.event.date} htmlFor="template-date">
              <Input
                id="template-date"
                type="date"
                dir="ltr"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="min-h-11"
              />
            </FormRow>
            <FormRow label={t.event.time} htmlFor="template-time">
              <Input
                id="template-time"
                type="time"
                dir="ltr"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="min-h-11"
              />
            </FormRow>
            <div className="mb-4">
              <Button type="submit" variant="lightPrimary" className="h-11" disabled={busy}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
                {busy ? tt.creating : tt.create}
              </Button>
            </div>
          </div>
          <p className="dk-muted -mt-1 text-xs">{tt.draftNote}</p>
          {error ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}
