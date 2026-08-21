"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BilingualLabel } from "@/components/ui/BilingualLabel";
import { useI18n } from "@/components/I18nProvider";

type BaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  /** Bilingual label halves — §3's `English / العربية` pattern. */
  labelEn: string;
  labelAr: string;
  icon?: LucideIcon;
  error?: string;
  /** Rendered opposite the label, e.g. the "Forgot?" link. */
  action?: React.ReactNode;
  containerClassName?: string;
};

/**
 * Email, phone and password inputs carry `dir="ltr"` because their content is
 * Latin/numeric. The affordances around them must follow the *input's*
 * direction, not the page's, otherwise `start`/`end` resolve against the RTL
 * layout and the leading icon lands on the right while text starts on the left.
 */
function useFieldDir(dir: React.HTMLAttributes<HTMLElement>["dir"]) {
  return dir === "ltr" || dir === "rtl" ? dir : undefined;
}

/**
 * §6 `TextField` — bilingual label above a dark rounded input with an optional
 * leading icon. §5 recommends keeping the icons on desktop as well as mobile so
 * there is a single shared input component, which is what this is.
 */
export function TextField({
  labelEn,
  labelAr,
  icon: Icon,
  error,
  action,
  className,
  containerClassName,
  ...props
}: BaseProps) {
  const autoId = useId();
  const id = props.name ? `field-${props.name}` : autoId;
  const fieldDir = useFieldDir(props.dir);

  return (
    <div className={cn("mb-4", containerClassName)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-on-dark">
          <BilingualLabel en={labelEn} ar={labelAr} />
        </label>
        {action}
      </div>

      <div className="relative" dir={fieldDir}>
        {Icon ? (
          <Icon
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4.5 w-4.5 text-text-muted"
          />
        ) : null}
        <input
          id={id}
          className={cn("dk-field", Icon && "ps-11", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * §6 `PasswordField` — a TextField plus the trailing eye-icon visibility toggle
 * shown in both reference mockups.
 */
export function PasswordField({
  labelEn,
  labelAr,
  icon: Icon,
  error,
  action,
  className,
  containerClassName,
  ...props
}: BaseProps) {
  const { t } = useI18n();
  const autoId = useId();
  const id = props.name ? `field-${props.name}` : autoId;
  const fieldDir = useFieldDir(props.dir);
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("mb-4", containerClassName)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-on-dark">
          <BilingualLabel en={labelEn} ar={labelAr} />
        </label>
        {action}
      </div>

      <div className="relative" dir={fieldDir}>
        {Icon ? (
          <Icon
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4.5 w-4.5 text-text-muted"
          />
        ) : null}
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={cn("dk-field pe-11", Icon && "ps-11", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.authUi.hidePassword : t.authUi.showPassword}
          aria-pressed={visible}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-text-muted transition-colors hover:text-gold-accent focus-visible:outline-none focus-visible:text-gold-accent"
        >
          {visible ? (
            <EyeOff className="h-4.5 w-4.5" />
          ) : (
            <Eye className="h-4.5 w-4.5" />
          )}
        </button>
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type AreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  labelEn: string;
  labelAr: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

/** Textarea counterpart to `TextField`, so long-form fields keep §3's labels. */
export function TextAreaField({
  labelEn,
  labelAr,
  hint,
  error,
  className,
  containerClassName,
  ...props
}: AreaProps) {
  const autoId = useId();
  const id = props.name ? `field-${props.name}` : autoId;

  return (
    <div className={cn("mb-4", containerClassName)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-on-dark">
        <BilingualLabel en={labelEn} ar={labelAr} />
        {hint ? <span className="dk-muted ms-1.5 font-normal">({hint})</span> : null}
      </label>
      <textarea
        id={id}
        className={cn("dk-field min-h-24", className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <p className="mt-1.5 text-sm font-medium text-bad">{error}</p> : null}
    </div>
  );
}
