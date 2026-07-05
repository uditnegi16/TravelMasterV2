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
    "bg-ink text-white hover:bg-black shadow-soft active:scale-[0.98]",
  secondary:
    "bg-brand text-white hover:bg-brand-hover shadow-soft active:scale-[0.98]",
  outline:
    "bg-white text-ink border border-border-strong hover:border-ink/40 hover:bg-surface-subtle active:scale-[0.98]",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-base rounded-xl gap-2",
  lg: "h-[3.25rem] px-7 text-md rounded-xl gap-2.5",
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
          "inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-150 ease-out disabled:opacity-40 disabled:pointer-events-none focus-ring",
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
