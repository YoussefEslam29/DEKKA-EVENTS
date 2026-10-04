"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { formatTimeOfDay } from "@/lib/format";
import { EVENT_TEMPLATE_KINDS, type EventTemplateKind } from "@/lib/constants";
import { templateFieldsFromEvent } from "@/lib/templates";
import type { EventDTO } from "@/lib/data";

/**
 * "Save as template" on an event's admin page (`PLAN/DEKKA_PWA_APP.md` §4) —
 * the quickest way to build the template library: every night already run is
 * one click away from being reusable.
 *
 * Captures the event *as saved* (the props, not any unsaved edits in the form
 * below) through `templateFieldsFromEvent`, the same field list the server uses
 * to make events from templates. The usual time is the time this event starts.
 * Sits in the page's wrapping action row; its small form takes a full line.
 */
export function SaveAsTemplateButton({ event }: { event: EventDTO }) {
  const { t, locale } = useI18n();
  const tt = t.templates;
  const captured = templateFieldsFromEvent(event);

  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState(event.titleAr);
  const [nameEn, setNameEn] = useState(event.titleEn);
  const [kind, setKind] = useState<EventTemplateKind>("night");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/event-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr, nameEn, kind, ...captured }),
      });
      if (!res.ok) {
        setError(t.common.somethingWrong);
        return;
      }
      setSaved(true);
      setOpen(false);
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="lightOutline"
        size="sm"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setSaved(false);
        }}
      >
        <BookmarkPlus className="h-4 w-4" aria-hidden />
        {tt.saveAsTemplate}
      </Button>

      {saved ? (
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-good">
          <Check className="h-4 w-4" aria-hidden />
          {tt.savedAsTemplate}
          <Link href="/admin/templates" className="ms-1 text-gold-deep underline">
            {tt.manage}
          </Link>
        </p>
      ) : null}

      {open ? (
        <form onSubmit={save} className="dk-card basis-full p-4">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormRow label={tt.templateNameAr} htmlFor="tpl-nameAr">
              <Input id="tpl-nameAr" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required maxLength={80} />
            </FormRow>
            <FormRow label={tt.templateNameEn} htmlFor="tpl-nameEn">
              <Input id="tpl-nameEn" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required maxLength={80} />
            </FormRow>
            <FormRow label={tt.kindLabel} htmlFor="tpl-kind">
              <Select id="tpl-kind" value={kind} onChange={(e) => setKind(e.target.value as EventTemplateKind)}>
                {EVENT_TEMPLATE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {tt.kind[k]}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label={tt.defaultTime}>
              <p className="dk-muted flex min-h-11 items-center text-sm">
                {formatTimeOfDay(captured.defaultTime, locale)}
              </p>
            </FormRow>
          </div>
          {error ? (
            <p role="alert" className="mb-3 text-sm font-semibold text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="lightPrimary" className="h-11" disabled={busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
            <Button type="button" variant="lightGhost" className="h-11" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
