"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";

/**
 * The route-level error boundary — a throw during render anywhere under the root
 * layout. It was called `GlobalError`, which is the name of a *different* Next.js
 * boundary (`app/global-error.tsx`, which catches the root layout itself failing).
 * Renamed so the two aren't confused now that both exist.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-24 text-center md:px-8">
      <p className="text-lg font-semibold">{t.common.somethingWrong}</p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        {t.common.tryAgain}
      </Button>
    </div>
  );
}
