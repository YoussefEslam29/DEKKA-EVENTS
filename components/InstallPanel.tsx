"use client";

import { useEffect } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { countOnce } from "@/lib/stats-client";
import { useI18n } from "@/components/I18nProvider";
import { useInstallState } from "@/components/InstallPrompt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";

/**
 * The body of `/get-app` — the page every "Get the app" link points at, and the
 * natural target for a QR code on a cafe table later (DEKKA_PWA_APP.md §5).
 *
 * Both platforms' steps are always shown: people use this page to help a friend
 * on the other kind of phone. The visitor's own platform just comes first, and
 * Chromium gets a real Install button on top.
 */
export function InstallPanel() {
  const { t } = useI18n();
  const { platform, canPrompt, install } = useInstallState();
  const g = t.app.getApp;

  // The install steps on screen count as the prompt shown (PLAN/DEKKA_PWA_APP.md §5.4).
  useEffect(() => {
    if (platform && platform !== "standalone") countOnce("install_prompt_shown");
  }, [platform]);

  if (platform === "standalone") {
    return (
      <Card className="flex items-center gap-3 p-5">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-good" aria-hidden />
        <p className="font-semibold">{g.installed}</p>
      </Card>
    );
  }

  const iphone = (
    <StepsCard
      key="iphone"
      title={g.iphoneTitle}
      steps={[g.iphoneStep1, g.iphoneStep2, g.iphoneStep3]}
    />
  );
  const android = (
    <StepsCard
      key="android"
      title={g.androidTitle}
      steps={[g.androidStep1, g.androidStep2, g.androidStep3]}
    />
  );

  return (
    <div className="grid gap-4">
      {canPrompt ? (
        <Button type="button" size="lg" className="h-14 w-full rounded-2xl" onClick={install}>
          <Download className="h-5 w-5" aria-hidden />
          {t.app.install.button}
        </Button>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {platform === "ios" ? [iphone, android] : [android, iphone]}
      </div>
    </div>
  );
}

function StepsCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-accent">
        {title}
      </h2>
      <ol className="grid gap-3">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coffee text-xs font-bold text-gold-accent">
              {i + 1}
            </span>
            <span className="pt-0.5 text-on-dark">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
