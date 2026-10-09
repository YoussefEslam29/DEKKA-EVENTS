"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { leaveDemo } from "@/components/DemoRibbon";

/**
 * Starts demo mode on this device (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.3): for pitching the
 * app with sample nights, menu and numbers while the database receives nothing.
 */
export function DemoModeCard({ on }: { on: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (res.ok) {
        // To the guest view; the refresh re-renders the shared layout too, so the ribbon shows.
        router.push("/");
        router.refresh();
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
      <FlaskConical className="h-6 w-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="font-bold">{t.demo.cardTitle}</h2>
        <p className="dk-muted text-sm">{on ? t.demo.on : t.demo.cardBody}</p>
        {failed ? (
          <p role="alert" className="mt-1 text-sm font-semibold text-bad">
            {t.common.somethingWrong}
          </p>
        ) : null}
      </div>
      {on ? (
        <Button type="button" variant="lightOutline" className="min-h-11" onClick={leaveDemo}>
          {t.demo.leave}
        </Button>
      ) : (
        <Button type="button" variant="lightPrimary" className="min-h-11" onClick={start} disabled={busy}>
          {t.demo.start}
        </Button>
      )}
    </Card>
  );
}
