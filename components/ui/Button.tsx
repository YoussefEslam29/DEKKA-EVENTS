import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * One button across both themes.
 *
 * `gold` is the §6 PrimaryButton — the gradient fill with dark text.
 * `outline` is the §6 OutlineButton used for social auth and secondary actions.
 * The `light*` variants serve the cream staff/admin workspace.
 */
export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-black",
  {
    variants: {
      variant: {
        // Primary: gold gradient, dark ink text (§4.5)
        gold: "bg-[image:var(--dk-gold-gradient)] text-ink-black hover:brightness-105 active:brightness-95",
        // Social / secondary on dark (§4.7)
        outline:
          "border border-border-dark bg-surface-dark text-on-dark hover:border-gold-accent/60 hover:bg-coffee",
        ghost: "bg-transparent text-on-dark hover:bg-surface-dark",
        dark: "bg-coffee text-on-dark hover:bg-surface-dark",
        danger: "bg-bad text-white hover:brightness-110",
        // Cream workspace variants
        lightPrimary: "bg-ink text-cream hover:bg-ink-soft focus-visible:ring-offset-cream",
        lightOutline:
          "border border-ink/25 bg-transparent text-ink hover:bg-gold-wash focus-visible:ring-offset-cream",
        lightGhost: "bg-transparent text-ink hover:bg-gold-wash focus-visible:ring-offset-cream",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-lg",
        md: "h-10 px-4 text-sm rounded-xl",
        lg: "h-12 px-6 text-base rounded-xl",
        pill: "h-13 px-6 text-base rounded-full",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
  );
}
