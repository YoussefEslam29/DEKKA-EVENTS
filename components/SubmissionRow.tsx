"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/Surface";
import { Textarea } from "@/components/ui/Field";
import type { SubmissionDTO } from "@/lib/data";
import type { SubmissionStatus } from "@/lib/constants";

const tone = {
  pending: "warn",
  approved: "good",
  declined: "bad",
} as const;

/** One pitch in the inbox, with the approve/decline controls inline. */
export function SubmissionRow({ submission }: { submission: SubmissionDTO }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(submission.adminNote);
  const [open, setOpen] = useState(false);

  async function update(patch: { status?: SubmissionStatus; adminNote?: string }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 transition-colors hover:border-gold">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{submission.bandName}</h3>
            <Badge tone={tone[submission.status]}>
              {t.submit.status[submission.status]}
            </Badge>
            {submission.genre ? <Badge>{submission.genre}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {submission.contactName} ·{" "}
            <a href={`mailto:${submission.email}`} dir="ltr" className="hover:underline">
              {submission.email}
            </a>
            {submission.phone ? (
              <span dir="ltr"> · {submission.phone}</span>
            ) : null}
          </p>
          {submission.preferredDates ? (
            <p className="mt-1 text-sm text-ink-faint">{submission.preferredDates}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {submission.status !== "approved" ? (
            <Button size="sm" disabled={busy} onClick={() => update({ status: "approved" })}>
              {t.admin.approve}
            </Button>
          ) : null}
          {submission.status !== "declined" ? (
            <Button
              size="sm"
              variant="lightOutline"
              disabled={busy}
              onClick={() => update({ status: "declined" })}
            >
              {t.admin.decline}
            </Button>
          ) : null}
          {submission.status !== "pending" ? (
            <Button
              size="sm"
              variant="lightGhost"
              disabled={busy}
              onClick={() => update({ status: "pending" })}
            >
              {t.admin.reopen}
            </Button>
          ) : null}
        </div>
      </div>

      {submission.pitch ? (
        <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{submission.pitch}</p>
      ) : null}

      {submission.links.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {submission.links.map((link) => (
            <li key={link}>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1 text-sm font-semibold text-gold-deep hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {link.replace(/^https?:\/\//, "").slice(0, 48)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        {open ? (
          <>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.admin.adminNote}
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => update({ adminNote: note })}>
                {t.common.save}
              </Button>
              <Button size="sm" variant="lightGhost" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-ink-faint hover:text-ink"
          >
            {t.admin.adminNote}
            {submission.adminNote ? `: ${submission.adminNote}` : ""}
          </button>
        )}
      </div>
    </Card>
  );
}
