import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "../../../lib/cn";
type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover shadow-card hover:shadow-raised active:scale-[0.98]",

  secondary:
    "bg-ink text-white hover:bg-black shadow-soft active:scale-[0.98]",

  outline:
    "bg-white text-ink border border-border hover:border-brand hover:text-brand hover:shadow-soft active:scale-[0.98]",

  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-subtle hover:text-ink",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-10 px-4 rounded-xl text-sm gap-2",

  md: "h-12 px-6 rounded-2xl text-base gap-2",

  lg: "h-14 px-8 rounded-2xl text-md gap-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      fullWidth,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold tracking-[-0.01em] btn-transition disabled:opacity-40 disabled:pointer-events-none focus-ring",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {icon && iconPosition === "left" && (
          <span className="inline-flex shrink-0">{icon}</span>
        )}
        {children}
        {icon && iconPosition === "right" && (
          <span className="inline-flex shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
