import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../../lib/cn";

type Variant = "default" | "filled" | "subtle";
type Size = "sm" | "md" | "lg";

interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  "aria-label": string;
}

const variantStyles: Record<Variant, string> = {
  default:
    "bg-white border border-border-strong text-ink-muted hover:text-ink hover:border-ink/30",

  filled:
    "bg-brand text-white hover:bg-brand-hover shadow-soft",

  subtle:
    "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-subtle",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4",

  md: "h-10 w-10 rounded-xl [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]",

  lg: "h-12 w-12 rounded-xl [&>svg]:h-5 [&>svg]:w-5",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      variant = "default",
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-all duration-150 ease-out active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40 focus-ring",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";