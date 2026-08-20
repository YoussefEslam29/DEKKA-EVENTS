"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-24 text-center md:px-8">
      <p className="text-lg font-semibold">{t.common.somethingWrong}</p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        {t.common.tryAgain}
      </Button>
    </div>
  );
}
