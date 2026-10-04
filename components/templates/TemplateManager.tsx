"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import { KIND_ICON } from "@/components/templates/TemplateLauncher";
import { TemplateForm } from "@/components/templates/TemplateForm";
import { formatMoney, formatTimeOfDay } from "@/lib/format";
import type { EventTemplateDTO } from "@/lib/data";

const ICON_BTN =
  "dk-icon-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] disabled:pointer-events-none disabled:opacity-40";

/**
 * `/admin/templates` (`PLAN/DEKKA_PWA_APP.md` §4): the saved nights and
 * activities, in the order their buttons appear on the events pages. Reorder,
 * edit, delete, or start a new one from scratch.
 *
 * Same state approach as `MenuManager`: local and optimistic for moves, the
 * server's answer lands afterwards, and a stale reorder re-fetches the page.
 */
export function TemplateManager({ initial }: { initial: EventTemplateDTO[] }) {
  const { t, locale } = useI18n();
  const tt = t.templates;
  const router = useRouter();

  const [templates, setTemplates] = useState(initial);
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setTemplates(initial);
  }
  const [editing, setEditing] = useState<{ template?: EventTemplateDTO } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [editing]);

  const name = (tpl: EventTemplateDTO) =>
    locale === "ar" ? tpl.nameAr || tpl.nameEn : tpl.nameEn || tpl.nameAr;

  async function move(index: number, delta: -1 | 1) {
    const next = [...templates];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setTemplates(next);
    try {
      const res = await fetch("/api/event-templates/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((tpl) => tpl.id) }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setNotice(tt.staleOrder);
      router.refresh();
    }
  }

  async function remove(tpl: EventTemplateDTO) {
    if (!window.confirm(tt.deleteConfirm.replace("{name}", name(tpl)))) return;
    const res = await fetch(`/api/event-templates/${tpl.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok && res?.status !== 404) {
      setNotice(t.common.somethingWrong);
      return;
    }
    setTemplates((list) => list.filter((x) => x.id !== tpl.id));
  }

  function onSaved(saved: EventTemplateDTO) {
    setTemplates((list) =>
      list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]
    );
    setEditing(null);
    setNotice(null);
  }

  return (
    <div>
      <PageHeader
        title={tt.title}
        subtitle={tt.subtitle}
        action={
          <Button type="button" variant="lightPrimary" className="h-11" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" aria-hidden />
            {tt.newTemplate}
          </Button>
        }
      />

      {notice ? (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-[4px] border border-bad/30 bg-bad/5 px-3 py-2 text-sm font-semibold text-bad"
        >
          <span className="pt-2.5">{notice}</span>
          <button type="button" className={ICON_BTN} aria-label={t.push.dismiss} onClick={() => setNotice(null)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div ref={formRef} className="scroll-mt-24">
        {editing ? (
          <TemplateForm
            key={editing.template?.id ?? "new"}
            template={editing.template}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState>{tt.empty}</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {templates.map((tpl, index) => {
            const Icon = KIND_ICON[tpl.kind];
            return (
              <div key={tpl.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 text-gold-deep" aria-hidden />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-bold">
                    {name(tpl)}
                    <Badge className="ms-2 align-middle">{tt.kind[tpl.kind]}</Badge>
                  </p>
                  <p className="dk-muted text-sm">
                    {tt.usually.replace("{time}", formatTimeOfDay(tpl.defaultTime, locale))}
                    {" · "}
                    {tpl.price > 0 ? `${formatMoney(tpl.price, locale)} ${t.common.egp}` : t.common.free}
                  </p>
                </div>
                <div className="ms-auto flex items-center">
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label={tt.moveUp}
                    title={tt.moveUp}
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label={tt.moveDown}
                    title={tt.moveDown}
                    disabled={index === templates.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label={`${t.common.edit}: ${name(tpl)}`}
                    title={t.common.edit}
                    onClick={() => setEditing({ template: tpl })}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BTN} hover:bg-bad/10 hover:text-bad`}
                    aria-label={`${t.common.delete}: ${name(tpl)}`}
                    title={t.common.delete}
                    onClick={() => void remove(tpl)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
