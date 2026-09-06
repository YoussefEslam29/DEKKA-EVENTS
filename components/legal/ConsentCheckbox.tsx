"use client";

import { useI18n } from "@/components/I18nProvider";
import { ConsentText } from "@/components/legal/ConsentText";

/**
 * The required agree-to-the-terms checkbox on signup and the band-pitch form.
 *
 * Markup follows the checkbox already in `EventForm` — the only change is the
 * accent token, since that one lives in the cream workspace and these two forms
 * are on the dark public theme.
 */
export function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="mb-4 flex items-start gap-2 text-sm leading-relaxed text-text-muted">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        <ConsentText prefix={t.legal.consent.checkboxPrefix} />
      </span>
    </label>
  );
}
