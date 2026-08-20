import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label
      className={cn("block text-sm font-semibold text-ink-soft mb-1.5", className)}
      {...props}
    >
      {children}
      {hint ? (
        <span className="ms-1.5 font-normal text-ink-faint">({hint})</span>
      ) : null}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("dk-field", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("dk-field min-h-24", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("dk-field", className)} {...props} />;
}

/** Label + control + optional error, the layout every form on the site uses. */
export function FormRow({
  label,
  hint,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-sm text-bad">{error}</p> : null}
    </div>
  );
}
