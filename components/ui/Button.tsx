import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The one button in the system. Square-ish corners, flat fills, no shadows —
 * see the brand notes in globals.css.
 */
export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-[4px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-ink text-cream hover:bg-ink-soft",
        gold: "bg-gold text-ink hover:bg-gold-deep hover:text-cream",
        outline: "border border-ink/25 bg-transparent text-ink hover:bg-gold-wash",
        ghost: "bg-transparent text-ink hover:bg-gold-wash",
        danger: "bg-bad text-cream hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
  );
}
