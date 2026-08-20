"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Label } from "@/components/ui/Field";

/** Month selector for the earnings report; navigates rather than fetching. */
export function MonthPicker({ month }: { month: string }) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="max-w-[12rem]">
      <Label htmlFor="report-month">{t.admin.month}</Label>
      <input
        id="report-month"
        type="month"
        dir="ltr"
        className="dk-field"
        value={month}
        onChange={(e) => {
          if (e.target.value) router.push(`/admin/report?month=${e.target.value}`);
        }}
      />
    </div>
  );
}
